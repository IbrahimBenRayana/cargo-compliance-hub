// SIGN IN · "Clear the gate".
// A night quay with a gate. Your container waits in the lane on a truck.
// Typing the email prints its domain on the container's tag (a gold scan line
// reads it); a password rolls the truck up to the gate and arms the scanner.
// Submitting locks the Focus Frame on. Success: emerald, the barrier lifts and
// the truck drives into the yard. Wrong details: one rose flash, the barrier
// stays down. The MFA step raises a second checkpoint that fills per digit.
import type * as THREE from 'three';
import type { SceneDef } from '../engine';
import { emailDomain, type GateState } from '../state';
import { damp, fitText, frameClock, liveTexture } from './live';

export function gateScene(get: () => GateState): SceneDef {
  return {
    dark: true, loop: 12, poster: 2.0, radius: 6.6, drift: 0.2,
    // the panel is tall: look down the lane on a diagonal so the set fills it
    camera: { pos: [9.0, 11.0, 8.8], target: [-0.2, 0.8, 0.4], fov: 30 },
    build(W) {
      const { THREE, C, M, E, lerp, clamp, rng, TAU } = W;
      const tick = frameClock();
      const LANE_Z = 0.6, GATE_X = 0.9, WAIT_X = -3.5, STOP_X = -1.75, EDGE = 5.4;

      // ---------------- the quay, the lane, the yard behind the gate
      W.add(W.slab(11, 0.4, 5.2, M.porcelain, 0.2));
      const laneMat = new THREE.MeshStandardMaterial({ color: '#16213A', roughness: 0.85 });
      const lane = W.mesh(W.rbox(10.6, 0.03, 1.6, 0.01), laneMat, false); lane.position.set(0, 0.41, LANE_Z); W.add(lane);
      for (const z of [LANE_Z - 0.82, LANE_Z + 0.82]) {
        const edge = W.mesh(W.rbox(10.6, 0.02, 0.05, 0.01), M.slate, false); edge.position.set(0, 0.43, z); W.add(edge);
      }
      for (let i = 0; i < 8; i++) {
        const dash = W.mesh(W.rbox(0.5, 0.02, 0.06, 0.01), M.gold, false); dash.position.set(-4.9 + i * 1.4, 0.43, LANE_Z); W.add(dash);
      }
      const r = rng(4), yard: { x: number; y: number; z: number; color: string }[] = [];
      const pal = [C.navy, C.steel, C.denim, C.navyDeep, C.slate];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        const h = 1 + Math.floor(r() * 3);
        for (let k = 0; k < h; k++) yard.push({ x: 2.1 + i * 1.32, y: 0.4 + 0.27 + k * 0.53, z: -1.4 - j * 0.56, color: pal[Math.floor(r() * pal.length)] });
      }
      W.add(W.containerField(yard, 1.25, 0.52, 0.5));

      // ---------------- the gate: posts, beam, scanner bar, booth, barrier
      const gate = new THREE.Group(); gate.position.set(GATE_X, 0.4, 0); W.add(gate);
      for (const z of [LANE_Z - 1.0, LANE_Z + 1.0]) {
        const post = W.mesh(W.rbox(0.24, 2.8, 0.24, 0.06), M.navy); post.position.set(0, 1.4, z); gate.add(post);
      }
      const beam = W.mesh(W.rbox(0.34, 0.3, 2.3, 0.08), M.navy); beam.position.set(0, 2.85, LANE_Z); gate.add(beam);
      const scanMat = new THREE.MeshStandardMaterial({ color: C.slate, emissive: C.slate, emissiveIntensity: 0.3, roughness: 0.3 });
      const scanBar = W.mesh(W.rbox(0.14, 0.07, 1.9, 0.03), scanMat, false); scanBar.position.set(0, 2.66, LANE_Z); gate.add(scanBar);
      const gateGlow = W.glow(C.gold, 3.2, 0); gateGlow.position.set(0, 2.2, LANE_Z); gate.add(gateGlow);
      const booth = W.mesh(W.rbox(0.8, 1.2, 0.8, 0.1), M.navyDeep); booth.position.set(0.15, 0.6, LANE_Z + 1.75); gate.add(booth);
      const boothWin = W.mesh(W.rbox(0.02, 0.32, 0.56, 0.01), scanMat, false); boothWin.position.set(-0.26, 0.86, LANE_Z + 1.75); gate.add(boothWin);
      // barrier arm pivots on the near post and spans the lane
      const pivot = new THREE.Group(); pivot.position.set(0.2, 1.0, LANE_Z + 1.0); gate.add(pivot);
      const stripe = [M.gold, M.white];
      for (let i = 0; i < 6; i++) {
        const seg = W.mesh(W.rbox(0.09, 0.09, 0.32, 0.02), stripe[i % 2]); seg.position.set(0, 0, -0.17 - i * 0.32); pivot.add(seg);
      }
      const hub = W.mesh(W.rbox(0.2, 0.2, 0.2, 0.05), M.navyDeep); pivot.add(hub);

      // ---------------- floodlights (it is night at the port)
      for (const [x, z] of [[-4.6, -2.0]] as const) {
        const pole = W.mesh(W.rbox(0.1, 3.6, 0.1, 0.03), M.navy); pole.position.set(x, 2.2, z); W.add(pole);
        const lamp = W.mesh(W.rbox(0.4, 0.12, 0.3, 0.04), M.goldGlow, false); lamp.position.set(x, 4.0, z); W.add(lamp);
        const halo = W.glow('#FFD98A', 2.6, 0.32); halo.position.set(x, 3.9, z); W.add(halo);
      }

      // ---------------- your container on a truck, with a consignee tag
      const truck = W.truck({ color: C.gold }); truck.position.set(WAIT_X, 0.42, LANE_Z); W.add(truck);
      let domain = '';
      const tag = liveTexture(W, 760, 220, (g, w, h) => {
        W.rr(g, 0, 0, w, h, 26); g.fillStyle = '#FFFFFF'; g.fill();
        W.rr(g, 0, 0, 12, h, [26, 0, 0, 26]); g.fillStyle = domain ? C.gold : '#C9D1E3'; g.fill();
        g.font = `600 26px ${W.FONT}`; g.fillStyle = '#6B7794'; g.fillText('CONSIGNEE', 44, 66);
        g.font = `600 52px ${W.MONO}`;
        g.fillStyle = domain ? '#0F1A30' : '#AEB7CB';
        g.fillText(fitText(g, domain || 'your-company.com', w - 88), 44, 156);
      });
      const tagMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.55), new THREE.MeshBasicMaterial({ map: tag.tex, transparent: true, toneMapped: false }));
      tagMesh.position.set(-0.25, 1.0, 0.456); truck.add(tagMesh);
      // the scan line that reads the tag whenever the domain changes
      const scanLine = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 1.05), new THREE.MeshBasicMaterial({ color: C.gold, transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
      scanLine.position.set(0, 0.97, 0.47); truck.add(scanLine);
      W.clip(truck, -EDGE, EDGE);

      // ---------------- the Focus Frame on your container
      const frame = W.add(W.focusFrame({ th: 0.07, arm: 0.36 }));

      // ---------------- the second checkpoint (MFA), raised only when needed
      // a code panel slides up out of the booth roof, six lights in a row
      const mfa = new THREE.Group(); mfa.position.set(GATE_X + 0.15, 0.4 + 1.2, LANE_Z + 1.75); W.add(mfa);
      const panel = W.mesh(W.rbox(0.9, 0.42, 0.14, 0.05), M.navyDeep); panel.position.y = 0.26; mfa.add(panel);
      const dotMats: THREE.MeshStandardMaterial[] = [];
      for (let i = 0; i < 6; i++) {
        const m = new THREE.MeshStandardMaterial({ color: C.slate, emissive: C.gold, emissiveIntensity: 0, roughness: 0.4 });
        const d = W.mesh(W.rbox(0.09, 0.14, 0.04, 0.02), m, false);
        d.position.set(-0.3 + i * 0.12, 0.26, 0.08); mfa.add(d); dotMats.push(m);
      }
      const mfaPill = W.pill('Second check', { h: 0.3, dot: C.gold }); mfaPill.position.set(0, 0.78, 0); mfa.add(mfaPill); W.billboard(mfaPill);
      mfa.scale.setScalar(0.001);

      // ---------------- status label over the gate (one pill per state, cross-faded)
      const STATUS: Record<string, [string, string]> = {
        idle: ['Waiting at the gate', C.slate],
        checking: ['Checking your details', C.amber],
        mfa: ['One more check', C.gold],
        success: ['Cleared · welcome back', C.emerald],
        error: ['Not cleared · check your details', C.rose],
      };
      const pills: Record<string, THREE.Mesh> = {};
      let noteText = '';
      for (const [k, [text, dot]] of Object.entries(STATUS)) {
        const p = W.pill(text, { h: 0.38, dot }); p.position.set(GATE_X, 3.75, LANE_Z); W.add(p);
        (p.material as THREE.MeshBasicMaterial).opacity = k === 'idle' ? 1 : 0; pills[k] = p;
      }

      // ---------------- drifting gold motes
      const N = 40, mr = rng(8), mp = new Float32Array(N * 3), seeds: number[][] = [];
      for (let i = 0; i < N; i++) seeds.push([mr() * 12 - 6, mr() * 4 + 1, mr() * 5 - 3, mr()]);
      const motes = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(mp, 3)),
        new THREE.PointsMaterial({ color: C.gold, size: 0.05, transparent: true, opacity: 0.6, depthWrite: false }));
      W.add(motes);

      // ---------------- state, eased every frame
      const col = new THREE.Color(), cTmp = new THREE.Color();
      let lastDomain: string | null = null, scanAt = -10, errSeen = -1, errAt = -10, okAt = -1, wasMfa = false;
      let approach = 0, lift = 0, open = 1, mfaIn = 0;
      const dotK = [0, 0, 0, 0, 0, 0], pillK: Record<string, number> = { idle: 1 };

      return { update(t, a) {
        const s = get(), dt = tick(), now = performance.now() / 1000;
        const d = emailDomain(s.email);
        if (d !== lastDomain) { domain = d; tag.redraw(); if (lastDomain !== null) scanAt = now; lastDomain = d; }
        if (errSeen < 0) errSeen = s.errorCount;
        if (s.errorCount > errSeen) errAt = now;
        errSeen = s.errorCount;
        if (s.phase === 'success') { if (okAt < 0) okAt = now; } else okAt = -1;
        if (s.phase === 'mfa') wasMfa = true; else if (s.phase === 'idle') wasMfa = false;
        const ok = okAt > 0 ? now - okAt : -1;
        const err = clamp(1 - (now - errAt) / 1.3);

        // the truck creeps up as the form fills, then drives through on success
        const want = s.phase === 'checking' || s.phase === 'mfa' || ok >= 0 ? 1 : (d ? 0.5 : 0) + (s.hasPassword ? 0.5 : 0);
        approach = damp(approach, want, 2.8, dt);
        const drive = ok >= 0 ? E.inOutCubic(clamp((ok - 0.15) / 1.1)) : 0;
        truck.position.x = lerp(WAIT_X, STOP_X, approach) + drive * 9;

        // scanner colour by phase; an error flashes rose and fades
        const base = ok >= 0 ? C.emerald : s.phase === 'mfa' ? C.gold : s.phase === 'checking' || s.hasPassword ? C.amber : C.slate;
        col.set(base).lerp(cTmp.set(C.rose), err);
        const busy = s.phase === 'checking' ? 0.35 + 0.35 * Math.sin(now * 8) : 0;
        scanMat.color.copy(col); scanMat.emissive.copy(col); scanMat.emissiveIntensity = (base === C.slate ? 0.25 : 0.9) + busy + err;
        gateGlow.material.color.copy(col);
        gateGlow.material.opacity = (base === C.slate ? 0.05 : 0.35) + err * 0.5 + (ok >= 0 ? 0.25 : 0);

        // barrier lifts on success; on error it shudders once and stays down
        lift = damp(lift, ok >= 0 ? 1 : 0, 7, dt);
        pivot.rotation.x = lift * 1.45 + err * Math.sin((now - errAt) * 38) * 0.05;

        // the scan line reads the tag after each change, and loops while checking
        const sk = s.phase === 'checking' ? (now * 1.3) % 1 : (now - scanAt) / 0.6;
        const sm = scanLine.material as THREE.MeshBasicMaterial;
        if (sk >= 0 && sk <= 1 && drive < 0.05) { scanLine.position.x = lerp(-1.45, 0.95, E.inOutSine(sk)); sm.opacity = Math.sin(Math.PI * sk) * 0.95; }
        else sm.opacity = 0;

        // Focus Frame: wide while idle, tighter as the form fills, locked on submit
        const wantOpen = ok >= 0 || s.phase === 'checking' || s.phase === 'mfa' ? 0 : 1 - approach * 0.7;
        open = damp(open, wantOpen, 6, dt);
        // brackets sit on the container's side, around the consignee tag
        frame.position.set(truck.position.x - 0.25, 1.39, LANE_Z + 0.5);
        frame.rotation.set(0, 0, 0);
        const pulse = ok >= 0 ? clamp(ok / 0.8) : err > 0 ? 1 - err : 0;
        frame.userData.set(2.75, 1.05, open, pulse > 0 && pulse < 1 ? pulse : 0);
        frame.userData.halo.material.color.set(ok >= 0 ? C.emerald : err > 0 ? C.rose : C.gold);
        frame.visible = drive < 0.2;

        // MFA checkpoint rises in; one dot lights per digit
        mfaIn = damp(mfaIn, s.phase === 'mfa' || (wasMfa && ok >= 0) ? 1 : 0, 6, dt);
        mfa.scale.set(1, Math.max(0.001, E.outBack(clamp(mfaIn))), 1);
        mfa.visible = mfaIn > 0.01;
        dotMats.forEach((m, i) => {
          dotK[i] = damp(dotK[i], ok >= 0 && wasMfa ? 1 : i < s.codeLength ? 1 : 0, 14, dt);
          m.color.set(C.slate).lerp(cTmp.set(ok >= 0 ? C.emerald : C.gold), dotK[i]);
          m.emissive.set(ok >= 0 ? C.emerald : C.gold); m.emissiveIntensity = dotK[i] * 0.9;
        });

        // status label (a page note, e.g. "Link sent", replaces it)
        if (s.note && s.note !== noteText) {
          if (pills.note) W.scene.remove(pills.note);
          const p = W.pill(s.note, { h: 0.38, dot: C.gold }); p.position.set(GATE_X, 3.75, LANE_Z); W.add(p);
          (p.material as THREE.MeshBasicMaterial).opacity = 0; pills.note = p; noteText = s.note;
        }
        const now_k = err > 0.05 ? 'error' : ok >= 0 ? 'success' : s.note ? 'note' : s.phase === 'error' ? 'idle' : s.phase;
        for (const k of Object.keys(pills)) {
          pillK[k] = damp(pillK[k] ?? 0, k === now_k ? 1 : 0, 9, dt);
          (pills[k].material as THREE.MeshBasicMaterial).opacity = pillK[k];
          pills[k].visible = pillK[k] > 0.01;
        }

        for (let i = 0; i < N; i++) { const [x, y, z, ph] = seeds[i]; mp[i * 3] = x + Math.sin(a + ph * TAU) * 0.3; mp[i * 3 + 1] = y + Math.sin(a * 2 + ph * 9) * 0.2; mp[i * 3 + 2] = z; }
        motes.geometry.attributes.position.needsUpdate = true;
        void t;
      } };
    },
  };
}
