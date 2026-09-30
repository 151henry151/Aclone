// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { noiseTexture } from './noise';
/** A single sky draw, with layered procedural clouds and a soft solar aureole. */
export function countrySky() {
  const sky = new T.Mesh(
    new T.SphereGeometry(700, 24, 12),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: {
        cloudNoise: { value: noiseTexture() },
        horizon: { value: new T.Color('#e5d3b7') },
        zenith: { value: new T.Color('#6b9eae') },
        daylight: { value: 1 },
      },
      vertexShader:
        'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `
      uniform vec3 horizon;uniform vec3 zenith;uniform float daylight;varying vec3 direction;
      uniform sampler2D cloudNoise;
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return texture2D(cloudNoise,(i+f+.5)/128.).r;}
      float fbm(vec2 p){return n(p)*.55+n(p*2.03)*.27+n(p*4.01)*.12+n(p*8.02)*.06;}
      void main(){
        vec3 d=normalize(direction);float h=max(0.,d.y);
        vec3 color=mix(horizon,zenith,pow(h,.35));
        vec2 p=d.xz/(max(.08,d.y)+.17)*2.4;
        float cloud=smoothstep(.48,.72,fbm(p));
        cloud*=smoothstep(0.,.16,h);
        vec3 cloudColor=mix(vec3(.49,.55,.57),vec3(1.,.94,.81),smoothstep(.45,.8,fbm(p+vec2(.12,.08))));
        color=mix(color,cloudColor*(.3+.7*daylight),cloud*.86);
        float sun=max(0.,dot(d,normalize(vec3(-.8,.7,.5))));
        color+=vec3(1.,.72,.36)*pow(sun,24.)*.22*daylight;
        color+=vec3(1.,.86,.62)*pow(sun,1800.)*2.*daylight;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }),
  );
  return sky;
}
