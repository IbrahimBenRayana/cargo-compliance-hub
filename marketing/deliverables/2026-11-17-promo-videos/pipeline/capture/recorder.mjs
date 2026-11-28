// Slow-motion screen capture of the real app.
//
// The page runs SLOW times slower than real time: CSS / Web Animations through
// the DevTools Animation domain, JS time (performance.now, Date.now, rAF
// timestamps, timers) through a scaled clock injected before any app code.
// Chrome's screencast grabs frames with timestamps; encode() divides those by
// SLOW and resamples to a constant 60 fps, so every transition comes out
// smooth even when capture itself runs well under 60 fps.
//
// Shot scripts speak in VIDEO time (ms of the final clip). Every pointer
// action is logged so the compositor can draw its own cursor and camera.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const SLOW = Number(process.env.PROMO_SLOW || 0.08);

const clockScript = (slow) => `(() => {
  const SLOW = ${slow};
  const pn = performance.now.bind(performance), p0 = pn();
  const vnow = () => p0 + (pn() - p0) * SLOW;
  performance.now = vnow;
  const RealDate = Date, d0 = RealDate.now();
  const dnow = () => d0 + (RealDate.now() - d0) * SLOW;
  class VDate extends RealDate {
    constructor(...a) { a.length ? super(...a) : super(dnow()); }
    static now() { return dnow(); }
  }
  window.Date = VDate;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(vnow()));
  const st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
  window.setTimeout = (fn, ms, ...a) => st(fn, (ms || 0) / SLOW, ...a);
  window.setInterval = (fn, ms, ...a) => si(fn, (ms || 0) / SLOW, ...a);
  // the screen must never show a scrollbar or the text caret
  const css = document.createElement('style');
  css.textContent = '::-webkit-scrollbar{display:none} *{scrollbar-width:none; caret-color:transparent}';
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(css));
})();`;

export class Recorder {
	constructor(page, name, outRoot) {
		this.page = page;
		this.name = name;
		this.dir = path.join(outRoot, name);
		this.events = [];
		this.frames = [];
		const vp = page.viewportSize();
		this.cursor = { x: vp.width * 0.6, y: vp.height * 0.8 };
	}

	static async prepare(context) {
		await context.addInitScript(clockScript(SLOW));
	}

