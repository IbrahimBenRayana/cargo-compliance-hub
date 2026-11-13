/**
 * Settings: a section list on the left (profile, organization, billing, CBP
 * identity, notifications, audit log) and the open section beside it.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { BillingSettings } from '@/components/billing/BillingSettings';
import { TINT, type Tone } from '@/components/dashboard/tones';
import { Activity, Bell, Building2, CreditCard, Key, Loader2, User, type IconType } from '@/components/icons';
import { CbpIdentityCard } from '@/components/settings/CbpIdentityCard';
import { ChangePasswordCard } from '@/components/settings/ChangePasswordCard';
import { EntryNumberBlocksCard } from '@/components/settings/EntryNumberBlocksCard';
import { NotificationPreferencesPanel } from '@/components/settings/NotificationPreferencesPanel';
import { TwoFactorSettings } from '@/components/settings/TwoFactorSettings';
import { stamp } from '@/components/shipment-detail/summary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuditLog, useOrganization, useProfile, useUpdateOrganization, useUpdateProfile } from '@/hooks/useFilings';
import { cn } from '@/lib/utils';

const PAGE = 'mx-auto flex max-w-[1360px] flex-col gap-5 -mx-2 sm:mx-auto pb-24 sm:pb-12';
const PANEL = 'overflow-hidden rounded-xl border border-border/70 bg-card shadow-card';

function Panel({ title, description, aside, children }: { title: string; description?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={PANEL}>
      <div className="flex items-start justify-between gap-3 px-5 py-3.5">
        <div>
          <h2 className="text-[14px] font-semibold">{title}</h2>
          {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {aside}
      </div>
      <div className="border-t border-border/70 px-5 py-4">{children}</div>
    </section>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p id={`${id}-hint`} className="text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** What kind of action an audit entry records, for its colour. */
function actionTone(action: string): Tone {
  if (action.includes('create')) return 'done';
  if (action.includes('delete') || action.includes('cancel')) return 'urgent';
  if (action.includes('submit')) return 'info';
  return 'calm';
}

type SettingsTab = 'profile' | 'organization' | 'billing' | 'api' | 'notifications' | 'activity';

const tabs: { id: SettingsTab; label: string; desc: string; icon: IconType }[] = [
  { id: 'profile', label: 'Profile', desc: 'Your name, password and sign-in', icon: User },
  { id: 'organization', label: 'Organization', desc: 'Company and importer details', icon: Building2 },
  { id: 'billing', label: 'Billing', desc: 'Plan, card and charges', icon: CreditCard },
  { id: 'api', label: 'CBP identity', desc: 'Filer code and service center', icon: Key },
  { id: 'notifications', label: 'Notifications', desc: 'What reaches you, and how', icon: Bell },
  { id: 'activity', label: 'Audit log', desc: 'Recent activity', icon: Activity },
];

