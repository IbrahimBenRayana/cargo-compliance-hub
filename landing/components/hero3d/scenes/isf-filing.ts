// ISF FILING · "ISF filing software with a clock on every filing"
// One idea: every filing has a deadline clock. A vessel waits at the quay; on the quay stands one
// ISF under the Focus Frame inside a clock ring. The gold arc fills toward the deadline (24h before
// lading), the 72h, 48h and 24h alert ticks light as it passes, and the ISF is accepted before
// the line. The arc rests, fades and starts again.
import type { SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 16, poster: 12.0, radius: 6.0, width: 6.0, drift: .22,
  camera: { pos: [4.5, 5.4, 15.5], target: [-.8, 2.2, -.2], fov: 27 },
  fit: { d: [1.036, -0.084, -0.007], m: [0.923, -0.085, -0.007] }, // measured by the poster harness fit pass
  build(W) {
    const { THREE, C, M, E, win, TAU } = W;
    // water behind, porcelain quay in front
    const sea = W.add(W.sea({ w: 8.6, d: 4.6, loop: 16, amp: .05 })); sea.position.set(2.1, 0, -1.3);
    const quay = W.add(W.slab(4.6, .5, 3.4, M.porcelain, .18)); quay.position.set(-3.6, 0, .4);
    const ship = W.add(W.ship({ len: 6.0, beam: 2.0, seed: 4, tiers: 3 }));
    ship.position.set(2.5, -.16, -1.7);

    // the dial stands on the quay, turned to the camera
    const dx = -3.4, dz = .6, R = 2.25, cy = 3.35;
    const dial = new THREE.Group(); dial.position.set(dx, 0, dz);
    dial.rotation.y = Math.atan2(W.camPos.x - dx, W.camPos.z - dz); W.add(dial);
    const foot = W.cyl(.55, .22, M.porcelain); foot.position.y = .5 + .11; dial.add(foot);
    const stem = W.mesh(W.rbox(.09, cy - R - .72, .09, .03), M.navy); stem.position.y = .72 + (cy - R - .72) / 2; dial.add(stem);
    // clockwise from 12 o'clock; the deadline is back at the top
    const ang = (u: number) => Math.PI / 2 - u * TAU;
    const at = (u: number, r = R): [number, number, number] => [Math.cos(ang(u)) * r, cy + Math.sin(ang(u)) * r, 0];
    const ringPts = Array.from({ length: 97 }, (_, i) => at(i / 96));
    dial.add(W.tube(ringPts, .045, M.mist, 192));
    const fillMat = new THREE.MeshStandardMaterial({ color: C.gold, roughness: .3, metalness: .2, emissive: C.gold, emissiveIntensity: W.dark ? .5 : .7, transparent: true });
    const fill = W.tube(ringPts, .08, fillMat, 192); dial.add(fill);
    const head = W.mesh(new THREE.SphereGeometry(.13, 20, 14), fillMat, false); dial.add(head);
    // deadline mark at the top
    const dl = W.mesh(W.rbox(.07, .42, .07, .03), M.rose, false); dl.position.set(...at(0, R)); dial.add(dl);
    const dlPill = W.pill('Deadline · 24h before lading', { dot: C.rose, h: .54 }); dlPill.position.set(0, cy + R + .6, .05); dial.add(dlPill); W.billboard(dlPill);

    // the three alert ticks, spaced by hours on a 120-hour dial
    const lit = W.dark
      ? { dot: C.gold, bg: '#16233F', color: '#F3F5F9', border: 'rgba(251,190,36,.8)', mono: true }
      : { dot: C.goldDark, bg: '#FFF7E0', border: 'rgba(216,146,15,.55)', mono: true };
    const gold = new THREE.Color(C.gold), mist = new THREE.Color(W.dark ? '#3A4A6E' : C.mist);
    const ticks = [72, 48, 24].map((hrs) => {
      const k = 1 - hrs / 120;
      const knobMat = new THREE.MeshStandardMaterial({ color: C.mist, roughness: .35, emissive: C.gold, emissiveIntensity: 0 });
      const knob = W.mesh(new THREE.SphereGeometry(.12, 20, 14), knobMat, false); knob.position.set(...at(k, R)); knob.position.z = .02; dial.add(knob);
      const p = at(k, R + .72);
      const base = W.pill(`${hrs}h`, { dot: C.slate, h: .5, mono: true }); base.position.set(p[0], p[1], .05); dial.add(base); W.billboard(base);
      const on = W.pill(`${hrs}h`, { ...lit, h: .5 }); on.position.copy(base.position); on.renderOrder = 11; on.material.opacity = 0; dial.add(on); W.billboard(on);
      return { k, knobMat, on };
    });

    // the ISF inside the ring
    const cw = 2.85, ar = .625, ch = cw * ar;
    const fDraft = W.cardFace({ title: 'ISF-10 · INV-4502', meta: 'MBOL MAEU9381-2', chip: 'Draft', chipColor: C.amber, rail: C.amber, rows: 2 });
    const fOk = W.cardFace({ title: 'ISF-10 · INV-4502', meta: 'MBOL MAEU9381-2', chip: 'Accepted', chipColor: C.emerald, rail: C.emerald, rows: 2 });
    const card = W.card(fDraft, { w: cw, aspect: ar, d: .08 }); card.position.set(0, cy, .05); dial.add(card);
    const frame = W.focusFrame({ th: .055, arm: .26 }); dial.add(frame);
    frame.userData.halo.material.color.set(C.emerald);
    const END = .9;  // the arc stops past the 24h alert, before the deadline

    return { update(t, a) {
      sea.userData.update(t);
      ship.position.y = -.16 + sea.userData.height(0, 0, t) * .5; ship.rotation.z = Math.sin(a + 1) * .006;
      // the clock: one slow pass, then rest, fade and start again
      const u = END * E.inOutSine(win(t, 1.0, 10.0));
      const fade = 1 - E.outCubic(win(t, 13.6, 15.2));
      fill.userData.setProgress(0, Math.max(.001, u));
      fillMat.opacity = fade; head.visible = u > .004;
      head.position.set(...at(u, R)); head.scale.setScalar(.6 + .4 * fade);
      ticks.forEach((m) => {
        const k = win(u, m.k - .012, m.k) * fade;
        m.on.material.opacity = k;
        m.knobMat.color.copy(mist).lerp(gold, k); m.knobMat.emissiveIntensity = k * (W.dark ? .6 : .8);
      });
      // accepted before the deadline
      const ok = E.outCubic(win(t, 10.2, 11.0)) * (1 - E.outCubic(win(t, 15.0, 15.8)));
      card.userData.blendTo(fOk, ok);
      frame.position.set(card.position.x, card.position.y, card.position.z + .06);
      frame.userData.set(cw, ch, 0, t > 10.4 && t < 12.0 ? win(t, 10.4, 12.0) : 0);
    } };
  },
};
