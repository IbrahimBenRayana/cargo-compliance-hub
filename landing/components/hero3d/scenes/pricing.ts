// PRICING · "A price per shipment, charged when CBP accepts."
// Shipments ride a belt through an acceptance gate. Each carries its price. Accepted: the price is
// charged and turns gold. Rejected: not charged. The gate is the only place money changes hands.
import type * as THREE from "three";
import type { SceneDef, World } from "../engine";

export const scene: SceneDef = {
  loop: 12, poster: 6.6, radius: 6.0, width: 6.2,
  camera: { pos: [5, 7, 14], target: [0, 1.9, 0], fov: 27 },
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
    const plans = [
      { price: '$45', name: 'ISF', ok: true, color: C.steel },
      { price: '$180', name: 'ISF + Entry', ok: false, color: C.denim },
      { price: '$280', name: 'Complete', ok: true, color: C.navy },
    ];
    const ships = plans.map((p) => {
      const g = W.add(W.clip(W.container(p.color, 2.2, .95, .95), -L / 2 + .05, L / 2 - .05));
      const before = W.pillTex(`${p.price} · ${p.name}`, {});
      const acc = W.pillTex(`Charged ${p.price} · accepted`, { dot: C.emerald, bg: '#FFF7E0', border: 'rgba(216,146,15,.5)' });
      const rej = W.pillTex('Rejected · not charged', { dot: C.rose, color: '#66728C' });
      const tag = W.pill(`${p.price} · ${p.name}`, { h: .44 }); W.add(tag);
      return { ...p, g, tag, texs: { before, after: p.ok ? acc : rej } };
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
