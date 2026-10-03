// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { spaceportFlight } from '../shared/spaceport-flight';
import { spaceportScale, spaceportApron } from '../shared/building-shapes';
export class RocketFlight {
  readonly group = new T.Group();
  private flames: T.InstancedMesh;
  private smoke: T.InstancedMesh;
  private glow: T.Mesh;
  private matrix = new T.Object3D();
  private flameMaterial: T.ShaderMaterial;
  private smokeMaterial: T.ShaderMaterial;
  constructor(readonly rocket: T.Group) {
    this.group.name = 'Rocket exhaust and pad clouds';
    this.group.userData.animatedFlight = true;
    const noise = `float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}`;
    this.flameMaterial = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      blending: T.AdditiveBlending,
      uniforms: { time: { value: 0 }, power: { value: 0 } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 vUv;uniform float time;uniform float power;${noise}void main(){float n=noise(vec2(vUv.x*13.,vUv.y*9.-time*12.));float endFade=smoothstep(0.,.22,vUv.y);float pulse=.76+.24*n;vec3 color=mix(vec3(1.,.13,.012),vec3(1.,.76,.24),vUv.y);color=mix(color,vec3(1.,.96,.77),pow(vUv.y,4.));gl_FragColor=vec4(color*1.2,endFade*pulse*power*.48);}`,
    });
    // A long tapered plume: narrow at the nozzle, broad in its turbulent lower half.
    const shape = new T.LatheGeometry(
      [
        new T.Vector2(0, -1),
        new T.Vector2(0.3, -0.9),
        new T.Vector2(0.6, -0.55),
        new T.Vector2(0.48, -0.15),
        new T.Vector2(0.33, 0),
      ],
      20,
    );
    this.flames = new T.InstancedMesh(shape, this.flameMaterial, 5);
    this.flames.count = 0;
    this.flames.frustumCulled = false;
    this.group.add(this.flames);
    this.smokeMaterial = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { opacity: { value: 0 }, time: { value: 0 } },
      vertexShader: `varying vec2 vUv;varying float shade;void main(){vUv=uv;vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);float scale=length(instanceMatrix[0].xyz)*length(modelMatrix[0].xyz);center.xy+=position.xy*scale;gl_Position=projectionMatrix*center;shade=.7+.3*fract(instanceMatrix[3].x*13.);}`,
      fragmentShader: `varying vec2 vUv;varying float shade;uniform float opacity;uniform float time;${noise}void main(){vec2 q=vUv*2.-1.;float n=noise(vUv*5.+time*.07)*.6+noise(vUv*13.)*.25;float edge=1.-smoothstep(.42,.98,length(q)+.2*n);float a=edge*opacity*(.4+.5*n);if(a<.005)discard;vec3 c=mix(vec3(.32,.34,.34),vec3(.84,.82,.74),n)*shade;gl_FragColor=vec4(c,a);}`,
    });
    this.smoke = new T.InstancedMesh(new T.PlaneGeometry(1, 1), this.smokeMaterial, 120);
    this.smoke.count = 0;
    this.smoke.frustumCulled = false;
    this.smoke.renderOrder = 2;
    this.group.add(this.smoke);
    this.glow = new T.Mesh(
      new T.CircleGeometry(1, 48),
      new T.MeshBasicMaterial({
        color: '#ffb354',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.set(
      spaceportApron.x / spaceportScale,
      0.23,
      spaceportApron.z / spaceportScale,
    );
    this.group.add(this.glow);
    this.group.visible = false;
  }
  update(world: string, time: number) {
    const f = spaceportFlight(world, time),
      scale = spaceportScale,
      x = spaceportApron.x / scale,
      z = spaceportApron.z / scale;
    this.rocket.position.y = f.height / scale;
    this.rocket.visible = f.visible;
    this.group.visible = f.thrust > 0 || f.smoke;
    if (!this.group.visible) return;
    this.flameMaterial.uniforms.time.value = time;
    this.flameMaterial.uniforms.power.value = f.thrust;
    this.flames.count = 5;
    this.smoke.count = 120;
    this.flames.visible = f.thrust > 0;
    const flameLength = Math.min(15, 1.1 + f.height / scale) * (0.85 + 0.15 * Math.sin(time * 15));
    [
      [0, 0],
      [-1.3, -1.3],
      [1.3, -1.3],
      [-1.3, 1.3],
      [1.3, 1.3],
    ].forEach(([dx, dz], i) => {
      this.matrix.position.set(x + dx, 1.4 + f.height / scale, z + dz);
      this.matrix.scale.set(1.5, flameLength, 1.5);
      this.matrix.rotation.set(0, time * 0.25 + i, 0);
      this.matrix.updateMatrix();
      this.flames.setMatrixAt(i, this.matrix.matrix);
    });
    this.flames.instanceMatrix.needsUpdate = true;
    const landing = f.elapsed >= 250,
      age = landing ? f.elapsed - 250 : f.elapsed;
    const billow = Math.max(0, Math.min(1, age / 6)) * (1 - Math.max(0, (age - 55) / 30));
    this.smoke.visible = f.smoke;
    this.smokeMaterial.uniforms.opacity.value = billow * 0.64;
    this.smokeMaterial.uniforms.time.value = time;
    for (let i = 0; i < 120; i++) {
      const phase = (i * 7.137) % 1,
        angle = i * 2.399;
      const spread = 2 + phase * Math.min(22, age * 0.55);
      const lift = (i % 7) * 0.25 + Math.min(8, age * 0.06) * (1 - phase);
      this.matrix.position.set(
        x + Math.cos(angle) * spread + age * 0.025,
        lift + 1.4 + phase * 1.75 + age * 0.018,
        z + Math.sin(angle) * spread,
      );
      this.matrix.scale.setScalar(3 + phase * 5 + age * 0.055);
      this.matrix.rotation.set(0, 0, 0);
      this.matrix.updateMatrix();
      this.smoke.setMatrixAt(i, this.matrix.matrix);
    }
    this.smoke.instanceMatrix.needsUpdate = true;
    this.glow.scale.setScalar(4 + f.thrust * 3);
    (this.glow.material as T.MeshBasicMaterial).opacity =
      f.thrust * 0.25 * Math.max(0, 1 - f.height / 100);
  }
}
