// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { noiseTexture } from './noise';
declare const __ACLONE_BASE__: string;
import { publicPath } from '../shared/public-path';

// Texture ownership lasts for the renderer's lifetime, across world rebuilds.
const textures = new Map<string, T.Texture>();
export function texture(name: string) {
  let map = textures.get(name);
  if (!map) {
    map = new T.TextureLoader().load(publicPath(__ACLONE_BASE__, `/textures/${name}.webp`));
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = 4;
    map.userData.shared = true;
    textures.set(name, map);
  }
  return map;
}

/** UVs measured in metres, so a stone stays the same size on different buildings. */
export function surface(
  mesh: T.Mesh<T.BufferGeometry, T.Material | T.Material[]>,
  name: string,
  size = 4,
  tint = '#ffffff',
) {
  const g = mesh.geometry,
    p = g.attributes.position,
    n = g.attributes.normal;
  const uv: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)),
      ay = Math.abs(n.getY(i)),
      az = Math.abs(n.getZ(i));
    uv.push(
      (ax > ay && ax > az ? p.getZ(i) : p.getX(i)) / size,
      (ay > ax && ay > az ? p.getZ(i) : p.getY(i)) / size,
    );
  }
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose();
  mesh.material = new T.MeshStandardMaterial({
    map: texture(name),
    bumpMap: texture(name),
    bumpScale: name === 'stone' ? 0.07 : 0.025,
    color: tint,
    roughness: 0.92,
  });
  return mesh;
}

export const roads = [
  [0, 30, 12, 175],
  [0, 10, 120, 11],
  [0, -36, 80, 9],
  [-40, 60, 75, 8],
  [35, 50, 9, 90],
  [52, 45, 82, 7],
];
export function roadDistance(x: number, z: number) {
  return Math.min(
    ...roads.map(([cx, cz, w, d]) => Math.max(Math.abs(x - cx) - w / 2, Math.abs(z - cz) - d / 2)),
  );
}
export const snowCover = { value: 0 };
export function groundMaterial(seaLevel: number) {
  const mat = new T.MeshStandardMaterial({ roughness: 1 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.snowCover = snowCover;
    shader.uniforms.groundNoise = { value: noiseTexture() };
    shader.uniforms.meadow = { value: texture('meadow') };
    shader.uniforms.gravel = { value: texture('gravel') };
    shader.uniforms.shore = { value: seaLevel };
    shader.vertexShader = 'varying vec3 groundPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\ngroundPosition=position;',
    );
    shader.fragmentShader =
      `
      uniform float snowCover; uniform sampler2D meadow; uniform sampler2D gravel; uniform float shore;
      varying vec3 groundPosition;
      uniform sampler2D groundNoise;
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return texture2D(groundNoise,(i+f+.5)/128.).r;}
      float lane(vec2 p,vec2 centre,vec2 halfSize){vec2 q=abs(p-centre)-halfSize;return max(q.x,q.y);}
      ` + shader.fragmentShader;
    const lanes = roads
      .map(
        ([x, z, w, d]) =>
          `r=min(r,lane(p,vec2(${x.toFixed(1)},${z.toFixed(1)}),vec2(${(w / 2).toFixed(1)},${(d / 2).toFixed(1)})));`,
      )
      .join('\n');
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      vec2 p=groundPosition.xz;
      float r=1000.; ${lanes}
      // Gravel wears away into the turf; noise breaks up the verge at two scales.
      float verge=noise(p*1.9)*.7+noise(p*.32)*1.4;
      float road=1.-smoothstep(-.8,1.4,r+verge-.8);
      road=max(road,1.-smoothstep(12.,14.,length(p)));
      float beach=1.-smoothstep(shore+.3,shore+1.7,groundPosition.y);
      vec3 turf=texture2D(meadow,p/5.).rgb;
      turf*=mix(vec3(.68,.74,.52),vec3(1.06,1.03,.88),noise(p*.045));
      vec3 grit=texture2D(gravel,p/6.).rgb;
      diffuseColor.rgb*=mix(mix(turf,grit,max(road,beach)),vec3(.85,.91,.94),snowCover*(1.-road*.25));
    `,
    );
  };
  mat.customProgramCacheKey = () => 'countryside-ground-v1';
  return mat;
}

let contact: T.CanvasTexture | undefined;
/** Cheap contact shade survives performance mode; sunlight supplies the long shadows. */
export function contactShadow(width: number, depth: number, opacity = 0.3) {
  if (!contact) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!,
      gradient = ctx.createRadialGradient(32, 32, 8, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(13,22,16,.85)');
    gradient.addColorStop(0.55, 'rgba(13,22,16,.5)');
    gradient.addColorStop(1, 'rgba(13,22,16,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    contact = new T.CanvasTexture(c);
    contact.userData.shared = true;
  }
  const mesh = new T.Mesh(
    new T.PlaneGeometry(width, depth),
    new T.MeshBasicMaterial({
      map: contact,
      color: 0x000000,
      transparent: true,
      opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.08;
  return mesh;
}

export const autumnTint = { value: 0 };
/** Snow settles on upward faces; foliage also shifts colour with the season. */
export function seasonalMaterial(mat: T.Material, foliage = false) {
  const previous = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    previous.call(mat, shader, renderer);
    shader.uniforms.snowCover = snowCover;
    shader.uniforms.autumnTint = autumnTint;
    shader.vertexShader = 'varying vec3 snowNormal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      '#include <beginnormal_vertex>\nsnowNormal=normalize(mat3(modelMatrix)*objectNormal);',
    );
    shader.fragmentShader =
      'uniform float snowCover;uniform float autumnTint;varying vec3 snowNormal;\n' +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>\n${foliage ? 'diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.65,.72,.35),autumnTint);' : ''}\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.85,.91,.94),snowCover*${foliage ? '.6' : 'smoothstep(.25,.8,snowNormal.y)'});`,
    );
  };
  mat.customProgramCacheKey = () => `seasonal-v1-${foliage}`;
}
