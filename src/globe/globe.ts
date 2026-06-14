import * as THREE from "three";
import type { Quake } from "../data/types";
import { magColor } from "../data/quakeUtils";
import landDots from "../assets/land-dots.json";

const GLOBE_RADIUS = 1;
const DEG2RAD = Math.PI / 180;

/** Convert lat/lon to a point on the unit sphere (Three.js Y-up). */
function latLonToVec3(lat: number, lon: number, r = GLOBE_RADIUS): THREE.Vector3 {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lon + 180) * DEG2RAD;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

export interface GlobeHoverEvent {
  quake: Quake;
  x: number;
  y: number;
}

export class Globe {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private group = new THREE.Group(); // holds globe + markers, rotates together
  private raf = 0;

  private quakes: Quake[] = [];
  private markerGeo?: THREE.BufferGeometry;
  private markerPoints?: THREE.Points;
  private rings: { mesh: THREE.Mesh; born: number; mag: number }[] = [];
  private ringTemplate: THREE.RingGeometry;
  private hovered = -1;

  // Pointer / inertia state
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private velX = 0;
  private velY = 0;
  private targetRotY = 0;
  private rotX = 0;
  private autoSpin = true;
  private pointerNDC = new THREE.Vector2(-2, -2);
  private raycaster = new THREE.Raycaster();
  private reduceMotion: boolean;

  onHover?: (e: GlobeHoverEvent | null) => void;
  onSelect?: (q: Quake) => void;

  constructor(private canvas: HTMLCanvasElement) {
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0, 0.35, 3.5);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(this.group);
    this.group.rotation.x = this.rotX = 0.32;

    this.raycaster.params.Points = { threshold: 0.045 };
    this.ringTemplate = new THREE.RingGeometry(0.012, 0.02, 40);

