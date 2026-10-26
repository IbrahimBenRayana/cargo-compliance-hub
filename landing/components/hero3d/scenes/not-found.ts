// 404 · "We couldn't find that page."
// A lone container drifting on open water. The Focus Frame searches, never quite locks.
// A buoy blinks. The one hero where nothing resolves, on purpose.
import type { SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 12, poster: 4.0, radius: 5.0,
  camera: { pos: [7, 6.5, 12.5], target: [0, 1.0, 0], fov: 27 },
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    const sea = W.add(W.sea({ w: 9, d: 6.5, loop: 12, amp: .14 }));
    const box = W.add(W.container(C.steel, 2.4, 1, 1));
    const buoy = new THREE.Group(); W.add(buoy);
    const bb = W.mesh(new THREE.CylinderGeometry(.18, .32, .7, 24), M.rose); bb.position.y = .35; buoy.add(bb);
    const bs = W.mesh(new THREE.TorusGeometry(.26, .05, 8, 24), M.paper); bs.rotation.x = Math.PI / 2; bs.position.y = .5; buoy.add(bs);
    const lamp = W.mesh(new THREE.SphereGeometry(.09, 12, 8), M.goldGlow, false); lamp.position.y = .8; buoy.add(lamp);
    const lampGlow = W.glow(C.gold, 1.2, 0); lampGlow.position.y = .8; buoy.add(lampGlow);
    buoy.position.set(2.8, 0, -1.6);
    const frame = W.add(W.focusFrame({ th: .08, arm: .45 }));
    const code = W.add(W.pill('404', { h: .5, mono: true }));

    return { update(t, a) {
      sea.userData.update(t);
      const bx = Math.sin(a) * .5 - .6, bz = Math.cos(a) * .25 + .4;
      box.position.set(bx, .25 + sea.userData.height(bx, bz, t) * 1.2, bz);
      box.rotation.set(Math.sin(a * 2) * .05, .5 + Math.sin(a) * .15, Math.cos(a * 2) * .06);
      buoy.position.y = sea.userData.height(2.8, -1.6, t) * 1.2; buoy.rotation.z = Math.sin(a * 3) * .1;
      const blink = (t % 2) < .25 ? 1 : 0; lampGlow.material.opacity = blink * .9; lamp.material = blink ? M.goldGlow : M.gold;
      // search: a lissajous path near the box, never centring on it
      const fx = bx + Math.sin(a * 2) * 1.3 + .4, fy = 1.4 + Math.sin(a * 3) * .4, fz = bz + Math.cos(a * 2) * .6 + .6;
      frame.position.set(fx, fy, fz); frame.quaternion.copy(W.camera.quaternion);
      frame.userData.set(1.8, 1.2, .35 + .25 * Math.sin(a * 4) ** 2, 0);
      code.position.set(fx, fy + 1.15, fz);
    } };
  },
};
