// COMPLIANCE · "Trade compliance software for what happens after entry"
// One idea: acceptance starts the clock. The accepted entry stands on the plinth under the Focus
// Frame, and a single gold line runs along the rail in front of it toward two milestones from the
// page's clock strip: the PSC deadline (day 299) and the estimated liquidation (about day 314).
// One milestone is lit at a time; the line rests, fades and starts again.
import type { SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 16, poster: 12.2, radius: 5.4, width: 5.4, drift: .22,
  camera: { pos: [3.2, 7.6, 14], target: [.3, 1.4, 0], fov: 26 },
  fit: { d: [1.253, 0, 0.073], m: [1.116, -0.004, 0.058] }, // measured by the poster harness fit pass
  build(W) {
    const { THREE, C, M, E, win, lerp } = W;
    W.add(W.slab(8.6, .4, 4.8, M.porcelain, .2));

    // the accepted entry: a card on a low porcelain stand at the start of the rail
    const cx = -2.4, cz = -1.3, cw = 3.2, ar = .625, ch = cw * ar;
    const stand = W.mesh(W.rbox(2.3, .22, .7, .08), M.porcelain); stand.position.set(cx, .51, cz); W.add(stand);
    const face = W.cardFace({ eyebrow: 'Entry', title: 'Accepted by CBP', big: true, meta: '230-1148293-5', rail: C.emerald, rows: 2 });
    const card = W.card(face, { w: cw, aspect: ar, d: .09 });
    const cy = .62 + ch / 2 + .04;
    card.position.set(cx, cy, cz); W.faceCam(card, -.26); W.add(card);
    const frame = W.add(W.focusFrame({ th: .06, arm: .3 })); frame.rotation.copy(card.rotation);
    frame.userData.halo.material.color.set(C.gold);

    // the rail: a thin track along the front of the plinth, from day 0 to liquidation
    const y = .47, z = 1.45, x0 = cx, x1 = 3.4;
    const track = W.tube([[x0, y, z], [x1, y, z]], .045, M.mist, 60); W.add(track);
    const fillMat = new THREE.MeshStandardMaterial({ color: C.gold, roughness: .3, metalness: .2, emissive: C.gold, emissiveIntensity: W.dark ? .5 : .7, transparent: true });
    const fill = W.tube([[x0, y, z], [x1 + .001, y, z]], .075, fillMat, 120); W.add(fill);
    const head = W.mesh(new THREE.SphereGeometry(.13, 20, 14), fillMat, false); W.add(head);
    const start = W.mesh(new THREE.SphereGeometry(.13, 20, 14), M.emerald, false); start.position.set(x0, y, z); W.add(start);

    // two milestones, each a slim pin with a pill; the lit pill fades in over the plain one
    const lit = W.dark
      ? { dot: C.gold, bg: '#16233F', color: '#F3F5F9', border: 'rgba(251,190,36,.8)' }
      : { dot: C.goldDark, bg: '#FFF7E0', border: 'rgba(216,146,15,.55)' };
    const marks = [
      { x: 1.55, h: .85, text: 'PSC deadline · day 299' },
      { x: x1, h: 2.3, text: 'Liquidation · about day 314' },
    ].map((m) => {
      const k = (m.x - x0) / (x1 - x0);
      const pin = W.mesh(W.rbox(.06, m.h, .06, .025), M.slate, false); pin.position.set(m.x, y + m.h / 2, z); W.add(pin);
      const knobMat = new THREE.MeshStandardMaterial({ color: C.mist, roughness: .35, emissive: C.gold, emissiveIntensity: 0 });
      const knob = W.mesh(new THREE.SphereGeometry(.12, 20, 14), knobMat, false); knob.position.set(m.x, y + m.h, z); W.add(knob);
      const base = W.pill(m.text, { dot: C.slate, h: .5 }); base.position.set(m.x, y + m.h + .45, z); W.add(base);
      const on = W.pill(m.text, { ...lit, h: .5 }); on.position.copy(base.position); on.renderOrder = 11; on.material.opacity = 0; W.add(on);
      const halo = W.glow(C.gold, 1.1, 0); halo.position.copy(knob.position); W.add(halo);
      return { k, knobMat, on, halo };
    });
    const gold = new THREE.Color(C.gold), mist = new THREE.Color(W.dark ? '#3A4A6E' : C.mist);

    return { update(t, a) {
      // progress: ease out to the PSC deadline, rest, ease on to liquidation, rest, fade, again
      const kP = marks[0].k;
      const u = lerp(0, kP, E.outCubic(win(t, 1.0, 6.0))) + lerp(0, 1 - kP, E.outCubic(win(t, 7.6, 11.0)));
      const fade = 1 - E.outCubic(win(t, 13.6, 15.2));
      fill.userData.setProgress(0, Math.max(.001, u));
      fillMat.opacity = fade; head.visible = u > .004;
      head.position.set(lerp(x0, x1, u), y, z); head.scale.setScalar(.6 + .4 * fade);
      // one milestone lit at a time: PSC while the line rests there, liquidation at the end
      const pscOn = win(u, kP - .015, kP) * (1 - win(u, .9, .99)) * fade;
      const liqOn = win(u, .985, 1) * fade;
      [pscOn, liqOn].forEach((k, i) => {
        const m = marks[i];
        m.on.material.opacity = k;
        m.knobMat.color.copy(mist).lerp(gold, k); m.knobMat.emissiveIntensity = k * (W.dark ? .6 : .8);
        m.halo.material.opacity = k * (W.dark ? .55 : .4);
      });
      // the entry stays in focus; a slow breath keeps it alive
      card.position.y = cy + Math.sin(a) * .03;
      frame.position.copy(card.position).add(new THREE.Vector3(0, 0, .07).applyEuler(card.rotation));
      frame.userData.set(cw, ch, 0, t > 1.0 && t < 2.6 ? win(t, 1.0, 2.6) : 0);
    } };
  },
};
