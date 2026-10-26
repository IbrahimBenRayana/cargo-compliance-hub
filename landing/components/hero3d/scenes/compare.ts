// COMPARE · "Four ways to file US customs."
// Four plinths, four honest options: a customs broker, spreadsheets and a vendor screen, legacy
// filing software, and MyCargoLens. The Focus Frame gives each the same time. No option is mocked.
import type { CardFaceOpts, SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 12, poster: 10.2, radius: 5.0, width: 5.4,
  camera: { pos: [0, 6.5, 14.5], target: [0, 1.5, 0], fov: 27 },
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    const xs = [-4.2, -1.4, 1.4, 4.2], zs = [.4, -.3, -.3, .4];
    const names = ['Customs broker', 'Spreadsheets', 'Legacy software', 'MyCargoLens'];
    const objs = xs.map((x, i) => {
      const g = new THREE.Group(); g.position.set(x, 0, zs[i]); W.add(g);
      const pl = W.cyl(1.05, .6, i === 3 ? M.navy : M.porcelain, 64); pl.position.y = .3; g.add(pl);
      const ring = W.mesh(new THREE.TorusGeometry(1.05, .03, 8, 96), i === 3 ? M.gold : M.mist, false); ring.rotation.x = Math.PI / 2; ring.position.y = .6; g.add(ring);
      const item = new THREE.Group(); item.position.y = .6; g.add(item);
      const tag = W.pill(names[i], { h: .4, dot: i === 3 ? C.gold : C.slate }); tag.position.set(0, -.2, 1.35); g.add(tag); W.billboard(tag);
      return { g, item, tag };
    });
    // broker: a stack of paper folders and a phone handset block
    const fold = (c: string, k: number) => { const f = W.mesh(W.rbox(1.2, .1, .85, .03), new THREE.MeshStandardMaterial({ color: c, roughness: .75 })); f.position.set((k % 2) * .05, .06 + k * .11, 0); f.rotation.y = (k % 3 - 1) * .1; return f; };
    [C.porcelain, C.mist, '#F3E7C4', C.porcelain, '#E8DDBF', C.mist].forEach((c, k) => objs[0].item.add(fold(c, k)));
    const ph = W.mesh(W.rbox(.5, .2, .9, .08), M.navy); ph.position.set(.62, .1, .2); ph.rotation.y = .4; objs[0].item.add(ph);
    // spreadsheets: a tilted grid sheet
    const sheet = W.canvasTex(512, 512, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 512); g.strokeStyle = 'rgba(30,45,77,.18)'; g.lineWidth = 2;
      for (let i = 0; i <= 12; i++) { g.beginPath(); g.moveTo(0, i * 42.6); g.lineTo(512, i * 42.6); g.stroke(); } for (let j = 0; j <= 5; j++) { g.beginPath(); g.moveTo(j * 102, 0); g.lineTo(j * 102, 512); g.stroke(); }
      g.fillStyle = 'rgba(16,185,129,.25)'; g.fillRect(0, 0, 512, 42); g.font = `500 20px ${W.MONO}`; g.fillStyle = '#4A5674'; for (let i = 1; i < 12; i++) g.fillText(`HBL ${4400 + i * 3}`, 10, i * 42.6 + 28); });
    const sh = W.mesh(W.rbox(1.5, 1.5, .05, .03), M.paper); sh.position.set(0, .95, 0); sh.rotation.set(-.25, 0, .05); objs[1].item.add(sh);
    const shf = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 1.44), new THREE.MeshBasicMaterial({ map: sheet, toneMapped: false })); shf.position.z = .03; sh.add(shf);
    const sh2 = sh.clone(); sh2.position.set(.15, .85, -.25); sh2.rotation.set(-.2, .2, -.08); objs[1].item.add(sh2);
    // legacy software: a chunky monitor with a terminal screen
    const term = W.canvasTex(512, 384, (g) => { g.fillStyle = '#0E1A12'; g.fillRect(0, 0, 512, 384); g.font = `500 24px ${W.MONO}`; g.fillStyle = '#7FD4A0';
      ['F1 ISF   F2 ENTRY   F3 QRY', '> MBOL ________', '> IOR  ________', '> HTS  ____.__.____', '', 'ENTER=SUBMIT  F12=EXIT'].forEach((l, i) => g.fillText(l, 22, 46 + i * 52)); });
    const mon = W.mesh(W.rbox(1.6, 1.25, .9, .1), new THREE.MeshStandardMaterial({ color: '#D9D4C7', roughness: .7 })); mon.position.y = 1.0; objs[2].item.add(mon);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.3, .95), new THREE.MeshBasicMaterial({ map: term, toneMapped: false })); scr.position.set(0, 1.02, .46); objs[2].item.add(scr);
    const stand = W.mesh(W.rbox(.8, .3, .7, .06), new THREE.MeshStandardMaterial({ color: '#CBC5B6', roughness: .7 })); stand.position.y = .15; objs[2].item.add(stand);
    // MyCargoLens: the ranked inbox, three cards
    const F = (o: CardFaceOpts) => W.cardFace({ h: 232, rows: 0, ...o });
    [F({ title: 'ISF-10 · INV-4502', meta: 'Due in 18h', chip: 'Now', chipColor: C.amber, rail: C.amber }), F({ title: 'Entry · INV-4421', meta: 'Fix steps ready', chip: 'Next', chipColor: C.rose, rail: C.rose }), F({ title: 'ISF-5 · 3 HBLs', meta: 'Due in 2d', chip: 'Later', chipColor: C.blue, rail: C.blue })]
      .forEach((f, k) => { const c = W.card(f, { w: 1.7, aspect: 232 / 640, d: .05 }); c.position.set(0, 1.55 - k * .55, -k * .08); c.rotation.x = -.1; objs[3].item.add(c); });
    const frame = W.add(W.focusFrame({ th: .065, arm: .34 }));

    return { update(t, a) {
      // 3s per option
      const i = Math.floor(t / 3) % 4, local = t % 3;
      const lock = E.outBack(win(local, .45, 1.0)), rel = win(local, 2.5, 3);
      objs.forEach((o, j) => { const up = j === i ? Math.sin(Math.PI * win(local, .2, 2.9)) : 0; o.item.position.y = .6 + up * .18; o.item.rotation.y = Math.sin(a + j) * .12; });
      const tgt = objs[i].g.position.clone().add(new THREE.Vector3(0, 1.6, 0));
      const prev = objs[(i + 3) % 4].g.position.clone().add(new THREE.Vector3(0, 1.6, 0));
      frame.position.lerpVectors(prev, tgt, E.inOutCubic(win(local, 0, .6))); frame.position.z += 1.0;
      frame.quaternion.copy(W.camera.quaternion);
      frame.userData.set(1.9, 1.7, Math.min(1, .25 + (1 - lock) * .75 + rel * .3), 0);
    } };
  },
};
