// node capture/run.mjs [shot ...]   — record shots against the LOCAL promo stack
import { fileURLToPath } from 'node:url';
import { open, VW, VH } from './session.mjs';
import { Recorder } from './recorder.mjs';
import { SHOTS } from './shots.mjs';

const OUT = fileURLToPath(new URL('../.work/shots/', import.meta.url));
const wanted = process.argv.slice(2);
const list = wanted.length ? wanted : Object.keys(SHOTS);
const scale = Number(process.env.PROMO_DPR || 3840 / 1440);

const { browser, page } = await open({ scale, prepare: (context) => Recorder.prepare(context) });
for (const name of list) {
	const shot = SHOTS[name];
	if (!shot) throw new Error(`unknown shot ${name}`);
	await page.setViewportSize(shot.viewport || { width: VW, height: VH });
	await shot.setup?.(page);
	const rec = new Recorder(page, name, OUT);
	await rec.start();
	try {
		await shot.run(rec, page);
	} catch (err) {
		// keep going with the other shots; leave a still of where this one stopped
		rec.running = false; await rec.loop;
		await page.screenshot({ path: `${OUT}${name}/failed.png` });
		console.error(`✗ ${name}: ${err.message.split('\n')[0]} (see ${name}/failed.png)`);
		process.exitCode = 1;
		await shot.after?.(page);
		continue;
	}
	await rec.stop();
	await shot.after?.(page);
	rec.encode();
}
await browser.close();
