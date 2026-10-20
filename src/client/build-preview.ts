import { addFoundation } from './foundations';
// SPDX-License-Identifier: GPL-3.0-or-later
import { buildingPreviewFrame, previewDirection } from './build-preview-scale';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildingModel } from './buildings';
import { creatorModel, disposeCreator } from './creator-model';
import { waitForTextures } from './materials';
import type { Building, World } from '../shared/types';
/** Single renderer per open designer. Repaint only on edits, resize or texture completion. */
export class BuildPreview {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
  private group?: T.Group;
  private observer: ResizeObserver;
  private dead = false;
  private serial = 0;
  private radius = 10;
  private frameWidth = 10;
  private frameHeight = 10;
  private center = new T.Vector3();
  private controls?: OrbitControls;
  private viewInitialized = false;
  constructor(
    private host: HTMLElement,
    private interactive = false,
  ) {
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
      'Building preview at a fixed scale for this building type',
    );
    host.replaceChildren(this.renderer.domElement);
    if (interactive) {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enablePan = false;
      this.controls.minPolarAngle = 0.05;
      this.controls.maxPolarAngle = Math.PI * 0.49;
      this.controls.minZoom = 0.5;
      this.controls.maxZoom = 4;
      this.controls.addEventListener('change', () => this.render());
    }
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
  show(b: Building, w?: World, terminalOnly = false) {
    this.clear();
    const serial = ++this.serial;
    const custom = w?.creator?.models.find((m) => m.id === b.creatorModel);
    this.group = custom ? creatorModel(custom, w!) : buildingModel(b);
    if (w) addFoundation(this.group, b, w);
    this.group.rotation.y = b.rotation;
    this.scene.add(this.group);
    const frame = () => {
      if (this.dead || serial !== this.serial) return;
      const excluded =
        terminalOnly && b.kind === 'starport'
          ? this.group!.children.filter((child) => child.userData.flight)
          : [];
      for (const child of excluded) {
        child.visible = false;
        this.group!.remove(child);
      }
      const bounds = new T.Box3().setFromObject(this.group!);
      for (const child of excluded) this.group!.add(child);
      const previousCenter = this.center.clone();
      bounds.getCenter(this.center);
      if (this.controls) {
        this.camera.position.add(this.center.clone().sub(previousCenter));
        this.controls.target.copy(this.center);
      }
      const reference = custom ? undefined : buildingPreviewFrame(b.kind, terminalOnly);
      this.radius = reference?.radius ?? Math.max(2, bounds.getSize(new T.Vector3()).length() / 2);
      this.frameWidth = reference?.horizontal ?? this.radius;
      this.frameHeight = reference?.vertical ?? this.radius;
      this.renderer.domElement.dataset.referenceRadius = String(this.radius);
      if (!this.viewInitialized) this.resetView();
      else this.render();
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
    const aspect = width / height;
    const halfHeight = this.interactive
      ? this.radius * Math.max(1, 1 / aspect) * 1.12
      : Math.max(this.frameHeight, this.frameWidth / aspect) * 1.12;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.left = -halfHeight * aspect;
    this.camera.right = halfHeight * aspect;
    this.renderer.domElement.dataset.metresPerPixel = String((halfHeight * 2) / height);
    if (!this.interactive) this.positionCamera();
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }
  private positionCamera() {
    this.camera.position
      .copy(this.center)
      .add(
        new T.Vector3(previewDirection.x, previewDirection.y, previewDirection.z)
          .normalize()
          .multiplyScalar(Math.max(100, this.radius * 4)),
      );
    this.camera.lookAt(this.center);
  }
  resetView() {
    this.viewInitialized = true;
    this.camera.zoom = 1;
    this.positionCamera();
    this.controls?.target.copy(this.center);
    this.controls?.update();
    this.render();
  }
  turn(azimuth: number, elevation = 0) {
    if (!this.controls) return;
    const spherical = new T.Spherical().setFromVector3(
      this.camera.position.clone().sub(this.center),
    );
    spherical.theta += azimuth;
    spherical.phi = T.MathUtils.clamp(spherical.phi + elevation, 0.05, Math.PI * 0.49);
    this.camera.position.copy(this.center).add(new T.Vector3().setFromSpherical(spherical));
    this.controls.update();
  }
  zoom(factor: number) {
    this.camera.zoom = T.MathUtils.clamp(this.camera.zoom * factor, 0.5, 4);
    this.render();
  }
  dispose() {
    this.dead = true;
    this.serial++;
    this.observer.disconnect();
    this.controls?.dispose();
    this.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