export default function SettingsPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: org, isLoading: orgLoading } = useOrganization();
  const { data: auditData, isLoading: auditLoading } = useAuditLog({ limit: 30 });
  const updateProfile = useUpdateProfile();
  const updateOrganization = useUpdateOrganization();

  // The open section lives in the address, so it can be linked to and survives a reload.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab: SettingsTab = tabs.some((t) => t.id === requestedTab) ? (requestedTab as SettingsTab) : 'profile';
  const setActiveTab = (tab: SettingsTab) => setSearchParams(tab === 'profile' ? {} : { tab }, { replace: true });

  // Profile form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  // Org form
  const [orgName, setOrgName] = useState('');
  const [iorNumber, setIorNumber] = useState('');
  const [einNumber, setEinNumber] = useState('');
  const [orgPhone, setOrgPhone] = useState('');

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
      setEmail(profile.email || '');
    }
  }, [profile]);

  useEffect(() => {
    if (org) {
      setOrgName(org.name || '');
      setIorNumber(org.iorNumber || '');
      setEinNumber(org.einNumber || '');
      setOrgPhone(org.phone || '');
    }
  }, [org]);

  const handleSaveProfile = async () => {
    try {
      await updateProfile.mutateAsync({ firstName, lastName });
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err.body?.error || err.message || 'Failed to update profile');
    }
  };

  const handleSaveOrg = async () => {
    try {
      const digits = orgPhone.replace(/\D/g, '');
      if (digits && digits.length < 10) {
        toast.error('Enter a 10-digit phone number, area code included');
        return;
      }
      await updateOrganization.mutateAsync({ name: orgName, iorNumber, einNumber, phone: orgPhone.trim() });
      toast.success('Organization saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update organization');
    }
  };


  const initials = ((profile?.firstName?.[0] || '') + (profile?.lastName?.[0] || '')).toUpperCase() || 'U';
  const canEdit = profile?.role === 'owner' || profile?.role === 'admin';

  if (profileLoading || orgLoading) {
    return (
      <div className={PAGE}>
        <Skeleton className="h-10 w-48 rounded-lg" />
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Skeleton className="h-[380px] rounded-xl" />
          <Skeleton className="h-[520px] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.015em]">Settings</h1>
          <p className="text-[13px] text-muted-foreground">Your account, your organization, and how the app reaches you.</p>
        </div>
        {profile?.role && <p className="text-[12.5px] text-muted-foreground">Signed in as <span className="font-medium capitalize text-foreground">{profile.role}</span></p>}
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className={PANEL}>
          <div className="flex items-center gap-3 px-4 py-4">
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-[14px] font-semibold text-primary-foreground">{initials}</span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold">{profile?.firstName} {profile?.lastName}</p>
              <p className="truncate text-[12.5px] text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
          <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto border-t border-border/70 p-2 [scrollbar-width:none] lg:flex-col">
            {tabs.map((tab) => {
              const on = activeTab === tab.id;
              return (
                <button
                  key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-current={on ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring',
                    on ? 'bg-muted text-foreground' : 'text-muted-foreground can-hover:hover:bg-muted/60 can-hover:hover:text-foreground',
                  )}
                >
                  <tab.icon weight={on ? 'duotone' : 'regular'} className={cn('h-5 w-5 shrink-0', on && 'text-primary')} aria-hidden />
                  <span className="min-w-0">
                    <span className="block whitespace-nowrap text-[13px] font-medium">{tab.label}</span>
                    <span className="block truncate text-[12px] text-muted-foreground max-lg:hidden">{tab.desc}</span>
                  </span>
                </button>
              );
            })}
          </nav>
          {profile?.createdAt && (
            <p className="border-t border-border/70 px-4 py-2.5 text-[12px] text-muted-foreground max-lg:hidden">
              Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </p>
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          {activeTab === 'profile' && (
            <>
              <Panel title="Personal information" description="The name shown on your filings and to your team.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="settings-first-name" label="First name">
                    <Input id="settings-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                  </Field>
                  <Field id="settings-last-name" label="Last name">
                    <Input id="settings-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                  </Field>
                  <Field id="settings-email" label="Email address" hint="To change your email, contact support.">
                    {/* The server refuses email changes from here. */}
                    <Input id="settings-email" value={email} readOnly aria-describedby="settings-email-hint" type="email" className="bg-muted/50" />
                  </Field>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={updateProfile.isPending}>
                    {updateProfile.isPending && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}Save changes
                  </Button>
                </div>
              </Panel>
              <ChangePasswordCard email={email} />
              <TwoFactorSettings />
            </>
          )}

          {activeTab === 'organization' && (
            <>
              <Panel title="Company details" description="Your importer of record information, used on filings.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field id="settings-org-name" label="Company name">
                      <Input id="settings-org-name" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Legal company name" autoComplete="organization" />
                    </Field>
                  </div>
                  <Field id="settings-ior" label="IOR number" hint="Importer of record number, used on every ISF.">
                    <Input id="settings-ior" value={iorNumber} onChange={(e) => setIorNumber(e.target.value)} placeholder="XX-XXXXXXXXX" aria-describedby="settings-ior-hint" className="font-mono" />
                  </Field>
                  <Field id="settings-ein" label="EIN / Tax ID" hint="Employer identification number.">
                    <Input id="settings-ein" value={einNumber} onChange={(e) => setEinNumber(e.target.value)} placeholder="XX-XXXXXXX" aria-describedby="settings-ein-hint" className="font-mono" />
                  </Field>
                  <Field id="settings-org-phone" label="Phone" hint="10 digits. CBP requires a contact phone on entries.">
                    <Input id="settings-org-phone" type="tel" autoComplete="tel" value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} placeholder="(310) 555-0100" aria-describedby="settings-org-phone-hint" />
                  </Field>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleSaveOrg} disabled={updateOrganization.isPending}>
                    {updateOrganization.isPending && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}Save organization
                  </Button>
                </div>
              </Panel>

              <EntryNumberBlocksCard canEdit={canEdit} />

              {org && (
                <Panel title="On this account">
                  <dl className="grid grid-cols-3 gap-x-6">
                    {[['People', org._count.users], ['Filings', org._count.filings], ['Templates', org._count.filingTemplates]].map(([label, count]) => (
                      <div key={label as string}>
                        <dt className="text-[12px] text-muted-foreground">{label}</dt>
                        <dd className="mt-0.5 text-[20px] font-semibold leading-7 tabular-nums">{Number(count).toLocaleString()}</dd>
                      </div>
                    ))}
                  </dl>
                </Panel>
              )}
            </>
          )}

          {activeTab === 'billing' && <BillingSettings />}

          {activeTab === 'api' && <CbpIdentityCard canEdit={canEdit} />}

          {activeTab === 'notifications' && (
            <Panel title="Notifications" description="Choose what reaches you in the app and by email. Everything is on to start with.">
              <NotificationPreferencesPanel />
            </Panel>
          )}

          {activeTab === 'activity' && (
            <section className={PANEL}>
              <div className="px-5 py-3.5">
                <h2 className="text-[14px] font-semibold">
                  Audit log {auditData?.data?.length ? <span className="font-normal tabular-nums text-muted-foreground">{auditData.data.length}</span> : null}
                </h2>
                <p className="text-[13px] text-muted-foreground">The most recent actions across your organization. Entries cannot be edited.</p>
              </div>
              {auditLoading ? (
                <div className="space-y-2 border-t border-border/70 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : !auditData?.data?.length ? (
                <p className="border-t border-border/70 px-5 py-10 text-center text-[13px] text-muted-foreground">Nothing recorded yet. Actions taken in the app are listed here.</p>
              ) : (
                <ul className="divide-y divide-border/60 border-t border-border/70">
                  {auditData.data.map((log: any) => (
                    <li key={log.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 px-5 py-2.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
                      <p className="flex min-w-0 items-center gap-2 text-[13px] font-medium">
                        <span className="truncate">{formatAction(log.action)}</span>
                        {log.entityType && <span className={cn('shrink-0 rounded-md px-1.5 py-px font-mono text-[11.5px] font-normal', TINT[actionTone(log.action)])}>{log.entityType}</span>}
                      </p>
                      <p className="truncate text-[13px] text-muted-foreground max-sm:order-last max-sm:col-span-2">
                        {log.user ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email : 'System'}
                      </p>
                      <time dateTime={log.createdAt} className="whitespace-nowrap text-[12.5px] tabular-nums text-muted-foreground">{stamp(log.createdAt)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/** "filing.status_changed" reads as "Filing: status changed". */
function formatAction(action: string): string {
  const text = action.replace(/\./g, ': ').replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
