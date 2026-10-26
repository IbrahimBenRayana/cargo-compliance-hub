// NVOCCs & FORWARDERS · "Every house bill on a deadline clock."
// Round 2. One master bill, six house bills. The box opens and the house bills lift out into a clean
// two-by-three grid, each with its own deadline ring. The Focus Frame takes in all six, a bulk submit
// runs across them and each turns accepted. Then they file back into the box.
import type * as THREE from "three";
import type { SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 12, poster: 6.9, radius: 5.5, width: 4.9,
  camera: { pos: [2.6, 5.4, 15], target: [0, 3.0, 0], fov: 26 },
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    W.add(W.slab(9.6, .4, 4.6, M.porcelain, .2));
    // master container, door end turned toward you
    const box = new THREE.Group(); box.position.set(0, .4, 1.0); box.rotation.y = -1.05; W.add(box);
    const body = W.container(C.navy, 3.0, 1.3, 1.3); body.position.y = .65; box.add(body);
    const doors = [-1, 1].map(s => { const pivot = new THREE.Group(); pivot.position.set(1.51, .65, s * .64); const d = W.mesh(W.rbox(.06, 1.22, .62, .03), M.steel); d.position.z = -s * .31; pivot.add(d);
      for (const zz of [-.15, .15]) { const bar = W.mesh(W.rbox(.03, 1.12, .03, .01), M.slate); bar.position.set(.04, 0, -s * .31 + zz); pivot.add(bar); } box.add(pivot); return { pivot, s }; });
    const inside = W.glow(C.gold, 2.4, 0); inside.position.set(1.4, .7, 0); box.add(inside);
    const mbol = W.pill('MBOL OOLU210577643', { h: .42, mono: true }); mbol.position.set(1.0, 1.9, 1.2); W.add(mbol);
    // house bills
    const N = 6, cw = 2.4, ar = .5, chh = cw * ar;
    const slot = (i: number) => new THREE.Vector3((i % 3 - 1) * 2.75, 4.95 - Math.floor(i / 3) * 1.5, -1.0);
    const hrs = [31, 44, 52, 67, 75, 90];
    const mk = (i: number, ok: boolean) => W.cardFace({ h: 320, eyebrow: `House bill ${String(i + 1).padStart(2, '0')}`, title: `HBL ${4410 + i * 7}`, meta: ok ? 'ISF-10 accepted' : `Due in ${hrs[i]}h`, metaMono: false, rail: ok ? C.emerald : C.amber, rows: 0 });
    const cards: { c: THREE.Group; ring: THREE.Group; ok: THREE.Texture; home: THREE.Vector3; rot: THREE.Euler; frac: number }[] = [];
    for (let i = 0; i < N; i++) {
      const c = W.card(mk(i, false), { w: cw, aspect: ar, d: .06 }); W.add(c);
      const ring = W.clockRing({ r: .3, tube: .03, ticks: 0, trackMat: M.mist }); ring.position.set(cw / 2 - .5, 0, .05); c.add(ring);
      const p = slot(i); c.position.copy(p); W.faceCam(c, -.06);
      cards.push({ c, ring, ok: mk(i, true), home: p, rot: c.rotation.clone(), frac: .25 + (1 - hrs[i] / 100) * .6 });
    }
    const bulk = W.pill('Bulk submit · 6 house bills', { h: .44, dot: C.gold }); bulk.position.set(0, 6.25, -1.0); W.add(bulk);
    const frame = W.add(W.focusFrame({ th: .07, arm: .4 })); frame.position.set(0, 4.2, -.95); frame.rotation.copy(cards[1].rot);
    const origin = new THREE.Vector3().copy(box.position).add(new THREE.Vector3(1.6, .8, 0).applyEuler(box.rotation));

    return { update(t, a) {
      const open = E.inOutCubic(win(t, .3, 1.1)) * (1 - E.inOutCubic(win(t, 11.0, 11.8)));
      doors.forEach(({ pivot, s }) => { pivot.rotation.y = s * open * 1.7; });
      inside.material.opacity = open * .7;
      cards.forEach((o, i) => {
        const out = E.outCubic(win(t, .9 + i * .22, 2.2 + i * .22)), back = E.inOutCubic(win(t, 9.6 + (N - 1 - i) * .14, 10.8 + (N - 1 - i) * .14));
        const k = out * (1 - back);
        o.c.position.lerpVectors(origin, o.home, k); o.c.position.y += Math.sin(Math.PI * k) * .5;
        o.c.rotation.copy(o.rot); o.c.scale.setScalar(.15 + .85 * k);
        W.fadeCard(o.c, Math.min(1, k * 2.5));
        const hit = win(t, 5.6 + i * .3, 6.0 + i * .3);
        o.c.userData.blendTo(o.ok, hit * (1 - back));
        o.ring.userData.setSweep(lerp(o.frac, 1, hit));
        (o.ring.children[1] as THREE.Mesh).material = hit > .5 ? M.emerald : M.goldGlow;
      });
      // the frame takes in the whole grid for the bulk submit
      const lock = E.outBack(win(t, 4.2, 4.9)), rel = win(t, 8.6, 9.2);
      frame.userData.set(8.0, 2.9, Math.min(1, 1 - lock + rel), t > 7.3 && t < 8.4 ? win(t, 7.3, 8.4) : 0);
      frame.userData.halo.material.color.set(C.emerald);
      bulk.scale.setScalar(E.outBack(win(t, 4.6, 5.1)) * (1 - win(t, 8.8, 9.2)) + .001);
      mbol.position.y = 1.9 + Math.sin(a * 2) * .03;
    } };
  },
};
