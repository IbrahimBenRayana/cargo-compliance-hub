// The storyboard's screen shots. Times are video ms. Selectors target visible
// text where possible so a restyle does not break the script.
import { go, tidy } from './session.mjs';
import { filingId, entryId, reset, sql } from './db.mjs';

const PHONE = { width: 540, height: 700 };

/** the box around several elements, in the centre form Recorder.box() returns */
async function around(...locs) {
	let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
	for (const loc of locs) {
		const el = loc.first();
		await el.waitFor({ state: 'visible', timeout: 30000 });
		const b = await el.boundingBox();
		x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
	}
	return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}

// the page's JS clock runs at SLOW, so entrance tweens need real seconds to finish
const settle = (page, ms = 9000) => page.waitForTimeout(ms);
const text = (page, t) => page.getByText(t, typeof t === 'string' ? { exact: true } : undefined).filter({ visible: true });
const button = (page, name) => page.getByRole('button', { name }).filter({ visible: true });

// "Awaiting response" lists how long ago each filing was sent: response times are not part of the story
const today = async (page) => {
	await go(page, '/');
	await page.evaluate(() => {
		const leaf = (t) => [...document.querySelectorAll('h1,h2,h3,h4,div,span,p')].find((e) => e.children.length === 0 && e.textContent.trim() === t);
		let card = leaf('Awaiting response');
		const other = leaf('ISF cutoffs');
		while (card && card.parentElement && !card.parentElement.contains(other)) card = card.parentElement;
		if (card) card.style.display = 'none';
	});
	await settle(page, 12000);
};

// The review panel prints the model's markdown as plain text ("**1. …**", "- …").
// For the film the same words are laid out as headings and bullets; nothing is added or removed.
const MARKDOWN = `(() => {
  if (window.__promoMd) return; window.__promoMd = true;
  const css = document.createElement('style'); css.textContent = '[role="dialog"] article { display: none !important; }'; document.head.appendChild(css);
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const inline = (s) => esc(s).replace(/\\*\\*(.+?)\\*\\*/g, '<strong style="font-weight:600">$1</strong>').replace(/\\*\\*/g, '');
  const render = (src) => src.split('\\n').map((l) => {
    const t = l.trim();
    if (!t) return '';
    const h = t.match(/^(?:#+\\s*)?\\*\\*(\\d+\\.\\s.+?)\\*\\*:?$/) || t.match(/^#+\\s*(.+)$/);
    if (h) return '<div style="margin:18px 0 6px;font-size:14px;font-weight:600">' + esc(h[1]) + '</div>';
    const b = t.match(/^(?:[-*]|\\d+\\.)\\s+(.*)$/);
    if (b) return '<div style="position:relative;margin:6px 0;padding-left:16px"><span style="position:absolute;left:3px;opacity:.55">•</span>' + inline(b[1]) + '</div>';
    return '<div style="margin:6px 0">' + inline(t) + '</div>';
  }).join('');
  const sync = () => {
    const a = document.querySelector('[role="dialog"] article');
    if (!a) return;
    let m = a.parentElement.querySelector('[data-promo-md]');
    if (!m) { m = document.createElement('div'); m.setAttribute('data-promo-md', ''); m.className = a.className.replace('whitespace-pre-wrap', ''); m.style.marginTop = '-12px'; a.after(m); }
    const html = render(a.textContent);
    if (m.__src !== html) { m.__src = html; m.innerHTML = html; }
  };
  new MutationObserver(sync).observe(document.body, { subtree: true, childList: true, characterData: true });
})();`;
const DRAFT_HTS = (v) => sql(`update filings set commodities = jsonb_set(commodities, '{0,htsCode}', '"${v}"') where master_bol = 'HLCU349102260' and status = 'draft'`);

