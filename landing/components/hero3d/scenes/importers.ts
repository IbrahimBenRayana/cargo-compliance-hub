// IMPORTERS · "Check every ISF and entry before CBP does."
// Round 2. The roll-up door opens and your truck drives out of your warehouse to the dock apron.
// The checklist above ticks through ISF-10, entry summary and cargo release while the Focus Frame
// glides from row to row. Released, the truck drives off. Next loop, the next truck comes out.
import type * as THREE from "three";
import type { SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 12, poster: 6.0, radius: 5.8, width: 5.6,
  camera: { pos: [8, 6.4, 13.5], target: [.4, 2.1, 0], fov: 27 },
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    W.add(W.slab(11, .45, 6.2, M.porcelain, .2));
    const lane = W.mesh(W.rbox(7.6, .03, 1.5, .015), M.mist); lane.position.set(1.6, .47, -1.3); W.add(lane);
    // warehouse: walls with an opening, roof, roll-up door that rises
    const wh = new THREE.Group(); wh.position.set(-3.2, .45, -1.3); W.add(wh);
    const wallBack = W.mesh(W.rbox(3.4, 2.5, .2, .05), M.paper); wallBack.position.set(0, 1.25, -1.2); wh.add(wallBack);
    for (const z of [-1.3, 1.3]) { const side = W.mesh(W.rbox(3.4, 2.5, .2, .05), M.paper); side.position.set(0, 1.25, z); wh.add(side); }
    const backEnd = W.mesh(W.rbox(.2, 2.5, 2.8, .05), M.paper); backEnd.position.set(-1.6, 1.25, 0); wh.add(backEnd);
    const roof = W.mesh(W.rbox(3.7, .16, 3.0, .05), M.navy); roof.position.y = 2.58; wh.add(roof);
    // front wall with a door opening (two jambs and a lintel)
    for (const z of [-1.2, 1.2]) { const j = W.mesh(W.rbox(.2, 2.5, .3, .04), M.paper); j.position.set(1.65, 1.25, z); wh.add(j); }
    const lintel = W.mesh(W.rbox(.22, .55, 2.6, .04), M.paper); lintel.position.set(1.65, 2.22, 0); wh.add(lintel);
    const frameD = W.mesh(W.rbox(.24, .08, 2.15, .02), M.navyDeep); frameD.position.set(1.66, 1.93, 0); wh.add(frameD);
    const inside = W.mesh(W.rbox(.05, 1.9, 2.1, .01), M.navyDeep, false); inside.position.set(1.3, .95, 0); wh.add(inside);
    const door = new THREE.Group(); door.position.set(1.72, 1.92, 0); wh.add(door);
    const slats: THREE.Mesh[] = [];
    for (let i = 0; i < 7; i++) { const sl = W.mesh(W.rbox(.06, .26, 2.1, .02), i % 2 ? M.mist : M.porcelain); sl.position.y = -.14 - i * .26; door.add(sl); slats.push(sl); }
    const sign = W.pill('Your warehouse', { h: .34 }); sign.position.set(-3.2, 3.55, -1.3); W.add(sign);
    // truck: hidden inside the building until it drives out (clip plane at the door), cut at the set edge
    const doorX = -3.2 + 1.62;
    const truck = W.add(W.clip(W.truck({ color: C.denim }), doorX, 5.4));
    const tag = W.add(W.pill('Your IOR', { h: .36, dot: C.gold }));
    // checklist card
    const items = ['ISF-10 filed', 'Entry summary (7501)', 'Cargo release (3461)'];
    const listTex = (n: number) => W.canvasTex(640, 520, (g) => {
      W.rr(g, 0, 0, 640, 520, 34); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(30,45,77,.1)'; g.stroke();
      g.font = `600 22px ${W.FONT}`; g.fillStyle = '#6B7794'; g.fillText('S H I P M E N T   I N V - 4 5 0 2', 48, 72);
      items.forEach((it, i) => {
        const y = 150 + i * 120, done = i < n;
        W.rr(g, 40, y - 52, 560, 92, 20); g.fillStyle = done ? 'rgba(16,185,129,.08)' : 'rgba(30,45,77,.04)'; g.fill();
        g.beginPath(); g.arc(92, y - 6, 22, 0, TAU); g.fillStyle = done ? '#10B981' : '#fff'; g.fill(); g.lineWidth = 4; g.strokeStyle = done ? '#10B981' : 'rgba(30,45,77,.25)'; g.stroke();
        if (done) { g.beginPath(); g.moveTo(81, y - 6); g.lineTo(89, y + 3); g.lineTo(104, y - 15); g.strokeStyle = '#fff'; g.lineWidth = 5; g.lineCap = 'round'; g.stroke(); }
        g.font = `650 32px ${W.FONT}`; g.fillStyle = '#0F1A30'; g.fillText(it, 134, y + 4);
      });
    });
    const texs = [0, 1, 2, 3].map(listTex);
    const cw = 3.4, ch = cw * 520 / 640;
    const card = W.card(texs[0], { w: cw, aspect: 520 / 640, d: .08 }); card.position.set(2.6, 4.2, .4); W.faceCam(card, -.1); W.add(card);
    const frame = W.add(W.focusFrame({ th: .055, arm: .28 }));
    const rowY = (i: number) => ch / 2 - (150 + i * 120 - 6) / 520 * ch;
    const ticks = [3.0, 4.6, 6.2];               // when each row ticks
    const x0 = 1.0;                              // parked on the apron

    return { update(t, a) {
      // door up 0..0.7, truck out 0.5..2.4, door down 2.6..3.2; truck leaves 7.6..9.8
      const up = E.inOutCubic(win(t, 0, .7)) * (1 - E.inOutCubic(win(t, 2.6, 3.2)));
      slats.forEach((sl, i) => { sl.position.y = -.14 - i * .26 * (1 - up) ; sl.scale.y = 1 - up * .9; });
      const outK = E.inOutCubic(win(t, .5, 2.4)), leave = E.inOutCubic(win(t, 7.6, 9.8));
      truck.position.set(lerp(doorX - 2.3, x0, outK) + leave * 6.5, .45, -1.3);
      truck.visible = t < 9.9;
      tag.position.copy(truck.position).add(new THREE.Vector3(.2, 1.95, 0)); tag.scale.setScalar(Math.min(win(t, 1.4, 1.8), 1 - win(t, 7.6, 8.2)) + .001);
      const n = t > 11.4 ? 0 : ticks.filter(x => t >= x).length;
      card.userData.setFace(texs[n]);
      card.position.y = 4.2 + Math.sin(a * 2) * .05;
      // frame glides row 0 -> 1 -> 2, then frames the whole list
      const m1 = E.inOutCubic(win(t, 3.3, 3.8)), m2 = E.inOutCubic(win(t, 4.9, 5.4)), all = E.inOutCubic(win(t, 6.5, 7.1));
      const y = lerp(lerp(lerp(rowY(0), rowY(1), m1), rowY(2), m2), 0, all);
      const fh = lerp(.62, ch, all), fw = lerp(cw - .3, cw, all);
      frame.position.copy(card.position).add(new THREE.Vector3(0, y, .07).applyEuler(card.rotation)); frame.rotation.copy(card.rotation);
      const lock = E.outBack(win(t, 2.0, 2.6)), rel = win(t, 9.0, 9.6);
      const pulse = ticks.map(x => (t > x && t < x + .8) ? win(t, x, x + .8) : 0).find(v => v > 0) || 0;
      frame.userData.set(fw, fh, Math.min(1, 1 - lock + rel), pulse);
      frame.userData.halo.material.color.set(C.emerald);
    } };
  },
};
