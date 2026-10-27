// SOLUTIONS · "Customs filing software for the people who file"
// Four small desks on a turntable: importers, NVOCCs and forwarders, customs brokers, developers.
// The table turns a quarter at a time; the desk in front lifts and the Focus Frame picks it.
import type * as THREE from "three";
import type { SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 16, poster: 3.0, radius: 5.0,
  camera: { pos: [0, 6.5, 14], target: [0, 1.6, .6], fov: 27 },
  fit: { d: [1.196, -0.0, 0.108], m: [1.069, -0.0, 0.099] }, // measured by the poster harness fit pass
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    const table = new THREE.Group(); W.add(table);
    const disc = W.cyl(4.4, .4, M.porcelain, 96); disc.position.y = .2; table.add(disc);
    const rimG = W.mesh(new THREE.TorusGeometry(4.4, .05, 10, 160), M.goldGlow, false); rimG.rotation.x = Math.PI / 2; rimG.position.y = .4; table.add(rimG);
    const base = W.cyl(3.6, .3, M.navy, 96); base.position.y = -.12; W.add(base);
    const desks: { g: THREE.Group; inner: THREE.Group; pl: THREE.Mesh; ang: number }[] = [];
    const mkDesk = (i: number, label: string, build: (g: THREE.Group) => void) => {
      const g = new THREE.Group(); const ang = i * Math.PI / 2;
      g.position.set(Math.sin(ang) * 2.7, .4, Math.cos(ang) * 2.7); g.rotation.y = ang;
      const plinth = W.mesh(W.rbox(2.3, .22, 2.3, .1), M.mist); plinth.position.y = .11; g.add(plinth);
      const inner = new THREE.Group(); inner.position.y = .22; g.add(inner); build(inner);
      const pl = W.pill(label, { h: .42, dot: C.gold }); pl.position.set(0, 2.3, 1.2); g.add(pl); W.billboard(pl);
      table.add(g); desks.push({ g, inner, pl, ang });
    };
    // importers: a container at a small warehouse
    mkDesk(0, 'Importers', (g) => {
      const wh = W.mesh(W.rbox(1.0, .9, 1.4, .06), M.porcelain); wh.position.set(-.5, .45, -.2); g.add(wh);
      const roof = W.mesh(W.rbox(1.08, .1, 1.5, .04), M.navy); roof.position.set(-.5, .93, -.2); g.add(roof);
      const door = W.mesh(W.rbox(.04, .5, .7, .02), M.slate); door.position.set(0, .26, -.2); g.add(door);
      const c = W.container(C.steel, 1.4, .58, .56); c.position.set(.45, .3, .45); c.rotation.y = Math.PI / 2; g.add(c);
    });
    // nvocc / forwarders: a small ship on a sea tile
    mkDesk(1, 'NVOCCs & forwarders', (g) => {
      const s = W.mesh(W.rbox(2.0, .12, 2.0, .06), new THREE.MeshStandardMaterial({ color: C.sea, roughness: .25 })); s.position.y = .06; g.add(s);
      const sh = W.ship({ len: 3.4, beam: 1.1, seed: 2, tiers: 2 }); sh.scale.setScalar(.55); sh.position.set(0, .3, 0); sh.rotation.y = .5; g.add(sh);
    });
    // customs brokers: stacked folders and a stamp-free desk
    mkDesk(2, 'Customs brokers', (g) => {
      const cols = [C.porcelain, C.mist, C.paper, C.porcelain, C.mist];
      cols.forEach((c, k) => { const f = W.mesh(W.rbox(1.2, .1, .9, .03), new THREE.MeshStandardMaterial({ color: c, roughness: .7 })); f.position.set(-.2 + (k % 2) * .06, .06 + k * .11, 0); f.rotation.y = (k % 3 - 1) * .08; g.add(f); });
      const tab = W.mesh(W.rbox(.3, .1, .06, .02), M.gold); tab.position.set(.2, .5, .45); g.add(tab);
      const mug = W.cyl(.16, .3, M.navy, 24); mug.position.set(.6, .15, .4); g.add(mug);
    });
    // developers: a terminal tile
    mkDesk(3, 'Developers', (g) => {
      const tex = W.canvasTex(512, 360, (c) => { W.rr(c, 0, 0, 512, 360, 30); c.fillStyle = '#0E1830'; c.fill(); c.font = `600 34px ${W.MONO}`; c.fillStyle = '#FBBE24'; c.fillText('POST', 40, 90); c.fillStyle = '#C9D1E3'; c.fillText('/shipments', 150, 90); c.fillStyle = '#10B981'; c.fillText('201 Created', 40, 160); c.fillStyle = '#8C99B8'; c.fillText('filing.accepted', 40, 230); });
      const sc = W.mesh(W.rbox(1.6, 1.1, .12, .06), M.navyDeep); sc.position.set(0, .75, -.2); sc.rotation.x = -.15; g.add(sc);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); face.position.set(0, .755, -.13); face.rotation.x = -.15; g.add(face);
      const kb = W.mesh(W.rbox(1.3, .06, .45, .03), M.slate); kb.position.set(0, .05, .5); g.add(kb);
    });
    const frame = W.add(W.focusFrame({ th: .07, arm: .4 }));
    const spot = W.add(W.glow(C.gold, 5, 0));

    return { update(t, a) {
      // 4 steps of 4s: turn 1.2s, then hold
      const step = Math.floor(t / 4), local = t - step * 4;
      const turn = E.inOutCubic(win(local, 0, 1.2));
      const rot = -(step + turn) * Math.PI / 2;
      table.rotation.y = rot;
      // which desk is in front: the one whose angle + rot ≈ 0
      desks.forEach((d, i) => {
        const front = ((i - (step + 1)) % 4 + 4) % 4 === 0;
        const up = front ? E.outBack(win(local, 1.0, 1.7)) * (1 - win(local, 3.6, 4)) : 0;
        d.inner.position.y = .22 + up * .35; d.inner.rotation.y = up * .2 * Math.sin(a * 4);
        d.pl.scale.setScalar(.85 + up * .25);
      });
      const fi = (step + 1) % 4, fd = desks[fi];
      const lock = E.outBack(win(local, 1.2, 1.9)), rel = win(local, 3.5, 4);
      const wp = new THREE.Vector3(0, 1.2, 2.7); // front position in world
      frame.position.copy(wp); frame.position.y += fd.inner.position.y * .5 + .25; frame.position.z += .9; frame.quaternion.copy(W.camera.quaternion);
      frame.userData.set(2.0, 1.5, Math.min(1, 1 - lock + rel), local > 1.6 && local < 2.7 ? win(local, 1.6, 2.7) : 0);
      spot.position.set(0, 1.4, 2.4); spot.material.opacity = (lock - rel) * .45;
    } };
  },
};
