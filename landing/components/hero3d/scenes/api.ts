// API · "An ISF API your TMS can file through"
// Your TMS on the left, MyCargoLens on the right. JSON requests travel over on the top lane,
// signed webhooks come back gold on the lower lane when CBP answers.
import type { SceneDef } from "../engine";

export const scene: SceneDef = {
  loop: 12, poster: 5.4, radius: 6.2, exposure: 1.05,
  camera: { pos: [6, 6.5, 14], target: [0, 2.2, 0], fov: 26 },
  fit: { d: [1.085, -0.023, 0.177], m: [0.994, 0.01, 0.163] }, // measured by the poster harness fit pass
  build(W) {
    const { THREE, C, M, E, win, env, lerp, TAU } = W;
    // glowing floor grid that fades out
    const grid = new THREE.GridHelper(16, 32, W.dark ? '#3D5A8A' : '#AEBAD2', W.dark ? '#22355C' : '#C9D1E3'); grid.material.transparent = true; grid.material.opacity = W.dark ? .35 : .5; W.add(grid);
    // fade the grid out radially so it never ends in a hard edge
    grid.material.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec2 vG;\nvoid main() {\n vG = position.xz;');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying vec2 vG;\nvoid main() {').replace('#include <fog_fragment>', '#include <fog_fragment>\n gl_FragColor.a *= 1.0 - smoothstep(3.0, 7.5, length(vG));');
    };
    const plate = W.add(W.slab(12, .2, 6, new THREE.MeshStandardMaterial({ color: '#111D36', roughness: .35, metalness: .3 }), .1));
    // TMS block
    const codeTex = W.canvasTex(640, 800, (g) => {
      W.rr(g, 0, 0, 640, 800, 36); g.fillStyle = '#0E1830'; g.fill();
      g.font = `600 26px ${W.MONO}`; g.fillStyle = '#8C99B8'; g.fillText('your-tms', 44, 70);
      const L = [['#FBBE24', 'POST'], ['#C9D1E3', ' /api/public/v1/shipments'], null, ['#8C99B8', '{'], ['#C9D1E3', '  "type": "ISF-10",'], ['#C9D1E3', '  "mbol": "MAEU9381-2",'], ['#C9D1E3', '  "importer": { ... },'], ['#C9D1E3', '  "parties": [ ... ]'], ['#8C99B8', '}'], null, ['#10B981', '201 Created']];
      let y = 150; for (const l of L) { if (l) { g.font = `500 28px ${W.MONO}`; g.fillStyle = l[0]; g.fillText(l[1], 44, y); } y += 52; }
    });
    const tms = new THREE.Group(); tms.position.set(-3.6, .2, 0); W.add(tms);
    const tb = W.mesh(W.rbox(2.6, 3.3, .5, .16), M.navyDeep); tb.position.y = 1.85; tms.add(tb);
    const ts = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.0), new THREE.MeshBasicMaterial({ map: codeTex, toneMapped: false })); ts.position.set(0, 1.85, .26); tms.add(ts);
    tms.rotation.y = .35;
    const tmsTag = W.pill('Your TMS', { h: .4, bg: '#16233F', color: '#F3F5F9', border: 'rgba(140,153,184,.4)' }); tmsTag.position.set(-3.6, 4.0, .4); W.add(tmsTag);
    // MyCargoLens core: tile with the mark printed on its face
    const markTex = W.canvasTex(512, 512, (g) => {
      W.rr(g, 0, 0, 512, 512, 60); g.fillStyle = '#14213D'; g.fill();
      g.save(); g.translate(56, 56); g.scale(4, 4); g.strokeStyle = '#8C99B8'; g.lineWidth = 6.4; g.lineCap = 'round'; g.lineJoin = 'round';
      for (const d of ['M 26 40 L 26 26 L 40 26', 'M 60 26 L 74 26 L 74 40', 'M 74 60 L 74 74 L 60 74', 'M 40 74 L 26 74 L 26 60']) g.stroke(new Path2D(d));
      g.fillStyle = '#FBBE24'; g.beginPath(); g.roundRect(42, 42, 16, 16, 4.6); g.fill(); g.restore();
    });
    const core = new THREE.Group(); core.position.set(3.6, .2, 0); W.add(core);
    const cb = W.mesh(W.rbox(2.6, 2.6, 2.6, .3), new THREE.MeshStandardMaterial({ color: C.navyDeep, roughness: .3, metalness: .4 })); cb.position.y = 1.5; core.add(cb);
    const cf = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: markTex, toneMapped: false })); cf.position.set(0, 1.5, 1.31); core.add(cf);
    const coreGlow = W.glow(C.gold, 5, .35); coreGlow.position.set(0, 1.5, -.5); core.add(coreGlow);
    core.rotation.y = -.35;
    const coreTag = W.pill('MyCargoLens', { h: .4, bg: '#16233F', color: '#F3F5F9', border: 'rgba(251,190,36,.5)', dot: C.gold }); coreTag.position.set(3.6, 3.55, .6); W.add(coreTag);
    // lanes
    const up = W.add(W.tube([[-2.2, 3.0, .3], [0, 4.0, .6], [2.2, 2.9, .9]], .035, new THREE.MeshStandardMaterial({ color: '#3D5A8A', emissive: '#3D5A8A', emissiveIntensity: .6 })));
    const dn = W.add(W.tube([[2.3, 1.2, 1.0], [0, .7, 1.4], [-2.3, 1.3, .6]], .035, new THREE.MeshStandardMaterial({ color: '#7A5A10', emissive: C.goldDark, emissiveIntensity: .5 })));
    const reqs = [0, 1, 2].map(i => { const p = W.pill('{ JSON }', { h: .34, mono: true, bg: '#1E2D4D', color: '#C9D1E3', border: 'rgba(140,153,184,.5)' }); W.add(p); return p; });
    const hooks = ['filing.submitted', 'filing.accepted', 'entry.accepted'].map(n => { const p = W.pill(n, { h: .36, mono: true, bg: '#2A2410', color: '#FDD872', border: 'rgba(251,190,36,.6)' }); W.add(p); const g2 = W.glow(C.gold, 1.4, 0); W.add(g2); return { p, g2 }; });
    const sig = W.add(W.pill('X-Signature: sha256=…', { h: .32, mono: true, bg: '#16233F', color: '#8C99B8', border: 'rgba(140,153,184,.3)' })); sig.position.set(0, .1, 2.6);
    const cu = up.userData.curve, cd = dn.userData.curve;

    return { update(t, a) {
      reqs.forEach((p, i) => { const k = ((t / 4 + i / 3) % 1); p.position.copy(cu.getPoint(E.inOutSine(k))); p.scale.setScalar(Math.sin(Math.PI * k) * .9 + .1); });
      hooks.forEach((h, i) => {
        const st = 1.5 + i * 4, k = E.inOutSine(win(t, st, st + 2.4));
        h.p.position.copy(cd.getPoint(k)).add(new THREE.Vector3(0, .25, 0)); h.p.visible = k > 0 && k < 1;
        h.p.scale.setScalar(Math.sin(Math.PI * k) * .9 + .1);
        h.g2.position.copy(h.p.position); h.g2.material.opacity = Math.sin(Math.PI * k) * .8;
      });
      coreGlow.material.opacity = .3 + .15 * Math.sin(a * 3);
      cb.position.y = 1.5 + Math.sin(a * 2) * .05; cf.position.y = cb.position.y;
      sig.material.opacity = .6 + .4 * Math.sin(a * 3);
    } };
  },
};
