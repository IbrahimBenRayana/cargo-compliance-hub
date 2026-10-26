// HOME · "Know which customs filing needs you now."
// A container ship at sea. One gold box carries the filing that needs you: it lifts out as a card,
// takes the top of the ranked inbox, the Focus Frame locks onto it, it resolves, the inbox settles.
import type * as THREE from "three";
import type { CardFaceOpts, SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 12, poster: 5.2, radius: 7.0,
  camera: { pos: [12.5, 7.2, 13.5], target: [0.2, 2.0, -0.2], fov: 27 },
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    const sea = W.add(W.sea({ w: 14, d: 7.6, loop: 12, amp: .11 }));
    sea.position.set(-.6, 0, .2);
    const ship = W.add(W.ship({ len: 9.2, beam: 2.7, seed: 11, gold: ['3,2,2'] }));
    const goldSlot = ship.userData.slot(3, 2, 2);
    const gbox = W.container(C.gold, 1.25, .52, .5); gbox.position.copy(goldSlot); ship.add(gbox);
    const gglow = W.glow(C.gold, 2.2, 0); gglow.position.copy(goldSlot); ship.add(gglow);
    ship.position.set(-1.8, -.18, .4);
    const foam = W.add(W.wake({ period: 3, trail: 4, spread: 1.4 }));

    // ranked inbox
    const F = (o: CardFaceOpts) => W.cardFace({ h: 232, rows: 0, ...o });
    const faces = {
      urgent: F({ title: 'ISF-10 · INV-4502', meta: 'MBOL MAEU9381-2', chip: 'Due in 18h', chipColor: C.amber, rail: C.amber }),
      done: F({ title: 'ISF-10 · INV-4502', meta: 'MBOL MAEU9381-2', chip: 'Accepted', chipColor: C.emerald, rail: C.emerald }),
      b: F({ title: 'Entry 7501 · INV-4421', meta: 'Fix steps ready', chip: 'Rejected', chipColor: C.rose, rail: C.rose }),
      c: F({ title: 'ISF-5 · 3 house bills', meta: 'OOLU210577643', chip: 'Due in 2d', chipColor: C.blue, rail: C.blue }),
      d: F({ title: 'Possible UFLPA exposure', meta: 'INV-4198 · review origin', chip: 'Review', chipColor: C.amber, rail: C.slate, metaMono: false }),
      e: F({ title: '3 drafts ready', meta: 'Checks passed', chip: 'Drafts', chipColor: C.slate, rail: C.slate, metaMono: false }),
    };
    const stackX = 4.6, stackZ = -2.4, top = 5.6, gap = 1.4, cw = 3.4, ar = 232 / 640;
    const slotPos = (k: number) => new THREE.Vector3(stackX - k * .05, top - k * gap, stackZ + k * .12);
    const rotY = Math.atan2(W.camPos.x - stackX, W.camPos.z - stackZ);
    const mk = (face: THREE.Texture) => { const c = W.card(face, { w: cw, aspect: ar, d: .09 }); c.rotation.set(-.06, rotY, 0); return W.add(c); };
    const cards = [mk(faces.b), mk(faces.c), mk(faces.d), mk(faces.e)];
    const hero = mk(faces.urgent);
    // path from the gold box to the top slot
    const from = new THREE.Vector3().copy(goldSlot).add(ship.position);
    const to = slotPos(0);
    const mid = new THREE.Vector3((from.x + to.x) / 2 - .4, to.y + 1.4, (from.z + to.z) / 2 + .6);
    const trail = W.add(W.tube([from.toArray(), mid.toArray(), to.toArray()], .022, M.goldGlow, 90));
    const curve = trail.userData.curve;
    const frame = W.add(W.focusFrame({ th: .08, arm: .42 })); frame.rotation.copy(hero.rotation);
    const spot = W.add(W.glow(C.gold, 5, 0)); spot.position.copy(to).add(new THREE.Vector3(0, 0, -.3));

    // drifting gold motes
    const N = 60, r = W.rng(5), mp = new Float32Array(N * 3), seeds: number[][] = [];
    for (let i = 0; i < N; i++) seeds.push([r() * 14 - 6, r() * 6 + .5, r() * 7 - 4, r()]);
    const motes = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(mp, 3)),
      new THREE.PointsMaterial({ color: C.gold, size: .06, transparent: true, opacity: .7, depthWrite: false }));
    W.add(motes);

    return { update(t, a) {
      sea.userData.update(t);
      ship.position.y = -.18 + sea.userData.height(0, 0, t) * .8;
      ship.rotation.x = Math.sin(a * 2) * .012; ship.rotation.z = Math.sin(a + 1) * .01;
      ship.position.x = -1.8 + Math.sin(a) * .15;
      foam.userData.update(t, new THREE.Vector3(ship.position.x - 4.4, 0, ship.position.z), ship.position.x + 4.4);

      // timeline
      const lift = E.inOutCubic(win(t, 1.3, 3.4));          // card travels out of the box
      const shiftDown = E.inOutCubic(win(t, 1.6, 3.2));     // stack makes room
      const lock = E.outBack(win(t, 3.3, 4.0));
      const resolve = E.inOutSine(win(t, 7.6, 8.4));
      const leave = E.inOutCubic(win(t, 9.4, 10.8));
      const shiftUp = E.inOutCubic(win(t, 9.8, 11.2));
      const glowBox = env(t, .6, 3.0, .6);
      gbox.material.emissiveIntensity = .15 + glowBox * .9; gglow.material.opacity = glowBox * .75;

      // stack slots: down by one while the urgent card is in, back up after it leaves
      const s = shiftDown - shiftUp;
      cards.forEach((c, i) => {
        const k = i + s; const p = slotPos(k); c.position.copy(p);
        const fade = i === 3 ? 1 - s : 1; W.fadeCard(c, fade);
      });

      // urgent card along the trail, then parked on top, then out to the right
      if (lift < 1) { const p = curve.getPoint(lift); hero.position.copy(p); hero.scale.setScalar(lerp(.12, 1, E.outCubic(lift))); }
      else { hero.position.copy(to); hero.scale.setScalar(1); }
      hero.position.x += leave * 2.2; hero.position.z -= leave * 1.6; hero.position.y += leave * .3;
      W.fadeCard(hero, lift > 0 ? Math.min(win(t, 1.3, 1.7), 1 - leave) : 0);
      hero.userData.blendTo(faces.done, resolve * (1 - leave));
      trail.userData.setProgress(win(t, 2.0, 3.8) * .98, Math.min(1, lift * 1.02));
      trail.visible = lift > 0 && t < 4;

      // focus frame
      const open = 1 - lock + leave * 1.2;
      frame.position.copy(hero.position).add(new THREE.Vector3(0, 0, .06).applyEuler(hero.rotation));
      frame.userData.set(cw, cw * ar, Math.min(1, Math.max(0, open)), t > 3.6 && t < 4.8 ? win(t, 3.6, 4.8) : (t > 8.0 && t < 9.2 ? win(t, 8.0, 9.2) : 0));
      frame.userData.halo.material.color.set(t > 6 ? C.emerald : C.gold);
      frame.visible = lift > .95 && leave < .9;
      spot.material.opacity = (lock * .5) * (1 - leave);

      // motes
      for (let i = 0; i < N; i++) { const [x, y, z, ph] = seeds[i]; mp[i * 3] = x + Math.sin(a + ph * TAU) * .3; mp[i * 3 + 1] = y + Math.sin(a * 2 + ph * 9) * .25; mp[i * 3 + 2] = z; }
      motes.geometry.attributes.position.needsUpdate = true;
    } };
  },
};
