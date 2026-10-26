// PLATFORM · "ABI filing software, from the ISF to liquidation."
// Round 2. One shipment, four stations in a row: ISF, entry summary, cargo release, liquidation.
// A gold box drives through each gate; the station's card turns accepted as it passes and the
// Focus Frame moves with it. Everything stands on one plinth and faces you.
import type { SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 12, poster: 6.3, radius: 5.5, width: 6.5,
  camera: { pos: [1.0, 4.6, 15], target: [0, 2.2, 0], fov: 26 },
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    W.add(W.slab(12.4, .4, 3.6, M.porcelain, .2));
    const rail = W.mesh(W.rbox(12, .06, .5, .03), M.mist); rail.position.set(0, .43, .9); W.add(rail);
    const prog = W.mesh(W.rbox(1, .07, .52, .03), M.goldGlow, false); prog.position.set(0, .44, .9); W.add(prog);
    const stations = [
      { x: -4.3, c: C.blue, e: 'Step 1', t: 'ISF-10 / ISF-5', ok: 'Accepted' },
      { x: -1.43, c: C.violet, e: 'Step 2', t: 'Entry · 7501', ok: 'Accepted' },
      { x: 1.43, c: C.emerald, e: 'Step 3', t: 'Release · 3461', ok: 'Released' },
      { x: 4.3, c: C.gold, e: 'Step 4 · 314 days', t: 'Liquidation', ok: 'Liquidated' },
    ].map((s) => {
      const g = new THREE.Group(); g.position.x = s.x; W.add(g);
      // gate over the rail
      for (const z of [.45, 1.35]) { const p = W.mesh(W.rbox(.12, 1.2, .12, .04), M.navy); p.position.set(0, 1.0, z); g.add(p); }
      const bar = W.mesh(W.rbox(.16, .16, 1.1, .05), new THREE.MeshStandardMaterial({ color: s.c, emissive: s.c, emissiveIntensity: .15 })); bar.position.set(0, 1.62, .9); g.add(bar);
      // the station's card, standing behind the rail on a small foot
      const foot = W.mesh(W.rbox(.7, .5, .5, .1), M.mist); foot.position.set(0, .6, -.7); g.add(foot);
      const stem = W.mesh(W.rbox(.08, 1.0, .08, .03), M.navy); stem.position.set(0, 1.3, -.7); g.add(stem);
      const mk = (chip: string, cc?: string) => W.cardFace({ h: 380, eyebrow: s.e, title: s.t, meta: chip, metaMono: false, rail: s.c, rows: 2, big: true, foot: '' });
      const fWait = mk('Waiting', C.slate), fOk = mk(s.ok, C.emerald);
      const card = W.card(fWait, { w: 2.7, aspect: 380 / 640, d: .07 }); card.position.set(0, 2.55, -.7); g.add(card);
      card.rotation.y = Math.atan2(W.camPos.x - s.x, W.camPos.z + .7);
      const glow = W.glow(s.c, 3, 0); glow.position.set(0, 2.55, -1.0); g.add(glow);
      return { ...s, g, bar, card, fOk, glow };
    });
    const box = W.add(W.container(C.gold, 1.2, .5, .5));
    const frame = W.add(W.focusFrame({ th: .06, arm: .32 }));
    // station times: the box parks under each gate in turn
    const park = [1.4, 3.8, 6.2, 8.6];
    const xAt = (t: number) => {
      let x = -6.3;
      for (let i = 0; i < 4; i++) x = lerp(x, stations[i].x, E.inOutCubic(win(t, park[i] - 1.2, park[i])));
      return lerp(x, 6.4, E.inOutCubic(win(t, 10.2, 11.4)));
    };

    return { update(t, a) {
      const x = xAt(t);
      box.position.set(x, .75, .9);
      box.scale.setScalar(Math.max(.001, Math.min(1, (6.2 - Math.abs(x)) / .5)));
      const reset = win(t, 11.2, 11.9);
      prog.scale.x = Math.max(.001, (Math.min(x, 6) + 6) * (1 - reset)); prog.position.x = -6 + prog.scale.x / 2;
      let cur = -1;
      stations.forEach((s, i) => {
        const done = t >= park[i] + .2 ? 1 : 0;
        s.card.userData.blendTo(s.fOk, done * (1 - reset));
        s.bar.material.emissiveIntensity = .15 + done * (1 - reset) * .7;
        s.glow.material.opacity = env(t, park[i] + .1, park[i] + 1.6, .3) * .5;
        if (t >= park[i] - .2) cur = i;
      });
      if (cur >= 0 && t < 10.4) {
        const s = stations[cur], lt = t - (park[cur] - .2);
        const c = s.card; const wp = new THREE.Vector3(); c.getWorldPosition(wp);
        frame.position.copy(wp).add(new THREE.Vector3(0, 0, .07).applyEuler(c.rotation)); frame.rotation.copy(c.rotation);
        frame.userData.set(2.7, 2.7 * 380 / 640, Math.min(1, 1 - E.outBack(win(lt, 0, .5)) + win(lt, 2.0, 2.4)), lt > .4 && lt < 1.3 ? win(lt, .4, 1.3) : 0);
        frame.userData.halo.material.color.set(C.emerald); frame.visible = true;
      } else frame.visible = false;
    } };
  },
};