export const SHOTS = {
	// Today: KPI strip, then the two ISFs nearest their cutoff
	dashboard: {
		setup: today,
		async run(rec, page) {
			rec.cursor = { x: 900, y: 690 };
			await rec.wait(1500);
			await rec.focus(await around(text(page, 'Action items'), text(page, /^No response/), text(page, 'ISF due'), text(page, /^Est\. /)), 'actions', 20);
			await rec.move(text(page, 'ISF cutoff passed'), 1000);
			await rec.wait(1500);
			await rec.move(text(page, 'ISF due'), 700);
			await rec.wait(5200);
		}
	},

	// every ISF with its cutoff
	shipments: {
		async setup(page) { await go(page, '/shipments'); await settle(page); },
		async run(rec, page) {
			rec.cursor = { x: 980, y: 640 };
			await rec.wait(900);
			await rec.focus(await around(text(page, 'ISF cutoff'), text(page, 'Importer'), text(page, /^Est\. /), text(page, /over$/), text(page, 'SAC26080102')), 'cutoff', 26);
			await rec.move(text(page, /^Est\. /), 1000);
			await rec.wait(1300);
			await rec.move(text(page, /over$/), 600);
			await rec.wait(4200);
		}
	},

	// the rule check catches a short HTS number before anything is sent
	validate: {
		async setup(page) { await go(page, `/shipments/${filingId('HLCU349102260', 'draft')}`); await settle(page); },
		async run(rec, page) {
			rec.cursor = { x: 760, y: 650 };
			await rec.wait(900);
			await rec.click(button(page, /Start submission/), { move: 900 });
			await text(page, /HTS code must be/).first().waitFor({ state: 'visible', timeout: 60000 });
			await rec.wait(500);
			await rec.focus(await around(text(page, 'Send to CBP').first(), button(page, /Start submission/), text(page, /HTS code must be/)), 'check', 22);
			await rec.wait(6000);
		}
	},

	// the compliance inbox: brief on top, open work ranked
	compliance: {
		async setup(page) { await go(page, '/compliance'); await settle(page, 12000); },
		async run(rec, page) {
			rec.cursor = { x: 1100, y: 700 };
			await rec.wait(1100);
			await rec.focus(await around(text(page, /^Filings needing attention/), text(page, 'Snooze').last(), button(page, /^Open/).first()), 'inbox', 24);
			await rec.move(button(page, /^Open/).first(), 1100);
			await rec.wait(5200);
		}
	},

	// an accepted entry, made from its ISF
	entry: {
		async setup(page) {
			await go(page, `/abi-documents/${entryId('MCL-3000101-7')}`);
			// the Transmission card prints internal plumbing (a legacy document id, poll attempts): not for the film
			await page.evaluate(() => {
				const leaf = (t) => [...document.querySelectorAll('h1,h2,h3,h4,div,span,p')].find((e) => e.children.length === 0 && e.textContent.trim() === t);
				let card = leaf('Transmission');
				const other = leaf('What was filed');
				while (card && card.parentElement && !card.parentElement.contains(other)) card = card.parentElement;
				if (card) card.style.display = 'none';
			});
			await settle(page);
		},
		async run(rec, page) {
			rec.cursor = { x: 820, y: 600 };
			await rec.wait(1000);
			await rec.focus(await around(text(page, 'Related'), text(page, /^This entry was made/), text(page, 'Entry number'), text(page, /Open shipment/)), 'linked', 26);
			await rec.move(text(page, /Open shipment/), 1100);
			await rec.wait(5000);
		}
	},

	// every request and its response
	logs: {
		async setup(page) {
			await go(page, '/integrations/logs');
			// how long each call took is not part of the story: that column is blanked
			await page.evaluate(() => {
				for (const th of document.querySelectorAll('th')) {
					if (th.textContent.trim() !== 'Took') continue;
					const i = [...th.parentElement.children].indexOf(th);
					th.style.visibility = 'hidden';
					for (const tr of th.closest('table').querySelectorAll('tbody tr')) if (tr.children[i]) tr.children[i].style.visibility = 'hidden';
				}
			});
			await settle(page);
		},
		async run(rec, page) {
			rec.cursor = { x: 900, y: 700 };
			await rec.wait(800);
			await rec.move(text(page, 'ISF sent').first(), 1200);
			await rec.wait(4500);
		}
	},

	// the same Today page on a narrow screen, for the vertical cut
	'm-dashboard': {
		viewport: PHONE,
		setup: today,
		async run(rec, page) {
			await rec.wait(1300);
			await rec.scrollTo(text(page, 'Action items'), 1300, 0.1);
			await rec.wait(4500);
		}
	},
	'm-shipments': {
		viewport: PHONE,
		async setup(page) { await go(page, '/shipments'); await settle(page); },
		async run(rec, page) {
			await rec.wait(900);
			await rec.scrollTo(text(page, 'HLCU349102260'), 1200, 0.1);
			await rec.wait(4500);
		}
	},

	// one ISF-10 from template to the confirm step. Nothing is sent: the shot ends on the confirm dialog.
	isf: {
		async setup(page) { reset(); await go(page, '/shipments'); await settle(page); },
		async run(rec, page) {
			const next = () => button(page, 'Next');
			rec.cursor = { x: 900, y: 560 };
			rec.mark('template');
			await rec.wait(900);
			await rec.click(button(page, /From template/), { move: 800, hold: 0 });
			await rec.wait(650);
			await rec.click(text(page, 'Electronics from Shenzhen'), { move: 600 });
			await page.getByPlaceholder('e.g., MAEU1234567890').waitFor({ state: 'visible', timeout: 60000 });
			await tidy(page);
			await rec.wait(900);
			rec.mark('bill');
			await rec.click(page.getByPlaceholder('e.g., MAEU1234567890'), { move: 700 });
			await rec.type('MAEU790031942', 50);
			await rec.wait(500);
			await rec.click(next(), { move: 600 });
			await rec.wait(1100);                                   // IOR & consignee, already filled
			rec.mark('parties');
			await rec.click(next(), { move: 300 });
			await rec.wait(900);                                    // Trade parties, already filled
			await rec.scroll(620, 1300);
			await rec.wait(300);
			await rec.scrollTo(next(), 900, 0.86);
			await rec.click(next(), { move: 500 });
			await page.getByPlaceholder('e.g., EVER GIVEN').waitFor({ state: 'visible', timeout: 60000 });
			await rec.wait(700);
			rec.mark('transport');
			await rec.click(page.getByPlaceholder('e.g., EVER GIVEN'), { move: 600 });
			await rec.type('MAERSK EMDEN', 45);
			await rec.click(page.getByPlaceholder('e.g., V001'), { move: 350 });
			await rec.type('436E', 60);
			await rec.click(page.getByRole('combobox').filter({ hasText: /Search ports/ }), { move: 500 });
			await rec.wait(250);
			await rec.type('Los Angeles', 45);
			await rec.wait(500);
			await page.keyboard.press('Enter');
			await rec.wait(350);
			const dates = page.locator('input[type="date"]');
			await dates.nth(0).fill('2026-11-28'); await rec.wait(260);
			await dates.nth(1).fill('2026-11-27'); await rec.wait(260);
			await dates.nth(2).fill('2026-12-16'); await rec.wait(600);
			await page.locator('h1, h2').first().click({ position: { x: 2, y: 2 } }).catch(() => {});   // drop the date field's focus ring
			await rec.click(next(), { move: 600 });
			await rec.wait(1100);
			rec.mark('cargo');                                      // Cargo, from the template
			await rec.scrollTo(next(), 1000, 0.86);
			await rec.click(next(), { move: 500 });
			await rec.wait(1200);
			rec.mark('review');
			const save = button(page, /Save Changes/);
			await rec.scrollTo(save, 1500, 0.86);
			await rec.wait(300);
			await rec.click(save, { move: 600 });
			await button(page, /Start submission/).waitFor({ state: 'visible', timeout: 60000 });
			await tidy(page);
			await rec.wait(1300);
			rec.mark('submit');
			await rec.click(button(page, /Start submission/), { move: 800 });
			await text(page, 'Send this ISF to CBP?').waitFor({ state: 'visible', timeout: 60000 });
			await rec.wait(400);
			await rec.focus(await around(text(page, 'Send this ISF to CBP?'), button(page, 'Cancel'), text(page, /charged under your plan/)), 'confirm', 60);
			await rec.wait(5500);
		},
		async after(page) { await page.keyboard.press('Escape'); reset(); }
	},

	// the compliance inbox with the notification list opened from the bell
	'ai-inbox': {
		async setup(page) {
			await go(page, '/compliance');
			// the two-factor reminder is snoozed for the film; its row in the notification list goes too (the app re-adds it at sign-in)
			await page.evaluate(() => {
				const hide = () => {
					for (const el of document.querySelectorAll('p, div, span, h3, h4')) {
						if (el.children.length || !/two-factor authentication/i.test(el.textContent)) continue;
						let row = el;
						while (row.parentElement && !/Deadline in/.test(row.parentElement.textContent)) row = row.parentElement;
						if (row.parentElement) row.style.display = 'none';
					}
				};
				new MutationObserver(hide).observe(document.body, { subtree: true, childList: true });
			});
			await settle(page, 12000);
		},
		async run(rec, page) {
			rec.cursor = { x: 980, y: 520 };
			await rec.wait(1300);
			const bell = page.locator('header button').filter({ hasText: /^\d*$/ }).last();
			await rec.click(bell, { move: 900 });
			await text(page, 'Notifications').waitFor({ state: 'visible', timeout: 60000 });
			await rec.wait(500);
			await rec.focus(await around(text(page, 'Notifications'), text(page, 'Mark all read'), text(page, /^Deadline in/).last()), 'bell', 30);
			await rec.move(text(page, /^Deadline in/).first(), 900);
			await rec.wait(5000);
		},
		async after(page) { await page.keyboard.press('Escape'); }
	},

	// the AI pre-flight review on a draft, the fix, then the rule check. Nothing is sent: it ends on the confirm dialog.
	ai: {
		async setup(page) {
			DRAFT_HTS('9401');
			sql('delete from hts_classifications');   // a fresh suggestion, not yesterday's cached one
			await go(page, `/shipments/${filingId('HLCU349102260', 'draft')}`);
			await page.evaluate(MARKDOWN);
			await settle(page);
		},
		async run(rec, page) {
			const next = () => button(page, 'Next');
			rec.cursor = { x: 900, y: 520 };
			rec.mark('open');
			await rec.wait(1000);
			await rec.click(button(page, /AI pre-flight review/), { move: 900 });
			await button(page, /Regenerate/).waitFor({ state: 'visible', timeout: 180000 });   // reads "Generating…" until the review is complete
			await rec.wait(700);
			rec.mark('read');
			await rec.move({ x: 1216, y: 500, w: 1, h: 1 }, 800);
			await rec.wait(3000);
			await rec.scroll(320, 2600);
			await rec.wait(4500);
			await page.keyboard.press('Escape');
			await rec.wait(700);
			// to the Cargo step of the draft (not in the film)
			await page.getByRole('link', { name: /^Edit$/ }).first().click();
			for (let i = 0; i < 4; i++) {
				await next().waitFor({ state: 'visible', timeout: 60000 });
				await next().scrollIntoViewIfNeeded();
				await next().click();
				await page.waitForTimeout(5000);
			}
			const hts = page.getByPlaceholder('e.g., 731815');
			await hts.waitFor({ state: 'visible', timeout: 60000 });
			await page.evaluate(() => scrollTo(0, 0));
			await tidy(page);
			await page.mouse.move(900, 660); rec.cursor = { x: 900, y: 660 };
			await page.waitForTimeout(4000);
			rec.mark('fix');
			await rec.wait(800);
			// HTS suggestions from the description: the app's own popup and its own answer
			await rec.click(hts.locator('xpath=following::button[1]'), { move: 800 });
			const use = page.getByRole('dialog').getByRole('button', { name: /^Use/ }).first();
			await use.waitFor({ state: 'attached', timeout: 180000 });
			await rec.wait(900);
			await rec.move({ x: 780, y: 330, w: 1, h: 1 }, 600);
			await rec.scrollTo(use, 1500, 0.4);
			await rec.wait(1500);
			await rec.click(use, { move: 700 });
			await rec.wait(1800);
			rec.mark('fixed');
			await rec.click(next(), { move: 700 });
			await rec.wait(1200);
			const save = button(page, /Save Changes/);
			await rec.scrollTo(save, 1200, 0.86);
			await rec.click(save, { move: 600 });
			await button(page, /Start submission/).waitFor({ state: 'visible', timeout: 60000 });
			await tidy(page);
			await rec.wait(1300);
			rec.mark('submit');
			await rec.click(button(page, /Start submission/), { move: 800 });
			await text(page, 'Send this ISF to CBP?').waitFor({ state: 'visible', timeout: 60000 });
			await rec.wait(400);
			await rec.focus(await around(text(page, 'Send this ISF to CBP?'), button(page, 'Cancel'), text(page, /charged under your plan/)), 'confirm', 60);
			await rec.wait(5500);
		},
		async after(page) { await page.keyboard.press('Escape'); DRAFT_HTS('9401'); }
	},

	// an accepted ISF: status, what was filed, history
	accepted: {
		async setup(page) { await go(page, `/shipments/${filingId('MAEU789441120', 'accepted')}`); await settle(page); },
		async run(rec, page) {
			rec.cursor = { x: 800, y: 640 };
			await rec.wait(1100);
			await rec.focus(await around(text(page, 'Related'), text(page, 'History'), text(page, 'Filing created'), text(page, 'ISF number')), 'history', 26);
			await rec.move(text(page, 'History'), 1100);
			await rec.wait(5500);
		}
	}
};
