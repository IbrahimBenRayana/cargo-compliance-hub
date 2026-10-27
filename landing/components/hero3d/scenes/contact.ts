// CONTACT · "Contact us"
// Three inboxes on a desk: customers, partnerships, press. A message flies in along a dotted arc
// and lands in the right one; its tray lights. A person reads every message.
import type { SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 12, poster: 1.5, radius: 5.0, width: 4.7,
  camera: { pos: [3, 7.5, 12.5], target: [0, 1.4, 0], fov: 27 },
  fit: { d: [1.239, 0.028, 0.29], m: [1.111, 0.038, 0.256] }, // measured by the poster harness fit pass
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    W.add(W.slab(9, .3, 4.4, M.porcelain, .15));
    const names = ['Customers', 'Partnerships', 'Press'];
    const trays = names.map((n, i) => {
      const g = new THREE.Group(); g.position.set(-2.8 + i * 2.8, .3, 0); W.add(g);
      const b = W.mesh(W.rbox(2.2, .5, 1.7, .12), M.navy); b.position.y = .25; g.add(b);
      const inner = W.mesh(W.rbox(1.9, .08, 1.4, .04), new THREE.MeshStandardMaterial({ color: C.mist, emissive: C.gold, emissiveIntensity: 0 })); inner.position.y = .5; g.add(inner);
      for (let k = 0; k < 2; k++) { const p = W.mesh(W.rbox(1.6, .03, 1.1, .01), M.paper, false); p.position.set(0, .56 + k * .035, 0); p.rotation.y = (k - .5) * .1; g.add(p); }
      const tag = W.pill(n, { h: .4 }); tag.position.set(0, 1.0, .95); g.add(tag); W.billboard(tag);
      const glow = W.glow(C.gold, 2.6, 0); glow.position.y = .9; g.add(glow);
      return { g, inner, glow };
    });
    const msg = W.card(W.cardFace({ eyebrow: 'New message', title: 'Question about our account', meta: 'Read by a person', metaMono: false, rail: C.gold, rows: 1, h: 340 }), { w: 1.8, aspect: 340 / 640, d: .04 }); W.add(msg);
    const dots = Array.from({ length: 18 }, () => { const d = W.mesh(new THREE.SphereGeometry(.035, 8, 6), M.goldGlow, false); W.add(d); return d; });

    return { update(t, a) {
      // one message per 4s, to tray 0, 1, 2
      const i = Math.floor(t / 4), lt = t % 4, tr = trays[i];
      const k = E.inOutCubic(win(lt, .3, 2.0));
      const from = new THREE.Vector3(-4 + i * 1.5, 4.4, -1.5), to = tr.g.position.clone().add(new THREE.Vector3(0, .62, 0));
      const mid = from.clone().lerp(to, .5).add(new THREE.Vector3(0, 1.3, .6));
      const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
      msg.position.copy(curve.getPoint(k));
      const land = E.inOutCubic(win(lt, 1.4, 2.0));
      msg.rotation.set(-Math.PI / 2 * land, (1 - land) * .3, 0);
      W.fadeCard(msg, Math.min(win(lt, .1, .4), 1 - win(lt, 3.2, 3.7)));
      dots.forEach((d, j) => { const u = j / (dots.length - 1); d.position.copy(curve.getPoint(u)); d.scale.setScalar(u < k ? 0.001 : Math.min(1, win(lt, 0, .3)) * (1 - win(lt, 2.2, 2.8))); });
      trays.forEach((tt, j) => { const on = j === i ? env(lt, 1.9, 3.8, .3) : 0; tt.inner.material.emissiveIntensity = on * .6; tt.glow.material.opacity = on * .6; });
    } };
  },
};
