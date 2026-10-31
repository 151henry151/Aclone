// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
/** A camera-local volume: fixed memory, one draw, no network particles. */
export class Precipitation {
  readonly mesh: T.Points;
  private positions = new Float32Array(900 * 3);
  constructor() {
    for (let i = 0; i < 900; i++)
      this.positions.set(
        [(Math.random() - 0.5) * 70, Math.random() * 32, (Math.random() - 0.5) * 70],
        i * 3,
      );
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(this.positions, 3));
    this.mesh = new T.Points(
      g,
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          snow: { value: 0 },
          opacity: { value: 0.5 },
          shelter: { value: new T.Vector4(0, 0, 0, 0) },
        },
        vertexShader:
          'uniform float snow;varying vec3 worldPosition;void main(){worldPosition=(modelMatrix*vec4(position,1.)).xyz;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=mix(5.,clamp(55./max(1.,-p.z),2.,8.),snow);}',
        fragmentShader:
          'uniform float snow;uniform float opacity;uniform vec4 shelter;varying vec3 worldPosition;void main(){if(snow<.5&&shelter.w>0.&&worldPosition.y<shelter.y&&worldPosition.y>shelter.y-2.5&&distance(worldPosition.xz,shelter.xz)<shelter.w)discard;vec2 p=gl_PointCoord-.5;float a=mix(step(abs(p.x),.1),smoothstep(.5,.2,length(p)),snow);gl_FragColor=vec4(.82,.9,1.,a*opacity);}',
      }),
    );
    this.mesh.frustumCulled = false;
  }
  shelter(at?: T.Vector3) {
    const value = (this.mesh.material as T.ShaderMaterial).uniforms.shelter.value as T.Vector4;
    if (at) value.set(at.x, at.y, at.z, 0.78);
    else value.w = 0;
  }
  update(dt: number, at: T.Vector3, kind: string, intensity: number, wind: number) {
    this.mesh.visible = kind !== 'clear';
    if (!this.mesh.visible) return;
    const snow = kind === 'snow';
    const material = this.mesh.material as T.ShaderMaterial;
    material.uniforms.snow.value = Number(snow);
    material.uniforms.opacity.value = snow ? 0.8 : 0.45;
    this.mesh.geometry.setDrawRange(0, Math.round(900 * intensity));
    this.mesh.position.set(at.x, at.y - 8, at.z);
    for (let i = 0; i < 900; i++) {
      const n = i * 3;
      this.positions[n] = ((this.positions[n] + wind * dt + 35) % 70) - 35;
      this.positions[n + 1] = (this.positions[n + 1] - (snow ? 2 : 22) * dt + 32) % 32;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}
