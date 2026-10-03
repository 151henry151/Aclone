// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { noiseTexture } from './noise';
import { starfield } from './starfield';
import { cloudShader } from './sky-weather';
/** One sky draw: rotating stars, sunlit lunar discs, and foreground cloud layers. */
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
        twilight: { value: 0 },
        sunDirection: { value: new T.Vector3(0, 1, 0) },
        clouds: { value: 0.4 },
        drift: { value: 0 },
        starMap: { value: starfield() },
        skyRotation: { value: new T.Matrix3() },
        night: { value: 0 },
        moonA: { value: new T.Vector4(0, 1, 0, 0.0192) },
        moonB: { value: new T.Vector4(0, 1, 0, 0.0098) },
        moonGlow: { value: 0 },
        twinkle: { value: 0 },
      },
      vertexShader:
        'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `
      uniform vec3 horizon;uniform vec3 zenith;uniform float daylight;uniform float twilight;varying vec3 direction;
      uniform sampler2D cloudNoise;uniform vec3 sunDirection;uniform float clouds;uniform float drift;
      uniform sampler2D starMap;uniform mat3 skyRotation;uniform float night;
      uniform vec4 moonA;uniform vec4 moonB;uniform float moonGlow;uniform float twinkle;
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return texture2D(cloudNoise,(i+f+.5)/128.).r;}
      float fbm(vec2 p){return n(p)*.55+n(p*2.03)*.27+n(p*4.01)*.12+n(p*8.02)*.06;}
      ${cloudShader}
      vec3 moon(vec3 color,vec3 d,vec4 body,vec3 tint,float seed){
        vec3 m=normalize(body.xyz);
        vec3 right=normalize(cross(abs(m.y)>.99?vec3(1.,0.,0.):vec3(0.,1.,0.),m));
        vec3 up=cross(m,right);
        vec2 uv=vec2(dot(d,right),dot(d,up))/sin(body.w);
        float r2=dot(uv,uv);
        if(dot(d,m)>0. && r2<1.01){
          vec3 normal=right*uv.x+up*uv.y-m*sqrt(max(0.,1.-r2));
          float lit=smoothstep(-.015,.055,dot(normal,normalize(sunDirection)));
          float relief=.48+.4*fbm(uv*13.+seed)+.12*n(uv*71.+seed);
          // Dark maria and small crater rims on the original procedural surface.
          relief*=mix(.62,1.,smoothstep(.34,.6,fbm(uv*5.+seed)));
          vec2 cell=floor(uv*9.);vec2 crater=fract(uv*9.)-.5;
          float rim=exp(-pow((length(crater)-.23)*35.,2.));
          relief+=rim*.12*step(.68,n(cell+seed));
          vec3 disc=tint*relief*(.012+lit*1.8)*(1.-daylight*.7);
          float edge=1.-smoothstep(.985,1.01,r2);
          color=mix(color,disc,edge*smoothstep(-.015,.04,d.y));
        }
        return color;
      }
      void main(){
        vec3 d=normalize(direction);float h=max(0.,d.y);
        vec3 color=mix(horizon,zenith,pow(h,.35));
        vec3 solar=normalize(sunDirection);
        float sunward=0.;
        if(twilight>.001){
        // Atmospheric bands follow the sun's azimuth, with a rose belt opposite it.
        float facing=dot(normalize(vec3(d.x,0.,d.z)+vec3(.00001,0.,0.)),normalize(vec3(solar.x,0.,solar.z)+vec3(.00001,0.,0.)));
        sunward=pow(max(0.,facing),3.);
        float lowBand=exp(-h*9.);
        float roseBand=exp(-pow((h-.16)*6.,2.));
        vec3 warm=vec3(1.35,.36,.065)*lowBand*(.18+.82*sunward);
        vec3 rose=vec3(.46,.09,.19)*roseBand*(.25+.55*sunward+.30*max(0.,-facing));
        vec3 blue=vec3(.012,.032,.10)*(1.-lowBand);
        color=mix(color,color*.55+warm+rose+blue,twilight);
        }

        vec3 equatorial=normalize(skyRotation*d);
        vec2 starUV=vec2(atan(equatorial.z,equatorial.x)/6.2831853+.5,asin(equatorial.y)/3.14159265+.5);
        float shimmer=.9+.1*sin(twinkle*1.7+dot(equatorial,vec3(431.,719.,283.)));
        color+=texture2D(starMap,starUV).rgb*night*smoothstep(.015,.22,h)*shimmer*2.4;
        color=moon(color,d,moonA,vec3(.94,.96,1.),11.);
        color=moon(color,d,moonB,vec3(1.,.85,.67),43.);
        float sun=max(0.,dot(d,normalize(sunDirection)));
        float sunVisible=smoothstep(-.025,.005,solar.y);
        color+=vec3(1.,.50,.16)*pow(sun,32.)*(.18*daylight+.65*twilight);
        vec3 discColor=mix(vec3(1.,.80,.51),vec3(1.,.32,.055),twilight);
        color+=discColor*smoothstep(.99993,.99997,sun)*5.*sunVisible;
        color+=discColor*pow(sun,1100.)*.4*sunVisible;
        float cloud=cloudAt(d,clouds,drift);
        vec2 p=d.xz/(max(.08,d.y)+.17)*2.4+vec2(drift,0.);
        float detail=fbm(p+vec2(.12,.08));
        vec3 cloudColor=mix(vec3(.49,.55,.57),vec3(1.,.94,.81),smoothstep(.45,.8,detail));
        float halo=pow(max(0.,dot(d,moonA.xyz)),100.)+pow(max(0.,dot(d,moonB.xyz)),160.);
        cloudColor*=.003+.997*daylight+moonGlow*(.02+.13*halo);
        if(twilight>.001){
        // Existing cloud noise also shapes illuminated edges: no extra texture samples.
        vec3 duskCloud=mix(vec3(.045,.034,.075),vec3(1.,.31,.105),.18+.82*sunward);
        float edges=smoothstep(.35,.75,detail);
        cloudColor=mix(cloudColor,cloudColor*.35+duskCloud*(.25+.75*edges),twilight*.85);
        cloudColor+=vec3(1.,.57,.24)*pow(sun,40.)*edges*twilight*.6;
        }
        color=mix(color,cloudColor,1.-pow(1.-cloud,3.));
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }),
  );
  return sky;
}
