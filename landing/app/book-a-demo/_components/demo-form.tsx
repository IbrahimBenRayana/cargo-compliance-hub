"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Field,
  FieldError,
  FormAlert,
  Honeypot,
  controlCls,
  describedBy,
  focusFirstError,
} from "./form-kit";
import {
  EMAIL_RE,
  compact,
  emailTypoFix,
  readAttribution,
  sendLead,
  track,
  type Attribution,
  type SendFailure,
} from "./lead-api";
import {
  FILER_BOND,
  FILER_VOLUME,
  FILES_TODAY,
  IMPORTER_VOLUME,
  NOTES_MAX,
  PERSONA_OPTIONS,
  SERVER_PERSONA,
  routeFor,
  type DemoPersona,
} from "./demo-copy";
import { CountrySelect } from "./country-select";

type Step1 = { email: string; name: string; company: string; persona: DemoPersona | ""; website: string };
type Step2 = { volume: string; filesToday: string; filerBond: string; country: string; opsOwner: string; notes: string };
type Errors = Partial<Record<keyof Step1 | keyof Step2, string>>;

const STEP1_ORDER = ["email", "name", "company", "persona"];
const STEP2_ORDER = ["volume", "filesToday", "notes"];

/**
 * Submit-level copy (deck §4 "System states"). The deck's "or email
 * [PUBLIC INBOX TBD]" clause is dropped until a public inbox exists.
 */
const FAILURE_COPY: Record<Exclude<SendFailure, "legacy" | "notfound">, string> = {
  network: "We couldn't reach our server, so your request wasn't sent. Try again.",
  server: "Something went wrong on our side and your request wasn't saved. Try again.",
  invalid: "Something went wrong on our side and your request wasn't saved. Try again.",
  rate: "We've had several requests from your network in the last hour. Try again in an hour.",
};

function step1Errors(v: Step1): Errors {
  const e: Errors = {};
  const email = v.email.trim();
  if (!email) e.email = "Enter your email so we can reply.";
  else if (!EMAIL_RE.test(email) || email.length > 255) e.email = "That email looks incomplete. Check the part after the @.";
  if (!v.name.trim()) e.name = "Enter your name so we know who we're meeting.";
  if (!v.company.trim()) e.company = "Enter your company name. If you're independent, your own name is fine.";
  if (!v.persona) e.persona = "Pick the closest match. It decides which call we set up.";
  return e;
}

function step2Errors(persona: DemoPersona, v: Step2): Errors {
  const e: Errors = {};
  if (persona !== "developer") {
    if (!v.volume) e.volume = "Pick a range so we show you the right setup.";
    if (!v.filesToday) e.filesToday = "Pick the closest match. 'Not filing yet' is fine.";
  }
  if (v.notes.length > NOTES_MAX) e.notes = "Keep it under 500 characters. You can tell us the rest on the call.";
  return e;
}

/** Plain-text body for the older server, which only accepts `message`. */
function legacyMessage(s1: Step1, s2: Step2, route: string, attr: Attribution) {
  const persona = PERSONA_OPTIONS.find((p) => p.value === s1.persona)?.label ?? "";
  const files = FILES_TODAY.find((f) => f.value === s2.filesToday)?.label;
  const bond = FILER_BOND.find((b) => b.value === s2.filerBond)?.label;
  return [
    `Company: ${s1.company.trim()}`,
    `Persona: ${persona}`,
    s2.volume && `Volume: ${s2.volume}`,
    files && `Files today: ${files}`,
    bond && `Filer code and bond: ${bond}`,
    s2.country && `Country: ${s2.country}`,
    s2.opsOwner.trim() && `Runs filing: ${s2.opsOwner.trim()}`,
    `Route: ${route}`,
    attr.src && `Source: ${attr.src}`,
    attr.utmSource && `UTM: ${[attr.utmSource, attr.utmMedium, attr.utmCampaign].filter(Boolean).join(" / ")}`,
  ]
    .filter(Boolean)
    .concat("", s2.notes.trim() || "(no notes)")
    .join("\n")
    .slice(0, 5000);
}

