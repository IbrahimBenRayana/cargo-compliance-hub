// ABOUT · "We build ISF and entry filing software. That's all we build."
// Round 2. What we file, and nothing else. Four forms rise out of one plinth in order: ISF-10, ISF-5,
// entry summary (7501), cargo release (3461). Each gets its tick, then the Focus Frame opens wide
// and holds all four: one product.
import type * as THREE from "three";
import type { SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 12, poster: 7.2, radius: 5.4, width: 5.8,
  camera: { pos: [1.2, 4.8, 14.5], target: [0, 2.0, 0], fov: 26 },
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    W.add(W.slab(11, .5, 3.4, M.navy, .2));
    const lip = W.mesh(W.rbox(11.1, .06, 3.5, .03), M.gold, false); lip.position.y = .5; W.add(lip);
    const forms = [
      { code: 'ISF-10', name: 'Importer Security Filing', who: 'Importers', c: C.blue },
      { code: 'ISF-5', name: 'ISF for FROB, IE and T&E', who: 'Filed by the carrier', c: C.blue },
      { code: '7501', name: 'Entry summary', who: 'Duties, HTS, parties', c: C.violet },
      { code: '3461', name: 'Cargo release', who: 'Release from CBP', c: C.emerald },
    ];
    const face = (f: { code: string; name: string; who: string; c: string }, done: boolean) => W.canvasTex(480, 600, (g) => {
      W.rr(g, 0, 0, 480, 600, 34); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(30,45,77,.1)'; g.stroke();
      W.rr(g, 0, 0, 480, 14, [34, 34, 0, 0]); g.fillStyle = f.c; g.fill();
      g.font = `600 20px ${W.FONT}`; g.fillStyle = '#6B7794'; g.fillText('C B P   F O R M', 40, 72);
      g.font = `750 84px ${W.FONT}`; g.fillStyle = '#0F1A30'; g.fillText(f.code, 40, 172);
      g.font = `600 27px ${W.FONT}`; g.fillStyle = '#1E2D4D'; g.fillText(f.name, 40, 226);
      g.font = `500 24px ${W.FONT}`; g.fillStyle = '#66728C'; g.fillText(f.who, 40, 264);
      for (let i = 0; i < 5; i++) { W.rr(g, 40, 312 + i * 34, i % 2 ? 260 : 380, 12, 6); g.fillStyle = 'rgba(30,45,77,.08)'; g.fill(); }
      W.rr(g, 40, 500, 400, 62, 31); g.fillStyle = done ? 'rgba(16,185,129,.12)' : 'rgba(30,45,77,.05)'; g.fill();
      g.beginPath(); g.arc(74, 531, 14, 0, TAU); g.fillStyle = done ? '#10B981' : 'rgba(30,45,77,.2)'; g.fill();
      g.font = `600 24px ${W.FONT}`; g.fillStyle = done ? '#0E8A62' : '#8C99B8'; g.fillText(done ? 'We file this' : '', 102, 540);
    });
    const tw = 2.1, th = tw * 600 / 480;
    const tiles = forms.map((f, i) => {
      const x = (i - 1.5) * 2.55;
      const slot = W.mesh(W.rbox(2.2, .04, .5, .02), M.navyDeep, false); slot.position.set(x, .53, 0); W.add(slot);
      const c = W.card(face(f, false), { w: tw, aspect: 600 / 480, d: .08 }); W.add(W.clip(c, -99, 99));
      c.rotation.y = Math.atan2(W.camPos.x - x, W.camPos.z) * .6;
      // only show the part above the plinth top while rising
      c.traverse((m) => { if ((m as THREE.Mesh).isMesh) ((m as THREE.Mesh).material as THREE.Material).clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -.52)]; });
      return { c, x, done: face(f, true), f };
    });
    const frame = W.add(W.focusFrame({ th: .075, arm: .45 }));
    const pill = W.add(W.pill('All we build: ISF and entry filing', { h: .48, dot: C.gold })); pill.position.set(0, 5.05, .3);

    return { update(t, a) {
      const sink = E.inOutCubic(win(t, 10.6, 11.7));
      tiles.forEach((o, i) => {
        const rise = E.outCubic(win(t, .3 + i * .5, 1.5 + i * .5));
        o.c.position.set(o.x, lerp(.52 - th / 2 - .1, .62 + th / 2, rise * (1 - sink)), 0);
        o.c.userData.blendTo(o.done, win(t, 2.6 + i * .6, 3.0 + i * .6) * (1 - sink));
      });
      // frame: on each tile as it ticks, then wide around all four
      const k = Math.min(3, Math.max(0, Math.floor((t - 2.4) / .6)));
      const wide = E.inOutCubic(win(t, 5.3, 6.1));
      const cx = lerp(tiles[k].x, 0, wide), cy = .62 + th / 2;
      frame.position.set(cx, cy, .2); frame.quaternion.copy(W.camera.quaternion);
      const lock = E.outBack(win(t, 2.3, 2.8));
      frame.userData.set(lerp(tw, 10.1, wide), th, Math.min(1, 1 - lock + win(t, 10.0, 10.6)), t > 6.1 && t < 7.1 ? win(t, 6.1, 7.1) : 0);
      frame.visible = t > 2.2;
      pill.scale.setScalar(E.outBack(win(t, 6.0, 6.5)) * (1 - win(t, 10.0, 10.5)) + .001);
    } };
  },
};
