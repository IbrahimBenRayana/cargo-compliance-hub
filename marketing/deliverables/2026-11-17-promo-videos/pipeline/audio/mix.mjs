// node audio/mix.mjs <cut> [voice] [--no-vo]  → .work/audio/<cut>[-novo].wav
// Music edit + voiceover on the timeline + sidechain ducking + soft UI ticks
// on every click, normalised to -14 LUFS / -1.5 dBTP (web delivery).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from '../composition/build.mjs';
import { CUTS } from '../composition/timeline.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORK = path.join(HERE, '..', '.work');
const MUSIC = path.join(WORK, 'music', 'atlasaudio-digital-technology-617560.mp3');
const TAIL = 150.0;      // where the track's own ending starts
const [name = 'promo', voice = 'af_heart', flag] = process.argv.slice(2);
const withVo = flag !== '--no-vo';
const scenes = resolve(name);
const total = scenes.reduce((a, s) => a + s.dur, 0);
const out = path.join(WORK, 'audio', `${name}${withVo ? '' : '-novo'}.wav`);
fs.mkdirSync(path.dirname(out), { recursive: true });

const vo = withVo ? scenes.flatMap((s) => (s.vo || []).map(([id, at]) => ({ file: path.join(WORK, 'vo', voice, `${id}.wav`), t: s.start + at }))) : [];
const clicks = scenes.flatMap((s) => (s.events || []).filter((e) => e.type === 'click')
	.map((e) => s.start + e.t / 1000 - s.from).filter((t) => t > s.start && t < s.start + s.dur));

const inputs = ['-i', MUSIC];
vo.forEach((v) => inputs.push('-i', v.file));
const f = [];
if (CUTS[name].music === 'straight') {
	// one continuous stretch of the track with a plain fade: no splice, so nothing can double up
	f.push(`[0:a]atrim=0:${total},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.5,afade=t=out:st=${total - 3.2}:d=3.2,volume=0.6[music]`);
} else {
	// the track's opening, then its own ending so the last note lands on the end card
	const head = Math.max(4, total - 5.5);
	f.push(`[0:a]atrim=0:${head},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.5[ma]`);
	f.push(`[0:a]atrim=${TAIL},asetpts=PTS-STARTPTS[mb]`);
	f.push(`[ma][mb]acrossfade=d=2.0:c1=tri:c2=tri,apad=whole_dur=${total},atrim=0:${total},afade=t=out:st=${total - 1.4}:d=1.4,volume=0.6[music]`);
}
// soft UI tick: a short, decaying 2.2 kHz blip
const tick = `sine=f=2200:d=0.05,afade=t=out:st=0:d=0.05,volume=0.16`;
clicks.forEach((t, i) => f.push(`${tick},adelay=${Math.round(t * 1000)}|${Math.round(t * 1000)},apad=whole_dur=${total}[k${i}]`));
vo.forEach((v, i) => f.push(`[${i + 1}:a]aresample=48000,pan=stereo|c0=c0|c1=c0,adelay=${Math.round(v.t * 1000)}|${Math.round(v.t * 1000)},apad=whole_dur=${total}[v${i}]`));
if (vo.length) {
	f.push(`${vo.map((_, i) => `[v${i}]`).join('')}amix=inputs=${vo.length}:normalize=0,volume=1.35,asplit=2[vox][sc]`);
	f.push(`[music][sc]sidechaincompress=threshold=0.04:ratio=6:attack=40:release=420:makeup=1[duck]`);
} else {
	f.push(`[music]anull[duck]`);
}
const bus = ['[duck]', vo.length ? '[vox]' : '', ...clicks.map((_, i) => `[k${i}]`)].join('');
const n = 1 + (vo.length ? 1 : 0) + clicks.length;
f.push(`${bus}amix=inputs=${n}:normalize=0,atrim=0:${total},loudnorm=I=-14:TP=-1.5:LRA=9,aresample=48000[out]`);

const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', f.join(';'), '-map', '[out]', '-ac', '2', '-ar', '48000', out], { stdio: 'inherit' });
if (r.status !== 0) process.exit(1);
// second pass: measure integrated loudness and trim to exactly -14 LUFS
const m = spawnSync('ffmpeg', ['-hide_banner', '-i', out, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' });
const lufs = Number((m.stderr.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop()?.match(/-?[\d.]+/)[0]);
const tmp = out.replace(/\.wav$/, '.tmp.wav');
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', out, '-af', `volume=${(-14 - lufs).toFixed(2)}dB,alimiter=limit=0.84:level=false`, tmp]);
fs.renameSync(tmp, out);
console.log(`${path.relative(process.cwd(), out)}: ${total.toFixed(1)} s, ${vo.length} lines, ${clicks.length} ticks`);
