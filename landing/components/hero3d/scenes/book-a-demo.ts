// BOOK A DEMO · "See your own filings in the inbox." (20 minutes)
// Round 2. The call, laid out as what you will see: a 20-minute rail along the front of a plinth and
// three stations on it. Your shipment and its filing, the inbox ranking it, and the price per shipment.
// A gold bead runs the rail; each station lights and the Focus Frame lands on it as the bead arrives.
import type { SceneDef, World } from "../engine";

export const scene: SceneDef = {
  loop: 12, poster: 9.0, radius: 4.8, width: 5.6,
  camera: { pos: [1.5, 5.6, 14.5], target: [0, 1.9, 0], fov: 26 },
  fit: { d: [0.997, -0.01, 0.142], m: [1.014, 0.007, 0.128] }, // measured by the poster harness fit pass
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    W.add(W.slab(10.6, .5, 3.6, M.porcelain, .2));
    // the 20-minute rail printed on the plinth's front edge
    const scale = W.canvasTex(2200, 120, (g) => {
      g.fillStyle = '#F3F5F9'; g.fillRect(0, 0, 2200, 120);
      for (let m = 0; m <= 20; m++) { const x = 60 + m / 20 * 2080; g.fillStyle = m % 5 ? 'rgba(30,45,77,.25)' : '#1E2D4D'; g.fillRect(x - 2, 0, 4, m % 5 ? 26 : 44); if (m % 5 === 0) { g.font = `600 34px ${W.FONT}`; g.fillStyle = '#1E2D4D'; g.textAlign = 'center'; g.fillText(`${m} min`, x, 96); } }
    });
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(11 * .96, .46), new THREE.MeshBasicMaterial({ map: scale, toneMapped: false })); strip.position.set(0, .25, 1.805); W.add(strip);
    const railT = W.mesh(W.rbox(10.4, .05, .14, .02), M.mist, false); railT.position.set(0, .53, 1.5); W.add(railT);
    const railF = W.mesh(W.rbox(1, .06, .16, .02), M.goldGlow, false); railF.position.set(0, .54, 1.5); W.add(railF);
    const bead = W.add(W.mesh(new THREE.SphereGeometry(.16, 24, 16), M.goldGlow, false));
    const beadGlow = W.add(W.glow(C.gold, 1.3, .7));
    const xOfMin = (m: number) => -5.2 + m / 20 * 10.4;
    // stations
    const st = [
      { x: -3.4, at: 2, label: 'Your filings', sub: 'How you file today' },
      { x: 0, at: 9, label: 'The inbox', sub: 'What needs you first' },
      { x: 3.4, at: 16, label: 'Your price', sub: 'Per shipment, on the site' },
    ] as { x: number; at: number; label: string; sub: string; pill: ReturnType<World['pill']>; glow: ReturnType<World['glow']> }[];
    // 1: a container with its ISF card
    const g1 = new THREE.Group(); g1.position.x = st[0].x; W.add(g1);
    const box = W.container(C.steel, 2.0, .85, .85); box.position.set(0, .93, -.2); box.rotation.y = .25; g1.add(box);
    // 2: three inbox rows standing on a stand, ranked
    const g2 = new THREE.Group(); g2.position.x = st[1].x; W.add(g2);
    const stand = W.mesh(W.rbox(2.3, .18, .9, .08), M.navy); stand.position.set(0, .59, -.3); g2.add(stand);
    const rows = [['ISF-10 · INV-4502', 'Due in 18h', C.amber], ['Entry · INV-4421', 'Fix steps ready', C.rose], ['ISF-5 · 3 HBLs', 'Due in 2d', C.blue]].map(([tt, m, c], i) => {
      const r = W.card(W.cardFace({ h: 220, rows: 0, title: tt, meta: m, metaMono: false, chip: i === 0 ? 'First' : undefined, chipColor: c, rail: c }), { w: 2.2, aspect: 220 / 640, d: .05 });
      r.position.set(0, 1.0 + (2 - i) * .82, -.3 - i * .05); r.rotation.x = -.06; g2.add(r); return r; });
    // 3: a price tag
    const g3 = new THREE.Group(); g3.position.x = st[2].x; W.add(g3);
    const tagTex = W.canvasTex(520, 400, (g) => {
      W.rr(g, 0, 0, 520, 400, 40); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(216,146,15,.45)'; g.stroke();
      g.beginPath(); g.arc(70, 70, 18, 0, TAU); g.strokeStyle = '#D8920F'; g.lineWidth = 6; g.stroke();
      g.font = `600 24px ${W.FONT}`; g.fillStyle = '#6B7794'; g.fillText('I S F', 110, 80);
      g.font = `750 110px ${W.FONT}`; g.fillStyle = '#0F1A30'; g.fillText('$45', 50, 220);
      g.font = `600 30px ${W.FONT}`; g.fillStyle = '#1E2D4D'; g.fillText('per accepted ISF', 54, 270);
      g.font = `500 24px ${W.FONT}`; g.fillStyle = '#0E8A62'; g.fillText('Charged when CBP accepts', 54, 340);
    });
    const tag = W.card(tagTex, { w: 2.1, aspect: 400 / 520, d: .06 }); tag.position.set(0, 1.75, -.3); tag.rotation.set(-.05, -.1, .04); g3.add(tag);
    const string = W.mesh(W.rbox(.03, .55, .03, .01), M.slate, false); string.position.set(-.75, 2.85, -.3); string.rotation.z = .5; g3.add(string);
    const groups = [g1, g2, g3];
    // labels: billboard pills at each station's foot
    st.forEach((s, i) => { s.pill = W.pill(s.label, { h: .42, dot: C.gold }); s.pill.position.set(s.x, .95 + (i === 1 ? 0 : 0), 1.25); W.add(s.pill); s.glow = W.glow(C.gold, 3.2, 0); s.glow.position.set(s.x, 1.8, -.8); W.add(s.glow); });
    st[0].pill.position.y = .8; st[1].pill.position.y = .8; st[2].pill.position.y = .8;
    const frame = W.add(W.focusFrame({ th: .06, arm: .32 }));
    const fsize = [[2.6, 1.5], [2.5, 2.7], [2.3, 1.9]], fy = [1.0, 1.85, 1.75];
    // bead timing: minute m at time t
    const minAt = (t: number) => E.inOutSine(win(t, .6, 9.8)) * 20 * (1 - E.inOutCubic(win(t, 10.8, 11.8)));

    const arrive = st.map(s => { for (let t = 0; t < 12; t += .01) if (minAt(t) >= s.at - 1) return t; return 12; });

    return { update(t, a) {
      const m = minAt(t), bx = xOfMin(m);
      bead.position.set(bx, .7, 1.5); beadGlow.position.copy(bead.position);
      railF.scale.x = Math.max(.001, bx + 5.2); railF.position.x = -5.2 + railF.scale.x / 2;
      let cur = -1; st.forEach((s, i) => { if (m >= s.at - 1) cur = i; });
      st.forEach((s, i) => {
        const on = cur === i ? 1 : 0;
        s.glow.material.opacity = on ? .45 * win(t, arrive[i], arrive[i] + .5) * (1 - win(t, 10.2, 10.8)) : 0;
        s.pill.scale.setScalar(1 + (on ? .08 : 0));
        groups[i].position.y = on ? Math.sin(a * 4) * .02 + .05 : 0;
      });
      rows.forEach((r, i) => { r.position.y = 1.0 + (2 - i) * .82 + Math.sin(a * 2 + i) * .02; });
      tag.rotation.z = .04 + Math.sin(a * 2) * .03;
      if (cur >= 0 && t < 10.6) {
        const s = st[cur], tIn = arrive[cur];
        frame.position.set(s.x, fy[cur], .35); frame.quaternion.copy(W.camera.quaternion);
        const lock = E.outBack(win(t, tIn, tIn + .6));
        frame.userData.set(fsize[cur][0], fsize[cur][1], Math.min(1, 1 - lock + win(t, 10.0, 10.6)), 0);
        frame.visible = true;
      } else frame.visible = false;
    } };
  },
};
