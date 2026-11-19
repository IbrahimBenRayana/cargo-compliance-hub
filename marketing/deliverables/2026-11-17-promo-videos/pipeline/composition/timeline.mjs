// One timeline drives the picture (build.mjs) and the sound (audio/mix.mjs).
// Times in seconds. `clip` names a capture in .work/shots/<clip>/ ; `from` is
// the clip time the scene starts at, or `mark` a moment the shot script named.
// Copy rules: marketing guardrails (no certification or connection claims, no
// response timing, price only as "ISF $45 per accepted ISF", CTA "Book a demo").

const END = { kind: 'end', dur: 6.2, line: 'An inbox for US customs,<br>not another dashboard.' };

const SCENES = {
	// ── Video 1: product promo ─────────────────────────────────────────────
	hook: { kind: 'hook', dur: 3.5, hook: 'Which filing needs you <em>now?</em>', vo: [['p01', 0.75]] },
	dashboard: {
		kind: 'app', clip: 'dashboard', from: 0.3, dur: 7.6,
		captions: [{ at: 0, eyebrow: 'Today', title: 'Open the app.<br>See what needs you.', wide: 'Open the app.<br>See what<br>needs you.', sub: 'The ISFs nearest their cutoff sit at the top of the day.' }],
		zooms: { actions: { z: 1.22, fx: 850, at: 2.6, hold: 9 } },
		vo: [['p02', 0.7]]
	},
	shipments: {
		kind: 'app', clip: 'shipments', from: 0.4, dur: 5.4,
		captions: [{ at: 0, eyebrow: 'Shipments', title: 'Every ISF, with its<br>own deadline clock.', wide: 'Every ISF,<br>with its own<br>deadline clock.', sub: 'Status, sailing date and time left to the cutoff, in one list.' }],
		zooms: { cutoff: { z: 1.22, fx: 850, at: 1.3, hold: 9 } },
		vo: [['p03', 0.8]]
	},
	validate: {
		kind: 'app', clip: 'validate', from: 0.5, dur: 6.6,
		captions: [{ at: 0, eyebrow: 'Rule checks', title: 'Checked before<br>you submit.', wide: 'Checked<br>before you<br>submit.', sub: 'Every field is checked first. Nothing goes to CBP until you confirm.' }],
		zooms: { check: { z: 1.22, fx: 850, hold: 9 } },
		vo: [['p04', 0.9]]
	},
	compliance: {
		kind: 'app', clip: 'compliance', from: 0.4, dur: 5.6,
		captions: [{ at: 0, eyebrow: 'Compliance', title: 'Open work, ranked<br>by urgency.', wide: 'Open work,<br>ranked by<br>urgency.', sub: 'A one-line brief on top, then the filings that need attention.' }],
		zooms: { inbox: { z: 1.22, fx: 850, at: 1.6, hold: 9 } },
		vo: [['p05', 0.8]]
	},
	entry: {
		kind: 'app', clip: 'entry', from: 0.4, dur: 6.0,
		captions: [{ at: 0, eyebrow: 'Entries', title: 'The entry starts from<br>the accepted ISF.', wide: 'The entry<br>starts from the<br>accepted ISF.', sub: 'Parties, importer number and bond carry over, and the two stay linked.' }],
		zooms: { linked: { z: 1.22, fx: 850, at: 1.7, hold: 9 } },
		vo: [['p06', 0.8]]
	},
	logs: {
		kind: 'app', clip: 'logs', from: 0.3, dur: 4.6,
		captions: [{ at: 0, eyebrow: 'Submission logs', title: 'Every request and<br>response, logged.', wide: 'Every request<br>and response,<br>logged.', sub: 'What was sent for each filing, and what came back.' }],
		push: [{ at: 0.9, z: 1.22, fx: 850, fy: 300, hold: 9 }],
		vo: [['p07', 0.8]]
	},
	end: { ...END, vo: [['p08', 0.75]] },

	// ── Video 2: vertical cut (music and captions only) ────────────────────
	'v-hook': { kind: 'hook', dur: 2.6, hook: 'Which ISF is about to miss its <em>cutoff?</em>' },
	'v-dashboard': {
		kind: 'app', clip: 'm-dashboard', from: 0.9, dur: 4.6,
		captions: [{ at: 0, eyebrow: 'Today', title: 'Today’s work, most<br>urgent first.' }]
	},
	'v-shipments': {
		kind: 'app', clip: 'm-shipments', from: 0.6, dur: 4.0,
		captions: [{ at: 0, eyebrow: 'Shipments', title: 'A deadline clock<br>on every ISF.' }]
	},
	'v-end': { ...END, dur: 4.4 },

	// ── Video 3: file an ISF-10 ────────────────────────────────────────────
	'f-hook': { kind: 'hook', dur: 4.0, hook: 'ISF-10, without<br>the <em>retyping.</em>', vo: [['f01', 0.7]] },
	'f-template': {
		kind: 'app', clip: 'isf', mark: 'template', from: 0.3, dur: 7.6,
		captions: [{ at: 0, eyebrow: 'Templates', title: 'Start from<br>a template.', sub: 'Parties, ports, HTS codes and bond are already in.' }],
		push: [{ at: 0.5, z: 1.22, fx: 850, fy: 330, hold: 9 }],
		vo: [['f02', 0.8]]
	},
	'f-steps': {
		kind: 'app', clip: 'isf', mark: 'transport', from: -0.9, dur: 8.2,
		captions: [{ at: 0, eyebrow: 'Six steps', title: 'Add what is new<br>for this shipment.', wide: 'Add what is new<br>for this<br>shipment.', sub: 'Vessel, voyage, port and dates. The rest came from the template.' }],
		push: [{ at: 0.1, z: 1.22, fx: 850, fy: 405, hold: 9, dur: 0.6 }],
		vo: [['f03', 0.9]]
	},
	'f-check': {
		kind: 'app', clip: 'isf', mark: 'submit', from: -0.2, dur: 7.0,
		captions: [{ at: 0, eyebrow: 'Rule checks', title: 'Checked, then<br>you confirm.', sub: 'Every field is checked. Nothing goes to CBP until you say so.' }],
		push: [{ at: 0.1, z: 1.22, fx: 850, fy: 405, hold: 9, dur: 0.6 }],
		zooms: { confirm: { z: 1.3, hold: 9 } },
		vo: [['f04', 0.9]]
	},
	'f-accepted': {
		kind: 'app', clip: 'accepted', from: 0.4, dur: 6.6,
		captions: [{ at: 0, eyebrow: 'After you submit', title: 'Status and history<br>in one place.', wide: 'Status and<br>history in<br>one place.', sub: 'What was filed, the linked entry, and every status change.' }],
		zooms: { history: { z: 1.22, fx: 850, at: 1.8, hold: 9 } },
		vo: [['f05', 0.9]]
	},
	'f-end': { ...END, dur: 7.6, line: 'File your next ISF-10<br>from a template.', price: '<b>ISF $45</b> per accepted ISF. No monthly fee.', vo: [['f06', 0.8]] },

	// ── Video 4: AI pre-flight review ──────────────────────────────────────
	'a-hook': { kind: 'hook', dur: 5.2, hook: 'Catch it before<br><em>CBP does.</em>', vo: [['a01', 0.7]] },
	'a-inbox': {
		kind: 'app', clip: 'compliance', from: 0.4, dur: 5.2,
		captions: [{ at: 0, eyebrow: 'Compliance', title: 'Drafts waiting<br>on you.', sub: 'The filings that need attention, most urgent first.' }],
		zooms: { inbox: { z: 1.22, fx: 850, at: 1.6, hold: 9 } },
		vo: [['a02', 0.8]]
	},
	'a-open': {
		kind: 'app', clip: 'ai', mark: 'open', from: 0.3, dur: 4.0,
		captions: [{ at: 0, eyebrow: 'AI pre-flight review', title: 'One click.<br>A full review.', sub: 'Run it on any draft, before you send.' }],
		vo: [['a03', 0.9]]
	},
	'a-review': {
		kind: 'app', clip: 'ai', mark: 'read', from: 0.92, dur: 9.4,
		captions: [{ at: 0, eyebrow: 'The review', title: 'What to fix,<br>in plain English.', sub: 'Field by field, plus possible UFLPA and agency flags.' }],
		push: [{ at: 0.2, z: 1.45, fx: 1216, fy: 530, hold: 9 }],
		vo: [['a04', 1.0]]
	},
	'a-fix': {
		kind: 'app', clip: 'ai', mark: 'fix', from: 0.2, dur: 4.3,
		captions: [{ at: 0, eyebrow: 'The fix', title: 'Fix it.<br>Then you decide.', sub: 'Correct the draft, then run the rule check.' }],
		push: [{ at: 0.1, z: 1.22, fx: 850, fy: 405, hold: 9, dur: 0.6 }],
		vo: [['a05', 0.9]]
	},
	'a-send': {
		kind: 'app', clip: 'ai', mark: 'submit', from: 0.9, dur: 5.8,
		captions: [{ at: 0, eyebrow: 'Rule checks', title: 'Checked, then<br>you confirm.', sub: 'Every field is checked. Nothing goes to CBP until you say so.' }],
		push: [{ at: 0.1, z: 1.22, fx: 850, fy: 405, hold: 9, dur: 0.6 }],
		zooms: { confirm: { z: 1.3, hold: 9 } },
	},
	'a-end': { ...END, line: 'AI pre-flight review,<br>on every draft.', vo: [['a06', 0.8]] }
};