	async start() {
		fs.rmSync(this.dir, { recursive: true, force: true });
		fs.mkdirSync(path.join(this.dir, 'frames'), { recursive: true });
		this.cdp = await this.page.context().newCDPSession(this.page);
		await this.cdp.send('Animation.enable');
		await this.cdp.send('Animation.setPlaybackRate', { playbackRate: SLOW });
		// screenshots honour devicePixelRatio (the screencast does not): lossless PNG at full density
		const vp = this.page.viewportSize();
		const dpr = await this.page.evaluate(() => devicePixelRatio);
		// a new CDP session captures at CSS size unless the clip carries the scale
		const clip = { x: 0, y: 0, width: vp.width, height: vp.height, scale: dpr };
		this.running = true;
		this.t0 = Date.now();
		this.loop = (async () => {
			let n = 0;
			while (this.running) {
				const before = Date.now();
				// the clip is in document coordinates: follow the page's scroll
				const { result } = await this.cdp.send('Runtime.evaluate', { expression: '[scrollX, scrollY]', returnByValue: true });
				const [sx, sy] = result.value || [0, 0];
				const { data } = await this.cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, clip: { ...clip, x: sx, y: sy } });
				const file = `f${String(n++).padStart(6, '0')}.png`;
				fs.writeFile(path.join(this.dir, 'frames', file), Buffer.from(data, 'base64'), () => {});
				this.frames.push({ file, t: (before + Date.now()) / 2000 });
			}
		})();
	}

	/** video-time ms since start() */
	now() {
		return (Date.now() - this.t0) * SLOW;
	}

	log(type, extra = {}) {
		this.events.push({ t: Math.round(this.now()), type, ...extra });
	}

	async wait(ms) {
		await this.page.waitForTimeout(ms / SLOW);
	}

	async box(target) {
		if (typeof target === 'object' && 'x' in target) return target;
		const loc = typeof target === 'string' ? this.page.locator(target).first() : target;
		await loc.waitFor({ state: 'visible', timeout: 60000 });
		const b = await loc.boundingBox();
		return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
	}

	/** glide the (real, invisible) pointer so hovers fire; the compositor draws the visible cursor */
	async move(target, ms = 700) {
		const b = await this.box(target);
		const steps = Math.max(8, Math.round(ms / 16));
		this.log('move', { x: b.x, y: b.y, ms, from: { ...this.cursor } });
		const from = { ...this.cursor };
		for (let i = 1; i <= steps; i++) {
			const k = i / steps, e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
			await this.page.mouse.move(from.x + (b.x - from.x) * e, from.y + (b.y - from.y) * e);
			await this.page.waitForTimeout(ms / steps / SLOW);
		}
		this.cursor = { x: b.x, y: b.y };
		return b;
	}

	async click(target, { move = 700, settle = 120, hold = 60 } = {}) {
		// a pointer click outside the viewport does nothing: bring the target in first
		if (typeof target !== 'string' && !('x' in target)) {
			const b0 = await this.box(target), vh = this.page.viewportSize().height;
			if (b0.y > vh - 30 || b0.y < 70) { await this.scrollTo(target, 900, 0.84); await this.wait(250); }
		}
		const b = await this.move(target, move);
		await this.wait(settle);
		this.log('click', { x: b.x, y: b.y, w: b.w, h: b.h });
		await this.page.mouse.down();
		if (hold) await this.page.waitForTimeout(hold / SLOW);   // menus that open on press need hold: 0
		await this.page.mouse.up();
		return b;
	}

	/** type into the focused field at a human pace (ms per character, video time) */
	async type(text, ms = 55) {
		this.log('type', { text, ms: ms * text.length });
		await this.page.keyboard.type(text, { delay: ms / SLOW });
	}

	/** name a moment so the timeline can start a scene there */
	mark(label) {
		this.log('mark', { label });
	}

	async scroll(dy, ms = 900) {
		const steps = Math.max(10, Math.round(ms / 16));
		this.log('scroll', { dy, ms });
		for (let i = 0; i < steps; i++) {
			await this.page.mouse.wheel(0, dy / steps);
			await this.page.waitForTimeout(ms / steps / SLOW);
		}
	}

	/** smooth-scroll so the target sits at `at` (fraction of the viewport height) */
	async scrollTo(target, ms = 1000, at = 0.3) {
		const loc = typeof target === 'string' ? this.page.locator(target).first() : target;
		await loc.waitFor({ state: 'attached', timeout: 60000 });
		const b = await loc.boundingBox();
		const dy = Math.round(b.y - this.page.viewportSize().height * at);
		if (Math.abs(dy) > 4) await this.scroll(dy, ms);
	}

	/** mark a camera focus (compositor zooms to this rect) */
	async focus(target, label = '', pad = 24) {
		const b = await this.box(target);
		this.log('focus', { label, x: b.x - b.w / 2 - pad, y: b.y - b.h / 2 - pad, w: b.w + 2 * pad, h: b.h + 2 * pad });
	}

	async stop() {
		this.running = false;
		await this.loop;
		await new Promise((r) => setTimeout(r, 500)); // pending frame writes
		const meta = { name: this.name, slow: SLOW, duration: Math.round(this.now()), events: this.events,
			viewport: this.page.viewportSize() };
		fs.writeFileSync(path.join(this.dir, 'events.json'), JSON.stringify(meta, null, 1));
		return meta;
	}

	/** frames → constant-60fps clip at real speed (yuv444 high-quality intermediate) */
	encode() {
		const list = [];
		for (let i = 0; i < this.frames.length; i++) {
			const next = this.frames[i + 1] ?? { t: this.frames[i].t + 1 / 30 };
			const dur = Math.max(0.001, (next.t - this.frames[i].t) * SLOW);
			list.push(`file 'frames/${this.frames[i].file}'`, `duration ${dur.toFixed(6)}`);
		}
		list.push(`file 'frames/${this.frames.at(-1).file}'`);
		fs.writeFileSync(path.join(this.dir, 'frames.txt'), list.join('\n'));
		const fpsIn = this.frames.length / ((this.frames.at(-1).t - this.frames[0].t) || 1);
		const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'frames.txt',
			'-vf', 'fps=60,format=yuv444p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', 'clip.mp4'],
			{ cwd: this.dir, stdio: 'inherit' });
		if (r.status !== 0) throw new Error('ffmpeg failed');
		console.log(`${this.name}: ${this.frames.length} frames, capture ${fpsIn.toFixed(1)} fps → ${(fpsIn / SLOW).toFixed(0)} fps-equivalent`);
	}
}
