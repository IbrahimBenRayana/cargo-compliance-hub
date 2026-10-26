// PRE-FILING CHECKS · "Catch filing errors before CBP does"
// A draft rides a rail into a glass lens. The scan finds a missing manufacturer ID, the error is
// fixed in place, the draft turns green and moves on to submit. The next draft is already coming.
import type { SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 12, poster: 4.3, radius: 6.0,
  camera: { pos: [6.5, 6.5, 14], target: [0, 2.3, 0], fov: 26 },
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    const rail = W.add(W.slab(12, .3, 2.0, M.porcelain, .14));
    const groove = W.mesh(W.rbox(11.6, .04, .3, .015), M.mist); groove.position.set(0, .32, 0); W.add(groove);
    // the lens: navy ring, gold inner ring, glass disc, on two feet
    const lens = new THREE.Group(); lens.position.set(0, 2.55, 0); W.add(lens);
    const ringO = W.mesh(new THREE.TorusGeometry(2.05, .2, 24, 96), M.navy); lens.add(ringO);
    const ringI = W.mesh(new THREE.TorusGeometry(1.8, .05, 12, 96), M.goldGlow, false); lens.add(ringI);
    const glass = W.mesh(new THREE.CylinderGeometry(1.78, 1.78, .1, 64), M.glass, false); glass.rotation.x = Math.PI / 2; lens.add(glass);
    for (const sx of [-1, 1]) { const f = W.mesh(W.rbox(.34, 1.1, .6, .1), M.navy); f.position.set(sx * .9, -2.1, 0); f.rotation.z = sx * -.35; lens.add(f); }
    lens.rotation.y = .25;
    // scan plane
    const scan = W.mesh(new THREE.PlaneGeometry(.06, 3.4), new THREE.MeshBasicMaterial({ color: C.gold, transparent: true, opacity: .0, toneMapped: false }), false);
    lens.add(scan); scan.position.z = .2;
    const scanGlow = W.glow(C.gold, 2.4, 0); lens.add(scanGlow);
    // faces
    const f0 = W.cardFace({ eyebrow: 'ISF-10 draft', title: 'INV-4502', meta: 'Running checks', chip: 'Draft', chipColor: C.slate, rail: C.slate, rows: 3 });
    const fErr = W.cardFace({ eyebrow: 'ISF-10 draft', title: 'INV-4502', meta: 'Fix 1 error to submit', metaMono: false, chip: '1 critical', chipColor: C.rose, rail: C.rose, rows: 3 });
    const fOk = W.cardFace({ eyebrow: 'ISF-10 draft', title: 'INV-4502', meta: 'Ready to submit', metaMono: false, chip: 'Checks passed', chipColor: C.emerald, rail: C.emerald, rows: 3 });
    const mkCard = () => { const c = W.card(f0, { w: 2.6, d: .08 }); c.rotation.y = .25; return W.add(W.clip(c, -5.9, 5.9)); };
    const cards = [mkCard(), mkCard()];
    const err = W.pill('Manufacturer ID missing', { dot: C.rose, h: .46 }); W.add(err);
    const okp = W.pill('Fixed · manufacturer added', { dot: C.emerald, h: .46 }); W.add(okp);
    // submit pad at the right end
    const pad = W.mesh(W.rbox(1.8, .16, 1.5, .07), M.gold); pad.position.set(4.6, .38, 0); W.add(pad);
    const padTag = W.add(W.pill('Submit', { h: .42, dot: C.gold })); padTag.position.set(4.6, 1.0, .9);
    const padGlow = W.add(W.glow(C.gold, 3, 0)); padGlow.position.set(4.6, .8, 0);

    const xAt = (t: number) => {   // card A path over the loop: enter, stop in lens, fix, go to submit
      const k1 = E.inOutCubic(win(t, 0, 2.2)), k2 = E.inOutCubic(win(t, 6.4, 8.6)), k3 = E.inOutCubic(win(t, 9.8, 12));
      return lerp(lerp(-3.6, 0, k1), 4.6, k2) + k3 * 3.5;
    };
    return { update(t, a) {
      // card A is this loop's draft; card B is next loop's, entering from the left at the end
      const A = cards[0], B = cards[1];
      A.position.set(xAt(t), 2.55, .05); A.position.y += Math.sin(Math.PI * win(t, 6.4, 8.6)) * .25 - E.inOutCubic(win(t, 8.6, 9.4)) * 1.1;
      A.rotation.x = -E.inOutCubic(win(t, 8.4, 9.4)) * 1.2;
      B.position.set(lerp(-9, -3.6, E.inOutCubic(win(t, 9.8, 12))), 2.55, .05); B.rotation.x = 0;
      B.userData.setFace(f0); B.userData.blendTo(fOk, 0);
      // scan 2.2..3.6
      const sk = win(t, 2.2, 3.6);
      scan.position.x = lerp(-1.6, 1.6, E.inOutSine(sk)); scan.material.opacity = Math.sin(Math.PI * sk) * .9;
      scanGlow.position.x = scan.position.x; scanGlow.material.opacity = Math.sin(Math.PI * sk) * .7;
      const found = win(t, 3.4, 3.7), fixed = win(t, 5.2, 5.7);
      A.userData.setFace(found > 0 && fixed < 1 ? fErr : f0);
      A.userData.blendTo(fOk, fixed);
      const ePos = new THREE.Vector3(-.4, 4.6, .9), oPos = new THREE.Vector3(-.2, 4.6, .9);
      err.position.copy(ePos); err.scale.setScalar(E.outBack(found) * (1 - fixed) + .001);
      okp.position.copy(oPos); okp.scale.setScalar(E.outBack(fixed) * (1 - win(t, 7.0, 7.5)) + .001);
      ringI.material.emissive.set(found > 0 && fixed < 1 ? C.rose : (fixed > 0 && t < 7 ? C.emerald : C.gold));
      ringI.material.color.copy(ringI.material.emissive);
      padGlow.material.opacity = env(t, 8.4, 10.2, .4) * .8;
      lens.position.y = 2.55 + Math.sin(a * 2) * .03;
    } };
  },
};
