// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { townRoads } from '../shared/town';
import type { World } from '../shared/types';
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

// Bake road coverage once per world rebuild. Shader cost stays constant as lanes grow.
function roadTexture(w: World) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d')!,
    scale = 1024 / 540;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const roads = townRoads(w);
  for (const [extra, color] of [
    [2, '#555'],
    [0, '#fff'],
  ] as const) {
    ctx.strokeStyle = color;
    for (const { a, b, width } of roads) {
      ctx.lineWidth = (width + extra) * scale;
      ctx.beginPath();
      ctx.moveTo((a.x + 270) * scale, (a.z + 270) * scale);
      ctx.lineTo((b.x + 270) * scale, (b.z + 270) * scale);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(512, 512, 13 * scale, 0, Math.PI * 2);
  ctx.fill();
  const map = new T.CanvasTexture(canvas);
  map.generateMipmaps = false;
  map.minFilter = map.magFilter = T.LinearFilter;
  return map;
}
export const snowCover = { value: 0 };
export function groundMaterial(w: World) {
  const mask = roadTexture(w);
  const mat = new T.MeshStandardMaterial({ roughness: 1 });
  mat.addEventListener('dispose', () => mask.dispose());
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.snowCover = snowCover;
    shader.uniforms.groundNoise = { value: noiseTexture() };
    shader.uniforms.meadow = { value: texture('meadow') };
    shader.uniforms.gravel = { value: texture('gravel') };
    shader.uniforms.shore = { value: w.settings.seaLevel };
    shader.uniforms.roadMask = { value: mask };
    shader.vertexShader = 'varying vec3 groundPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\ngroundPosition=position;',
    );
    shader.fragmentShader =
      `
      uniform sampler2D roadMask; uniform float snowCover; uniform sampler2D meadow; uniform sampler2D gravel; uniform float shore;
      varying vec3 groundPosition;
      uniform sampler2D groundNoise;
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return texture2D(groundNoise,(i+f+.5)/128.).r;}
      ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      vec2 p=groundPosition.xz;
      // Gravel wears away into the turf; noise breaks up the verge at two scales.
      float verge=noise(p*1.9)*.7+noise(p*.32)*1.4;
      float road=smoothstep(.16,.84,texture2D(roadMask,vec2(.5+p.x/540.,.5-p.y/540.)).r+verge*.06);
      road=max(road,1.-smoothstep(12.,14.,length(p)));
      float beach=1.-smoothstep(shore+.3,shore+1.7,groundPosition.y);
      vec3 turf=texture2D(meadow,p/5.).rgb;
      turf*=mix(vec3(.68,.74,.52),vec3(1.06,1.03,.88),noise(p*.045));
      vec3 grit=texture2D(gravel,p/6.).rgb;
      diffuseColor.rgb*=mix(mix(turf,grit,max(road,beach)),vec3(.85,.91,.94),snowCover*(1.-road*.25));
    `,
    );
  };
  mat.customProgramCacheKey = () => 'countryside-ground-v2';
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
