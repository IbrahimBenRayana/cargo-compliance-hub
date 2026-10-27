// SECURITY · "Security at MyCargoLens"
// Round 2. Sign in, roles, record, left to right on one plinth. A six-digit MFA code fills in and the
// padlock opens. The person's role lights up (Owner, Admin, Operator, Viewer). Every action lands in
// the audit log, including the CBP response. The Focus Frame follows the story.
import type * as THREE from "three";
import type { SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 12, poster: 7.8, radius: 5.1, width: 6.0,
  camera: { pos: [1.2, 5.2, 14.5], target: [0, 2.3, 0], fov: 26 },
  fit: { d: [0.959, -0.053, -0.018], m: [1.018, 0.004, -0.022] }, // measured by the poster harness fit pass
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    W.add(W.slab(11.4, .45, 3.4, M.porcelain, .2));
    const face = <O extends THREE.Object3D>(o: O) => { o.rotation.y = Math.atan2(W.camPos.x - o.position.x, W.camPos.z - o.position.z) * .8; return o; };
    // ---- 1. sign in: phone with the code, padlock above
    const code = '482913';
    const phoneTex = (n: number) => W.canvasTex(400, 640, (g) => {
      W.rr(g, 0, 0, 400, 640, 48); g.fillStyle = '#14213D'; g.fill();
      W.rr(g, 18, 18, 364, 604, 36); g.fillStyle = '#fff'; g.fill();
      g.font = `700 34px ${W.FONT}`; g.fillStyle = '#0F1A30'; g.fillText('Sign in', 46, 110);
      g.font = `500 22px ${W.FONT}`; g.fillStyle = '#66728C'; g.fillText('Enter the 6-digit code', 46, 150); g.fillText('from your authenticator', 46, 180);
      for (let i = 0; i < 6; i++) { const x = 46 + i * 52 + (i > 2 ? 10 : 0); W.rr(g, x, 236, 42, 60, 10); g.fillStyle = i < n ? 'rgba(251,190,36,.16)' : 'rgba(30,45,77,.05)'; g.fill(); g.lineWidth = 2; g.strokeStyle = i === n ? '#FBBE24' : 'rgba(30,45,77,.15)'; g.stroke();
        if (i < n) { g.font = `600 34px ${W.MONO}`; g.fillStyle = '#0F1A30'; g.textAlign = 'center'; g.fillText(code[i], x + 21, 278); g.textAlign = 'left'; } }
      W.rr(g, 46, 340, 308, 64, 14); g.fillStyle = n >= 6 ? '#10B981' : '#1E2D4D'; g.fill();
      g.font = `650 26px ${W.FONT}`; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(n >= 6 ? 'Verified' : 'Continue', 200, 381); g.textAlign = 'left';
      g.font = `500 20px ${W.FONT}`; g.fillStyle = '#8C99B8'; g.fillText('Or use a recovery code', 46, 456);
    });
    const phoneT = [0, 1, 2, 3, 4, 5, 6].map(phoneTex);
    const phone = W.card(phoneT[0], { w: 1.75, aspect: 640 / 400, d: .14 }); phone.position.set(-3.9, 2.25, 0); face(phone); W.add(phone);
    const pfoot = W.mesh(W.rbox(1.2, .25, .7, .08), M.navy); pfoot.position.set(-3.9, .58, 0); W.add(pfoot);
    const lock = new THREE.Group(); lock.position.set(-3.9, 4.55, 0); W.add(lock);
    const lockMat = new THREE.MeshStandardMaterial({ color: C.navy, roughness: .35, metalness: .3 });
    const lbody = W.mesh(W.rbox(.78, .62, .34, .12), lockMat); lock.add(lbody);
    const hole = W.mesh(new THREE.CylinderGeometry(.07, .07, .05, 16), M.gold, false); hole.rotation.x = Math.PI / 2; hole.position.set(0, .03, .18); lock.add(hole);
    const shackle = W.mesh(new THREE.TorusGeometry(.24, .055, 12, 32, Math.PI), M.slate, false); shackle.position.y = .3; lock.add(shackle);
    const lglow = W.glow(C.emerald, 1.8, 0); lock.add(lglow);
    // ---- 2. roles: four badges in a 2x2 grid
    const roles = [['Owner', 'Everything, plus billing'], ['Admin', 'People, templates, audit log'], ['Operator', 'Create and submit filings'], ['Viewer', 'Read and export PDFs']];
    const badgeTex = (r: string[], on: boolean) => W.canvasTex(560, 260, (g) => {
      W.rr(g, 0, 0, 560, 260, 30); g.fillStyle = '#fff'; g.fill(); g.lineWidth = on ? 6 : 3; g.strokeStyle = on ? '#FBBE24' : 'rgba(30,45,77,.12)'; g.stroke();
      g.beginPath(); g.arc(70, 92, 30, 0, TAU); g.fillStyle = on ? '#FBBE24' : '#E4E9F2'; g.fill();
      g.font = `700 30px ${W.FONT}`; g.fillStyle = on ? '#0F1A30' : '#8C99B8'; g.textAlign = 'center'; g.fillText(r[0][0], 70, 103); g.textAlign = 'left';
      g.font = `700 40px ${W.FONT}`; g.fillStyle = '#0F1A30'; g.fillText(r[0], 124, 106);
      g.font = `500 26px ${W.FONT}`; g.fillStyle = '#66728C'; g.fillText(r[1], 40, 190);
      if (on) { W.rr(g, 400, 66, 124, 46, 23); g.fillStyle = 'rgba(16,185,129,.14)'; g.fill(); g.font = `650 22px ${W.FONT}`; g.fillStyle = '#0E8A62'; g.fillText('Active', 428, 97); }
    });
    const badges = roles.map((r, i) => {
      const b = W.card(badgeTex(r, false), { w: 2.05, aspect: 260 / 560, d: .06 });
      b.position.set((i % 2 ? 1 : -1) * 1.12, 3.15 - Math.floor(i / 2) * 1.12, -.2); face(b); W.add(b);
      return { b, on: badgeTex(r, true) };
    });
    const rstand = W.mesh(W.rbox(4.4, .2, .8, .08), M.navy); rstand.position.set(0, .55, -.2); W.add(rstand);
    for (const x of [-1.6, 1.6]) { const p = W.mesh(W.rbox(.08, 1.4, .08, .03), M.navy); p.position.set(x, 1.3, -.25); W.add(p); }
    const rtag = W.add(W.pill('Four roles', { h: .4 })); rtag.position.set(0, 4.3, -.2);
    // ---- 3. the audit log
    const rows = [
      ['10:42:17', 'Signed in with MFA', 'Operator'], ['10:42:51', 'ISF-10 submitted', 'Operator'],
      ['10:42:53', 'CBP response logged', 'System'], ['10:44:02', 'Audit log exported (CSV)', 'Admin'],
    ];
    const logTex = (n: number) => W.canvasTex(640, 560, (g) => {
      W.rr(g, 0, 0, 640, 560, 34); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(30,45,77,.12)'; g.stroke();
      g.font = `700 32px ${W.FONT}`; g.fillStyle = '#0F1A30'; g.fillText('Audit log', 40, 72);
      g.font = `500 22px ${W.FONT}`; g.fillStyle = '#66728C'; g.fillText('Every action and every CBP request', 40, 108);
      rows.forEach((r, i) => {
        const y = 160 + i * 92, on = i < n;
        W.rr(g, 28, y - 10, 584, 76, 14); g.fillStyle = on ? (i === n - 1 ? 'rgba(251,190,36,.12)' : 'rgba(30,45,77,.04)') : 'rgba(30,45,77,.02)'; g.fill();
        if (!on) return;
        g.font = `500 22px ${W.MONO}`; g.fillStyle = '#8C99B8'; g.fillText(r[0], 48, y + 36);
        g.font = `600 25px ${W.FONT}`; g.fillStyle = '#0F1A30'; g.fillText(r[1], 172, y + 36);
        g.font = `500 21px ${W.FONT}`; g.fillStyle = '#B07A0C'; g.textAlign = 'right'; g.fillText(r[2], 594, y + 36); g.textAlign = 'left';
      });
    });
    const logT = [0, 1, 2, 3, 4].map(logTex);
    const log = W.card(logT[0], { w: 3.0, aspect: 560 / 640, d: .1 }); log.position.set(3.95, 2.25, 0); face(log); W.add(log);
    const lfoot = W.mesh(W.rbox(1.6, .25, .7, .08), M.navy); lfoot.position.set(3.95, .58, 0); W.add(lfoot);
    const lcsv = W.add(W.pill('Export · CSV', { h: .36, mono: true })); lcsv.position.set(3.95, 4.05, .2);
    const frame = W.add(W.focusFrame({ th: .06, arm: .3 }));
    const times = { digits: [.4, 2.4] as [number, number], unlock: 2.6, rowAt: [3.0, 4.6, 5.4, 7.4], op: 3.8, admin: 6.8 };

    return { update(t, a) {
      const reset = t > 10.8;
      const n = reset ? 0 : Math.min(6, Math.floor(win(t, ...times.digits) * 6.999));
      phone.userData.setFace(phoneT[t >= times.digits[1] && !reset ? 6 : n]);
      const un = E.outBack(win(t, times.unlock, times.unlock + .5)) * (1 - win(t, 10.6, 11.2));
      shackle.position.y = .3 + un * .2; shackle.rotation.y = un * .9;
      lockMat.color.set(un > .5 ? C.emerald : C.navy); lglow.material.opacity = un * .5;
      const rowsN = reset ? 0 : times.rowAt.filter(x => t >= x).length;
      log.userData.setFace(logT[rowsN]);
      const opOn = t >= times.op && t < 10.8 && t < times.admin, adOn = t >= times.admin && t < 10.8;
      badges.forEach((o, i) => o.b.userData.blendTo(o.on, i === 2 ? (opOn ? 1 : 0) : i === 1 ? (adOn ? 1 : 0) : 0));
      // frame: phone -> Operator badge -> log -> Admin badge -> log
      const tgt = (o: THREE.Object3D, w: number, h: number) => ({ p: o.position.clone(), r: o.rotation, w, h });
      const steps = [
        { at: .3, ...tgt(phone, 1.75, 2.8) }, { at: 3.6, ...tgt(badges[2].b, 2.05, .95) }, { at: 4.4, ...tgt(log, 3.0, 2.62) },
        { at: 6.6, ...tgt(badges[1].b, 2.05, .95) }, { at: 7.2, ...tgt(log, 3.0, 2.62) },
      ];
      let i = 0; for (let j = 0; j < steps.length; j++) if (t >= steps[j].at) i = j;
      const s = steps[i], pv = steps[Math.max(0, i - 1)], k = i === 0 ? 1 : E.inOutCubic(win(t, s.at, s.at + .45));
      frame.position.lerpVectors(pv.p, s.p, k).add(new THREE.Vector3(0, 0, .12)); frame.rotation.copy(s.r);
      const open = Math.min(1, 1 - E.outBack(win(t, .3, .8)) + win(t, 10.2, 10.8));
      frame.userData.set(lerp(pv.w, s.w, k), lerp(pv.h, s.h, k), open, (t > times.unlock && t < times.unlock + .9) ? win(t, times.unlock, times.unlock + .9) : 0);
      frame.userData.halo.material.color.set(C.emerald);
    } };
  },
};
