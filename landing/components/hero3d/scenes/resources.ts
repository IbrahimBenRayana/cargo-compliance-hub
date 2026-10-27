// RESOURCES · "ISF and customs filing guides"
// Round 2. An open guide with full pages. Every six seconds a page turns cleanly around the spine:
// its front is the right page you were reading, its back is the next left page. Topic chips float
// round it. Quiet, for a reading page.
import type * as THREE from "three";
import type { SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 24, poster: 1.0, radius: 4.9,
  camera: { pos: [3.5, 8.5, 11], target: [0, .9, .2], fov: 27 },
  fit: { d: [1.235, -0.035, 0.04], m: [1.098, -0.034, 0.033] }, // measured by the poster harness fit pass
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    const pw = 2.7, ph = 3.5;
    const guides = [
      ['ISF late filing', 'penalties', 'Source: CBP ISF FAQ 2.0'],
      ['Who files', 'the ISF?', 'Source: 19 CFR 149'],
      ['The 24-hour', 'rule', 'Source: 19 CFR 4.7'],
      ['After CBP', 'accepts the entry', 'Source: 19 CFR 159'],
    ];
    // a full page: eyebrow, two-line heading, paragraph blocks, a callout, page number
    const pageTex = (gi: number, side: string, n: number) => W.canvasTex(540, 700, (g) => {
      g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 540, 700);
      const [h1, h2, src] = guides[gi % guides.length];
      if (side === 'L') {
        g.font = `600 18px ${W.FONT}`; g.fillStyle = '#B07A0C'; g.fillText('G U I D E', 50, 70);
        g.font = `700 40px ${W.FONT}`; g.fillStyle = '#0F1A30'; g.fillText(h1, 50, 128); g.fillText(h2, 50, 176);
        g.font = `500 20px ${W.FONT}`; g.fillStyle = '#66728C'; g.fillText('6 min read · updated Oct 2026', 50, 214);
        let y = 262; for (let i = 0; i < 11; i++) { W.rr(g, 50, y, i % 4 === 3 ? 260 : 440, 12, 6); g.fillStyle = 'rgba(30,45,77,.1)'; g.fill(); y += i % 4 === 3 ? 44 : 28; }
        W.rr(g, 50, 600, 440, 48, 12); g.fillStyle = 'rgba(251,190,36,.16)'; g.fill(); g.font = `500 18px ${W.MONO}`; g.fillStyle = '#7A5A10'; g.fillText(src, 66, 631);
      } else {
        g.font = `700 26px ${W.FONT}`; g.fillStyle = '#0F1A30'; g.fillText('What to check', 50, 80);
        let y = 116; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(62, y + 6, 8, 0, TAU); g.fillStyle = '#10B981'; g.fill(); W.rr(g, 84, y, [330, 280, 360, 300][i], 12, 6); g.fillStyle = 'rgba(30,45,77,.12)'; g.fill(); y += 40; }
        y += 20; for (let i = 0; i < 10; i++) { W.rr(g, 50, y, i % 5 === 4 ? 220 : 440, 12, 6); g.fillStyle = 'rgba(30,45,77,.1)'; g.fill(); y += i % 5 === 4 ? 44 : 28; }
        W.rr(g, 50, 560, 440, 70, 14); g.fillStyle = 'rgba(30,45,77,.05)'; g.fill(); g.font = `600 20px ${W.FONT}`; g.fillStyle = '#1E2D4D'; g.fillText('Deadline: 24 hours before lading', 70, 602);
      }
      g.font = `500 18px ${W.MONO}`; g.fillStyle = '#9AA3B8'; g.fillText(String(n), side === 'L' ? 50 : 470, 680);
    });
    // spread k shows guide k: left page L(k), right page R(k)
    const L = [0, 1, 2, 3].map(k => pageTex(k, 'L', 12 + k * 2)), R = [0, 1, 2, 3].map(k => pageTex(k, 'R', 13 + k * 2));
    const book = new THREE.Group(); book.rotation.y = -.2; W.add(book);
    const cover = W.mesh(W.rbox(pw * 2 + .34, .12, ph + .3, .05), M.navy); cover.position.y = .06; book.add(cover);
    const blockL = W.mesh(W.rbox(pw, .22, ph, .04), M.paper); blockL.position.set(-pw / 2 - .02, .23, 0); book.add(blockL);
    const blockR = W.mesh(W.rbox(pw, .22, ph, .04), M.paper); blockR.position.set(pw / 2 + .02, .23, 0); book.add(blockR);
    const flat = (x: number, tex: THREE.Texture) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(pw * .97, ph * .97), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, .345, 0); book.add(m); return m; };
    const left = flat(-pw / 2 - .02, L[0]), right = flat(pw / 2 + .02, R[0]);
    // the turning leaf: pivot on the spine; front faces up (right page), back faces down (next left page, UVs mirrored so it reads correctly once turned)
    const pivot = new THREE.Group(); pivot.position.set(0, .36, 0); book.add(pivot);
    const gF = new THREE.PlaneGeometry(pw * .97, ph * .97); gF.rotateX(-Math.PI / 2); gF.translate(pw / 2 + .02, 0, 0);
    const gB = new THREE.PlaneGeometry(pw * .97, ph * .97); gB.rotateX(Math.PI / 2); gB.translate(pw / 2 + .02, -.002, 0);
    const uv = gB.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); uv.needsUpdate = true;
    const uvB = gB.attributes.uv; for (let i = 0; i < uvB.count; i++) uvB.setX(i, 1 - uvB.getX(i));
    const mF = new THREE.MeshBasicMaterial({ map: R[0], toneMapped: false }), mB = new THREE.MeshBasicMaterial({ map: L[1], toneMapped: false });
    const leafF = new THREE.Mesh(gF, mF), leafB = new THREE.Mesh(gB, mB); pivot.add(leafF, leafB);
    const ribbon = W.mesh(W.rbox(.16, .02, ph * .6, .01), M.gold, false); ribbon.position.set(.04, .36, ph * .55); book.add(ribbon);
    const topics = [['Deadlines', C.amber], ['Penalties', C.rose], ['Who files what', C.blue], ['After acceptance', C.emerald]];
    const chips = topics.map(([tp, c]) => { const p = W.pill(tp, { h: .42, dot: c }); W.add(p); return p; });
    const set = (m: THREE.MeshBasicMaterial, tex: THREE.Texture) => { if (m.map !== tex) { m.map = tex; m.needsUpdate = true; } };

    return { update(t, a) {
      // four turns per 24 s loop: spread s -> s+1 during [1.5, 3.7] of each 6-second quarter
      const half = Math.floor(t / 6), lt = t % 6, s = half % 4;
      const k = E.inOutCubic(win(lt, 1.5, 3.7));
      const cur = s, nxt = (s + 1) % 4;
      // under the leaf: left page stays current until the leaf lands, right page already shows the next spread
      set(left.material, k >= 1 ? L[nxt] : L[cur]);
      set(right.material, k > 0 ? R[nxt] : R[cur]);
      set(mF, R[cur]); set(mB, L[nxt]);
      pivot.visible = k > 0 && k < 1;
      pivot.rotation.z = k * Math.PI;
      pivot.position.y = .36 + Math.sin(Math.PI * k) * .25;
      if (lt > 3.7) { set(left.material, L[nxt]); set(right.material, R[nxt]); }
      chips.forEach((p, i) => { const q = a * 2 + i * TAU / 4; p.position.set(Math.cos(q) * 4.1, 1.7 + Math.sin(q * 2 + i) * .3, Math.sin(q) * 2.9); });
      book.position.y = Math.sin(a * 2) * .03;
    } };
  },
};
