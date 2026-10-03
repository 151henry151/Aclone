// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
export type DrunkEffects = 'auto' | 'reduced' | 'off';
/** Scene-only postprocessing. DOM controls/chat stay sharp; sober rendering has no extra pass. */
export class DrunkVision {
  preference: DrunkEffects;
  private media = matchMedia('(prefers-reduced-motion: reduce)');
  private strength = 0;
  private phase = 0;
  private target?: T.WebGLRenderTarget;
  private size = new T.Vector2();
  private screen = new T.Scene();
  private camera = new T.Camera();
  private material = new T.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      image: { value: null },
      strength: { value: 0 },
      time: { value: 0 },
      motion: { value: 1 },
      pixel: { value: new T.Vector2() },
    },
    vertexShader: `varying vec2 vUv;
      void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `uniform sampler2D image;
      uniform float strength,time,motion; uniform vec2 pixel; varying vec2 vUv;
      vec3 sampleScene(vec2 uv){return texture2D(image,clamp(uv,vec2(.001),vec2(.999))).rgb;}
      void main(){
        vec2 p=vUv-.5;
        float a=strength;
        // Slow, overlapping waves: no rapid flashes or high-frequency camera shake.
        float roll=sin(time*.73)*.026*a*motion;
        p=mat2(cos(roll),-sin(roll),sin(roll),cos(roll))*p;
        p*=1.-.06*a; // crop slightly to leave room for the moving distortion
        p*=1.+sin(time*1.13)*.035*a*motion;
        p+=vec2(sin(p.y*9.+time*1.5),sin(p.x*8.-time*1.1))*.017*a*motion;
        p+=p*dot(p,p)*sin(time*.91)*.08*a*motion;
        vec2 uv=p+.5;
        float strong=smoothstep(.12,1.,a);
        vec2 blur=pixel*(.7+3.5*strong)*strong;
        vec3 color=sampleScene(uv)*.5;
        color+=(sampleScene(uv+blur)+sampleScene(uv-blur))*.25;
        // A drifting second image is stronger than the subtle colour fringe.
        vec2 ghost=vec2(.012,.002)*strong*motion;
        ghost.x*=.65+.35*sin(time*.67);
        color=mix(color,sampleScene(uv+ghost),.24*strong*motion);
        float fringe=.003*strong*motion;
        color.r=mix(color.r,sampleScene(uv+vec2(fringe,0.)).r,.45*strong);
        color.b=mix(color.b,sampleScene(uv-vec2(fringe,0.)).b,.45*strong);
        color*=1.-smoothstep(.2,.72,length(vUv-.5))*.18*a;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  constructor() {
    const saved = localStorage.getItem('aclone.drunkEffects');
    this.preference = saved === 'off' || saved === 'reduced' ? saved : 'auto';
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      'position',
      new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
    );
    const quad = new T.Mesh(geometry, this.material);
    quad.frustumCulled = false;
    this.screen.add(quad);
  }
  get label() {
    return this.preference === 'auto'
      ? `automatic${this.media.matches ? ' (reduced motion)' : ''}`
      : this.preference;
  }
  cycle() {
    this.preference =
      this.preference === 'auto' ? 'reduced' : this.preference === 'reduced' ? 'off' : 'auto';
    localStorage.setItem('aclone.drunkEffects', this.preference);
  }
  render(renderer: T.WebGLRenderer, scene: T.Scene, camera: T.Camera, amount: number, dt: number) {
    const reduced = this.preference === 'reduced' || this.media.matches;
    const desired = this.preference === 'off' ? 0 : amount;
    // Ease in over seconds. Clear immediately on world exit/rebirth or opt-out.
    this.strength =
      desired === 0 ? 0 : T.MathUtils.lerp(this.strength, desired, 1 - Math.exp(-dt * 1.4));
    renderer.domElement.dataset.intoxication = this.strength.toFixed(3);
    renderer.domElement.dataset.drunkEffects =
      this.preference === 'off' ? 'off' : reduced ? 'reduced' : 'full';
    if (this.strength < 0.002) {
      this.target?.dispose();
      this.target = undefined;
      renderer.render(scene, camera);
      return;
    }
    this.phase = (this.phase + Math.min(dt, 0.1)) % (Math.PI * 200);
    renderer.getDrawingBufferSize(this.size);
    // Bound mobile/high-DPI cost. Only intoxicated scenes pay for this extra pass.
    const scale = Math.min(1, 1920 / this.size.x, 1080 / this.size.y);
    const width = Math.max(1, Math.round(this.size.x * scale)),
      height = Math.max(1, Math.round(this.size.y * scale));
    if (!this.target)
      this.target = new T.WebGLRenderTarget(width, height, {
        type: renderer.extensions.has('EXT_color_buffer_float')
          ? T.HalfFloatType
          : T.UnsignedByteType,
        depthBuffer: true,
        stencilBuffer: false,
      });
    if (this.target.width !== width || this.target.height !== height)
      this.target.setSize(width, height);
    const uniforms = this.material.uniforms;
    uniforms.image.value = this.target.texture;
    uniforms.strength.value = reduced ? this.strength * 0.32 : this.strength;
    uniforms.motion.value = reduced ? 0 : 1;
    uniforms.time.value = this.phase;
    uniforms.pixel.value.set(1 / width, 1 / height);
    const previous = renderer.getRenderTarget(),
      autoReset = renderer.info.autoReset;
    renderer.info.autoReset = false;
    renderer.info.reset();
    try {
      renderer.setRenderTarget(this.target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(previous);
      renderer.render(this.screen, this.camera);
    } finally {
      renderer.setRenderTarget(previous);
      renderer.info.autoReset = autoReset;
    }
  }
}
