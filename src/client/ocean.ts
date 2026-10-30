import { refractedEarthRadius } from '../shared/marine-visibility';
import { CoastalSurf } from './coastal-surf';
// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { terrainHeight } from '../shared/terrain';
import { waterLevel, oceanWeather, SWELLS, swell, waveImpact } from '../shared/ocean';
import { seaMaterial } from './sea-material';

/** Single-pass underwater extinction: nearby gear retains contrast; deep objects
 * converge to the water colour. No second scene render, screen-space depth pass,
 * or full-resolution framebuffer is needed on mobile GPUs. */
export class Ocean {
  readonly surf = new CoastalSurf();
  readonly level = { value: 0 };
  readonly tint = { value: new T.Color('#17454c') };
  readonly time = { value: 0 };
  readonly amplitude = { value: 0 };
  private patched = new WeakSet<T.Material>();
  mesh?: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
  private world?: World;
  private sampleX = Infinity;
  private sampleZ = Infinity;
  private samples = new Float32Array();
  private depthKeys = new Float64Array(131072).fill(NaN);
  private depthValues = new Float32Array(131072);
  private spray: T.Points;
  private drops = new Float32Array(192 * 3);
  private velocities = new Float32Array(192 * 3);
  private ages = new Float32Array(192).fill(10);
  private next = 0;
  private sprayBudget = 0;
  constructor() {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(this.drops, 3));
    this.spray = new T.Points(
      g,
      new T.PointsMaterial({
        color: '#def4f1',
        size: 0.23,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    );
    this.spray.frustumCulled = false;
    this.spray.visible = false;
    this.spray.name = 'Bow spray and storm deck wash';
  }
  get sprayObject() {
    return this.spray;
  }
  absorb(root: T.Object3D) {
    root.traverse((o) => {
      const m = (o as T.Mesh).material;
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
        if (
          this.patched.has(mat) ||
          mat.userData.oceanSurface ||
          mat instanceof T.ShaderMaterial ||
          mat instanceof T.SpriteMaterial
        )
          continue;
        this.patched.add(mat);
        const compile = mat.onBeforeCompile,
          key = mat.customProgramCacheKey();
        mat.onBeforeCompile = (shader, renderer) => {
          compile.call(mat, shader, renderer);
          shader.uniforms.oceanLevel = this.level;
          if (shader.uniforms.shore) shader.uniforms.shore = this.level;
          shader.uniforms.oceanTint = this.tint;
          const decl = 'varying vec3 vOceanPosition;\n';
          shader.vertexShader =
            decl +
            shader.vertexShader.replace(
              '#include <project_vertex>',
              `#include <project_vertex>
            vec4 oceanWorld = vec4(transformed,1.0);
            #ifdef USE_BATCHING
            oceanWorld = batchingMatrix * oceanWorld;
            #endif
            #ifdef USE_INSTANCING
            oceanWorld = instanceMatrix * oceanWorld;
            #endif
            vOceanPosition = (modelMatrix * oceanWorld).xyz;
            vec3 apparentWorld = vOceanPosition;
            vec2 horizonDelta = apparentWorld.xz-cameraPosition.xz;
            apparentWorld.y -= dot(horizonDelta,horizonDelta)/${(2 * refractedEarthRadius).toFixed(1)};
            mvPosition = viewMatrix * vec4(apparentWorld,1.0);
            gl_Position = projectionMatrix * mvPosition;`,
            );
          shader.fragmentShader =
            'uniform float oceanLevel;\nuniform vec3 oceanTint;\n' + decl + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <opaque_fragment>',
            `
            float submergedDepth = max(0.0, oceanLevel-vOceanPosition.y);
            float submergedPath = submergedDepth * length(cameraPosition-vOceanPosition) / max(.1,abs(cameraPosition.y-vOceanPosition.y));
            submergedPath = min(length(cameraPosition-vOceanPosition), submergedPath);
            float transmission = exp(-.32 * submergedPath);
            outgoingLight = mix(oceanTint, outgoingLight, transmission);
            #include <opaque_fragment>`,
          );
        };
        mat.customProgramCacheKey = () => key + '-ocean-extinction-curvature-v2';
        mat.needsUpdate = true;
      }
    });
  }
  create(w: World, low = false) {
    this.surf.reset();
    this.world = w;
    this.sampleX = Infinity;
    this.sampleZ = Infinity;
    this.depthKeys.fill(NaN);
    const n = low ? 64 : 96;
    const g = new T.PlaneGeometry(1, 1, n, n);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    // Four-metre near field, gently increasing spacing towards the fog horizon.
    const extent = (v: number) =>
      Math.sign(v) *
      (Math.abs(v) < 0.65 ? Math.abs(v) * 300 : 195 + ((Math.abs(v) - 0.65) / 0.35) ** 2 * 1205);
    for (let i = 0; i < p.count; i++) p.setXYZ(i, extent(p.getX(i) * 2), 0, extent(p.getZ(i) * 2));
    this.samples = new Float32Array(p.count);
    g.setAttribute('seaGround', new T.BufferAttribute(this.samples, 1));
    g.boundingSphere = new T.Sphere(new T.Vector3(), 2000);
    const m = seaMaterial();
    m.userData.oceanSurface = true;
    m.color.set('#327d87');
    m.roughness = 0.28;
    const waveCode = SWELLS.map(
      ([x, z, l, period, a, phase]) => `{
      float phase=dot(p,vec2(${x.toFixed(5)},${z.toFixed(5)}))*${((2 * Math.PI) / l).toFixed(7)}-oceanTime*${((2 * Math.PI) / period).toFixed(7)}+${phase.toFixed(5)};
      float a=oceanAmplitude*${a.toFixed(5)}*clamp(depth/3.0,0.0,1.0);
      wave.x+=a*sin(phase);
      wave.yz+=a*${((2 * Math.PI) / l).toFixed(7)}*vec2(${x.toFixed(5)},${z.toFixed(5)})*cos(phase);
    }`,
    ).join('\n');
    const funcs = `uniform float oceanTime;uniform float oceanAmplitude;uniform float oceanLevel;attribute float seaGround;varying vec3 vSeaWorld;varying float vSeaGround;
      vec3 oceanWave(vec2 p,float depth){vec3 wave=vec3(0.0);${waveCode}return wave;}`;
    const foamPixels = new Uint8Array(64 * 64 * 4);
    let seed = 712367;
    for (let i = 0; i < 64 * 64; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const v = seed >>> 24;
      foamPixels.set([v, v, v, 255], i * 4);
    }
    const foamTexture = new T.DataTexture(foamPixels, 64, 64);
    foamTexture.wrapS = foamTexture.wrapT = T.RepeatWrapping;
    foamTexture.magFilter = foamTexture.minFilter = T.LinearFilter;
    foamTexture.needsUpdate = true;
    m.addEventListener('dispose', () => foamTexture.dispose());
    const compile = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
      compile.call(m, shader, renderer);
      Object.assign(shader.uniforms, {
        oceanTime: this.time,
        oceanAmplitude: this.amplitude,
        oceanLevel: this.level,
        seaFoam: { value: foamTexture },
      });
      shader.vertexShader = funcs + '\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        vec2 oceanXZ=(modelMatrix*vec4(position,1.0)).xz;
        vec3 seaWave=oceanWave(oceanXZ,oceanLevel-seaGround);
        objectNormal=normalize(vec3(-seaWave.y,1.0,-seaWave.z));`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed.y+=seaWave.x;
        vSeaWorld=(modelMatrix*vec4(transformed,1.0)).xyz;vSeaGround=seaGround;`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec3 apparentSea=(modelMatrix*vec4(transformed,1.)).xyz;
        vec2 horizonDelta=apparentSea.xz-cameraPosition.xz;
        apparentSea.y-=dot(horizonDelta,horizonDelta)/${(2 * refractedEarthRadius).toFixed(1)};
        mvPosition=viewMatrix*vec4(apparentSea,1.);
        gl_Position=projectionMatrix*mvPosition;`,
      );
      shader.fragmentShader =
        'uniform sampler2D seaFoam;uniform float oceanTime;uniform float oceanAmplitude;uniform float oceanLevel;varying vec3 vSeaWorld;varying float vSeaGround;\n' +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float depth=oceanLevel-vSeaGround;
        // Moving surf bands follow the actual shore-depth contour, including tides.
        float fleck=smoothstep(.28,.7,texture2D(seaFoam,vSeaWorld.xz*.07+vec2(oceanTime*.012,0.0)).r);
        float surf=pow(max(0.0,sin(depth*3.8+oceanTime*2.0+fleck*.8)),5.0);
        surf*=smoothstep(0.0,.18,depth)*(1.0-smoothstep(.5,3.0+oceanAmplitude,depth));
        surf*=smoothstep(.02,.35,oceanAmplitude);
        surf*=.12+.88*fleck;
        float crest=smoothstep(.55,.9,(vSeaWorld.y-oceanLevel)/max(.01,oceanAmplitude));
        float foam=max(surf*.15,crest*smoothstep(.3,1.2,oceanAmplitude)*fleck);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.8,.91,.88),foam*.85);`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        'diffuseColor.a *= mix(0.55, 0.96, pow(seaGrazing, 2.0));',
        'diffuseColor.a *= max(foam*.9, mix(0.40, 0.97, pow(seaGrazing, 2.0)));',
      );
    };
    m.customProgramCacheKey = () => 'ocean-swell-foam-v1';
    this.mesh = new T.Mesh(g, m);
    this.mesh.name = 'Tidal ocean and breaking surf';
    // An opaque far-water bed closes the volume beyond the extinction distance.
    // It hides missing terrain tiles/the sky behind the water without another pass.
    const deepGeometry = new T.PlaneGeometry(2800, 2800);
    deepGeometry.rotateX(-Math.PI / 2);
    const deepMaterial = new T.MeshBasicMaterial({ color: this.tint.value });
    deepMaterial.color = this.tint.value;
    deepMaterial.userData.oceanSurface = true;
    const deepWater = new T.Mesh(deepGeometry, deepMaterial);
    deepWater.position.y = -16;
    deepWater.name = 'Optically deep water';
    this.mesh.add(deepWater);
    return this.mesh;
  }
  update(w: World, x: number, z: number, time: number, dt: number, light = 1) {
    this.world = w;
    this.level.value = waterLevel(w, time);
    this.time.value = time;
    this.amplitude.value = oceanWeather(w).amplitude;
    this.tint.value.setRGB(0.012, 0.07, 0.085).multiplyScalar(0.12 + 0.88 * light);
    if (this.mesh) {
      this.mesh.position.y = this.level.value;
      const cx = Math.round(x / 16) * 16,
        cz = Math.round(z / 16) * 16;
      if (cx !== this.sampleX || cz !== this.sampleZ) {
        this.sampleX = cx;
        this.sampleZ = cz;
        this.mesh.position.x = cx;
        this.mesh.position.z = cz;
        const p = this.mesh.geometry.attributes.position;
        for (let i = 0; i < p.count; i++)
          this.samples[i] = this.bathymetry(w, cx + p.getX(i), cz + p.getZ(i));
        this.mesh.geometry.attributes.seaGround.needsUpdate = true;
      }
    }
    let visible = false;
    for (let i = 0; i < this.ages.length; i++) {
      this.ages[i] += dt;
      if (this.ages[i] < 1.3) {
        visible = true;
        this.velocities[i * 3 + 1] -= 9.8 * dt;
        for (let k = 0; k < 3; k++) this.drops[i * 3 + k] += this.velocities[i * 3 + k] * dt;
      } else this.drops[i * 3 + 1] = -10000;
    }
    this.spray.visible = visible;
    this.spray.geometry.attributes.position.needsUpdate = true;
  }
  /** Reuse a bounded four-metre survey as the surface grid travels. Bilinear
   * interpolation avoids snapping the rendered shoreline to survey cells.
   * Physics continues sampling the exact terrain under each hull. */
  private bathymetry(w: World, x: number, z: number) {
    const ix = Math.floor(x / 4),
      iz = Math.floor(z / 4);
    const sample = (a: number, b: number) => {
      const key = (a + 32768) * 65536 + b + 32768;
      const index = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663)) & 131071;
      if (this.depthKeys[index] !== key) {
        this.depthKeys[index] = key;
        this.depthValues[index] = terrainHeight(w, a * 4, b * 4);
      }
      const h = this.depthValues[index];
      return h;
    };
    const tx = x / 4 - ix,
      tz = z / 4 - iz;
    return T.MathUtils.lerp(
      T.MathUtils.lerp(sample(ix, iz), sample(ix + 1, iz), tx),
      T.MathUtils.lerp(sample(ix, iz + 1), sample(ix + 1, iz + 1), tx),
      tz,
    );
  }
  height(x: number, z: number) {
    return (
      this.level.value +
      swell(
        x,
        z,
        this.time.value,
        this.amplitude.value,
        this.level.value - (this.world ? terrainHeight(this.world, x, z) : -100),
      ).height
    );
  }
  /** Keep trailing gear in the sea while the hull pitches; fairleads and deck
   * cargo stay attached. Rig animation regenerates these buffers each frame. */
  stabilizeRig(boat: T.Object3D) {
    const rig = boat.getObjectByName('Otter trawl, towing warps and catch');
    if (!rig) return;
    boat.updateMatrixWorld(true);
    const inverse = boat.matrixWorld.clone().invert(),
      yaw = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), boat.rotation.y);
    const point = new T.Vector3(),
      desired = new T.Vector3(),
      matrix = new T.Matrix4();
    const levelPoint = (p: T.Vector3) => {
      const weight = T.MathUtils.smoothstep(-p.z, 8, 18);
      if (!weight) return;
      desired.copy(p).applyQuaternion(yaw).add(boat.position);
      desired.y += this.height(desired.x, desired.z) - boat.position.y;
      desired.applyMatrix4(inverse);
      p.lerp(desired, weight);
    };
    rig.traverse((o) => {
      if (!o.visible) return;
      if (o instanceof T.InstancedMesh) {
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, matrix);
          point.setFromMatrixPosition(matrix);
          levelPoint(point);
          matrix.setPosition(point);
          o.setMatrixAt(i, matrix);
        }
        o.instanceMatrix.needsUpdate = true;
      } else if (o instanceof T.Mesh || o instanceof T.LineSegments) {
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          point.fromBufferAttribute(pos, i);
          levelPoint(point);
          pos.setXYZ(i, point.x, point.y, point.z);
        }
        pos.needsUpdate = true;
      }
    });
  }
  splash(boat: T.Object3D, speed: number, length: number, beam: number, dt: number, low = false) {
    if (!this.world) return;
    const { x, z } = boat.position,
      heading = boat.rotation.y;
    const impact = waveImpact(
      x,
      z,
      this.time.value,
      heading,
      speed,
      this.amplitude.value,
      this.level.value - terrainHeight(this.world, x, z),
    );
    this.sprayBudget += impact * dt * (low ? 15 : 60);
    const count = Math.min(24, Math.floor(this.sprayBudget));
    this.sprayBudget -= count;
    for (let j = 0; j < count; j++) {
      const i = this.next++ % this.ages.length,
        side = Math.sin(i * 17.13);
      const at = boat.localToWorld(new T.Vector3(side * beam * 0.35, 0.6, length * 0.46));
      this.ages[i] = 0;
      this.drops.set([at.x, at.y, at.z], i * 3);
      // Outboard fan and a little backwash across the working deck.
      this.velocities.set(
        [
          Math.cos(heading) * side * 3 - Math.sin(heading) * speed * 0.35,
          2 + impact * 1.6,
          -Math.sin(heading) * side * 3 - Math.cos(heading) * speed * 0.35,
        ],
        i * 3,
      );
    }
  }
}
