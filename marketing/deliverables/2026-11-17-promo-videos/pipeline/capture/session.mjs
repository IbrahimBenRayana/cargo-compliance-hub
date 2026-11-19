// Shared: launch Chrome, sign in to the LOCAL promo stack, return {browser, context, page}.
import { chromium } from 'playwright';

export const BASE = process.env.PROMO_BASE || 'http://localhost:8090';
// a 1440-wide viewport at 2.67x keeps 3840-px frames but draws the UI a third larger in the film
export const VW = 1440, VH = 810;
if (!/^http:\/\/localhost:\d+$/.test(BASE)) throw new Error('promo capture runs against localhost only');

// presentation only: the support chat bubble and the "AI coach off" note (no AI key locally)
export const TIDY = `
  [data-promo-hide] { visibility: hidden !important; }
  ::-webkit-scrollbar { display: none; }
  [data-sonner-toaster], [data-radix-toast-viewport] { display: none !important; }
`;

// MyCargoLens's own filer code is an internal identifier: it is taken out of the one option label that prints it
const STRIP = `(() => {
  const fix = (n) => { if (n.nodeValue && n.nodeValue.includes('(S7P)')) n.nodeValue = n.nodeValue.replace(/\\s*\\(S7P\\)/g, ''); };
  const walk = (root) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) fix(n); };
  const start = () => { walk(document.body); new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') fix(m.target); for (const a of m.addedNodes) a.nodeType === 3 ? fix(a) : a.nodeType === 1 && walk(a); } }).observe(document.body, { subtree: true, childList: true, characterData: true }); };
  document.body ? start() : document.addEventListener('DOMContentLoaded', start);
})();`;

export async function tidy(page) {
	await page.addStyleTag({ content: TIDY }).catch(() => {});
	await page.evaluate(() => {
		for (const el of document.querySelectorAll('button, span, div, p')) {
			if (el.children.length <= 2 && /^\s*AI coach off\s*$/.test(el.textContent)) el.setAttribute('data-promo-hide', '');
		}
		// floating chat launcher: the fixed button in the bottom-right corner
		for (const el of document.querySelectorAll('button')) {
			const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
			const fixed = cs.position === 'fixed' || getComputedStyle(el.parentElement).position === 'fixed';
			if (fixed && r.right > innerWidth - 120 && r.bottom > innerHeight - 120) (cs.position === 'fixed' ? el : el.parentElement).setAttribute('data-promo-hide', '');
		}
	});
}

/** client-side navigation: the access token lives in memory, so never reload */
export async function go(page, to, settle = 2500) {
	await page.evaluate((to) => { history.pushState({}, '', to); dispatchEvent(new PopStateEvent('popstate')); }, to);
	await page.waitForTimeout(settle);
	await tidy(page);
}

export async function open({ scale = 1, headless = true, prepare } = {}) {
	const browser = await chromium.launch({ channel: 'chrome', headless });
	const context = await browser.newContext({
		viewport: { width: VW, height: VH }, deviceScaleFactor: scale, colorScheme: 'light', locale: 'en-US', timezoneId: 'America/Los_Angeles'
	});
	// the two-factor reminder is snoozed, as a signed-in operator would have it
	await context.addInitScript(() => localStorage.setItem('mcl_mfa_nag_dismissed', String(Date.now() + 1e12)));
	await context.addInitScript(STRIP);
	if (prepare) await prepare(context);
	const page = await context.newPage();
	await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
	await page.fill('input[type="email"]', 'demo@mycargolens.com');
	await page.fill('input[type="password"]', 'password123'); // prisma/seed.ts dev login
	await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }), page.keyboard.press('Enter')]);
	await page.waitForTimeout(1500);
	await tidy(page);
	return { browser, context, page };
}
