// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { fleetTractor } from './tractor-fleet';
/** One demand-rendered orthographic preview; every tractor uses the same metre scale. */
export class TractorPreview {
  private renderer = new T.WebGLRenderer({ antialias: true });
  private scene = new T.Scene();
  private camera = new T.OrthographicCamera(-4.3, 4.3, 3.1, -3.1, 0.1, 100);
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private group?: T.Group;
  constructor(private host: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.domElement.setAttribute('aria-label', 'Tractor preview; drag to rotate');
    host.replaceChildren(this.renderer.domElement);
    this.scene.background = new T.Color('#b2beb3');
    this.scene.add(new T.HemisphereLight('#eff4ff', '#66704d', 2));
    const sun = new T.DirectionalLight('#fff0d3', 2.8);
    sun.position.set(-6, 9, 8);
    this.scene.add(sun);
    this.camera.position.set(7, 4.8, 8);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.3, 0);
    this.controls.enablePan = false;
    this.controls.minZoom = 0.75;
    this.controls.maxZoom = 2.5;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.update();
    this.controls.addEventListener('change', () => this.render());
    this.observer = new ResizeObserver(() => this.render());
    this.observer.observe(host);
  }
  private clear() {
    if (!this.group) return;
    this.scene.remove(this.group);
    const mats = new Set<T.Material>();
    this.group.traverse((o) => {
      if (o instanceof T.Mesh) {
        if (!o.geometry.userData.shared) o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.add(m);
      }
    });
    for (const m of mats) if (!m.userData.shared) m.dispose();
  }
  show(slot: number, color?: string) {
    this.clear();
    this.group = new T.Group();
    fleetTractor(this.group, slot, color);
    this.scene.add(this.group);
    this.render();
  }
  render() {
    const width = Math.max(200, this.host.clientWidth),
      height = Math.max(240, this.host.clientHeight);
    const halfHeight = Math.max(3.1, 4.1 / (width / height));
    this.camera.left = (-halfHeight * width) / height;
    this.camera.right = -this.camera.left;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.observer.disconnect();
    this.controls.dispose();
    this.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
