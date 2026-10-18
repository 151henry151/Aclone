// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { buildingModel } from './buildings';
import { creatorModel, disposeCreator } from './creator-model';
import { waitForTextures } from './materials';
import type { Building, World } from '../shared/types';
/** Single renderer per open designer. Repaint only on edits, resize or texture completion. */
export class BuildPreview {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(38, 1, 0.1, 5000);
  private group?: T.Group;
  private observer: ResizeObserver;
  private dead = false;
  private serial = 0;
  private radius = 10;
  private center = new T.Vector3();
  constructor(private host: HTMLElement) {
    this.renderer = new T.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.scene.background = new T.Color('#a5b5b1');
    this.scene.add(new T.HemisphereLight('#edf4ff', '#686b4c', 2));
    const sun = new T.DirectionalLight('#fff1d8', 2.5);
    sun.position.set(-12, 20, 16);
    this.scene.add(sun);
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Building preview in selected style, size and orientation',
    );
    host.replaceChildren(this.renderer.domElement);
    this.observer = new ResizeObserver(() => this.render());
    this.observer.observe(host);
  }
  private clear() {
    if (!this.group) return;
    this.scene.remove(this.group);
    if (this.group.userData.creatorModel) disposeCreator(this.group);
    else
      this.group.traverse((o) => {
        o.userData.disposed = true;
        if (o instanceof T.InstancedMesh) o.dispose();
        if (o instanceof T.Mesh) {
          if (!o.geometry.userData.shared) o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            for (const value of Object.values(m))
              if (value instanceof T.Texture && !value.userData.shared) value.dispose();
            m.dispose();
          }
        }
      });
  }
  show(b: Building, w: World) {
    this.clear();
    const serial = ++this.serial;
    const custom = w.creator?.models.find((m) => m.id === b.creatorModel);
    this.group = custom ? creatorModel(custom, w) : buildingModel(b);
    this.group.rotation.y = b.rotation;
    this.scene.add(this.group);
    const frame = () => {
      if (this.dead || serial !== this.serial) return;
      const bounds = new T.Box3().setFromObject(this.group!);
      bounds.getCenter(this.center);
      this.radius = Math.max(2, bounds.getSize(new T.Vector3()).length() / 2);
      this.render();
    };
    this.group.userData.redraw = frame;
    frame();
    void waitForTextures().then(frame);
  }
  private render() {
    if (this.dead) return;
    const width = Math.max(180, this.host.clientWidth),
      height = Math.max(220, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    const fov = (this.camera.fov * Math.PI) / 360;
    const distance =
      (this.radius / Math.sin(Math.min(fov, Math.atan(Math.tan(fov) * this.camera.aspect)))) * 1.15;
    this.camera.position
      .copy(this.center)
      .add(new T.Vector3(0.6, 0.46, 1).normalize().multiplyScalar(distance));
    this.camera.lookAt(this.center);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.dead = true;
    this.serial++;
    this.observer.disconnect();
    this.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
