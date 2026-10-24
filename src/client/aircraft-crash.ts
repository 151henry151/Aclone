// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { Player, World } from '../shared/types';

/** One bounded draw call: expanding flame, outward sparks and rising dark smoke.
 * Only authoritative crash events trigger it, never client prediction. */
export class AircraftCrashes {
  readonly mesh: T.Points;
  private seen = new Map<string, number>();
  private world = '';
  private cursor = 0;
  private age = new Float32Array(256).fill(20);
  private velocity = new Float32Array(256 * 3);
  constructor() {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(256 * 3), 3));
    g.setAttribute('age', new T.Float32BufferAttribute(this.age, 1));
    g.setAttribute('kind', new T.Float32BufferAttribute(new Float32Array(256), 1));
    this.mesh = new T.Points(
      g,
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        vertexShader: `attribute float age; attribute float kind; varying float t; varying float k;
        void main(){t=age;k=kind;vec4 p=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*p;
        float size=k>.5?.12:(1.8+min(t,6.)*.8);
        gl_PointSize=clamp(size*500./max(1.,-p.z),1.,180.);}`,
        fragmentShader: `varying float t; varying float k;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        void main(){float d=length(gl_PointCoord-.5)*2.; if(d>1.||t>8.)discard;
        float n=noise(gl_PointCoord*6.+vec2(t*.6,-t*1.8));
        float edge=(1.-smoothstep(.2,1.,d+(n-.5)*.42));
        vec3 fire=mix(vec3(1.,.16,.01),vec3(1.,.93,.52),clamp(pow(1.-d,2.)+n*.4,0.,1.));
        float smoke=smoothstep(.65,2.8,t);
        vec3 color=mix(fire,vec3(.12,.13,.14),smoke);
        float alpha=edge*(1.-smoothstep(3.,8.,t))*.8;
        if(k>.5){color=vec3(1.,.62,.08);alpha=edge*(1.-smoothstep(.3,2.,t));}
        gl_FragColor=vec4(color,alpha);}`,
      }),
    );
    this.mesh.name = 'Aircraft impact flames and smoke';
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }
  receive(w: Pick<World, 'id' | 'time' | 'players'>) {
    if (w.id !== this.world) {
      this.clear();
      this.world = w.id;
    }
    for (const p of Object.values(w.players)) {
      const c = p.lastFlightCrash;
      if (!c || this.seen.get(p.id) === c.at) continue;
      this.seen.set(p.id, c.at);
      if (
        w.time - c.at < 0 ||
        w.time - c.at > 3 ||
        c.x === undefined ||
        c.y === undefined ||
        c.z === undefined
      )
        continue;
      this.emit(c);
    }
    for (const id of this.seen.keys()) if (!w.players[id]) this.seen.delete(id);
  }
  emit(c: NonNullable<Player['lastFlightCrash']>) {
    const pos = this.mesh.geometry.attributes.position;
    const kind = this.mesh.geometry.attributes.kind;
    for (let n = 0; n < 64; n++) {
      const i = this.cursor++ % 256,
        angle = n * 2.399963;
      const spark = n % 3 === 0;
      this.age[i] = 0;
      kind.setX(i, spark ? 1 : 0);
      pos.setXYZ(i, c.x!, c.y! + 0.5 + (n % 5) * 0.14, c.z!);
      const speed = spark ? 6 + (n % 7) : 1.2 + (n % 4) * 0.5;
      this.velocity.set(
        [
          Math.cos(angle) * speed,
          spark ? 3 + (n % 5) : 1.5 + (n % 3) * 0.5,
          Math.sin(angle) * speed,
        ],
        i * 3,
      );
    }
    this.mesh.visible = true;
    for (const a of Object.values(this.mesh.geometry.attributes)) a.needsUpdate = true;
  }
  update(dt: number) {
    if (!this.mesh.visible) return;
    const pos = this.mesh.geometry.attributes.position,
      kind = this.mesh.geometry.attributes.kind;
    let active = false;
    for (let i = 0; i < 256; i++) {
      if (this.age[i] > 8) continue;
      active = true;
      this.age[i] += dt;
      const j = i * 3,
        spark = kind.getX(i) > 0.5;
      pos.setXYZ(
        i,
        pos.getX(i) + this.velocity[j] * dt,
        pos.getY(i) + this.velocity[j + 1] * dt,
        pos.getZ(i) + this.velocity[j + 2] * dt,
      );
      this.velocity[j] *= Math.exp(-dt * (spark ? 0.8 : 1.1));
      this.velocity[j + 2] *= Math.exp(-dt * (spark ? 0.8 : 1.1));
      if (spark) this.velocity[j + 1] -= 6 * dt;
    }
    this.mesh.geometry.attributes.age.array.set(this.age);
    pos.needsUpdate = this.mesh.geometry.attributes.age.needsUpdate = true;
    this.mesh.visible = active;
  }
  clear() {
    this.age.fill(20);
    this.seen.clear();
    this.mesh.visible = false;
  }
}
