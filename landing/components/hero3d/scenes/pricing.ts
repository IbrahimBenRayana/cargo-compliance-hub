// PRICING · "$45 per ISF, charged when CBP accepts."
// Shipments ride a belt through an acceptance gate, each with a tag. An accepted ISF is charged $45
// and turns gold; a rejected one isn't charged. Customs entry carries no price ("Talk to us").
import type * as THREE from "three";
import type { SceneDef, World } from "../engine";

export const scene: SceneDef = {
  loop: 12, poster: 6.6, radius: 6.0, width: 6.2,
  camera: { pos: [5, 7, 14], target: [0, 1.9, 0], fov: 27 },
  fit: { d: [1.054, -0.021, 0.077], m: [0.939, -0.019, 0.067] }, // measured by the poster harness fit pass
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    const L = 12;
    const belt = W.add(W.slab(L, .5, 2.2, M.navy, .18));
    const band = W.mesh(W.rbox(L - .3, .06, 1.8, .03), new THREE.MeshStandardMaterial({ color: '#2A3B5F', roughness: .8 })); band.position.y = .52; W.add(band);
    const rollers: THREE.Mesh[] = [];
    for (let i = 0; i < 24; i++) { const r = W.mesh(W.rbox(.06, .02, 1.82, .01), M.slate, false); r.position.set(-L / 2 + .3 + i * .5, .56, 0); W.add(r); rollers.push(r); }
    // gate
    const gate = new THREE.Group(); gate.position.set(.6, .5, 0); W.add(gate);
    for (const z of [-1.3, 1.3]) { const p = W.mesh(W.rbox(.34, 2.7, .34, .1), M.porcelain); p.position.set(0, 1.35, z); gate.add(p); }
    const top = W.mesh(W.rbox(.4, .36, 2.95, .1), M.porcelain); top.position.y = 2.76; gate.add(top);
    const light = W.mesh(W.rbox(.42, .1, 2.4, .04), new THREE.MeshStandardMaterial({ color: C.mist, emissive: C.mist, emissiveIntensity: .3 }), false); light.position.y = 2.55; gate.add(light);
    const flash = W.glow(C.emerald, 4, 0); flash.position.y = 1.6; gate.add(flash);
    const gtag = W.pill('CBP response', { h: .4, dot: C.slate }); gtag.position.set(0, 3.45, 0); gate.add(gtag); W.billboard(gtag);
    // shipments
    // Only the ISF has a public price. Entry is "Talk to us"; its accepted tag names no amount.
    const plans = [
      { label: '$45 · ISF', done: 'Charged $45 · accepted', ok: true, color: C.steel },
      { label: '$45 · ISF', done: 'Rejected · not charged', ok: false, color: C.denim },
      { label: 'Entry · Talk to us', done: 'Entry · accepted', ok: true, color: C.navy },
    ];
    const ships = plans.map((p) => {
      const g = W.add(W.clip(W.container(p.color, 2.2, .95, .95), -L / 2 + .05, L / 2 - .05));
      const before = W.pillTex(p.label, {});
      const after = p.ok
        ? W.pillTex(p.done, { dot: C.emerald, bg: '#FFF7E0', border: 'rgba(216,146,15,.5)' })
        : W.pillTex(p.done, { dot: C.rose, color: '#66728C' });
      const tag = W.pill(p.label, { h: .44 }); W.add(tag);
      return { ...p, g, tag, texs: { before, after } };
    });
    const setTag = (tag: ReturnType<World["pill"]>, tex: THREE.Texture) => { if (tag.material.map !== tex) { tag.material.map = tex; tag.material.needsUpdate = true; tag.scale.x = tex.userData.aspect / tag.geometry.parameters.width * tag.geometry.parameters.height; } };
    const gx = .6;

    return { update(t, a) {
      let flashK = 0, flashOk = true;
      ships.forEach((s, i) => {
        // each box crosses the belt once per loop; boxes are a third of the loop apart
        const u = ((t / L + i / 3) % 1);
        const x = -L / 2 - 1.2 + u * (L + 2.4);
        s.g.position.set(x, 1.0, 0);
        s.tag.position.set(x, 2.25, 1.7);
        const passed = x > gx;
        setTag(s.tag, passed ? s.texs.after : s.texs.before);
        s.tag.scale.y = 1; s.tag.material.opacity = Math.min(1, Math.min(x + L / 2 + .6, L / 2 + .6 - x) / .8);
        const d = Math.abs(x - gx);
        if (d < .9) { flashK = Math.max(flashK, 1 - d / .9); flashOk = s.ok; }
      });
      const col = flashOk ? C.emerald : C.rose;
      light.material.color.set(flashK > .05 ? col : C.mist); light.material.emissive.set(flashK > .05 ? col : C.mist); light.material.emissiveIntensity = .3 + flashK * 1.2;
      flash.material.color.set(col); flash.material.opacity = flashK * .7;
      rollers.forEach((r, i) => { r.position.x = -L / 2 + .3 + ((i * .5 + t * (L + 2.4) / L) % 11.5); });
    } };
  },
};
