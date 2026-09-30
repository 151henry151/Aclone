// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
/** One draw call and a bounded pool, shared by engines and occupied/working buildings. */
export class SmokePlumes {
  readonly mesh: T.Points;
  private positions: Float32Array;
  private alpha: Float32Array;
  private sizes: Float32Array;
  private life: Float32Array;
  private cursor = 0;
  constructor(readonly capacity = 128) {
    this.positions = new Float32Array(capacity * 3);
    this.alpha = new Float32Array(capacity);
    this.sizes = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(this.positions, 3));
    geometry.setAttribute('opacity', new T.BufferAttribute(this.alpha, 1));
    geometry.setAttribute('size', new T.BufferAttribute(this.sizes, 1));
    this.mesh = new T.Points(
      geometry,
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexShader:
          'attribute float opacity;attribute float size;varying float fade;void main(){fade=opacity;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*320./max(1.,-p.z),1.,72.);}',
        fragmentShader:
          'varying float fade;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(vec3(.64,.64,.59),fade*smoothstep(1.,.1,d));}',
      }),
    );
    this.mesh.frustumCulled = false;
  }
  emit(at: T.Vector3) {
    const i = this.cursor++ % this.capacity;
    this.positions.set(at.toArray(), i * 3);
    this.life[i] = 4;
    this.alpha[i] = 0;
    this.sizes[i] = 0.35;
  }
  update(dt: number, wind = 0.35) {
    for (let i = 0; i < this.capacity; i++) {
      this.life[i] = Math.max(0, this.life[i] - dt);
      const age = 4 - this.life[i];
      this.alpha[i] = this.life[i] > 0 ? ((Math.min(1, age * 3) * this.life[i]) / 4) * 0.32 : 0;
      this.positions[i * 3] += wind * dt;
      this.positions[i * 3 + 1] += 0.75 * dt;
      this.positions[i * 3 + 2] += wind * 0.3 * dt;
      this.sizes[i] = 0.35 + age * 0.28;
    }
    for (const attribute of Object.values(this.mesh.geometry.attributes))
      attribute.needsUpdate = true;
  }
  clear() {
    this.life.fill(0);
    this.alpha.fill(0);
  }
}
