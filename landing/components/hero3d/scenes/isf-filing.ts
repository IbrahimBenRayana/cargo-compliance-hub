// ISF FILING · "ISF filing software with a clock on every filing"
// A vessel under a deadline ring. The gold sweep runs toward the deadline (24h before lading);
// the 72, 48 and 24 hour alerts light as it passes them, and the ISF is accepted before the line.
import type { SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 12, poster: 7.2, radius: 7.0,
  camera: { pos: [11, 8.5, 12.5], target: [0, 2.0, 0], fov: 27 },
  fit: { d: [1.19, -0.032, 0.143], m: [1.057, -0.033, 0.13] }, // measured by the poster harness fit pass
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    const sea = W.add(W.sea({ w: 12.5, d: 8, loop: 12 }));
    const ship = W.add(W.ship({ len: 8.4, beam: 2.6, seed: 4 }));
    ship.position.set(-.3, -.18, 0);
    const foam = W.add(W.wake({ period: 3, trail: 2.4, spread: 1.1 }));

    // the deadline ring floats level around the ship
    const R = 4.6;
    const ring = W.clockRing({ r: R, tube: .045, ticks: 24, trackMat: new THREE.MeshStandardMaterial({ color: C.mist, roughness: .4, transparent: true, opacity: .85 }) });
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, 3.9, 0); W.add(ring);
    // sweep starts at the back of the ring and runs clockwise toward the camera side
    const start = .62;
    ring.rotation.z = start * TAU;
    const marks = [
      { k: .25, label: '72h alert' }, { k: .5, label: '48h alert' }, { k: .75, label: '24h alert' },
    ].map((m) => {
      const ang = start * TAU + m.k * TAU;
      const p = new THREE.Vector3(Math.cos(ang) * R, 3.9, -Math.sin(ang) * R);
      const dot = W.mesh(new THREE.SphereGeometry(.13, 20, 14), new THREE.MeshStandardMaterial({ color: C.slate, emissive: C.amber, emissiveIntensity: 0 }), false); dot.position.copy(p); W.add(dot);
      const pl = W.pill(m.label, { dot: C.amber, h: .44 }); pl.position.copy(p).add(new THREE.Vector3(0, .55, 0)); W.add(pl);
      const halo = W.glow(C.amber, 1.4, 0); halo.position.copy(p); W.add(halo);
      return { ...m, dot, pl, halo };
    });
    // deadline marker: end of the ring
    const endAng = start * TAU + TAU * .999;
    const dl = W.pill('Deadline · 24h before lading', { dot: C.rose, h: .46 });
    dl.position.set(Math.cos(endAng) * R, 3.9 + .62, -Math.sin(endAng) * R); W.add(dl);
    const head = W.add(W.mesh(new THREE.SphereGeometry(.17, 20, 14), M.goldGlow, false));
    const headGlow = W.add(W.glow(C.gold, 1.6, .7));

    // the ISF card above the ship
    const fDue = W.cardFace({ title: 'ISF-10 · INV-4502', meta: 'MBOL MAEU9381-2', chip: 'Due in 31h', chipColor: C.amber, rail: C.amber, rows: 2, foot: '3 house bills · OOLU210577643' });
    const fOk = W.cardFace({ title: 'ISF-10 · INV-4502', meta: 'MBOL MAEU9381-2', chip: 'Accepted', chipColor: C.emerald, rail: C.emerald, rows: 2, foot: '3 house bills · OOLU210577643' });
    const card = W.card(fDue, { w: 2.9, d: .08 }); card.position.set(.6, 5.6, -.4); W.faceCam(card, -.12); W.add(card);
    const frame = W.add(W.focusFrame({ th: .08, arm: .42 })); frame.rotation.copy(card.rotation);

    return { update(t, a) {
      sea.userData.update(t);
      ship.position.y = -.18 + sea.userData.height(0, 0, t) * .8; ship.rotation.z = Math.sin(a + 1) * .012; ship.rotation.x = Math.sin(a * 2) * .01;
      foam.userData.update(t, new THREE.Vector3(ship.position.x - 4, 0, 0), ship.position.x + 4.1);
      const k = E.inOutSine(win(t, .8, 9.0)) * .86;              // stops before the deadline
      const fade = 1 - win(t, 10.6, 11.6);
      ring.userData.setSweep(k * fade + (1 - fade) * 0);
      const ang = start * TAU + k * TAU;
      head.position.set(Math.cos(ang) * R, 3.9, -Math.sin(ang) * R); head.scale.setScalar(fade + .001);
      headGlow.position.copy(head.position); headGlow.material.opacity = .7 * fade;
      marks.forEach(m => {
        const hit = k >= m.k ? 1 : 0, since = hit ? (t - (.8 + 8.2 * E.inOutSine(0) )) : 0;
        const lit = hit * fade;
        m.dot.material.emissiveIntensity = lit * 1.2; m.dot.material.color.set(lit > .5 ? C.amber : C.slate);
        // brief halo burst when the sweep crosses the mark
        const dk = Math.abs(k - m.k);
        m.halo.material.opacity = Math.max(0, 1 - dk / .05) * .9 * fade; m.halo.scale.setScalar(1 + (1 - Math.min(1, dk / .05)) * 1.4);
        m.pl.scale.setScalar(1 + Math.max(0, 1 - dk / .04) * .15);
      });
      // accepted at ~9.2s, before the deadline
      const ok = E.inOutSine(win(t, 8.9, 9.5));
      card.userData.blendTo(fOk, ok * fade + 0);
      card.position.y = 5.6 + Math.sin(a * 2) * .06;
      const lock = E.outBack(win(t, 1.0, 1.8));
      frame.position.copy(card.position).add(new THREE.Vector3(0, 0, .06).applyEuler(card.rotation));
      frame.userData.set(2.9, 2.9 * .625, Math.min(1, 1 - lock + win(t, 10.8, 11.6)), t > 9.1 && t < 10.3 ? win(t, 9.1, 10.3) : 0);
      frame.userData.halo.material.color.set(C.emerald);
    } };
  },
};
