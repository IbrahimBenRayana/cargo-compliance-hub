// SIGN UP (invite) and SET PASSWORD · "Your berth is ready".
// A quay at night with a ship alongside. Your gold container stands on the
// quay with your organisation stencilled on it. Over the water floats your
// crew card: the role from the invitation, the name you type, and a password
// bar that fills gold to emerald with strength. Each field you complete swings
// one box aboard. Submitting locks the Focus Frame on your container, it is
// loaded aboard, and "Workspace ready" rises over the ship. A failed submit
// pulses the frame rose once.
import type * as THREE from 'three';
import type { SceneDef } from '../engine';
import type { BerthState } from '../state';
import { damp, fitText, frameClock, liveTexture } from './live';

export function berthScene(get: () => BerthState): SceneDef {
  return {
    dark: true, loop: 12, poster: 2.0, radius: 6.4, drift: 0.2,
    // the panel is tall: a high three-quarter view across the quay to the ship
    camera: { pos: [5.5, 10.5, 10.5], target: [0.3, 1.2, -0.4], fov: 30 },
    build(W) {
      const { THREE, C, M, E, clamp, rng, TAU } = W;
      const tick = frameClock();

      // ---------------- sea, quay, ship alongside
      const sea = W.add(W.sea({ w: 11, d: 4.2, loop: 12, amp: 0.08 })); sea.position.set(0, 0, -2.3);
      const quay = W.add(W.slab(11, 0.5, 3.2, M.porcelain, 0.2)); quay.position.z = 1.4;
      for (let i = 0; i < 5; i++) {
        const bollard = W.cyl(0.09, 0.22, M.navy, 16); bollard.position.set(-4 + i * 2, 0.61, -0.05); W.add(bollard);
      }
      const ship = W.add(W.ship({ len: 8, beam: 2.3, seed: 5, tiers: 1, flat: true }));
      ship.position.set(0.3, -0.12, -2.35);
      const slot = (b: number, rw: number, tier: number) => (ship.userData.slot(b, rw, tier) as THREE.Vector3).clone().add(ship.position);

      // ---------------- boxes waiting on the quay: one per form field
      const MAXBOX = 4, boxPal = [C.steel, C.denim, C.slate, C.steel];
      const boxes = Array.from({ length: MAXBOX }, (_, i) => {
        const b = W.add(W.container(boxPal[i], 1.25, 0.52, 0.5));
        const home = new THREE.Vector3(-4.1 + (i % 2) * 1.32, 0.5 + 0.27 + Math.floor(i / 2) * 0.53, 2.1);
        const dest = slot(i, i % 2 ? 0 : 3, 1);
        b.position.copy(home);
        return { b, home, dest, k: 0 };
      });

      // ---------------- your container, with your organisation stencilled on
      let org = '';
      const stencil = liveTexture(W, 900, 260, (g, w, h) => {
        g.textBaseline = 'middle';
        g.fillStyle = org ? 'rgba(20,33,61,.9)' : 'rgba(20,33,61,.35)';
        const text = (org || 'Your workspace').toUpperCase();
        g.font = `800 84px ${W.FONT}`;
        if (g.measureText(text).width <= w - 60) { g.fillText(text, 30, h / 2 + 4); return; }
        // long names: two lines at a smaller size, split at the space nearest the middle
        g.font = `800 64px ${W.FONT}`;
        const at = text.lastIndexOf(' ', Math.ceil(text.length / 2));
        const mid = at > 0 ? at : text.indexOf(' ');
        const [l1, l2] = mid > 0 ? [text.slice(0, mid), text.slice(mid + 1)] : [text, ''];
        g.fillText(fitText(g, l1, w - 60), 30, h / 2 - 34);
        if (l2) g.fillText(fitText(g, l2, w - 60), 30, h / 2 + 40);
      });
      const mine = new THREE.Group(); W.add(mine);
      mine.add(W.container(C.gold, 2.4, 1.0, 1.0));
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.6), new THREE.MeshBasicMaterial({ map: stencil.tex, transparent: true, toneMapped: false }));
      plate.position.set(0, 0.05, 0.505); mine.add(plate);
      const QUAY_POS = new THREE.Vector3(0.9, 1.0, 1.75), SHIP_POS = slot(3, 1, 1).add(new THREE.Vector3(0.2, 0.25, 0));
      mine.position.copy(QUAY_POS);
      const frame = W.add(W.focusFrame({ th: 0.07, arm: 0.36 }));

      // ---------------- the crew card: role, name, org and the password bar
      let name = '', role = '', bar = 0;
      const crewFace = liveTexture(W, 640, 380, (g, w, h) => {
        W.rr(g, 0, 0, w, h, 32); g.fillStyle = '#FFFFFF'; g.fill();
        W.rr(g, 0, 0, 12, h, [32, 0, 0, 32]); g.fillStyle = C.gold; g.fill();
        g.font = `600 24px ${W.FONT}`; g.fillStyle = '#6B7794';
        g.fillText((role || 'Crew').toUpperCase().split('').join(String.fromCharCode(8202)), 48, 66);
        g.font = `700 50px ${W.FONT}`; g.fillStyle = name ? '#0F1A30' : '#AEB7CB';
        g.fillText(fitText(g, name || 'Your name', w - 96), 48, 140);
        g.font = `500 26px ${W.MONO}`; g.fillStyle = '#66728C';
        g.fillText(fitText(g, org || 'your workspace', w - 96), 48, 196);
        // password strength
        g.font = `600 22px ${W.FONT}`; g.fillStyle = '#6B7794'; g.fillText('PASSWORD', 48, 270);
        W.rr(g, 48, 290, w - 96, 18, 9); g.fillStyle = 'rgba(30,45,77,.10)'; g.fill();
        if (bar > 0.01) {
          W.rr(g, 48, 290, Math.max(18, (w - 96) * bar), 18, 9);
          g.fillStyle = bar > 0.75 ? C.emerald : C.gold; g.fill();
        }
      });
      const crew = W.add(W.card(crewFace.tex, { w: 2.7, aspect: 380 / 640, d: 0.06 }));
      crew.position.set(-1.9, 3.4, -0.2); W.faceCam(crew, -0.12);

      // ---------------- "Workspace ready · {org}" over the ship on success
      let readyFor = '';
      let ready: THREE.Mesh | null = null;

      // ---------------- warm glow + motes
      const halo = W.glow('#FFD98A', 3.0, 0.22); halo.position.set(4.6, 3.6, -2.6); W.add(halo);
      const N = 40, mr = rng(12), mp = new Float32Array(N * 3), seeds: number[][] = [];
      for (let i = 0; i < N; i++) seeds.push([mr() * 11 - 5.5, mr() * 4 + 1, mr() * 5 - 3, mr()]);
      const motes = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(mp, 3)),
        new THREE.PointsMaterial({ color: C.gold, size: 0.05, transparent: true, opacity: 0.6, depthWrite: false }));
      W.add(motes);

      // ---------------- state, eased every frame
      const p = new THREE.Vector3();
      let errSeen = -1, errAt = -10, okAt = -1, open = 1, readyK = 0, last = '';

      return { update(t, a) {
        const s = get(), dt = tick(), now = performance.now() / 1000;
        sea.userData.update(t);
        ship.position.y = -0.12 + sea.userData.height(0, 0, t) * 0.6;

        // text on the container and the card, redrawn only when it changes
        const nextBar = damp(bar, s.strength, 6, dt);
        const key = `${s.org}\u0001${s.name}\u0001${s.role}`;
        if (key !== last || Math.abs(nextBar - bar) > 0.004) {
          if (s.org !== org) { org = s.org; stencil.redraw(); }
          name = s.name; role = s.role; bar = nextBar; crewFace.redraw(); last = key;
        }
        if (errSeen < 0) errSeen = s.errorCount;
        if (s.errorCount > errSeen) errAt = now;
        errSeen = s.errorCount;
        if (s.phase === 'success') { if (okAt < 0) okAt = now; } else okAt = -1;
        const ok = okAt > 0 ? now - okAt : -1;
        const err = clamp(1 - (now - errAt) / 1.3);

        // one box swings aboard per completed field
        boxes.forEach((o, i) => {
          o.b.visible = i < s.total;
          o.k = damp(o.k, i < s.filled || ok >= 0 ? 1 : 0, 2.6, dt);
          const k = E.inOutSine(clamp(o.k));
          p.lerpVectors(o.home, o.dest, k); p.y += Math.sin(Math.PI * k) * 2.2;
          o.b.position.copy(p);
        });

        // on success your container is loaded aboard
        const lift = ok >= 0 ? E.inOutCubic(clamp((ok - 0.15) / 1.1)) : 0;
        p.lerpVectors(QUAY_POS, SHIP_POS, lift); p.y += Math.sin(Math.PI * lift) * 2.4;
        mine.position.copy(p);

        // Focus Frame: tightens as the form fills, locks on submit
        const fill = s.total ? s.filled / s.total : 0;
        const wantOpen = ok >= 0 || s.phase === 'checking' ? 0 : 1 - fill * 0.75;
        open = damp(open, wantOpen, 6, dt);
        frame.position.copy(mine.position).add(p.set(0, 0, 0.62));
        W.faceCam(frame, 0);
        const pulse = ok >= 0 ? clamp(ok / 0.8) : err > 0 ? 1 - err : 0;
        frame.userData.set(2.5, 1.05, open, pulse > 0 && pulse < 1 ? pulse : 0);
        frame.userData.halo.material.color.set(ok >= 0 ? C.emerald : err > 0 ? C.rose : C.gold);

        // "Workspace ready · {org}" rises over the ship (built on first success)
        if (ok >= 0) {
          const label = s.doneLabel ?? (org ? `Workspace ready · ${org}` : 'Workspace ready');
          if (label !== readyFor) {
            if (ready) W.scene.remove(ready);
            ready = W.pill(label, { h: 0.42, dot: C.emerald }); W.add(ready); readyFor = label;
          }
        }
        readyK = damp(readyK, ok >= 0.5 ? 1 : 0, 5, dt);
        if (ready) {
          (ready.material as THREE.MeshBasicMaterial).opacity = readyK;
          ready.position.set(0.4, 3.9 + readyK * 0.4, -2.3);
          ready.visible = readyK > 0.01;
        }

        for (let i = 0; i < N; i++) { const [x, y, z, ph] = seeds[i]; mp[i * 3] = x + Math.sin(a + ph * TAU) * 0.3; mp[i * 3 + 1] = y + Math.sin(a * 2 + ph * 9) * 0.2; mp[i * 3 + 2] = z; }
        motes.geometry.attributes.position.needsUpdate = true;
      } };
    },
  };
}