export function DemoForm({ initialPersona }: { initialPersona?: DemoPersona }) {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [s1, setS1] = React.useState<Step1>({
    email: "",
    name: "",
    company: "",
    persona: initialPersona ?? "",
    website: "",
  });
  const [s2, setS2] = React.useState<Step2>({ volume: "", filesToday: "", filerBond: "", country: "", opsOwner: "", notes: "" });
  const [errors, setErrors] = React.useState<Errors>({});
  const [banner, setBanner] = React.useState<string | null>(null);
  const [failure, setFailure] = React.useState<SendFailure | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [started, setStarted] = React.useState(false);

  // Server state for this visit: the step-1 lead id, which identity it was
  // saved with, and whether the API is the older one without lead storage.
  const lead = React.useRef<{ id?: string; key?: string; legacy?: boolean }>({});
  const attr = React.useRef<Attribution>({});
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const firstRender = React.useRef(true);

  React.useEffect(() => {
    attr.current = readAttribution();
    track("demo_form_view", initialPersona ? { persona: initialPersona } : {});
  }, [initialPersona]);

  // Move focus to the step heading when the step changes (not on first load).
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const typo = s1.email && !errors.email ? emailTypoFix(s1.email.trim()) : null;
  const persona = (s1.persona || "other") as DemoPersona;

  function markStarted() {
    if (started) return;
    setStarted(true);
    track("demo_form_start");
  }

  function set1<K extends keyof Step1>(k: K, v: Step1[K]) {
    markStarted();
    setS1((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  }
  function set2<K extends keyof Step2>(k: K, v: Step2[K]) {
    setS2((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  }

  function fail(kind: SendFailure) {
    setFailure(kind);
    setBanner(null);
    track("demo_form_error", { field: `submit_${kind}` });
  }

  function invalid(e: Errors, order: string[]) {
    setErrors(e);
    setFailure(null);
    setBanner("Check the highlighted field.");
    const first = order.find((k) => e[k as keyof Errors]);
    if (first) track("demo_form_error", { field: first });
    // wait for aria-invalid to render before focusing
    requestAnimationFrame(() => focusFirstError(order, e as Record<string, string | undefined>));
  }

  async function submitStep1() {
    const e = step1Errors(s1);
    if (Object.keys(e).length) return invalid(e, STEP1_ORDER);
    setErrors({});
    setBanner(null);
    setFailure(null);

    const key = [s1.email.trim().toLowerCase(), s1.name.trim(), s1.company.trim()].join("\u0000");
    // Back then Continue with the same identity: already saved, don't create a second lead.
    if (lead.current.legacy || (lead.current.id && lead.current.key === key)) {
      setStep(2);
      return;
    }

    setBusy(true);
    const res = await sendLead(
      "POST",
      compact({
        name: s1.name.trim(),
        email: s1.email.trim(),
        company: s1.company.trim(),
        subject: "demo",
        formSource: "book_a_demo",
        step: 1,
        persona: SERVER_PERSONA[persona],
        ...attr.current,
        website: s1.website,
      }),
    );
    setBusy(false);

    if (res.ok) {
      lead.current = { id: res.leadId, key };
      track("generate_lead", { stage: 1, persona });
      setStep(2);
    } else if (res.kind === "legacy") {
      // Older server: nothing stored yet. Step 2 sends everything in one email.
      lead.current = { legacy: true };
      setStep(2);
    } else {
      fail(res.kind);
    }
  }

  async function submitStep2() {
    const e = step2Errors(persona, s2);
    if (Object.keys(e).length) return invalid(e, STEP2_ORDER);
    setErrors({});
    setBanner(null);
    setFailure(null);

    const route = routeFor(persona, s2.volume, s2.filesToday);
    const qualification = compact({
      persona: SERVER_PERSONA[persona],
      volumeBand: persona === "developer" ? undefined : s2.volume,
      filesToday: persona === "developer" ? undefined : s2.filesToday,
      filerBond: persona === "importer" ? s2.filerBond : undefined,
      country: persona === "nvocc" ? s2.country : undefined,
      opsOwner: persona === "developer" ? s2.opsOwner.trim().slice(0, 200) : undefined,
      route,
      message: s2.notes.trim(),
    });
    const full = () =>
      compact({
        name: s1.name.trim(),
        email: s1.email.trim(),
        company: s1.company.trim(),
        subject: "demo",
        formSource: "book_a_demo",
        ...attr.current,
        ...qualification,
        website: s1.website,
      });
    const legacy = () => ({
      name: s1.name.trim(),
      email: s1.email.trim(),
      subject: "demo",
      message: legacyMessage(s1, s2, route, attr.current),
      website: s1.website,
    });

    setBusy(true);
    let res;
    if (lead.current.legacy) {
      res = await sendLead("POST", legacy());
    } else if (lead.current.id) {
      res = await sendLead("PATCH", qualification, lead.current.id);
      // Step-1 lead expired or unknown: send the whole request instead.
      if (!res.ok && res.kind === "notfound") res = await sendLead("POST", full());
    } else {
      res = await sendLead("POST", full());
    }
    if (!res.ok && res.kind === "legacy") {
      lead.current = { legacy: true };
      res = await sendLead("POST", legacy());
    }

    if (res.ok) {
      track("generate_lead", { stage: 2, persona, route });
      router.push(`/book-a-demo/thanks?route=${route}`);
      // keep the button busy while the next page loads
      return;
    }
    setBusy(false);
    fail(res.kind);
  }

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy) return;
    if (step === 1) void submitStep1();
    else void submitStep2();
  }

  const volumeOptions = persona === "importer" ? IMPORTER_VOLUME : FILER_VOLUME;
  const failureText = failure && failure !== "legacy" && failure !== "notfound" ? FAILURE_COPY[failure] : null;
  const noFilerYet = s2.filerBond === "neither" || s2.filerBond === "not_sure";

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={busy} className="relative">
      <motion.div
        key={step}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        className="flex flex-col gap-5"
      >
        <div>
          {step === 2 && (
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setErrors({});
                setBanner(null);
                setFailure(null);
              }}
              className="-ml-1 mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft aria-hidden className="size-4" />
              Back
            </button>
          )}
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-tone-eyebrow">
            Step {step} of 2
          </p>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-foreground outline-none"
          >
            {step === 1 ? "Tell us who you are" : "A bit about your filings"}
          </h2>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            {step === 1
              ? "Four quick fields. We save your request when you press Continue."
              : "So the call covers what you actually file."}
          </p>
        </div>

        {step === 1 ? (
          <>
            <Field id="email" label="Work email" error={errors.email}>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="name@company.com"
                maxLength={255}
                value={s1.email}
                onChange={(e) => set1("email", e.target.value)}
                aria-invalid={!!errors.email}
                aria-describedby={describedBy("email", { error: errors.email, help: !!typo })}
                className={controlCls}
              />
              {typo && (
                <p id="email-help" className="text-[13px] text-muted-foreground">
                  Did you mean{" "}
                  <button
                    type="button"
                    onClick={() => set1("email", typo)}
                    className="font-medium text-foreground underline decoration-current/40 underline-offset-2 hover:decoration-current"
                  >
                    {typo}
                  </button>
                  ?
                </p>
              )}
            </Field>

            <Field id="name" label="Full name" error={errors.name}>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                maxLength={120}
                value={s1.name}
                onChange={(e) => set1("name", e.target.value)}
                aria-invalid={!!errors.name}
                aria-describedby={describedBy("name", { error: errors.name })}
                className={controlCls}
              />
            </Field>

            <Field id="company" label="Company" error={errors.company}>
              <input
                id="company"
                name="company"
                type="text"
                autoComplete="organization"
                placeholder="Company name"
                maxLength={200}
                value={s1.company}
                onChange={(e) => set1("company", e.target.value)}
                aria-invalid={!!errors.company}
                aria-describedby={describedBy("company", { error: errors.company })}
                className={controlCls}
              />
            </Field>

            <fieldset
              aria-describedby={errors.persona ? "persona-error" : undefined}
              className="flex flex-col gap-2"
            >
              <legend className="mb-2 text-[14px] font-medium text-foreground">Which best describes you?</legend>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {PERSONA_OPTIONS.map((o, i) => {
                  const checked = s1.persona === o.value;
                  return (
                    <label
                      key={o.value}
                      className={cn(
                        "relative flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border bg-card px-4 py-3 transition-[border-color,box-shadow] duration-150",
                        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[hsl(var(--ring)/0.35)]",
                        // Selected = navy border + navy check (no fill, never gold). Dark mode uses the sky ink, like /pricing.
                        checked
                          ? "border-[hsl(222_47%_22%)] shadow-[0_0_0_1px_hsl(222_47%_22%)] dark:border-[hsl(205_90%_78%)] dark:shadow-[0_0_0_1px_hsl(205_90%_78%)]"
                          : "border-foreground/15 hover:border-foreground/30",
                        errors.persona && !checked && "border-red-600/60 dark:border-red-400/60",
                        i === PERSONA_OPTIONS.length - 1 && "sm:col-span-2",
                      )}
                    >
                      <input
                        type="radio"
                        name="persona"
                        id={`persona-${o.value}`}
                        value={o.value}
                        checked={checked}
                        onChange={() => set1("persona", o.value)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150",
                          checked
                            ? "border-[hsl(222_47%_22%)] bg-[hsl(222_47%_22%)] text-white dark:border-[hsl(205_90%_78%)] dark:bg-[hsl(205_90%_78%)] dark:text-[hsl(222_47%_11%)]"
                            : "border-foreground/30",
                        )}
                      >
                        {checked && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-semibold leading-snug text-foreground">{o.label}</span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{o.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <FieldError id="persona" error={errors.persona} />
            </fieldset>

            <Honeypot value={s1.website} onChange={(v) => set1("website", v)} />
          </>
        ) : (
          <>
            {persona !== "developer" && (
              <>
                <Field
                  id="volume"
                  label={persona === "importer" ? "US shipments per month" : "ISFs or entries per month"}
                  error={errors.volume}
                >
                  <select
                    id="volume"
                    name="volume"
                    value={s2.volume}
                    onChange={(e) => set2("volume", e.target.value)}
                    aria-invalid={!!errors.volume}
                    aria-describedby={describedBy("volume", { error: errors.volume })}
                    className={controlCls}
                  >
                    <option value="">Choose a range</option>
                    {volumeOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field id="filesToday" label="How do you file today?" error={errors.filesToday}>
                  <select
                    id="filesToday"
                    name="filesToday"
                    value={s2.filesToday}
                    onChange={(e) => set2("filesToday", e.target.value)}
                    aria-invalid={!!errors.filesToday}
                    aria-describedby={describedBy("filesToday", { error: errors.filesToday })}
                    className={controlCls}
                  >
                    <option value="">Choose one</option>
                    {FILES_TODAY.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            {persona === "importer" && (
              <Field
                id="filerBond"
                label="Do you have a filer code and continuous bond?"
                hint="(optional)"
                help={
                  noFilerYet
                    ? "That's fine. Bring it up on the call and we'll talk through what self-filing needs."
                    : undefined
                }
              >
                <select
                  id="filerBond"
                  name="filerBond"
                  value={s2.filerBond}
                  onChange={(e) => set2("filerBond", e.target.value)}
                  aria-describedby={describedBy("filerBond", { help: noFilerYet })}
                  className={controlCls}
                >
                  <option value="">Choose one</option>
                  {FILER_BOND.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {persona === "nvocc" && (
              <Field id="country" label="Country" hint="(optional)" help="So we offer times in your working day.">
                <CountrySelect
                  id="country"
                  value={s2.country}
                  onChange={(v) => set2("country", v)}
                  className={controlCls}
                  aria-describedby="country-help"
                />
              </Field>
            )}

            {persona === "developer" && (
              <Field
                id="opsOwner"
                label="Who runs filing day to day?"
                hint="(optional)"
                help="We'd like them on the call so it's useful for both of you."
              >
                <input
                  id="opsOwner"
                  name="opsOwner"
                  type="text"
                  maxLength={200}
                  placeholder="Name or role, e.g. our ISF manager"
                  value={s2.opsOwner}
                  onChange={(e) => set2("opsOwner", e.target.value)}
                  aria-describedby="opsOwner-help"
                  className={controlCls}
                />
              </Field>
            )}

            <Field
              id="notes"
              label="Anything you want to see?"
              hint="(optional)"
              help={`${s2.notes.length} / ${NOTES_MAX}`}
              error={errors.notes}
            >
              <textarea
                id="notes"
                name="notes"
                rows={4}
                placeholder="e.g. ISF for consolidations, a recent rejection, filing from our TMS"
                value={s2.notes}
                onChange={(e) => set2("notes", e.target.value)}
                aria-invalid={!!errors.notes}
                aria-describedby={describedBy("notes", { help: true, error: errors.notes })}
                className={cn(controlCls, "h-auto resize-y py-2.5 leading-relaxed")}
              />
            </Field>
          </>
        )}

        <div aria-live="assertive" role="alert" className="empty:hidden">
          {banner && <FormAlert>{banner}</FormAlert>}
          {failureText && (
            <FormAlert
              action={
                <Button type="submit" variant="outline" size="sm" className="w-fit bg-background" disabled={busy}>
                  Try again
                </Button>
              }
            >
              {failureText}
            </FormAlert>
          )}
        </div>

        <div>
          {/* The page's one gold element (deck §7). */}
          <Button type="submit" variant="gold" size="lg" className="h-12 w-full" disabled={busy}>
            {busy ? (step === 1 ? "Saving…" : "Sending…") : step === 1 ? "Continue" : "Send request"}
          </Button>
          {step === 1 && (
            <p className="mt-3 text-center text-[13px] text-muted-foreground">
              We use this to arrange your call. We don&apos;t add you to a mailing list.
            </p>
          )}
        </div>
      </motion.div>
    </form>
  );
}