    this.buildBackdrop();
    this.buildLandDots();
    this.bindPointer();
    this.resize();
    window.addEventListener("resize", this.resize);
    this.loop();
  }

  /** Faint outer halo + atmosphere so the planet reads against the dark bg. */
  private buildBackdrop() {
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.14, 64, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        uniforms: { uColor: { value: new THREE.Color(0x3a6fff) } },
        vertexShader: `
          varying vec3 vN; varying vec3 vPos;
          void main(){
            vN = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vPos = mv.xyz;
            gl_Position = projectionMatrix * mv;
          }`,
        // Rim term peaks at the silhouette and falls to zero toward the centre,
        // so the glow is a thin halo rather than a full-disc bloom.
        fragmentShader: `
          varying vec3 vN; varying vec3 vPos; uniform vec3 uColor;
          void main(){
            vec3 viewDir = normalize(-vPos);
            float rim = 1.0 - abs(dot(vN, viewDir));
            float i = pow(clamp(rim, 0.0, 1.0), 3.5) * 0.6;
            gl_FragColor = vec4(uColor, i);
          }`,
      })
    );
    this.scene.add(atmo);

    // Dark inner sphere to occlude back-facing dots and give the globe mass.
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 0.985, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0x080b16 })
    );
    this.group.add(core);
  }

  /** Render the precomputed land grid as a single Points cloud. */
  private buildLandDots() {
    const dots = landDots as [number, number][];
    const positions = new Float32Array(dots.length * 3);
    for (let i = 0; i < dots.length; i++) {
      const v = latLonToVec3(dots[i][0], dots[i][1], GLOBE_RADIUS * 1.002);
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.013,
      color: 0x4a5a82,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
    });
    this.group.add(new THREE.Points(geo, mat));
  }

  /** (Re)build the quake marker cloud and reset shockwave rings. */
  setQuakes(quakes: Quake[]) {
    this.quakes = quakes;
    this.hovered = -1;

    if (this.markerPoints) {
      this.group.remove(this.markerPoints);
      this.markerGeo?.dispose();
      (this.markerPoints.material as THREE.Material).dispose();
      this.markerPoints = undefined;
    }
    for (const r of this.rings) {
      this.group.remove(r.mesh);
      (r.mesh.material as THREE.Material).dispose();
    }
    this.rings = [];

    if (quakes.length === 0) return;

    const positions = new Float32Array(quakes.length * 3);
    const colors = new Float32Array(quakes.length * 3);
    const sizes = new Float32Array(quakes.length);
    const c = new THREE.Color();
    for (let i = 0; i < quakes.length; i++) {
      const q = quakes[i];
      const v = latLonToVec3(q.lat, q.lon, GLOBE_RADIUS * 1.01);
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
      c.set(magColor(q.mag));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      sizes[i] = Math.max(7, 4 + q.mag * 4.5);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(Float32Array.from(quakes, () => Math.random()), 1));

    // Soft round sprite drawn in the fragment shader; gentle twinkle via aSeed.
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uHover: { value: -1 } },
      vertexShader: `
        attribute float aSize; attribute float aSeed; attribute vec3 color;
        uniform float uTime; uniform float uHover;
        varying vec3 vColor; varying float vGlow;
        void main(){
          vColor = color;
          float tw = 0.7 + 0.3 * sin(uTime * 2.0 + aSeed * 6.28);
          vGlow = tw;
          float hov = (float(gl_VertexID) == uHover) ? 1.7 : 1.0;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * tw * hov * (3.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vGlow;
        void main(){
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float core = smoothstep(0.5, 0.0, d);
          float halo = smoothstep(0.5, 0.15, d) * 0.5;
          gl_FragColor = vec4(vColor, (core + halo) * vGlow);
        }`,
    });

    this.markerGeo = geo;
    this.markerPoints = new THREE.Points(geo, mat);
    this.markerPoints.renderOrder = 2;
    this.group.add(this.markerPoints);

    // Seed shockwave rings on the most significant events.
    const notable = [...quakes].sort((a, b) => b.mag - a.mag).slice(0, 14);
    for (const q of notable) this.spawnRing(q, Math.random() * 4000);
  }

  private spawnRing(q: Quake, delay = 0) {
    const mesh = new THREE.Mesh(
      this.ringTemplate,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(magColor(q.mag)),
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const pos = latLonToVec3(q.lat, q.lon, GLOBE_RADIUS * 1.012);
    mesh.position.copy(pos);
    mesh.lookAt(pos.clone().multiplyScalar(2)); // orient tangent to surface
    this.group.add(mesh);
    this.rings.push({ mesh, born: performance.now() + delay, mag: q.mag });
  }

  private bindPointer() {
    const onDown = (e: PointerEvent) => {
      this.dragging = true;
      this.autoSpin = false;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.velX = this.velY = 0;
      this.canvas.classList.add("is-dragging");
      this.canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointerNDC.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.velX = dx * 0.005;
      this.velY = dy * 0.005;
      this.targetRotY += this.velX;
      this.rotX = THREE.MathUtils.clamp(this.rotX + this.velY, -1.1, 1.1);
    };
    const onUp = (e: PointerEvent) => {
      this.dragging = false;
      this.canvas.classList.remove("is-dragging");
      try { this.canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    this.canvas.addEventListener("pointerdown", onDown);
    this.canvas.addEventListener("pointermove", onMove);
    this.canvas.addEventListener("pointerup", onUp);
    this.canvas.addEventListener("pointerleave", () => {
      this.pointerNDC.set(-2, -2);
    });
    this.canvas.addEventListener("click", () => {
      if (this.hovered >= 0 && this.onSelect) this.onSelect(this.quakes[this.hovered]);
    });
  }

  private resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private updateHover() {
    if (!this.markerPoints || this.dragging) {
      if (this.hovered !== -1 && this.dragging) {
        this.hovered = -1;
        this.onHover?.(null);
        (this.markerPoints?.material as THREE.ShaderMaterial)?.uniforms.uHover && ((this.markerPoints!.material as THREE.ShaderMaterial).uniforms.uHover.value = -1);
      }
      return;
    }
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObject(this.markerPoints);
    // Only accept hits on the front hemisphere (not occluded by the globe).
    let idx = -1;
    for (const h of hits) {
      if (h.index == null) continue;
      const world = new THREE.Vector3().fromBufferAttribute(
        this.markerGeo!.getAttribute("position") as THREE.BufferAttribute,
        h.index
      );
      this.group.localToWorld(world);
      const toCam = this.camera.position.clone().sub(world).normalize();
      const normal = world.clone().normalize();
      if (normal.dot(toCam) > 0.05) { idx = h.index; break; }
    }
    const mat = this.markerPoints.material as THREE.ShaderMaterial;
    if (idx !== this.hovered) {
      this.hovered = idx;
      mat.uniforms.uHover.value = idx;
      if (idx >= 0) {
        const rect = this.canvas.getBoundingClientRect();
        const world = new THREE.Vector3().fromBufferAttribute(
          this.markerGeo!.getAttribute("position") as THREE.BufferAttribute,
          idx
        );
        this.group.localToWorld(world);
        const proj = world.clone().project(this.camera);
        this.onHover?.({
          quake: this.quakes[idx],
          x: rect.left + ((proj.x + 1) / 2) * rect.width,
          y: rect.top + ((-proj.y + 1) / 2) * rect.height,
        });
        this.canvas.style.cursor = "pointer";
      } else {
        this.onHover?.(null);
        this.canvas.style.cursor = this.dragging ? "grabbing" : "grab";
      }
    } else if (idx >= 0) {
      // keep tooltip glued to the moving marker
      const rect = this.canvas.getBoundingClientRect();
      const world = new THREE.Vector3().fromBufferAttribute(
        this.markerGeo!.getAttribute("position") as THREE.BufferAttribute,
        idx
      );
      this.group.localToWorld(world);
      const proj = world.clone().project(this.camera);
      this.onHover?.({
        quake: this.quakes[idx],
        x: rect.left + ((proj.x + 1) / 2) * rect.width,
        y: rect.top + ((-proj.y + 1) / 2) * rect.height,
      });
    }
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const t = performance.now();

    if (!this.dragging) {
      if (this.autoSpin && !this.reduceMotion) this.targetRotY += 0.0009;
      this.targetRotY += this.velX;
      this.velX *= 0.94;
      if (Math.abs(this.velX) < 0.00002) this.velX = 0;
    }
    this.group.rotation.y += (this.targetRotY - this.group.rotation.y) * 0.12;
    this.group.rotation.x += (this.rotX - this.group.rotation.x) * 0.12;

    if (this.markerPoints) {
      (this.markerPoints.material as THREE.ShaderMaterial).uniforms.uTime.value = t / 1000;
    }

    // Animate shockwave rings: expand + fade, then respawn.
    for (const r of this.rings) {
      const age = (t - r.born) / 1000;
      const mat = r.mesh.material as THREE.MeshBasicMaterial;
      if (age < 0) { mat.opacity = 0; continue; }
      const cycle = 2.6;
      const p = (age % cycle) / cycle;
      const scale = 1 + p * (3 + r.mag);
      r.mesh.scale.setScalar(scale);
      mat.opacity = (1 - p) * 0.5 * (this.reduceMotion ? 0 : 1);
    }

    this.updateHover();
    this.renderer.render(this.scene, this.camera);
  };

  /** Smoothly rotate a given quake to face the camera. */
  focus(q: Quake) {
    this.autoSpin = false;
    this.targetRotY = -((q.lon + 180) * DEG2RAD) - Math.PI / 2;
    this.rotX = THREE.MathUtils.clamp(q.lat * DEG2RAD, -1.1, 1.1);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    this.renderer.dispose();
  }
}
