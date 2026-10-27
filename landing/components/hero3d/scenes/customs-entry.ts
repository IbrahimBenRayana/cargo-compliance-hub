// CUSTOMS ENTRY · "Customs entry software that starts from your accepted ISF"
// The accepted ISF hands its parties and bond to the 7501 as glowing data tiles. The entry passes
// its checks, cargo release (3461) turns the gate light green, and the truck rolls out.
import type { SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 12, poster: 4.4, radius: 5.9, width: 5.6,
  camera: { pos: [9.5, 7.5, 13], target: [0, 2.2, 0], fov: 27 },
  fit: { d: [1.104, -0.047, 0.157], m: [1.007, -0.021, 0.138] }, // measured by the poster harness fit pass
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    // quay
    const quay = W.add(W.slab(11, .5, 6.6, M.porcelain, .2));
    // back of the quay: stacked boxes and a gantry crane
    const r = W.rng(21), stacks = [], pal = [C.navy, C.steel, C.denim, C.porcelain, C.slate, C.navyDeep];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { const h = 1 + Math.floor(r() * 3); for (let k = 0; k < h; k++) stacks.push({ x: -4.4 + i * 1.32, y: .5 + .27 + k * .53, z: -2.2 - j * .54, color: pal[Math.floor(r() * pal.length)] }); }
    W.add(W.containerField(stacks, 1.25, .52, .5));

    const lane = W.mesh(W.rbox(10.8, .04, 1.6, .02), W.M.mist); lane.position.set(0, .52, 1.2); W.add(lane);
    for (let i = -5; i <= 5; i++) { const d = W.mesh(W.rbox(.5, .02, .07, .01), M.paper, false); d.position.set(i * 1.0, .55, 1.2); W.add(d); }
    // release gate
    const gate = new THREE.Group(); gate.position.set(2.2, .5, 1.2); W.add(gate);
    for (const z of [-1.15, 1.15]) { const p = W.mesh(W.rbox(.3, 2.6, .3, .08), M.navy); p.position.set(0, 1.3, z); gate.add(p); }
    const beamG = W.mesh(W.rbox(.36, .34, 2.66, .08), M.navy); beamG.position.set(0, 2.66, 0); gate.add(beamG);
    const light = W.mesh(W.rbox(.38, .1, 2.2, .04), new THREE.MeshStandardMaterial({ color: C.amber, emissive: C.amber, emissiveIntensity: 1 }), false); light.position.set(0, 2.47, 0); gate.add(light);
    const lightGlow = W.glow(C.amber, 2.4, .6); lightGlow.position.set(.3, 2.4, 0); gate.add(lightGlow);
    const relPill = W.pill('Cargo release · 3461', { dot: C.amber, h: .42 }); relPill.position.set(0, 3.35, 0); gate.add(relPill);
    W.billboard(relPill);
    // trucks (two, so the loop is seamless), cut at the quay edges
    const trucks = [0, 1].map(() => W.add(W.clip(W.truck({ color: C.steel }), -5.45, 5.45)));
    trucks.forEach(tk => tk.position.set(0, .5, 1.2));
    // cards
    const fIsf = W.cardFace({ eyebrow: 'ISF-10', title: 'INV-4502', meta: 'MBOL MAEU9381-2', chip: 'Accepted', chipColor: C.emerald, rail: C.emerald, rows: 3 });
    const fEntryEmpty = W.cardFace({ eyebrow: 'Entry summary 7501', title: 'INV-4502', meta: 'Draft', chip: 'Draft', chipColor: C.slate, rail: C.violet, rows: 0 });
    const fEntryFull = W.cardFace({ eyebrow: 'Entry summary 7501', title: 'INV-4502', meta: 'Parties · bond · HTS', chip: 'Checks passed', chipColor: C.emerald, rail: C.violet, rows: 3 });
    const isf = W.card(fIsf, { w: 3.1, d: .08 }); isf.position.set(-3.0, 3.6, -.6); W.faceCam(isf, -.06); W.add(isf);
    const ent = W.card(fEntryEmpty, { w: 3.1, d: .08 }); ent.position.set(1.2, 4.1, -.9); W.faceCam(ent, -.06); W.add(ent);
    const frame = W.add(W.focusFrame({ th: .075, arm: .4 }));
    // data tiles flying across
    const labels = ['Importer of record', 'Consignee', 'Bond', 'Manufacturer'];
    const tiles = labels.map((l) => { const p = W.pill(l, { h: .34, dot: C.violet, fs: 26 }); W.add(p); return p; });
    const pts = labels.map((_, i) => { const a0 = isf.position.clone().add(new THREE.Vector3(.2, .3 - i * .28, .1)); const b0 = ent.position.clone().add(new THREE.Vector3(-.2, .3 - i * .28, .1));
      const m0 = a0.clone().lerp(b0, .5).add(new THREE.Vector3(0, 1.1 - i * .15, .8)); return new THREE.QuadraticBezierCurve3(a0, m0, b0); });
    const glowE = W.add(W.glow(C.violet, 4, 0)); glowE.position.copy(ent.position).add(new THREE.Vector3(0, 0, -.4));

    return { update(t, a) {
      // tiles: 1.0 .. 4.4, staggered
      tiles.forEach((p, i) => { const k = E.inOutCubic(win(t, 1.0 + i * .45, 2.6 + i * .45)); p.position.copy(pts[i].getPoint(k)); p.visible = k > 0 && k < 1; p.scale.setScalar(.6 + Math.sin(Math.PI * k) * .5); });
      const filled = win(t, 2.6, 4.6);
      ent.userData.blendTo(fEntryFull, E.inOutSine(win(t, 4.2, 4.8)) * (1 - win(t, 11.2, 11.9)));
      glowE.material.opacity = env(t, 4.2, 6.5, .5) * .5;
      // frame: on the ISF first, then on the entry
      const onEntry = E.inOutCubic(win(t, 3.6, 4.4));
      const target = new THREE.Vector3().lerpVectors(isf.position, ent.position, onEntry).add(new THREE.Vector3(0, 0, .07));
      frame.position.copy(target); frame.rotation.copy(ent.rotation);
      const open = Math.max(1 - E.outBack(win(t, .3, 1.0)), win(t, 10.6, 11.4)) + Math.sin(Math.PI * win(t, 3.6, 4.4)) * .35;
      frame.userData.set(3.1, 3.1 * .625, Math.min(1, open), t > 4.6 && t < 5.8 ? win(t, 4.6, 5.8) : 0);
      frame.userData.halo.material.color.set(C.emerald);
      // gate: release at 6.0
      const rel = win(t, 5.8, 6.2) * (1 - win(t, 10.5, 11));
      const col = new THREE.Color(C.amber).lerp(new THREE.Color(C.emerald), rel);
      light.material.color.copy(col); light.material.emissive.copy(col); lightGlow.material.color.copy(col);
      // trucks: A waits at the gate then leaves; B arrives for the next loop
      const gx = -1.2;
      const goA = E.inOutCubic(win(t, 6.4, 10.4)), goB = E.inOutCubic(win(t, 8.8, 12));
      trucks[0].position.x = gx + goA * 9; trucks[1].position.x = gx - 9 + goB * 9;
      trucks.forEach(tk => { tk.position.y = .5 + Math.abs(Math.sin(t * 9)) * .006; });
      isf.position.y = 3.6 + Math.sin(a * 2) * .05; ent.position.y = 4.1 + Math.sin(a * 2 + 1) * .05;
    } };
  },
};
