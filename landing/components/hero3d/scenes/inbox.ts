// INBOX · "Customs filing tracking, ranked by what needs you now"
// A rolodex of filings on a wheel. A filing turns critical, climbs to the top, the Focus Frame locks,
// the rejection gets fixed and the card files itself away. The wheel settles back.
import type * as THREE from "three";
import type { CardFaceOpts, SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 12, poster: 4.6, radius: 5.6,
  camera: { pos: [6.5, 5.0, 13.5], target: [0, 2.9, 0], fov: 26 },
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    const F = (o: CardFaceOpts) => W.cardFace({ h: 232, rows: 0, ...o });
    const faces = [
      F({ title: 'ISF-10 · INV-4502', meta: 'MBOL MAEU9381-2', chip: 'Due in 4h', chipColor: C.amber, rail: C.amber }),
      F({ title: 'Possible UFLPA exposure', meta: 'INV-4198 · review origin', metaMono: false, chip: 'Review', chipColor: C.amber, rail: C.amber }),
      F({ title: 'Entry 230-1148293-5', meta: 'PSC deadline approaching', metaMono: false, chip: 'Medium', chipColor: C.blue, rail: C.blue }),
      F({ title: '3 drafts ready for review', meta: 'Checks passed', metaMono: false, chip: 'Low', chipColor: C.slate, rail: C.slate }),
      F({ title: 'ISF-5 · 3 house bills', meta: 'OOLU210577643', chip: 'Due in 2d', chipColor: C.blue, rail: C.blue }),
    ];
    const fCrit = F({ title: 'INV-4421 · CBP rejected', meta: 'Manufacturer party missing tax ID', metaMono: false, chip: 'Critical', chipColor: C.rose, rail: C.rose });
    const fCalm = F({ title: 'INV-4421 · Entry 7501', meta: 'Draft', metaMono: false, chip: 'Draft', chipColor: C.slate, rail: C.slate });
    const fFixed = F({ title: 'INV-4421 · resubmitted', meta: 'Fix applied · 3 steps', metaMono: false, chip: 'Accepted', chipColor: C.emerald, rail: C.emerald });
    const cw = 4.2, ar = 232 / 640, R = 5.2, step = .32, cy = 3.2, cz = -5.2;
    // a picker drum: slot k sits on the front of a horizontal cylinder, top first
    const phi = (k: number) => (2 - k) * step;
    const slot = (k: number, out = 0) => new THREE.Vector3(0, cy + Math.sin(phi(k)) * (R + out), cz + Math.cos(phi(k)) * (R + out));
    const tilt = (k: number) => -phi(k);
    const mk = (f: THREE.Texture) => { const c = W.card(f, { w: cw, aspect: ar, d: .1 }); W.add(c); return c; };
    const stack = faces.map(mk);
    const hot = mk(fCalm);
    const frame = W.add(W.focusFrame({ th: .08, arm: .42 }));
    const glow = W.add(W.glow(C.rose, 6, 0));
    const yaw = 0;
    return { update(t, a) {
      // hot card: starts at bottom slot 5 (calm), turns critical at 1.2, climbs to slot 0 by 3.0
      const crit = win(t, 1.0, 1.4), climb = E.inOutCubic(win(t, 1.4, 3.2));
      const fix = E.inOutSine(win(t, 6.6, 7.2)), leave = E.inOutCubic(win(t, 8.4, 9.6));
      const back = E.inOutCubic(win(t, 9.2, 10.6)), ret = E.inOutCubic(win(t, 10.4, 11.8));
      const s = climb - back;                                    // others shift down while the hot card is on top
      stack.forEach((c, i) => { const k = i + s; c.position.copy(slot(k)); c.rotation.set(tilt(k), yaw, 0, 'YXZ'); });
      const hk = lerp(5, 0, climb);
      const hp = slot(hk, Math.sin(Math.PI * climb) * 1.3 + climb * .3); hot.position.copy(hp); hot.rotation.set(tilt(hk), yaw, 0, 'YXZ');
      // leave: slide right and fade; return: reappear at the bottom, calm
      hot.position.x += leave * 5.5;
      const vis = ret > 0 ? ret : 1 - leave;
      if (ret > 0) { const p = slot(5); hot.position.copy(p); hot.position.x = 0; hot.rotation.set(tilt(5), yaw, 0, 'YXZ'); }
      W.fadeCard(hot, vis);
      hot.userData.setFace(ret > 0 || t < 1.0 ? fCalm : fCrit);
      hot.userData.blendTo(fFixed, ret > 0 ? 0 : fix * (1 - leave));
      if (ret > 0) hot.userData.over.material.opacity = 0;
      // frame + glow
      const lock = E.outBack(win(t, 3.1, 3.8));
      frame.position.copy(hot.position).add(new THREE.Vector3(0, 0, .07).applyEuler(hot.rotation)); frame.rotation.copy(hot.rotation);
      frame.userData.set(cw, cw * ar, Math.min(1, 1 - lock + leave), t > 3.5 && t < 4.6 ? win(t, 3.5, 4.6) : (t > 7 && t < 8.2 ? win(t, 7, 8.2) : 0));
      frame.userData.halo.material.color.set(t > 6 ? C.emerald : C.gold);
      frame.visible = t > 2.6 && t < 9.6;
      glow.position.copy(hot.position).add(new THREE.Vector3(0, 0, -.6)); glow.material.opacity = crit * (1 - fix) * .35 * (1 - leave);
      glow.material.color.set(C.rose);
    } };
  },
};
