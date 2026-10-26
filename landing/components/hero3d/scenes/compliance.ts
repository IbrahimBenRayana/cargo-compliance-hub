// COMPLIANCE · "Trade compliance software for what happens after entry"
// Round 2. Acceptance starts the clock: a 314-day gauge stands around the accepted entry and fills
// toward liquidation. The Focus Frame reads the entry's HTS lines and raises two flags beside it:
// possible ADD/CVD and possible UFLPA exposure. At day 314 the entry liquidates.
import type * as THREE from "three";
import type { SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 12, poster: 4.6, radius: 4.9, width: 5.2,
  camera: { pos: [3.2, 4.6, 14], target: [.6, 2.7, 0], fov: 26 },
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    W.add(W.slab(10, .4, 4.2, M.porcelain, .2));
    const root = new THREE.Group(); root.position.set(-1.1, 0, -.4); W.add(root);
    root.rotation.y = Math.atan2(W.camPos.x + 1.1, W.camPos.z + .4) * .8;

    // gauge: a 270-degree arc from 7:30 round to 4:30, standing on two feet
    const R = 2.45, cy = 2.75, a0 = Math.PI * 1.25, sweep = Math.PI * 1.5;
    const angAt = (u: number) => a0 - u * sweep;                       // clockwise
    const pt = (u: number, r = R): [number, number, number] => [Math.cos(angAt(u)) * r, cy + Math.sin(angAt(u)) * r, 0];
    const arcPts = Array.from({ length: 49 }, (_, i) => pt(i / 48));
    const track = W.tube(arcPts, .07, M.mist, 160); root.add(track);
    const fill = W.tube(arcPts, .1, M.goldGlow, 160); root.add(fill);
    for (let i = 0; i <= 12; i++) { const u = i / 12, a = angAt(u); const tk = W.mesh(W.rbox(.05, i % 3 ? .16 : .3, .05, .02), M.slate, false); tk.position.set(Math.cos(a) * (R + .3), cy + Math.sin(a) * (R + .3), 0); tk.rotation.z = a - Math.PI / 2; root.add(tk); }
    for (const sx of [-1, 1]) { const f = W.mesh(W.rbox(.22, .9, .4, .08), M.navy); f.position.set(sx * 1.25, .85, 0); f.rotation.z = sx * .25; root.add(f); }
    const head = W.mesh(new THREE.SphereGeometry(.17, 20, 14), M.goldGlow, false); root.add(head);
    const headGlow = W.glow(C.gold, 1.4, .7); root.add(headGlow);
    // milestones on the arc (no PSC day count: position only)
    const marks = [
      { u: 0, t: 'Entry accepted', c: C.emerald, off: [-1.15, -.1] },
      { u: .9, t: 'PSC deadline', c: C.blue, off: [1.35, .55] },
      { u: 1, t: 'Liquidation · day 314', c: C.violet, off: [1.25, -.45] },
    ].map(m => {
      const p = pt(m.u); const dot = W.mesh(new THREE.SphereGeometry(.15, 20, 14), new THREE.MeshStandardMaterial({ color: m.c, emissive: m.c, emissiveIntensity: .2 }), false); dot.position.set(...p); root.add(dot);
      const pl = W.pill(m.t, { dot: m.c, h: .4 }); pl.position.set(p[0] + m.off[0], p[1] + m.off[1], .2); root.add(pl); W.billboard(pl);
      return { ...m, dot };
    });
    // day counter under the gauge (pre-rendered every 2 days)
    const dayTex: (THREE.Texture | null)[] = Array.from({ length: 158 }, () => null);
    const dayPill = W.pill('Day 0 of 314', { h: .46, mono: true }); dayPill.position.set(0, .55, .5); root.add(dayPill); W.billboard(dayPill);
    const setDay = (d: number) => { const k = Math.min(157, Math.round(d / 2)); if (!dayTex[k]) dayTex[k] = W.pillTex(`Day ${k * 2} of 314`, { mono: true }); if (dayPill.material.map !== dayTex[k]) { dayPill.material.map = dayTex[k]; dayPill.material.needsUpdate = true; } };

    // the entry card inside the gauge, with two HTS lines
    const face = (state: string) => W.canvasTex(640, 420, (g) => {
      W.rr(g, 0, 0, 640, 420, 34); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(30,45,77,.1)'; g.stroke();
      W.rr(g, 0, 0, 12, 420, [34, 0, 0, 34]); g.fillStyle = state === 'liq' ? C.violet : C.emerald; g.fill();
      g.font = `600 22px ${W.FONT}`; g.fillStyle = '#6B7794'; g.fillText('E N T R Y   2 3 0 - 1 1 4 8 2 9 3 - 5', 48, 66);
      g.font = `700 40px ${W.FONT}`; g.fillStyle = '#0F1A30'; g.fillText(state === 'liq' ? 'Liquidated' : 'Accepted by CBP', 48, 120);
      [['8504.40.95', 'Power supplies'], ['7318.15.20', 'Steel bolts']].forEach(([h, d], i) => {
        const y = 196 + i * 92; W.rr(g, 36, y - 46, 568, 76, 16); g.fillStyle = 'rgba(30,45,77,.04)'; g.fill();
        g.font = `600 30px ${W.MONO}`; g.fillStyle = '#1E2D4D'; g.fillText(h, 60, y + 2); g.font = `500 28px ${W.FONT}`; g.fillStyle = '#66728C'; g.fillText(d, 290, y + 2);
      });
      g.font = `500 22px ${W.MONO}`; g.fillStyle = '#8C99B8'; g.fillText('HTS lines checked daily', 48, 392);
    });
    const fAcc = face('acc'), fLiq = face('liq');
    const cw = 2.9, ch = cw * 420 / 640;
    const card = W.card(fAcc, { w: cw, aspect: 420 / 640, d: .08 }); card.position.set(0, cy + .05, .15); root.add(card);
    const rowY = (i: number) => ch / 2 - (196 + i * 92 - 8) / 420 * ch;
    const frame = W.focusFrame({ th: .055, arm: .26 }); root.add(frame);
    // risk chips to the right of the gauge, stacked with room between them
    const chips = [
      W.pill('Possible ADD/CVD · 7318.15', { dot: C.amber, h: .46 }),
      W.pill('Possible UFLPA exposure · review origin', { dot: C.amber, h: .46 }),
    ];
    chips.forEach((c, i) => { c.position.set(4.6, 4.35 - i * .85, .2); root.add(c); W.billboard(c); });
    const lines = chips.map((c, i) => { const l = W.mesh(W.rbox(1, .025, .025, .01), M.goldGlow, false); root.add(l); return l; });

    return { update(t, a) {
      const out = win(t, 10.6, 11.5);
      const u = E.inOutSine(win(t, .4, 9.4)) * (1 - out);
      fill.userData.setProgress(0, u);
      const hp = pt(u); head.position.set(...hp); headGlow.position.set(...hp); head.scale.setScalar(1 - out + .001); headGlow.material.opacity = .7 * (1 - out);
      setDay(u * 314);
      marks.forEach(m => { const on = u >= m.u - .002 ? 1 : 0; m.dot.material.emissiveIntensity = .2 + on * .8; m.dot.scale.setScalar(1 + Math.max(0, 1 - Math.abs(u - m.u) / .04) * .5); });
      card.userData.blendTo(fLiq, win(t, 9.3, 9.8) * (1 - out));
      // frame: row 1 (1.2..2.6), row 2 (2.8..4.2), then whole card at day 314
      const r1 = E.outBack(win(t, 1.2, 1.7)), mv = E.inOutCubic(win(t, 2.6, 3.1)), toCard = E.inOutCubic(win(t, 4.4, 5.0));
      const fy = lerp(lerp(rowY(0), rowY(1), mv), 0, toCard);
      const fw = lerp(cw - .2, cw, toCard), fh = lerp(.42, ch, toCard);
      frame.position.set(card.position.x, card.position.y + fy, card.position.z + .07);
      const open = Math.min(1, (1 - r1) + win(t, 5.2, 5.8) * (1 - win(t, 8.8, 9.3)) + out);
      frame.userData.set(fw, fh, open, (t > 1.6 && t < 2.4) ? win(t, 1.6, 2.4) : (t > 3.1 && t < 3.9) ? win(t, 3.1, 3.9) : (t > 9.4 && t < 10.2) ? win(t, 9.4, 10.2) : 0);
      frame.userData.halo.material.color.set(t > 9 ? C.violet : C.amber);
      chips.forEach((c, i) => {
        const on = E.outBack(win(t, 1.9 + i * 1.5, 2.4 + i * 1.5)) * (1 - out);
        c.scale.setScalar(on + .001);
        const from = new THREE.Vector3(card.position.x + cw / 2, card.position.y + rowY(i), .2), to = c.position.clone().add(new THREE.Vector3(-c.geometry.parameters.width / 2, 0, 0));
        const l = lines[i]; const d = to.clone().sub(from); l.position.copy(from).addScaledVector(d, .5); l.scale.x = d.length() * on + .001; l.rotation.z = Math.atan2(d.y, d.x);
      });
    } };
  },
};
