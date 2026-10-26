// MyCargoLens hero world kit (port of marketing hero-3d/src/engine.js, approved Oct 26 2026).
// One renderer, one light rig, one material library and a set of brand primitives
// (containers, ship, sea slab, filing cards, focus frame, clock ring, packets).
// Every hero scene is a pure function of time t (seconds) with a fixed loop length,
// so the same code renders the live hero, the poster frame and seamless loops.
//
// Only Hero3D imports this file, and only through a dynamic import after hydration,
// so three.js never lands in the first-load bundle.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// ---------------------------------------------------------------- palette
export const C = {
  navy: "#1E2D4D", navyDeep: "#14213D", ink: "#0B1428", steel: "#3D5A8A", denim: "#5E78A8",
  slate: "#8C99B8", mist: "#C9D1E3", porcelain: "#F3F5F9", paper: "#FFFFFF",
  gold: "#FBBE24", goldDark: "#D8920F", goldLight: "#FDD872",
  rose: "#E5484D", amber: "#F59E0B", emerald: "#10B981", blue: "#3D6FDB", violet: "#8B5CF6",
  sea: "#2F64AE", seaDeep: "#173563", foam: "#DCE6F5",
};

// ---------------------------------------------------------------- math + easing
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const win = (t: number, a: number, b: number) => clamp((t - a) / (b - a)); // 0..1 inside [a,b]
const E = {
  outCubic: (k: number) => 1 - Math.pow(1 - k, 3),
  inOutCubic: (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  inOutSine: (k: number) => -(Math.cos(Math.PI * k) - 1) / 2,
  outBack: (k: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
  outExpo: (k: number) => (k === 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  inCubic: (k: number) => k * k * k,
};
// a 0→1→0 envelope: rises over [a,a+r], holds, falls over [b-r,b]
const env = (t: number, a: number, b: number, r = 0.4) => Math.min(win(t, a, a + r), 1 - win(t, b - r, b));
const TAU = Math.PI * 2;
function rng(seed = 7) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- canvas textures
// next/font serves Inter under a generated family name; Hero3D passes the
// computed body font-family in before the first texture is drawn.
let FONT = '"Inter", -apple-system, "Segoe UI", sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
export function setFont(family: string) { if (family) FONT = family; }

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;
function canvasTex(w: number, h: number, draw: Draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d")!; draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) { g.beginPath(); g.roundRect(x, y, w, h, r); }

export interface CardFaceOpts {
  title?: string; meta?: string; metaMono?: boolean; chip?: string; chipColor?: string; rail?: string;
  rows?: number; mono?: boolean; dark?: boolean; big?: boolean; eyebrow?: string; foot?: string; h?: number;
}
// A filing card face: status rail, title, meta, a few skeleton rows, optional chip.
function cardFace(o: CardFaceOpts) {
  const W = 640, H = o.h || 400;
  return canvasTex(W, H, (g) => {
    const dark = !!o.dark;
    rr(g, 0, 0, W, H, 34); g.fillStyle = dark ? "#16233F" : "#FFFFFF"; g.fill();
    g.lineWidth = 3; g.strokeStyle = dark ? "rgba(140,153,184,.35)" : "rgba(30,45,77,.10)"; g.stroke();
    if (o.rail) { rr(g, 0, 0, 12, H, [34, 0, 0, 34]); g.fillStyle = o.rail; g.fill(); }
    const x0 = 52; let y = 78;
    if (o.eyebrow) { g.font = `600 22px ${FONT}`; g.fillStyle = dark ? "#8C99B8" : "#6B7794"; g.fillText(o.eyebrow.toUpperCase().split("").join(String.fromCharCode(8202)), x0, y); y += 52; }
    let fs = o.big ? 46 : 38; const room = W - x0 - 40 - (o.chip ? chipW(o.chip) + 28 : 0);
    do { g.font = `${o.big ? 700 : 650} ${fs}px ${o.mono ? MONO : FONT}`; fs -= 1; } while (g.measureText(o.title || "").width > room && fs > 22);
    g.fillStyle = dark ? "#F3F5F9" : "#0F1A30";
    g.fillText(o.title || "", x0, y); y += 50;
    if (o.meta) { g.font = `500 26px ${o.metaMono === false ? FONT : MONO}`; g.fillStyle = dark ? "#8C99B8" : "#66728C"; g.fillText(o.meta, x0, y); y += 30; }
    const rows = o.rows ?? 2; y += 26;
    for (let i = 0; i < rows; i++) {
      rr(g, x0, y, (i % 2 ? 0.52 : 0.74) * (W - 2 * x0), 16, 8); g.fillStyle = dark ? "rgba(140,153,184,.22)" : "rgba(30,45,77,.08)"; g.fill(); y += 36;
    }
    if (o.chip) {
      g.font = `650 25px ${FONT}`; const tw = g.measureText(o.chip).width;
      const cw = tw + 74, ch = 52, cx = W - cw - 44, cy = 40;
      rr(g, cx, cy, cw, ch, 26); g.fillStyle = hexA(o.chipColor || C.amber, 0.14); g.fill();
      g.beginPath(); g.arc(cx + 28, cy + ch / 2, 8, 0, TAU); g.fillStyle = o.chipColor || C.amber; g.fill();
      g.fillStyle = shade(o.chipColor || C.amber); g.fillText(o.chip, cx + 46, cy + 35);
    }
    if (o.foot) { g.font = `500 24px ${MONO}`; g.fillStyle = dark ? "#8C99B8" : "#7A859E"; g.fillText(o.foot, x0, H - 44); }
  });
}
export interface PillOpts { fs?: number; dot?: string; mono?: boolean; bg?: string; border?: string; color?: string; h?: number }
// A pill label (billboard chips floating in the scene)
function pillTex(text: string, o: PillOpts = {}) {
  const fs = o.fs || 30, pad = 30, dot = o.dot ? 30 : 0;
  const m = document.createElement("canvas").getContext("2d")!; m.font = `650 ${fs}px ${o.mono ? MONO : FONT}`;
  const W = Math.ceil(m.measureText(text).width + pad * 2 + dot), H = Math.round(fs * 2.1);
  const tex = canvasTex(W, H, (g) => {
    rr(g, 2, 2, W - 4, H - 4, H / 2); g.fillStyle = o.bg || "#FFFFFF"; g.fill();
    g.lineWidth = 2.5; g.strokeStyle = o.border || "rgba(30,45,77,.12)"; g.stroke();
    if (o.dot) { g.beginPath(); g.arc(pad + 6, H / 2, 8, 0, TAU); g.fillStyle = o.dot; g.fill(); }
    g.font = `650 ${fs}px ${o.mono ? MONO : FONT}`; g.fillStyle = o.color || "#0F1A30"; g.textBaseline = "middle";
    g.fillText(text, pad + dot, H / 2 + 1);
  });
  tex.userData = { aspect: W / H };
  return tex;
}
function chipW(t: string) { const m = document.createElement("canvas").getContext("2d")!; m.font = `650 25px ${FONT}`; return m.measureText(t).width + 74 + 44; }
function hexA(hex: string, a: number) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function shade(hex: string) { const n = parseInt(hex.slice(1), 16); const f = 0.62; return `rgb(${((n >> 16) * f) | 0},${(((n >> 8) & 255) * f) | 0},${((n & 255) * f) | 0})`; }

// ---------------------------------------------------------------- world
export interface WorldOpts {
  lite?: boolean; dark?: boolean; exposure?: number; floorR?: number; floorY?: number;
  camera?: { pos?: [number, number, number]; target?: [number, number, number]; fov?: number };
}

function createWorld(canvas: HTMLCanvasElement, opts: WorldOpts = {}) {
  const lite = !!opts.lite;
  const dark = !!opts.dark;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = opts.exposure ?? 1.0;
  renderer.shadowMap.enabled = !lite;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.localClippingEnabled = true;

  // Every texture this world creates, so dispose() can free them all
  // (CanvasTextures live in closures and on materials swapped at runtime).
  const textures = new Set<THREE.Texture>();
  const tex = <T extends THREE.Texture>(t: T) => { textures.add(t); return t; };
  const ctex = (w: number, h: number, draw: Draw) => tex(canvasTex(w, h, draw));
  const once = (f: () => THREE.CanvasTexture) => { let t: THREE.CanvasTexture | undefined; return () => t || (t = tex(f())); };

  // corrugated steel: vertical ribs used as map + bump on every container
  const corrugation = once(() => canvasTex(256, 64, (g, w, h) => {
    for (let x = 0; x < w; x++) { const v = 214 + 34 * Math.sin((x / w) * TAU * 16); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, h); }
    g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
  }));
  const glowTex = once(() => canvasTex(256, 256, (g) => {
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,.55)"); r.addColorStop(0.6, "rgba(255,255,255,.12)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  }));
  const ringTex = once(() => canvasTex(256, 256, (g) => {
    const r = g.createRadialGradient(128, 128, 70, 128, 128, 128);
    r.addColorStop(0, "rgba(255,255,255,0)"); r.addColorStop(0.55, "rgba(255,255,255,.9)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  }));

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envRT = pmrem.fromScene(room, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = dark ? 0.55 : 0.75;

  const cam = opts.camera || {};
  const camera = new THREE.PerspectiveCamera(cam.fov || 28, 1, 0.1, 200);
  const camPos = new THREE.Vector3(...(cam.pos || [10, 7.5, 12]));
  const camTarget = new THREE.Vector3(...(cam.target || [0, 0.6, 0]));
  camera.position.copy(camPos); camera.lookAt(camTarget);

  // light rig: soft key with shadows, cool fill from the sky, warm gold rim from behind
  const hemi = new THREE.HemisphereLight(dark ? "#5E78A8" : "#E8EEF8", dark ? "#0B1428" : "#B9C3D6", dark ? 0.6 : 0.9);
  scene.add(hemi);
  const key = new THREE.DirectionalLight("#FFFFFF", dark ? 1.6 : 2.3);
  key.position.set(-6, 12, 8); key.castShadow = !lite;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  const sc = key.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 40;
  scene.add(key);
  const rim = new THREE.DirectionalLight("#FFD98A", dark ? 1.4 : 0.9); rim.position.set(6, 5, -9); scene.add(rim);

  // shadow catcher floor (transparent, only the shadow shows)
  const floorMat = new THREE.ShadowMaterial({ opacity: dark ? 0.45 : 0.16 });
  const floorR = opts.floorR || 9;
  floorMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("void main() {", "varying vec2 vFl;\nvoid main() {\n vFl = position.xy;");
    sh.fragmentShader = sh.fragmentShader.replace("void main() {", "varying vec2 vFl;\nvoid main() {").replace("#include <fog_fragment>", `#include <fog_fragment>\n gl_FragColor.a *= 1.0 - smoothstep(${(floorR * 0.55).toFixed(2)}, ${floorR.toFixed(2)}, length(vFl));`);
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(floorR * 2, floorR * 2), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = opts.floorY ?? -0.01; floor.receiveShadow = true; scene.add(floor);

  // ---------------- material library
  const std = (color: THREE.ColorRepresentation, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...o });
  const M = {
    navy: std(C.navy, { roughness: 0.45 }), navyDeep: std(C.navyDeep, { roughness: 0.4 }),
    steel: std(C.steel), denim: std(C.denim), slate: std(C.slate), mist: std(C.mist),
    porcelain: std(C.porcelain, { roughness: 0.6 }), paper: std(C.paper, { roughness: 0.7 }),
    gold: std(C.gold, { roughness: 0.28, metalness: 0.55, emissive: C.goldDark, emissiveIntensity: 0.18 }),
    goldGlow: std(C.gold, { roughness: 0.3, metalness: 0.2, emissive: C.gold, emissiveIntensity: 0.7 }),
    emerald: std(C.emerald, { emissive: C.emerald, emissiveIntensity: 0.35 }),
    rose: std(C.rose, { emissive: C.rose, emissiveIntensity: 0.35 }),
    amber: std(C.amber, { emissive: C.amber, emissiveIntensity: 0.3 }),
    glass: new THREE.MeshPhysicalMaterial({ color: "#DCE8FA", roughness: 0.04, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.22, depthWrite: false, envMapIntensity: 1.6 }),
  };

  const geoCache = new Map<string, THREE.BufferGeometry>();
  const cached = <G extends THREE.BufferGeometry>(k: string, f: () => G): G => { if (!geoCache.has(k)) geoCache.set(k, f()); return geoCache.get(k) as G; };
  const rbox = (w: number, h: number, d: number, r = 0.06, s = 3) => cached(`rb${w},${h},${d},${r},${s}`, () => new RoundedBoxGeometry(w, h, d, s, r));
  const shadowed = <O extends THREE.Object3D>(o: O, cast = true, recv = true) => { o.traverse((m) => { if ((m as THREE.Mesh).isMesh) { m.castShadow = cast; m.receiveShadow = recv; } }); return o; };
  const mesh = <G extends THREE.BufferGeometry, Mt extends THREE.Material>(geo: G, mat: Mt, cast = true) => { const m = new THREE.Mesh<G, Mt>(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; };

  // ---------------- primitives
  const containerMats = new Map<string, THREE.MeshStandardMaterial>();
  function containerMat(color: string) {
    if (!containerMats.has(color)) {
      const map = corrugation();
      containerMats.set(color, new THREE.MeshStandardMaterial({ color, map, bumpMap: map, bumpScale: 1.4, roughness: 0.5, metalness: 0.15 }));
    }
    return containerMats.get(color)!;
  }
  // 40ft-ish box: length 2.4, height 1.0, width 1.0 (units)
  function container(color: string = C.navy, len = 2.4, h = 1, w = 1) {
    return mesh(rbox(len, h, w, 0.045 * h, 2), color === C.gold
      ? new THREE.MeshStandardMaterial({ color: C.gold, map: corrugation(), bumpMap: corrugation(), bumpScale: 1.4, roughness: 0.3, metalness: 0.45, emissive: C.goldDark, emissiveIntensity: 0.15 })
      : containerMat(color));
  }
  // many containers in one draw call
  function containerField(list: { x: number; y: number; z: number; ry?: number; color: string }[], len = 2.4, h = 1, w = 1) {
    const im = new THREE.InstancedMesh(rbox(len, h, w, (0.03 * h) / 0.6, 2), new THREE.MeshStandardMaterial({ map: corrugation(), bumpMap: corrugation(), bumpScale: 1.4, roughness: 0.5, metalness: 0.15 }), list.length);
    const o = new THREE.Object3D(), col = new THREE.Color();
    list.forEach((c, i) => { o.position.set(c.x, c.y, c.z); o.rotation.set(0, c.ry || 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, col.set(c.color)); });
    im.castShadow = true; im.receiveShadow = true; return im;
  }

  // Container ship. Hull = side profile extruded across the beam, then tapered at bow and stern.
  // Vertex colours paint the bottom navy, a gold waterline stripe and the topsides.
  function ship(o: { len?: number; beam?: number; seed?: number; hull?: string; palette?: string[]; gold?: string[]; tiers?: number; flat?: boolean } = {}) {
    const L = o.len || 9, B = o.beam || 2.6, D = 1.4, seed = o.seed || 3;
    const s = new THREE.Shape();
    const xs = -L / 2, xb = L / 2;
    s.moveTo(xs, D * 0.55); s.lineTo(xs + 0.05, -D * 0.25); s.quadraticCurveTo(xs + 0.25, -D * 0.45, xs + 0.9, -D * 0.45);
    s.lineTo(xb - 1.6, -D * 0.45); s.quadraticCurveTo(xb - 0.25, -D * 0.45, xb, D * 0.62); s.lineTo(xs, D * 0.55);
    const g = new THREE.ExtrudeGeometry(s, { depth: B, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 4, curveSegments: 18, steps: 1 });
    g.translate(0, 0, -B / 2);
    const p = g.attributes.position, colors: number[] = [], cTop = new THREE.Color(o.hull || C.navy), cBot = new THREE.Color(C.navyDeep), cGold = new THREE.Color(C.gold), cDeck = new THREE.Color("#2A3B5F");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const bow = clamp((x - (xb - 2.4)) / 2.4), stern = clamp((xs + 0.9 - x) / 0.9);
      const yk = clamp((y + D * 0.45) / (D * 1.05));
      const nar = 1 - Math.pow(bow, 1.6) * (0.92 - 0.5 * yk) - stern * 0.12;
      p.setZ(i, z * nar);
      const c = y < -D * 0.2 ? cBot : y < -D * 0.1 ? cGold : y > D * 0.5 ? cDeck : cTop;
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3)); g.computeVertexNormals();
    const grp = new THREE.Group();
    const hull = mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.1 }));
    grp.add(hull);
    // superstructure (bridge) at the stern
    const bx = xs + 0.75;
    const bridge = new THREE.Group();
    const b1 = mesh(rbox(1.1, 2.7, B * 0.8, 0.06), M.porcelain); b1.position.set(0, 1.35, 0); bridge.add(b1);
    const b2 = mesh(rbox(1.25, 0.38, B * 1.02, 0.05), M.porcelain); b2.position.set(0.05, 2.86, 0); bridge.add(b2);
    const win1 = mesh(rbox(0.02, 0.12, B * 0.96, 0.01), M.navyDeep, false); win1.position.set(0.68, 2.88, 0); bridge.add(win1);
    const fun = mesh(rbox(0.42, 0.7, 0.5, 0.08), M.navy); fun.position.set(-0.32, 3.3, 0); bridge.add(fun);
    const band = mesh(rbox(0.44, 0.1, 0.52, 0.04), M.gold); band.position.set(-0.32, 3.48, 0); bridge.add(band);
    bridge.scale.setScalar(clamp(L / 8.5, 0.45, 1)); bridge.position.set(bx, D * 0.55, 0); grp.add(bridge);
    // container stacks: 20ft boxes (1.25 x .52 x .5) running fore and aft
    const r = rng(seed), list: { x: number; y: number; z: number; color: string }[] = [], palette = o.palette || [C.navy, C.steel, C.denim, C.porcelain, C.navyDeep, C.slate, C.steel, C.navy];
    const rows = Math.max(1, Math.floor((B - 0.1) / 0.52)), x0 = bx + 1.05, bays = Math.floor((xb - 1.5 - x0) / 1.32) + 1;
    const golds = o.gold || [], maxT = o.tiers || 4;
    const slot = (b: number, rw: number, t2: number) => new THREE.Vector3(x0 + b * 1.32, D * 0.55 + 0.27 + t2 * 0.53, (rw - (rows - 1) / 2) * 0.52);
    for (let b = 0; b < bays; b++) for (let rw = 0; rw < rows; rw++) {
      const edge = rw === 0 || rw === rows - 1 ? 1 : 0;
      const tiers = o.flat ? 1 : Math.max(1, Math.round(maxT - edge - r() * 1.6 - (b === bays - 1 ? 1 : 0)));
      for (let t2 = 0; t2 < tiers; t2++) {
        if (golds.includes(`${b},${rw},${t2}`)) continue;
        const p2 = slot(b, rw, t2); list.push({ x: p2.x, y: p2.y, z: p2.z, color: palette[Math.floor(r() * palette.length)] });
      }
    }
    grp.add(containerField(list, 1.25, 0.52, 0.5));
    grp.userData.slot = slot; grp.userData.deck = D * 0.55;
    shadowed(grp);
    return grp;
  }

  // Diorama sea: a rounded slab you see in section, with a faceted animated surface.
  // Waves use integer wave numbers in time so they loop exactly over `loop` seconds.
  function sea(o: { w?: number; d?: number; depth?: number; loop?: number; color?: string; crest?: string; amp?: number } = {}) {
    const w = o.w || 12, d = o.d || 7, depth = o.depth || 1.1, loop = o.loop || 12, segX = lite ? 40 : 64, segZ = lite ? 24 : 40;
    const grp = new THREE.Group();
    const body = new THREE.Mesh(rbox(w, depth, d, 0.35, 4), new THREE.MeshPhysicalMaterial({ color: "#1D4280", roughness: 0.35, metalness: 0, transparent: true, opacity: 0.9, clearcoat: 0.25 }));
    body.position.y = -depth / 2 - 0.02; body.receiveShadow = true; grp.add(body);
    const geo = new THREE.PlaneGeometry(w - 0.5, d - 0.5, segX, segZ); geo.rotateX(-Math.PI / 2);
    const base = (geo.attributes.position.array as Float32Array).slice();
    const mat = new THREE.MeshStandardMaterial({ color: "#FFFFFF", vertexColors: true, roughness: 0.2, metalness: 0.05, flatShading: true });
    const col = new Float32Array(base.length), cLow = new THREE.Color(o.color || C.sea), cHigh = new THREE.Color(o.crest || "#9CC0F0"), cTmp = new THREE.Color();
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const surf = new THREE.Mesh(geo, mat); surf.receiveShadow = true; surf.position.y = 0.02; grp.add(surf);
    const amp = o.amp ?? 0.12;
    grp.userData.update = (t: number) => {
      const ph = (TAU * t) / loop, a = geo.attributes.position.array as Float32Array;
      for (let i = 0; i < a.length; i += 3) {
        const x = base[i], z = base[i + 2];
        const y = amp * (Math.sin(x * 0.9 + ph * 2) * 0.6 + Math.sin(z * 1.3 - ph * 3 + x * 0.3) * 0.4 + Math.sin((x + z) * 2.1 + ph * 4) * 0.18);
        a[i + 1] = y; cTmp.copy(cLow).lerp(cHigh, clamp((y / amp) * 0.5 + 0.35)); col[i] = cTmp.r; col[i + 1] = cTmp.g; col[i + 2] = cTmp.b;
      }
      geo.attributes.color.needsUpdate = true;
      geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
    };
    grp.userData.height = (x: number, z: number, t: number) => { const ph = (TAU * t) / loop; return amp * (Math.sin(x * 0.9 + ph * 2) * 0.6 + Math.sin(z * 1.3 - ph * 3 + x * 0.3) * 0.4); };
    return grp;
  }

  // Foam wake: flattened white bits born at the stern (and bow), drifting back and out, then shrinking away.
  function wake(o: { period?: number; len?: number; spread?: number; trail?: number } = {}) {
    const N = lite ? 36 : 70, period = o.period || 3, spread = o.spread || 1.6, r0 = rng(9);
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 10, 6), new THREE.MeshStandardMaterial({ color: "#F4F8FF", roughness: 0.6, emissive: "#C9D8F2", emissiveIntensity: 0.25 }), N);
    const seeds = Array.from({ length: N }, (_, i) => [i / N, r0() < 0.5 ? -1 : 1, r0(), r0()]);
    const d = new THREE.Object3D();
    im.userData.update = (t: number, origin: THREE.Vector3, bow: number) => {
      seeds.forEach(([off, side, j, k], i) => {
        const life = ((((t / period + off) % 1) + 1) % 1), isBow = i % 5 === 0;
        const back = isBow ? life * 1.4 : life * (o.trail || 4.5);
        const out = (isBow ? 0.35 + life * 0.9 : 0.25 + life * spread) * side;
        const x = (isBow ? bow : origin.x) - back, z = origin.z + out + (j - 0.5) * 0.25;
        const sc = Math.sin(Math.PI * Math.min(1, life * 1.15)) * (isBow ? 0.9 : 1.25) * (0.6 + k * 0.7);
        d.position.set(x, origin.y + 0.1, z); d.scale.set(sc * 1.8, sc * 0.35, sc * 1.1); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
    };
    im.receiveShadow = true; return im;
  }

  // Rounded platform slab (quay, plinth, turntable top)
  function slab<Mt extends THREE.Material = THREE.MeshStandardMaterial>(w: number, h: number, d: number, mat: Mt = M.porcelain as unknown as Mt, r = 0.18) { const m = mesh(rbox(w, h, d, Math.min(r, h / 2 - 0.001), 4), mat); m.position.y = h / 2; return m; }

  // A floating filing card: paper slab + printed face. setFace(tex) swaps the print.
  function card(face: THREE.Texture, o: { w?: number; aspect?: number; d?: number; dark?: boolean; shadow?: boolean } = {}) {
    const w = o.w || 3.2, h = w * (o.aspect || 0.625), d = o.d || 0.07;
    const grp = new THREE.Group();
    const body = mesh(rbox(w, h, d, Math.min(0.12, d / 2 - 0.001), 3), o.dark ? M.navyDeep : M.paper);
    grp.add(body);
    const fm = new THREE.MeshBasicMaterial({ map: face, transparent: true, toneMapped: false });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.985, h * 0.985), fm); front.position.z = d / 2 + 0.003; grp.add(front);
    const over = new THREE.Mesh(front.geometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, toneMapped: false })); over.position.z = d / 2 + 0.006; grp.add(over);
    grp.userData = { w, h, body, front, over,
      setFace(t: THREE.Texture) { if (front.material.map !== t) { front.material.map = t; front.material.needsUpdate = true; } },
      blendTo(t: THREE.Texture, k: number) { if (over.material.map !== t) { over.material.map = t; over.material.needsUpdate = true; } over.material.opacity = k; },
      setOpacity(k: number) { [body.material as THREE.Material, fm, over.material].forEach((m) => { m.transparent = true; }); fm.opacity = k; body.visible = k > 0.02; front.visible = k > 0.02; over.visible = k > 0.02; } };
    body.castShadow = o.shadow !== false; return grp;
  }
  // per-card body material so cards can fade independently
  function fadeCard(c: THREE.Object3D, k: number) {
    const u = c.userData; if (!u.ownMat) { u.body.material = u.body.material.clone(); u.ownMat = true; }
    u.body.material.transparent = true; u.body.material.opacity = k; u.front.material.opacity = k; if (u.over.material.opacity > 0) u.over.material.opacity = Math.min(u.over.material.opacity, k);
    c.visible = k > 0.01; u.body.castShadow = k > 0.5;
  }

  // The Focus Frame as a 3D reticle: four L brackets. open: 0 = locked tight, 1 = wide + faded.
  function focusFrame(o: { th?: number; arm?: number; color?: string } = {}) {
    const grp = new THREE.Group(), th = o.th || 0.085, arm = o.arm || 0.55;
    const mat = new THREE.MeshStandardMaterial({ color: o.color || (dark ? C.slate : C.navy), roughness: 0.35, metalness: 0.3, transparent: true, emissive: o.color || (dark ? C.slate : C.navy), emissiveIntensity: dark ? 0.25 : 0.05 });
    const corners: THREE.Group[] = [];
    const capsule = new THREE.CapsuleGeometry(th / 2, arm, 4, 10);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Group();
      const h1 = new THREE.Mesh(capsule, mat); h1.rotation.z = Math.PI / 2; h1.position.x = arm / 2;
      const v1 = new THREE.Mesh(capsule, mat); v1.position.y = -arm / 2;
      b.add(h1, v1); b.rotation.z = (-i * Math.PI) / 2; grp.add(b); corners.push(b);
      h1.castShadow = v1.castShadow = true;
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex(), color: C.gold, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    grp.add(halo);
    grp.userData = {
      mat, halo,
      // size: [w,h] of the subject; open: 0..1; pulse 0..1
      set(w: number, h: number, open = 0, pulse = 0) {
        const pad = 0.18 + open * 0.35;
        const hw = w / 2 + pad, hh = h / 2 + pad;
        const pos = [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]];
        corners.forEach((b, i) => { b.position.set(pos[i][0] * (1 + open * 0.08), pos[i][1] * (1 + open * 0.08), 0); b.scale.setScalar(1 - open * 0.25); });
        mat.opacity = 1 - open * 0.85;
        const hs = Math.max(w, h) * (1.05 + E.outCubic(pulse) * 0.45);
        halo.scale.set(hs, hs, 1);
        halo.material.opacity = pulse > 0 ? Math.pow(1 - pulse, 2) * (dark ? 0.8 : 0.45) : 0;
      },
    };
    grp.userData.set(1, 1, 1);
    return grp;
  }

  // Additive gold glow sprite
  function glow(color: string = C.gold, size = 2, opacity = 0.6) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: dark ? THREE.AdditiveBlending : THREE.NormalBlending }));
    s.scale.set(size, size, 1); return s;
  }
  // Billboard pill label
  function pill(text: string, o: PillOpts = {}) {
    const t = tex(pillTex(text, o)), h = o.h || 0.42;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(h * t.userData.aspect, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthWrite: false }));
    m.renderOrder = 10; m.userData.billboard = true; m.userData.tex = t; return m;
  }
  // Clock ring: thin track, ticks, and a sweep arc you drive with setSweep(0..1)
  function clockRing(o: { r?: number; tube?: number; trackMat?: THREE.Material; arcMat?: THREE.Material; ticks?: number } = {}) {
    const r = o.r || 2, grp = new THREE.Group(), segs = 180;
    const track = mesh(new THREE.TorusGeometry(r, o.tube || 0.04, 10, 160), o.trackMat || M.mist, false); grp.add(track);
    const arcGeo = new THREE.TorusGeometry(r, (o.tube || 0.04) * 1.9, 12, segs);
    const arc = mesh(arcGeo, o.arcMat || M.goldGlow, false); grp.add(arc);
    const ticks = o.ticks ?? 12;
    for (let i = 0; i < ticks; i++) { const a = (i / ticks) * TAU; const tk = mesh(rbox(0.05, 0.22, 0.05, 0.02), M.slate, false); tk.position.set(Math.cos(a) * (r + 0.22), Math.sin(a) * (r + 0.22), 0); tk.rotation.z = a + Math.PI / 2; grp.add(tk); }
    // torus index layout: radialSegments rings around the tube for each tubular segment => count per segment
    const per = arcGeo.index!.count / segs;
    grp.userData.setSweep = (k: number, from = 0) => { arcGeo.setDrawRange(Math.floor(from * segs) * per, Math.max(0, Math.floor((k - from) * segs)) * per); };
    grp.userData.setSweep(0);
    return grp;
  }
  // Small glowing data packet
  function packet(color: string = C.gold, s = 0.16) { return mesh(rbox(s, s, s, s * 0.25, 2), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.3 }), false); }
  // Smooth tube along points
  function tube(points: [number, number, number][], radius = 0.03, mat: THREE.Material = M.mist, segs = 120) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const g = new THREE.TubeGeometry(curve, segs, radius, 8, false); const m = mesh(g, mat, false); m.userData.curve = curve;
    const per = g.index!.count / segs; m.userData.setProgress = (a: number, b = 1) => g.setDrawRange(Math.floor(a * segs) * per, Math.max(0, Math.floor((b - a) * segs)) * per);
    return m;
  }
  // Port gantry crane
  function crane(o: { h?: number; span?: number; mat?: THREE.Material; reach?: number } = {}) {
    const g = new THREE.Group(), h = o.h || 4.2, span = o.span || 2.2, mat = o.mat || M.navy;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const leg = mesh(rbox(0.16, h, 0.16, 0.04), mat); leg.position.set(sx * 0.5, h / 2, (sz * span) / 2); g.add(leg); }
    for (const sx of [-1, 1]) { const tie = mesh(rbox(0.14, 0.14, span + 0.16, 0.04), mat); tie.position.set(sx * 0.5, h * 0.55, 0); g.add(tie); }
    const boom = mesh(rbox(o.reach || 7, 0.22, 0.5, 0.05), mat); boom.position.set((o.reach || 7) / 2 - 1.6, h + 0.1, 0); g.add(boom);
    const cab = mesh(rbox(0.5, 0.4, 0.55, 0.06), M.gold); cab.position.set(0, h - 0.2, 0); g.add(cab);
    const trolley = mesh(rbox(0.42, 0.18, 0.56, 0.04), M.porcelain); trolley.position.set(2, h - 0.05, 0); g.add(trolley);
    g.userData.trolley = trolley; return shadowed(g);
  }

  // ---------------- helpers for scenes
  function faceCam<O extends THREE.Object3D>(o: O, tilt = -0.05) { o.rotation.set(tilt, Math.atan2(camPos.x - o.position.x, camPos.z - o.position.z), 0, "YXZ"); return o; }
  // cut an object at the diorama edges (x range) so things can drive on and off the set
  function clip<O extends THREE.Object3D>(o: O, xmin: number, xmax: number) {
    const planes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -xmin), new THREE.Plane(new THREE.Vector3(-1, 0, 0), xmax)];
    o.traverse((m) => { const ms = m as THREE.Mesh; if (ms.isMesh) { const mt = (ms.material as THREE.Material).clone(); mt.clippingPlanes = planes; mt.clipShadows = true; ms.material = mt; } }); return o;
  }
  function cyl<Mt extends THREE.Material>(r: number, h: number, mat: Mt, seg = 64, rt?: number) { return mesh(cached(`cy${r},${h},${seg},${rt}`, () => new THREE.CylinderGeometry(rt ?? r, r, h, seg)), mat); }
  // Truck: cab + chassis + a container, cab facing +x
  function truck(o: { cabMat?: THREE.Material; container?: boolean; color?: string } = {}) {
    const g = new THREE.Group();
    const ch = mesh(rbox(3.0, 0.14, 0.86, 0.05), M.navyDeep); ch.position.set(-0.2, 0.42, 0); g.add(ch);
    const cab = mesh(rbox(0.9, 1.0, 0.96, 0.12), o.cabMat || M.porcelain); cab.position.set(1.65, 0.92, 0); g.add(cab);
    const ws = mesh(rbox(0.04, 0.34, 0.84, 0.02), M.navyDeep, false); ws.position.set(2.1, 1.15, 0); g.add(ws);
    const stripe = mesh(rbox(0.92, 0.08, 0.98, 0.03), M.gold, false); stripe.position.set(1.65, 0.62, 0); g.add(stripe);
    const wg = cached("wheel", () => { const w = new THREE.CylinderGeometry(0.24, 0.24, 0.2, 24); w.rotateX(Math.PI / 2); return w; });
    for (const x of [1.7, -0.6, -1.2]) for (const z of [-0.42, 0.42]) { const w = mesh(wg, M.navy); w.position.set(x, 0.24, z); g.add(w); }
    if (o.container !== false) { const c = container(o.color || C.steel, 2.6, 0.95, 0.9); c.position.set(-0.25, 0.97, 0); g.add(c); g.userData.box = c; }
    return shadowed(g);
  }
  // square label texture for the top of a slab / tile
  function tileTex(title: string, color: string, o: { bg?: string; plain?: boolean; rows?: number; fs?: number; fg?: string; sub?: string } = {}) {
    return ctex(512, 512, (g) => {
      rr(g, 0, 0, 512, 512, 40); g.fillStyle = o.bg || "#FFFFFF"; g.fill();
      if (!o.plain) for (let i = 0; i < (o.rows ?? 3); i++) { rr(g, 48, 150 + i * 46, [300, 220, 260][i % 3], 18, 9); g.fillStyle = "rgba(30,45,77,.08)"; g.fill(); }
      g.beginPath(); g.arc(66, 82, 14, 0, TAU); g.fillStyle = color; g.fill();
      g.font = `700 ${o.fs || 52}px ${FONT}`; g.fillStyle = o.fg || "#0F1A30"; g.fillText(title, 96, 100);
      if (o.sub) { g.font = `500 30px ${MONO}`; g.fillStyle = "#66728C"; g.fillText(o.sub, 48, 440); }
    });
  }

  // Free every GPU resource this world owns: geometries, materials, textures,
  // the environment map and the WebGL context itself.
  function dispose() {
    const geos = new Set<THREE.BufferGeometry>(geoCache.values());
    const mats = new Set<THREE.Material>([...Object.values(M), ...containerMats.values(), floorMat]);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) geos.add(m.geometry);
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.add(x));
      const ud = o.userData;
      if (ud && ud.tex && (ud.tex as THREE.Texture).isTexture) textures.add(ud.tex);
    });
    mats.forEach((m) => {
      for (const v of Object.values(m)) if (v && (v as THREE.Texture).isTexture) textures.add(v as THREE.Texture);
      m.dispose();
    });
    geos.forEach((g) => g.dispose());
    textures.forEach((t) => t.dispose());
    envRT.dispose(); pmrem.dispose(); room.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    scene.clear();
    renderer.renderLists.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  // ---------------- run loop
  const billboards: THREE.Object3D[] = [];
  const api = { THREE, scene, camera, renderer, C, M, E, lerp, clamp, win, env, rng, TAU, lite, dark,
    container, containerField, ship, sea, wake, slab, card, fadeCard, focusFrame, glow, pill, clockRing, packet, tube, crane,
    // canvasTex / cardFace / pillTex are registered so dispose() frees them
    cardFace: (o: CardFaceOpts) => tex(cardFace(o)), pillTex: (text: string, o?: PillOpts) => tex(pillTex(text, o)), canvasTex: ctex,
    rr, get FONT() { return FONT; }, MONO, rbox, mesh, shadowed, faceCam, clip, cyl, truck, tileTex, key, rim, hemi, floor, camPos, camTarget,
    add<O extends THREE.Object3D>(o: O) { scene.add(o); o.traverse((c) => { if (c.userData && c.userData.billboard) billboards.push(c); }); return o; },
    billboard<O extends THREE.Object3D>(o: O) { billboards.push(o); return o; },
    _billboards: billboards, dispose };
  return api;
}

