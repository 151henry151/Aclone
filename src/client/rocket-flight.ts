// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { noiseTexture } from './noise';
import { spaceportFlight } from '../shared/spaceport-flight';
import { spaceportScale, spaceportApron } from '../shared/building-shapes';
import { groundPuff, rocketExhaust } from './rocket-exhaust';
const noise = `uniform sampler2D plumeNoise;float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return texture2D(plumeNoise,(i+f+.5)/128.).r;} float fbm(vec2 p){return .55*noise(p)+.28*noise(p*2.07)+.17*noise(p*4.13);}`;
export class RocketFlight {
  readonly group = new T.Group();
  private flames: T.InstancedMesh;
  private smoke: T.InstancedMesh;
  private wash: T.InstancedMesh;
  private matrix = new T.Object3D();
  private flameMaterial: T.ShaderMaterial;
  private cloudMaterial: T.ShaderMaterial;
  constructor(readonly rocket: T.Group) {
    this.group.name = 'Rocket exhaust and pad clouds';
    this.group.userData.animatedFlight = true;
    this.flameMaterial = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      blending: T.AdditiveBlending,
      uniforms: { time: { value: 0 }, power: { value: 0 }, plumeNoise: { value: noiseTexture() } },
      vertexShader: `varying vec2 vUv;varying float altitude;
      void main(){vUv=uv;vec4 local=instanceMatrix*vec4(0.,position.y,0.,1.);altitude=local.y;
      vec4 c=modelViewMatrix*local;
      c.x+=position.x*length(instanceMatrix[0].xyz)*length(modelMatrix[0].xyz);
      gl_Position=projectionMatrix*c;}`,
      fragmentShader: `varying vec2 vUv;varying float altitude;uniform float time,power;${noise}
      void main(){if(altitude<.24)discard;float t=1.-vUv.y;
      float n=fbm(vec2(vUv.x*9.,t*18.-time*10.));
      float width=(.3+.55*smoothstep(0.,.55,t))*(1.-smoothstep(.72,1.,t));
      float edge=abs(vUv.x*2.-1.)+.11*(n-.5)*sqrt(t);
      float a=(1.-smoothstep(width*.55,width+.04,edge))*smoothstep(0.,.08,vUv.y)*power;
      float core=(1.-smoothstep(width*.15,width*.75,edge))*(1.-t*.7);
      vec3 c=mix(vec3(3.5,.85,.06),vec3(5.,4.6,3.6),clamp(core+.17*n,0.,1.));
      gl_FragColor=vec4(c,a*smoothstep(.24,1.4,altitude));}`,
    });
    // A continuous camera-facing turbulent jet, clipped by the pad rather than
    // squeezed into a short bulb as the rocket approaches the ground.
    const shape = new T.PlaneGeometry(2, 1);
    shape.translate(0, -0.5, 0);
    this.flames = new T.InstancedMesh(shape, this.flameMaterial, 6);
    this.flames.count = 0;
    this.flames.name = 'Engine jets';
    this.flames.frustumCulled = false;
    this.flames.renderOrder = 4;
    this.group.add(this.flames);
    this.cloudMaterial = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        time: { value: 0 },
        daylight: { value: 1 },
        plumeNoise: { value: noiseTexture() },
      },
      vertexShader: `attribute float puffOpacity;attribute float heat;attribute float seed;varying vec2 vUv;varying float alpha,warm,variation,heightAbovePad;void main(){vUv=uv;alpha=puffOpacity;warm=heat;variation=seed;vec4 c=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);float size=length(instanceMatrix[0].xyz)*length(modelMatrix[0].xyz);heightAbovePad=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).y-modelMatrix[3].y+size*(position.x*viewMatrix[1][0]+position.y*viewMatrix[1][1]);c.xy+=position.xy*size;gl_Position=projectionMatrix*c;}`,
      fragmentShader: `varying vec2 vUv;varying float alpha,warm,variation,heightAbovePad;uniform float time,daylight;${noise}
      void main(){
        if(alpha<.004)discard;
        vec2 q=vUv*2.-1.;if(dot(q,q)>1.4)discard;float angle=variation*6.283;
        vec2 uv=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*q;
        vec2 flow=vec2(variation*83.,variation*41.+time*(warm>.3?-1.3:.12));
        float n=fbm(uv*3.2+flow),fine=noise(uv*16.+flow);
        float radius=length(q)+.38*(n-.5)+.08*(fine-.5);
        float edge=1.-smoothstep(.62,1.,radius);
        float density=edge*(.7+.6*n);float a=alpha*density*smoothstep(0.,14.,heightAbovePad);
        if(a<.004)discard;
        // Small turbulent lobes instead of one shaded billiard ball per sprite.
        vec3 normal=normalize(vec3(q,sqrt(max(.03,1.-dot(q,q)))));
        float light=(.42+.58*max(0.,dot(normal,normalize(vec3(-.4,.65,.7)))))*(.7+.5*n);
        vec3 c=vec3(.93,.92,.89)*light*daylight;
        float glow=warm*(.65+.55*n);
        c=mix(c,vec3(2.4,.67,.075),clamp(glow,0.,1.));
        c=mix(c,vec3(4.,3.5,2.3),smoothstep(.67,1.,glow));
        gl_FragColor=vec4(c,a);
      }`,
    });
    this.smoke = this.puffs(180, 'Pad dust and steam');
    this.wash = this.puffs(160, 'Turbulent exhaust');
    this.wash.renderOrder = 3;
    this.group.add(this.smoke, this.wash);
    this.group.visible = false;
  }
  private puffs(count: number, name: string) {
    const geometry = new T.PlaneGeometry(1, 1);
    geometry.setAttribute(
      'puffOpacity',
      new T.InstancedBufferAttribute(new Float32Array(count), 1).setUsage(T.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'heat',
      new T.InstancedBufferAttribute(new Float32Array(count), 1).setUsage(T.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'seed',
      new T.InstancedBufferAttribute(
        Float32Array.from({ length: count }, (_, i) => (i * 0.61803398875) % 1),
        1,
      ),
    );
    const mesh = new T.InstancedMesh(geometry, this.cloudMaterial, count);
    mesh.count = 0;
    mesh.name = name;
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    return mesh;
  }
  private puff(
    mesh: T.InstancedMesh,
    i: number,
    x: number,
    y: number,
    z: number,
    size: number,
    alpha: number,
    heat: number,
  ) {
    const scale = spaceportScale;
    this.matrix.position.set(
      (spaceportApron.x + x) / scale,
      y / scale,
      (spaceportApron.z + z) / scale,
    );
    this.matrix.scale.setScalar(alpha > 0.004 ? size / scale : 0);
    this.matrix.rotation.set(0, 0, 0);
    this.matrix.updateMatrix();
    mesh.setMatrixAt(i, this.matrix.matrix);
    mesh.geometry.getAttribute('puffOpacity').setX(i, alpha);
    mesh.geometry.getAttribute('heat').setX(i, heat);
  }
  update(world: string, time: number, daylight = 1) {
    const f = spaceportFlight(world, time),
      e = rocketExhaust(f.elapsed),
      scale = spaceportScale;
    this.rocket.position.y = f.height / scale;
    this.rocket.visible = f.visible;
    // No distant-pad cloud on approach; retain already emitted puffs after cutoff.
    this.group.visible =
      (f.elapsed >= 0 && f.elapsed < 90) || (f.elapsed >= 250 && f.elapsed < 337);
    if (!this.group.visible) return;
    this.flameMaterial.uniforms.time.value = f.elapsed;
    this.flameMaterial.uniforms.power.value = f.thrust;
    this.cloudMaterial.uniforms.time.value = f.elapsed;
    this.cloudMaterial.uniforms.daylight.value = Math.max(0.04, Math.min(1, daylight));
    this.flames.visible = f.thrust > 0;
    this.smoke.count = 180;
    this.wash.count = 160;
    const length = e.length / scale;
    const nozzles = [
      [0, 0],
      [-1.3, -1.3],
      [1.3, -1.3],
      [-1.3, 1.3],
      [1.3, 1.3],
    ];
    nozzles.forEach(([dx, dz], i) => {
      this.matrix.position.set(
        spaceportApron.x / scale + dx,
        e.nozzle / scale,
        spaceportApron.z / scale + dz,
      );
      this.matrix.scale.set(
        1.6,
        Math.min(length, 5) * (0.97 + 0.03 * Math.sin(f.elapsed * 13 + i)),
        0.8,
      );
      this.matrix.rotation.set(0, i, 0);
      this.matrix.updateMatrix();
      this.flames.setMatrixAt(i, this.matrix.matrix);
    });
    this.matrix.position.set(
      spaceportApron.x / scale,
      (e.nozzle - 10) / scale,
      spaceportApron.z / scale,
    );
    this.matrix.scale.set(
      e.landing ? 3.5 : 8,
      Math.max(0.001, length - 10 / scale),
      e.landing ? 3.5 : 8,
    );
    this.matrix.rotation.set(0, 0, 0);
    this.matrix.updateMatrix();
    this.flames.setMatrixAt(5, this.matrix.matrix);
    this.flames.count = e.nozzle > 12 ? 6 : 5;
    this.flames.instanceMatrix.needsUpdate = true;
    let active = 0;
    for (let i = 0; i < 180; i++) {
      const p = groundPuff(f.elapsed, i, 180);
      active += Number(p.opacity > 0.004);
      this.puff(
        this.smoke,
        i,
        p.x,
        p.y,
        p.z,
        p.size,
        p.opacity * 1.6,
        Math.max(0, 1 - p.age / 6) * e.contact * 0.8,
      );
    }
    this.smoke.visible = active > 0;
    // Fast, expanding incandescent parcels turn radially along the pad once intercepted.
    for (let i = 0; i < 160; i++) {
      const t = (i / 160 + f.elapsed * (e.landing ? 1.8 : 0.72)) % 1,
        angle = i * 2.399963;
      const down = t * e.length;
      const onPad = down > e.nozzle - 2;
      const radius = (e.landing ? 2 : 4) + t * (e.landing ? 6 : 18);
      const radial = onPad ? radius + (down - e.nozzle + 2) * 0.9 : radius;
      this.puff(
        this.wash,
        i,
        Math.cos(angle) * radial,
        onPad ? 4 + radial * 0.08 : e.nozzle - down,
        Math.sin(angle) * radial,
        (e.landing ? 8 : 20) + t * (e.landing ? 16 : 55),
        f.thrust * Math.pow(1 - t, 0.6) * (onPad ? 0.65 : 0.8),
        onPad ? 0.75 * (1 - t) : 1 - t * 0.36,
      );
    }
    this.wash.visible = f.thrust > 0;
    for (const mesh of [this.smoke, this.wash]) {
      mesh.instanceMatrix.needsUpdate = true;
      (mesh.geometry.getAttribute('puffOpacity') as T.InstancedBufferAttribute).needsUpdate = true;
      (mesh.geometry.getAttribute('heat') as T.InstancedBufferAttribute).needsUpdate = true;
    }
    this.group.userData.groundPuffs = active;
    this.group.userData.groundContact = e.contact;
  }
}