export const CUTS = {
	promo: { format: 'wide', scenes: ['hook', 'dashboard', 'shipments', 'validate', 'compliance', 'entry', 'logs', 'end'] },
	'promo-square': { format: 'square', audio: 'promo', scenes: ['hook', 'dashboard', 'shipments', 'validate', 'compliance', 'entry', 'logs', 'end'] },
	vertical: { format: 'vertical', scenes: ['v-hook', 'v-dashboard', 'v-shipments', 'v-end'] },
	isf: { format: 'wide', scenes: ['f-hook', 'f-template', 'f-steps', 'f-check', 'f-accepted', 'f-end'] },
	ai: { format: 'wide', scenes: ['a-hook', 'a-inbox', 'a-open', 'a-review', 'a-fix', 'a-send', 'a-end'] }
};

// stage size, the app window's view, and how the camera behaves per format
export const FORMATS = {
	wide: { sw: 1920, sh: 1080, viewW: 1320, viewH: 742.5, zmax: 1.45, zoomGain: 1, brand: false },
	// the square frame is narrow: the camera sits on the page content and leaves the sidebar out
	square: { sw: 1080, sh: 1080, viewW: 1000, viewH: 562.5, zmax: 1.9, zoomGain: 1, brand: true, base: { z: 1.22, fx: 850, fy: 405 } },
	// the narrow capture paints only its top 600 px: the window shows exactly that
	vertical: { sw: 1080, sh: 1920, viewW: 960, viewH: 1066.7, clipH: 600, zmax: 1, zoomGain: 1, brand: true }
};

export function cut(name = 'promo') {
	let t = 0;
	return CUTS[name].scenes.map((id) => {
		const s = { id, ...SCENES[id] };
		s.start = Math.round(t * 1000) / 1000;
		t += s.dur;
		return s;
	});
}

export const length = (name = 'promo') => cut(name).reduce((a, s) => a + s.dur, 0);
