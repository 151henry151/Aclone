// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { waterLevel } from '../shared/ocean';
import { terrainHeight } from '../shared/terrain';
import { hash2, smoothstep } from '../shared/noise';
import { riverBanks, riverSurfacePoints } from '../shared/inland-water';

/** Static, bank-aligned water ribbons; small shared shader supplies moving ripples.
 * Split rivers into bounded meshes so distant/offscreen reaches cost no draw work. */
export class InlandWater {
  readonly group = new T.Group();
  private time = { value: 0 };
  private tide = { value: 0 };
  private datum = { value: 0 };
  private centre = { value: new T.Vector2() };
  private material?: T.MeshPhongMaterial;
  private bankMaterials: T.Material[] = [];
  private reaches: { mesh: T.Mesh; bounds: T.Box3; reach: number }[] = [];
  reset(w: World) {
    this.group.traverse((o) => {
      if (o instanceof T.Mesh) o.geometry.dispose();
    });
    this.material?.dispose();
    this.bankMaterials.forEach((m) => m.dispose());
    this.bankMaterials = [];
    this.group.clear();
    this.reaches = [];
    if (!w.northernIsland) return;
    this.datum.value = w.settings.seaLevel;
    const material = (this.material = new T.MeshPhongMaterial({
      color: 0x34514a,
      specular: 0xc5e2db,
      shininess: 110,
      transparent: true,
      opacity: 0.93,
      side: T.DoubleSide,
      depthWrite: false,
    }));
    material.onBeforeCompile = (shader) => {
      shader.uniforms.riverTime = this.time;
      shader.uniforms.riverTide = this.tide;
      shader.uniforms.riverDatum = this.datum;
      shader.uniforms.riverCentre = this.centre;
      shader.vertexShader =
        'varying vec2 riverUv;varying vec2 riverPosition;varying float riverFlow;varying float riverWaterDepth;attribute float riverDepth;attribute float riverSlope;uniform float riverTide;uniform float riverDatum;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\ntransformed.y+=riverTide*(1.-smoothstep(riverDatum,riverDatum+3.,position.y-.035));riverUv=uv;riverPosition=position.xz;riverFlow=smoothstep(.015,.16,riverSlope);riverWaterDepth=riverDepth;',
        );
      shader.fragmentShader =
        'varying vec2 riverUv;varying vec2 riverPosition;varying float riverFlow;varying float riverWaterDepth;uniform float riverTime;uniform vec2 riverCentre;\n' +
        shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
        float across=abs(riverUv.x*2.-1.);
        float depth=riverWaterDepth*(1.-across*across);
        float current=riverTime*(.6+riverFlow*2.8);
        float ripple=sin(riverUv.y*3.4-current*5.+sin(riverUv.x*33.))*.6+sin(riverUv.y*7.-current*8.+riverUv.x*51.)*.4;
        float riffle=pow(.5+.5*sin(riverUv.y*.065),8.);
        float broken=sin(riverUv.y*5.-current*8.+sin(riverUv.x*47.+riverUv.y*.4)*3.);
        float foam=smoothstep(.72,.98,broken)*riverFlow*riffle*(1.-smoothstep(.65,1.,across));
        diffuseColor.rgb=mix(vec3(.065,.115,.105),diffuseColor.rgb,smoothstep(0.,1.8,depth));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.65,.72,.68),foam*.75);
        diffuseColor.rgb+=vec3(.008,.012,.01)*ripple;
        float fresnel=pow(1.-abs(dot(normalize(vNormal),normalize(vViewPosition))),3.);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.22,.29,.30),.25+fresnel*.4);
        diffuseColor.a*=(.93+.07*smoothstep(0.,.8,depth))*(1.-smoothstep(750.,1000.,distance(riverPosition,riverCentre)));
        if(diffuseColor.a<.01) discard;`,
        );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        float ripples=(sin(riverUv.y*3.4-riverTime*3.+sin(riverUv.x*33.))*.012+sin(riverUv.y*7.-riverTime*5.+riverUv.x*51.)*.006)*(1.+riverFlow*2.);
        vec3 rx=cross(dFdy(-vViewPosition),normal), ry=cross(normal,dFdx(-vViewPosition));
        float det=dot(dFdx(-vViewPosition),rx);
        normal=normalize(abs(det)*normal-sign(det)*(dFdx(ripples)*rx+dFdy(ripples)*ry));`,
      );
    };
    const stone = new T.MeshLambertMaterial({ color: 0xffffff });
    this.bankMaterials.push(stone);
    stone.onBeforeCompile = (shader) => {
      shader.uniforms.bankCentre = this.centre;
      shader.vertexShader =
        'varying vec3 bankPosition;\n' +
        shader.vertexShader.replace(
          '#include <project_vertex>',
          `
        vec4 bankLocal=vec4(transformed,1.);
        #ifdef USE_INSTANCING
        bankLocal=instanceMatrix*bankLocal;
        #endif
        bankPosition=(modelMatrix*bankLocal).xyz;
        #include <project_vertex>`,
        );
      shader.fragmentShader =
        'varying vec3 bankPosition;uniform vec2 bankCentre;\n' +
        shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
        float visibility=1.-smoothstep(600.,850.,distance(bankPosition.xz,bankCentre));
        if(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)>visibility) discard;`,
        );
    };
    const add = (
      positions: number[],
      uv: number[],
      indices: number[],
      slopes: number[] = [],
      depths: number[] = [],
    ) => {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setAttribute(
        'riverSlope',
        new T.Float32BufferAttribute(
          slopes.length ? slopes : new Array(positions.length / 3).fill(0),
          1,
        ),
      );
      g.setAttribute(
        'riverDepth',
        new T.Float32BufferAttribute(
          depths.length ? depths : new Array(positions.length / 3).fill(2),
          1,
        ),
      );
      g.setIndex(indices);
      g.computeVertexNormals();
      g.computeBoundingSphere();
      const m = new T.Mesh(g, material);
      m.renderOrder = 2;
      this.group.add(m);
      g.computeBoundingBox();
      this.reaches.push({ mesh: m, bounds: g.boundingBox!, reach: 1000 });
    };
    for (const survey of w.northernIsland.rivers) {
      const river = { ...survey, points: riverSurfacePoints(survey.points) };
      const banks = riverBanks(river.points);
      let distance = 0;
      for (let start = 0; start < banks.length - 1; start += 160) {
        const end = Math.min(start + 160, banks.length - 1);
        const stones: { x: number; y: number; z: number; size: number; seed: number }[] = [];
        for (let i = start; i < end; i++) {
          const p = river.points[i],
            next = river.points[i + 1];
          const d = Math.hypot(next.x - p.x, next.z - p.z) || 1;
          const rough = smoothstep(0.025, 0.14, (p.level - next.level) / d);
          // Mostly texture-sized gravel. Scattered low cobbles in rapid reaches;
          // never continuous rows of metre-sized blocks along both banks.
          for (let j = 0; j < 3; j++) {
            const seed = hash2(i, j, w.northernIsland.seed + 72);
            if (seed > 0.018 + rough * 0.07) continue;
            const t = hash2(i, j, 83),
              side = hash2(i, j, 84) > 0.5 ? 1 : -1;
            const offset = (p.width / 2) * (0.75 + hash2(i, j, 85) * 0.42) * side;
            const x = p.x + (next.x - p.x) * t - ((next.z - p.z) / d) * offset;
            const z = p.z + (next.z - p.z) * t + ((next.x - p.x) / d) * offset;
            stones.push({
              x,
              z,
              y: terrainHeight(w, x, z),
              size: 0.09 + seed * 0.25 + rough * 0.12,
              seed,
            });
          }
        }
        const rockGeometry = new T.IcosahedronGeometry(1, 1);
        const rocks = new T.InstancedMesh(rockGeometry, stone, stones.length);
        const transform = new T.Object3D(),
          color = new T.Color();
        stones.forEach((p, i) => {
          transform.position.set(p.x, p.y + p.size * 0.2, p.z);
          transform.scale.set(p.size * (0.8 + p.seed * 0.5), p.size * 0.6, p.size);
          transform.rotation.set(p.seed * 0.6, p.seed * 13, p.seed * 0.4);
          transform.updateMatrix();
          rocks.setMatrixAt(i, transform.matrix);
          rocks.setColorAt(
            i,
            color.setRGB(0.1 + p.seed * 0.07, 0.12 + p.seed * 0.07, 0.09 + p.seed * 0.06),
          );
        });
        rocks.computeBoundingSphere();
        this.group.add(rocks);
        rocks.computeBoundingBox();
        this.reaches.push({ mesh: rocks, bounds: rocks.boundingBox!, reach: 850 });
        const positions: number[] = [],
          uv: number[] = [],
          indices: number[] = [],
          slopes: number[] = [],
          depths: number[] = [];
        for (let i = start; i <= Math.min(start + 160, banks.length - 1); i++) {
          const b = banks[i];
          const prev = river.points[Math.max(0, i - 1)],
            next = river.points[Math.min(river.points.length - 1, i + 1)];
          const slope =
            (prev.level - next.level) / Math.max(1, Math.hypot(next.x - prev.x, next.z - prev.z));
          slopes.push(slope, slope);
          depths.push(river.points[i].depth, river.points[i].depth);
          if (i > start)
            distance += Math.hypot(
              river.points[i].x - river.points[i - 1].x,
              river.points[i].z - river.points[i - 1].z,
            );
          positions.push(
            b.left.x,
            b.level + 0.035,
            b.left.z,
            b.right.x,
            b.level + 0.035,
            b.right.z,
          );
          uv.push(0, distance, 1, distance);
          const k = (i - start) * 2;
          if (i > start) indices.push(k - 2, k, k + 1, k - 2, k + 1, k - 1);
        }
        add(positions, uv, indices, slopes, depths);
      }
    }
    for (const p of w.northernIsland.ponds) {
      const positions = [p.x, p.level + 0.035, p.z],
        uv = [0.5, 0],
        indices: number[] = [];
      for (let i = 0; i <= 80; i++) {
        const a = (i / 80) * Math.PI * 2;
        positions.push(p.x + Math.cos(a) * p.rx, p.level + 0.035, p.z + Math.sin(a) * p.rz);
        uv.push((Math.cos(a) + 1) / 2, Math.sin(a) * p.rz);
        if (i) indices.push(0, i + 1, i);
      }
      add(positions, uv, indices);
    }
  }
  update(w: World, time: number, x: number, z: number) {
    this.time.value = time;
    this.tide.value = waterLevel(w, time) - w.settings.seaLevel;
    // Narrow channels need the streamed riverbed, not the coarse horizon mesh.
    // Fade with the local terrain coverage rather than drawing floating strips.
    this.centre.value.set(x, z);
    // Shader fading alone still submits distant geometry (and shades pixels
    // before discarding). Reject complete reaches on the CPU outside the fade.
    for (const { mesh, bounds, reach } of this.reaches) {
      const dx = Math.max(bounds.min.x - x, 0, x - bounds.max.x);
      const dz = Math.max(bounds.min.z - z, 0, z - bounds.max.z);
      mesh.visible = dx * dx + dz * dz <= reach * reach;
    }
  }
}