export type World = ReturnType<typeof createWorld>;
export interface SceneInstance { update?(t: number, a: number): void }
export interface SceneDef extends WorldOpts {
  loop: number; poster?: number; radius?: number; width?: number; hfit?: number; drift?: number; offset?: number;
  build(W: World): SceneInstance | void;
}

export interface MountOpts {
  lite: boolean;
  /** called after the first live frame has been drawn */
  onReady?: () => void;
}

// Mount a hero on a canvas: run loop, camera fit, pointer parallax, pause when
// offscreen or the tab is hidden. Reduced motion / Save-Data / no-WebGL are
// handled by Hero3D, which never imports this module in those cases.
export function mountHero(canvas: HTMLCanvasElement, sceneDef: SceneDef, opts: MountOpts) {
  const W = createWorld(canvas, { ...sceneDef, lite: opts.lite });
  const L = sceneDef.loop || 12;
  const s = sceneDef.build(W) || {};
  const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
  const camDir = new THREE.Vector3().subVectors(W.camPos, W.camTarget).normalize();
  const onPointer = (e: PointerEvent) => { ptr.x = (e.clientX / innerWidth) * 2 - 1; ptr.y = (e.clientY / innerHeight) * 2 - 1; };
  // pointer parallax is a full-tier nicety; lite (touch, low-core) skips it
  if (!opts.lite) addEventListener("pointermove", onPointer, { passive: true });

  function resize() {
    const r = canvas.getBoundingClientRect(); if (!r.width) return;
    W.renderer.setSize(r.width, r.height, false); W.camera.aspect = r.width / r.height;
    // keep the diorama framed on narrow canvases by pulling the camera back:
    // fit a sphere of `radius` around the target into the frustum, whatever the aspect
    if (sceneDef.radius) {
      const v = THREE.MathUtils.degToRad(W.camera.fov / 2), h = Math.atan(Math.tan(v) * W.camera.aspect);
      let dist = sceneDef.radius / Math.sin(Math.min(v, h * (sceneDef.hfit || 1)));
      // wide scenes: also keep `width` (half-width of the set, in units) inside the frame on narrow screens
      if (sceneDef.width) dist = Math.max(dist, sceneDef.width / Math.tan(h) + 1.5);
      W.camPos.copy(W.camTarget).addScaledVector(camDir, dist);
    }
    W.camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  const _q = new THREE.Quaternion(), right = new THREE.Vector3(), up = new THREE.Vector3();
  function frame(t: number) {
    const tl = ((t % L) + L) % L;
    // camera: a slow periodic drift plus pointer parallax
    ptr.sx += (ptr.x - ptr.sx) * 0.04; ptr.sy += (ptr.y - ptr.sy) * 0.04;
    const drift = sceneDef.drift ?? 0.35, a = (TAU * tl) / L;
    const ox = Math.sin(a) * drift + ptr.sx * 0.6, oy = Math.cos(a * 2) * drift * 0.25 - ptr.sy * 0.35;
    right.subVectors(W.camPos, W.camTarget).cross(W.camera.up).normalize().negate();
    W.camera.position.copy(W.camPos).addScaledVector(right, ox).add(up.set(0, oy, 0));
    W.camera.lookAt(W.camTarget);
    s.update?.(tl, a);
    // billboards face the camera upright in world space, whatever their parent's rotation
    for (const b of W._billboards) {
      if (b.parent && b.parent !== W.scene) { b.parent.getWorldQuaternion(_q); b.quaternion.copy(_q.invert()).multiply(W.camera.quaternion); }
      else b.quaternion.copy(W.camera.quaternion);
    }
    W.renderer.render(W.scene, W.camera);
  }

  let visible = true, raf = 0, ready = false, disposed = false, paused = 0, pausedAt = 0;
  const start = performance.now();
  // start mid-story so the first live frame matches the poster underneath it
  const t0 = sceneDef.poster ?? 0;
  function loop() {
    if (disposed) return;
    if (!visible || document.hidden) { raf = 0; pausedAt = performance.now(); return; }
    if (pausedAt) { paused += performance.now() - pausedAt; pausedAt = 0; }
    frame((performance.now() - start - paused) / 1000 + t0 + (sceneDef.offset || 0));
    if (!ready) { ready = true; opts.onReady?.(); }
    raf = requestAnimationFrame(loop);
  }
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) loop(); }, { threshold: 0 });
  const onVis = () => { if (!document.hidden && !raf) loop(); };
  // Compile every shader off the main thread first (KHR_parallel_shader_compile
  // where the GPU has it): a cold synchronous compile on the first frame is a
  // multi-second long task on low-end phones.
  W.renderer.compileAsync(W.scene, W.camera).catch(() => {}).then(() => {
    if (disposed) return;
    io.observe(canvas);
    document.addEventListener("visibilitychange", onVis);
    loop();
  });

  return {
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      removeEventListener("pointermove", onPointer);
      W.dispose();
    },
  };
}
