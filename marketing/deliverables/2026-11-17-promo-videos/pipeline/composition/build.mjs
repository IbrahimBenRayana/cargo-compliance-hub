// node composition/build.mjs <cut>  → composition/index.html
// Reads the timeline and each capture's events.json, copies the clips into
// assets/clips and writes one Hyperframes composition per cut. All motion is
// a single paused GSAP timeline, so every frame is seekable and deterministic.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cut, CUTS, FORMATS } from './timeline.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(HERE, '..', '.work', 'shots');

function events(clip) {
	const file = path.join(SHOTS, clip, 'events.json');
	if (!fs.existsSync(file)) throw new Error(`missing capture: ${clip} (run capture/run.mjs ${clip})`);
	const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
	const dst = path.join(HERE, 'assets', 'clips', `${clip}.mp4`);
	const src = path.join(SHOTS, clip, 'clip.mp4');
	fs.mkdirSync(path.dirname(dst), { recursive: true });
	if (!fs.existsSync(dst) || fs.statSync(dst).mtimeMs < fs.statSync(src).mtimeMs) fs.copyFileSync(src, dst);
	return meta;
}

export function resolve(name) {
	const scenes = cut(name);
	for (const s of scenes) {
		if (!s.clip) continue;
		const meta = events(s.clip);
		if (s.mark) {
			const m = meta.events.find((e) => e.type === 'mark' && e.label === s.mark);
			if (!m) throw new Error(`${s.id}: no mark "${s.mark}" in ${s.clip}`);
			s.from = Math.max(0, m.t / 1000 + (s.from || 0));
		}
		const need = s.from + s.dur;
		if (meta.duration / 1000 < need - 0.05) {
			console.warn(`! ${s.id}: clip ${s.clip} is ${(meta.duration / 1000).toFixed(2)} s, scene needs ${need.toFixed(2)} s (last frame holds)`);
		}
		s.events = meta.events;
		s.clipDur = meta.duration / 1000;
		s.viewport = meta.viewport;
	}
	return scenes;
}

function build(name) {
	const scenes = resolve(name);
	const format = CUTS[name].format, layout = FORMATS[format];
	const total = scenes.reduce((a, s) => a + s.dur, 0);
	const videos = scenes.filter((s) => s.clip).map((s) => {
		const start = Math.max(0, s.start - 0.4);
		const lead = Math.min(s.start - start, s.from);
		const dur = Math.min(s.dur + lead + 0.9, s.clipDur - (s.from - lead)); // runs past the cut so fades keep picture
		return `<video id="v-${s.id}" class="clip shot" src="assets/clips/${s.clip}.mp4" muted playsinline
          data-start="${(s.start - lead).toFixed(3)}" data-duration="${dur.toFixed(3)}" data-media-start="${(s.from - lead).toFixed(3)}"></video>`;
	}).join('\n          ');
	const captions = scenes.flatMap((s) => (s.captions || []).map((c, i) => `
      <div class="cap" id="cap-${s.id}-${i}">
        <div class="eyebrow"><span class="dot"></span>${c.eyebrow}</div>
        <h2>${((format === 'wide' && c.wide) || c.title).split('<br>').map((l) => `<span class="line"><span>${l}</span></span>`).join('')}</h2>
        ${c.sub ? `<p>${c.sub}</p>` : ''}
      </div>`)).join('');
	const end = scenes.find((s) => s.kind === 'end'), hook = scenes.find((s) => s.kind === 'hook');
	const vp = scenes.find((x) => x.viewport)?.viewport || { width: 1440, height: 810 };
	const html = fs.readFileSync(path.join(HERE, 'src', 'template.html'), 'utf8')
		.replaceAll('%TOTAL%', total.toFixed(3))
		.replaceAll('%RW%', layout.sw * 2).replaceAll('%RH%', layout.sh * 2)
		.replaceAll('%SW%', layout.sw).replaceAll('%SH%', layout.sh)
		.replace('%FORMAT%', format)
		.replace('%HOOK%', hook.hook)
		.replace('%END_LINE%', end.line)
		.replace('%END_PRICE%', end.price ? `<div class="price">${end.price}</div>` : '')
		.replace('%VIDEOS%', videos)
		.replace('%CAPTIONS%', captions)
		.replace('%DATA%', JSON.stringify({ name, total, scenes, layout, vw: vp.width, vh: vp.height }));
	const out = path.join(HERE, 'index.html'); // Hyperframes renders index.html: build one cut at a time
	fs.writeFileSync(out, html);
	fs.writeFileSync(path.join(HERE, 'meta.json'), JSON.stringify({ id: `mycargolens-${name}`, name: `MyCargoLens ${name}` }));
	console.log(`${name}: ${total.toFixed(1)} s, ${layout.sw * 2}x${layout.sh * 2} → ${path.relative(process.cwd(), out)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build(process.argv[2] || 'promo');
