// THANKS · "You're booked."
// A calendar tile. The Focus Frame settles on one day, the day turns gold, a check lands,
// and the invite slides into an inbox tray.
import type { SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 10, poster: 5.0, radius: 4.8,
  camera: { pos: [4, 7, 12], target: [0, 1.8, 0], fov: 27 },
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    const cal = new THREE.Group(); cal.position.set(-.6, 2.0, 0); cal.rotation.set(-.2, .25, 0); W.add(cal);
    const body = W.mesh(W.rbox(4.2, 3.8, .3, .2), M.paper); cal.add(body);
    const head = W.mesh(W.rbox(4.2, .8, .32, .2), M.navy); head.position.y = 1.5; cal.add(head);
    for (const x of [-1.2, 1.2]) { const ring = W.mesh(new THREE.TorusGeometry(.16, .05, 10, 24), M.gold); ring.position.set(x, 1.95, .05); cal.add(ring); }
    const days = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      const d = W.mesh(W.rbox(.62, .52, .06, .08), new THREE.MeshStandardMaterial({ color: C.porcelain, roughness: .6 }), false);
      d.position.set(-1.5 + c * .75, .65 - r * .62, .17); cal.add(d); days.push(d);
    }
    const pick = days[8];
    const check = W.mesh(new THREE.TorusGeometry(.0001, .0001, 3, 3), M.emerald, false);
    const chk = new THREE.Group(); chk.position.copy(pick.position).add(new THREE.Vector3(0, 0, .12)); cal.add(chk);
    const s1 = W.mesh(W.rbox(.06, .2, .05, .02), M.navyDeep, false); s1.position.set(-.08, -.03, 0); s1.rotation.z = .8; chk.add(s1);
    const s2 = W.mesh(W.rbox(.06, .38, .05, .02), M.navyDeep, false); s2.position.set(.07, .05, 0); s2.rotation.z = -.6; chk.add(s2);
    const frame = W.focusFrame({ th: .05, arm: .2 }); cal.add(frame);
    const glow = W.glow(C.gold, 2.2, 0); glow.position.copy(pick.position).add(new THREE.Vector3(0, 0, .3)); cal.add(glow);
    // tray + invite
    const tray = new THREE.Group(); tray.position.set(2.9, 0, 1.2); W.add(tray);
    const tb = W.mesh(W.rbox(2.2, .5, 1.6, .12), M.navy); tb.position.y = .25; tray.add(tb);
    const tin = W.mesh(W.rbox(1.9, .1, 1.3, .05), M.mist); tin.position.y = .48; tray.add(tin);
    const invite = W.card(W.cardFace({ eyebrow: 'Calendar invite', title: 'MyCargoLens demo', meta: '20 min · video call', metaMono: false, rail: C.gold, rows: 0, h: 320 }), { w: 1.9, aspect: 320 / 640, d: .04 }); W.add(invite);

    return { update(t, a) {
      const lock = E.outBack(win(t, .8, 1.5)), gold = win(t, 1.6, 2.0), ck = E.outBack(win(t, 2.0, 2.5));
      const reset = win(t, 8.8, 9.6);
      frame.position.copy(pick.position).add(new THREE.Vector3(0, 0, .14));
      frame.userData.set(.62, .52, Math.min(1, 1 - lock + reset), t > 1.6 && t < 2.6 ? win(t, 1.6, 2.6) : 0);
      pick.material.color.set(gold > .5 && reset < .5 ? C.gold : C.porcelain); pick.material.emissive = new THREE.Color(C.gold); pick.material.emissiveIntensity = gold * .3 * (1 - reset);
      chk.scale.setScalar(ck * (1 - reset) + .001); glow.material.opacity = gold * .6 * (1 - reset);
      // invite flies from the calendar into the tray 3.0..5.0
      const k = E.inOutCubic(win(t, 3.0, 5.0)), out = win(t, 8.6, 9.4);
      const from = new THREE.Vector3(.6, 2.6, .6), to = new THREE.Vector3(2.9, .62, 1.2);
      const p = new THREE.Vector3().lerpVectors(from, to, k); p.y += Math.sin(Math.PI * k) * 1.2;
      invite.position.copy(p); invite.rotation.set(-Math.PI / 2 * E.inOutCubic(win(t, 4.0, 5.0)), .25 * (1 - k), 0);
      W.fadeCard(invite, Math.min(win(t, 2.8, 3.2), 1 - out));
      cal.position.y = 2.0 + Math.sin(a) * .05;
    } };
  },
};
