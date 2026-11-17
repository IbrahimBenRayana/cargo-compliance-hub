import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  UserPlus, Loader2, MoreHorizontal, Mail, ArrowRightLeft, Search, Trash2, UserX, UserCheck,
  Radio, Landmark, Activity, DollarSign, FileText,
} from '@/components/icons';
import { CbpSetupDialog } from '@/components/admin/CbpSetupDialog';
import { PricingDialog } from '@/components/admin/PricingDialog';
import { UsageInvoicesDialog } from '@/components/admin/UsageInvoicesDialog';
import { TINT, FILL, type Tone } from '@/components/dashboard/tones';
import { adminApi } from '@/api/client';
import type { AdminOrganization, AdminUserLookup } from '@/api/client';
import { PLAN_META } from '@/lib/planMeta';
import { money } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PAGE = 'mx-auto flex max-w-[1360px] flex-col gap-5 -mx-2 sm:mx-auto pb-24 sm:pb-12';
const PANEL = 'overflow-hidden rounded-xl border border-border/70 bg-card shadow-card';
const TH = 'px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground';
const TD = 'px-4 py-2.5';

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-medium', TINT[tone])}>
      <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', FILL[tone])} />{children}
    </span>
  );
}

function formatDate(ts: string | null) {
  if (!ts) return 'not recorded';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Display name for a plan id: prefer the app's PLAN_META label, fall back to
 *  the server-supplied name (covers the private `enterprise` tier). */
function planLabel(planId: string | undefined, fallbackName: string | undefined) {
  if (planId && PLAN_META[planId]) return PLAN_META[planId].name;
  return fallbackName ?? 'Unnamed plan';
}

/** Short price note for a plan in the pickers. Entry prices are per org. */
function planPrice(p: { perFilingCents: number; sellsEntries: boolean }) {
  const isf = p.perFilingCents > 0 ? `${money(p.perFilingCents)} / ISF` : 'contract';
  return p.sellsEntries ? `${isf} · entries priced per client` : isf;
}

/** One-line summary of an org's prices for the clients table. */
function pricingSummary(org: AdminOrganization) {
  const e = org.pricing?.effective;
  if (!e) return null;
  const b = org.billing;
  const isf = b?.mode === 'invoiced'
    ? `Invoiced ${money(b.monthlyMinimumCents ?? 0)}/mo incl. ${b.includedIsfs ?? 0} · then ${money(e.isfCents)}/ISF` +
      (b.isfBands ?? []).map((band) => `, ${money(band.cents)} from #${band.fromIsf.toLocaleString('en-US')}`).join('')
    : `ISF ${money(e.isfCents)}`;
  if (e.entryLinkedCents == null || e.entryOnlyCents == null) return isf;
  return `${isf} · entry +${money(e.entryLinkedCents)} / ${money(e.entryOnlyCents)}`;
}

interface ProvisionForm {
  companyName: string;
  iorNumber: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerEmail: string;
  planId: string;
  maxUsers: string;
}

/**
 * Cross-org user lookup. Emails are globally unique, so an account anywhere on
 * the platform blocks that address from being invited to any other team. This
 * card answers "where does this email live?" and clears stray rows.
 */
function UserLookupCard() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ searched: string; user: AdminUserLookup | null } | null>(null);

  const lookup = useMutation({
    mutationFn: (address: string) => adminApi.lookupUser(address),
    onSuccess: (data, address) => setResult({ searched: address, user: data.user }),
    onError: (err: any) => toast.error(err.body?.error || 'Lookup failed'),
  });

  const refresh = () => {
    if (result) lookup.mutate(result.searched);
  };

  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.setUserActive(id, isActive),
    onSuccess: (_, vars) => {
      toast.success(vars.isActive ? 'Account reactivated' : 'Account deactivated');
      refresh();
    },
    onError: (err: any) => toast.error(err.body?.error || 'Update failed'),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: (data) => {
      toast.success(`Account deleted. ${data.releasedEmail} can now be invited anywhere.`);
      refresh();
    },
    onError: (err: any) => toast.error(err.body?.error || 'Delete failed'),
  });

  const user = result?.user ?? null;
  const activityTotal = user ? Object.values(user.activity).reduce((a, b) => a + b, 0) : 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (address) lookup.mutate(address);
  };

  const handleDelete = (u: AdminUserLookup) => {
    if (!window.confirm(
      `Permanently delete ${u.email} from "${u.organization.name}"? This frees the email for re-invitation and cannot be undone.`,
    )) return;
    deleteUser.mutate(u.id);
  };

  return (
    <section className={PANEL}>
      <div className="px-5 py-3.5">
        <h2 className="text-[14px] font-semibold">Find a user</h2>
        <p className="text-[13px] text-muted-foreground">
          Look up which organization holds an email address. Use it when an invitation fails
          because the address is already taken somewhere on the platform.
        </p>
      </div>
      <div className="space-y-4 border-t border-border/70 px-5 py-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            type="email"
            placeholder="person@company.com"
            aria-label="Email address to look up"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-0 max-w-sm"
          />
          <Button type="submit" variant="outline" disabled={lookup.isPending || !email.trim()}>
            {lookup.isPending
              ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
              : <Search aria-hidden />}
            Search
          </Button>
        </form>

        {result && !user && (
          <p className="text-[13px] text-muted-foreground">
            No account holds <span className="break-all font-mono text-foreground">{result.searched}</span>.
            This address is free to invite.
          </p>
        )}

        {user && (
          <div className="min-w-0 space-y-3 border-t border-border/70 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-medium">
                {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}
              </span>
              <span className="break-all font-mono text-[12.5px] text-muted-foreground">{user.email}</span>
              <Pill tone={user.isActive ? 'done' : 'calm'}>{user.isActive ? 'Active' : 'Deactivated'}</Pill>
              <Pill tone="calm">{user.role}</Pill>
              {user.isPlatformAdmin && <Pill tone="info">Platform admin</Pill>}
              {!user.emailVerified && <Pill tone="soon">Email unverified</Pill>}
            </div>
            <div className="space-y-1 text-[13px] text-muted-foreground">
              <div>
                Organization: <span className="font-medium text-foreground">{user.organization.name}</span>
              </div>
              <div className="tabular-nums">Created {formatDate(user.createdAt)} · Last login {formatDate(user.lastLoginAt)}</div>
            </div>
            <p className={cn('rounded-lg px-4 py-3 text-[13px]', activityTotal === 0 ? 'bg-info-tint text-info' : 'bg-soon-tint text-soon')}>
              {activityTotal === 0
                ? 'No filings or other work product. Safe to delete.'
                : `Has work product (${Object.entries(user.activity)
                    .filter(([, n]) => n > 0)
                    .map(([k, n]) => `${n} ${k}`)
                    .join(', ')}). Deactivate instead of deleting.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActive.mutate({ id: user.id, isActive: !user.isActive })}
                disabled={setActive.isPending}
              >
                {user.isActive
                  ? <><UserX aria-hidden />Deactivate</>
                  : <><UserCheck aria-hidden />Reactivate</>}
              </Button>
              <Button
                size="sm"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => handleDelete(user)}
                disabled={deleteUser.isPending || activityTotal > 0 || user.isPlatformAdmin}
                title={activityTotal > 0 ? 'Users with filings or documents cannot be hard-deleted' : undefined}
              >
                {deleteUser.isPending
                  ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
                  : <Trash2 aria-hidden />}
                Delete permanently
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const EMPTY_FORM: ProvisionForm = {
  companyName: '',
  iorNumber: '',
  ownerFirstName: '',
  ownerLastName: '',
  ownerEmail: '',
  planId: '',
  maxUsers: '',
};

export function AdminClientsPage() {
  const queryClient = useQueryClient();

  const { data: orgsData, isLoading: orgsLoading } = useQuery({
    queryKey: ['admin', 'organizations'],
    queryFn: () => adminApi.organizations(),
  });
  const { data: plansData } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => adminApi.plans(),
  });

  const organizations = orgsData?.organizations ?? [];
  const plans = plansData?.plans ?? [];

  const provision = useMutation({
    mutationFn: (body: Parameters<typeof adminApi.provisionOrganization>[0]) =>
      adminApi.provisionOrganization(body),
  });
  const changePlan = useMutation({
    mutationFn: ({ orgId, planId }: { orgId: string; planId: string }) =>
      adminApi.changePlan(orgId, planId),
  });
  const resendSetup = useMutation({
    mutationFn: (orgId: string) => adminApi.resendSetup(orgId),
  });

  // ─── Provision dialog ───────────────────────────────────
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [form, setForm] = useState<ProvisionForm>(EMPTY_FORM);

  const setField = (key: keyof ProvisionForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleProvision = async () => {
    if (!form.companyName.trim()) return toast.error('Company name is required');
    if (!form.ownerFirstName.trim()) return toast.error('Owner first name is required');
    if (!form.ownerLastName.trim()) return toast.error('Owner last name is required');
    if (!form.ownerEmail.trim()) return toast.error('Owner email is required');
    if (!form.planId) return toast.error('Please select a plan');

    const maxUsersNum = form.maxUsers.trim() ? Number(form.maxUsers) : undefined;
    if (maxUsersNum !== undefined && (!Number.isFinite(maxUsersNum) || maxUsersNum < 1)) {
      return toast.error('Max users must be a positive number');
    }

    try {
      await provision.mutateAsync({
        companyName: form.companyName.trim(),
        iorNumber: form.iorNumber.trim() || undefined,
        ownerEmail: form.ownerEmail.trim(),
        ownerFirstName: form.ownerFirstName.trim(),
        ownerLastName: form.ownerLastName.trim(),
        planId: form.planId,
        maxUsers: maxUsersNum,
      });
      toast.success(`Account created. A setup email was sent to ${form.ownerEmail.trim()}`);
      setForm(EMPTY_FORM);
      setProvisionOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
    } catch (err: any) {
      toast.error(err.body?.error || err.message || 'Failed to provision client');
    }
  };

  // ─── Change plan dialog ─────────────────────────────────
  const [planDialogOrg, setPlanDialogOrg] = useState<AdminOrganization | null>(null);
  const [cbpDialogOrg, setCbpDialogOrg] = useState<AdminOrganization | null>(null);
  const [pricingDialogOrg, setPricingDialogOrg] = useState<AdminOrganization | null>(null);
  const [usageDialogOrg, setUsageDialogOrg] = useState<AdminOrganization | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('');

  const openPlanDialog = (org: AdminOrganization) => {
    setPlanDialogOrg(org);
    setSelectedPlan(org.plan?.id ?? '');
  };

  const handleChangePlan = async () => {
    if (!planDialogOrg || !selectedPlan) return;
    try {
      const result = await changePlan.mutateAsync({ orgId: planDialogOrg.id, planId: selectedPlan });
      toast.success(`Plan changed to ${result.plan.name}`);
      setPlanDialogOrg(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
    } catch (err: any) {
      toast.error(err.body?.error || err.message || 'Failed to change plan');
    }
  };

  const handleResendSetup = async (org: AdminOrganization) => {
    try {
      const result = await resendSetup.mutateAsync(org.id);
      toast.success(`Setup email sent to ${result.sentTo || org.owner?.email || 'the owner'}`);
    } catch (err: any) {
      toast.error(err.body?.error || err.message || 'Failed to resend setup email');
    }
  };

  return (
    <div className={PAGE}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.015em]">Clients</h1>
          <p className="text-[13px] text-muted-foreground">Provision and manage client accounts.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/cbp"><Activity aria-hidden />CBP traffic</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/cert"><Radio aria-hidden />Certification console</Link>
          </Button>
          <Dialog open={provisionOpen} onOpenChange={setProvisionOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><UserPlus aria-hidden />Provision client</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Provision a client account</DialogTitle>
                <DialogDescription>
                  Creates the organization and owner account. The owner receives an email
                  with a link to set their password.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="company-name">Company name</Label>
                  <Input
                    id="company-name"
                    placeholder="Acme Imports LLC"
                    value={form.companyName}
                    onChange={(e) => setField('companyName', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ior-number">IOR number <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="ior-number"
                    placeholder="12-3456789"
                    className="font-mono"
                    value={form.iorNumber}
                    onChange={(e) => setField('iorNumber', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="owner-first">Owner first name</Label>
                    <Input
                      id="owner-first"
                      placeholder="Jane"
                      value={form.ownerFirstName}
                      onChange={(e) => setField('ownerFirstName', e.target.value)}
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="owner-last">Owner last name</Label>
                    <Input
                      id="owner-last"
                      placeholder="Doe"
                      value={form.ownerLastName}
                      onChange={(e) => setField('ownerLastName', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="owner-email">Owner email</Label>
                  <Input
                    id="owner-email"
                    type="email"
                    placeholder="jane@acme.com"
                    value={form.ownerEmail}
                    onChange={(e) => setField('ownerEmail', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="provision-plan">Plan</Label>
                  <Select value={form.planId} onValueChange={(v) => setField('planId', v)}>
                    <SelectTrigger id="provision-plan">
                      <SelectValue placeholder="Select a plan" />
                    </SelectTrigger>
                    <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="font-medium">{planLabel(p.id, p.name)}</span>
                        <span className="ml-2 text-[12.5px] tabular-nums text-muted-foreground">{planPrice(p)}</span>
                      </SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="max-users">Max users <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="max-users"
                    type="number"
                    min={1}
                    placeholder="Default"
                    value={form.maxUsers}
                    onChange={(e) => setField('maxUsers', e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setProvisionOpen(false)}>Cancel</Button>
                <Button onClick={handleProvision} disabled={provision.isPending}>
                  {provision.isPending
                    ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
                    : <UserPlus aria-hidden />}
                  Create account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Clients table */}
      <section className={PANEL}>
        <div className="px-5 py-3.5">
          <h2 className="text-[14px] font-semibold">Client accounts</h2>
          <p className="text-[13px] text-muted-foreground">Organizations provisioned on the platform.</p>
        </div>
        {orgsLoading ? (
          <div className="flex items-center justify-center gap-2 border-t border-border/70 px-5 py-12 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
            Loading clients…
          </div>
        ) : organizations.length === 0 ? (
          <div className="border-t border-border/70 px-5 py-10 text-center">
            <p className="text-[14px] font-medium">No clients yet</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setProvisionOpen(true)}>
              <UserPlus aria-hidden />
              Provision your first client
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-border/70">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border/70">
                  <th scope="col" className={TH}>Company</th>
                  <th scope="col" className={TH}>Plan</th>
                  <th scope="col" className={TH}>Owner</th>
                  <th scope="col" className={TH}>CBP</th>
                  <th scope="col" className={cn(TH, 'max-md:hidden')}>Users</th>
                  <th scope="col" className={cn(TH, 'max-md:hidden')}>Filings</th>
                  <th scope="col" className={cn(TH, 'max-md:hidden')}>Created</th>
                  <th scope="col" aria-label="Actions" className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {organizations.map((org) => (
                  <tr key={org.id} className="align-top">
                    <td className={TD}>
                      <p className="font-medium">{org.name}</p>
                      <p className="text-[12.5px] text-muted-foreground">
                        {org.iorNumber ? <>IOR <span className="font-mono">{org.iorNumber}</span></> : 'No IOR'}
                      </p>
                    </td>
                    <td className={TD}>
                      {org.plan ? (
                        <div className="space-y-1">
                          <p className="font-medium">{planLabel(org.plan.id, org.plan.name)}</p>
                          <p className="text-[12px] tabular-nums text-muted-foreground">{pricingSummary(org)}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No plan</span>
                      )}
                    </td>
                    <td className={TD}>
                      {org.owner ? (
                        <div className="space-y-1">
                          <p className="font-mono text-[12.5px]">{org.owner.email}</p>
                          {org.owner.emailVerified
                            ? <Pill tone="done">Verified</Pill>
                            : <Pill tone="soon">Pending setup</Pill>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No owner</span>
                      )}
                    </td>
                    <td className={TD}>
                      {org.cbp?.filerCode ? (
                        <div className="space-y-1">
                          <p className="font-mono">{org.cbp.filerCode}</p>
                          <Pill tone={org.cbp.serviceCenterApprovedAt ? 'done' : 'soon'}>
                            {org.cbp.serviceCenterApprovedAt ? 'Queue approved' : 'Awaiting rep'}
                          </Pill>
                        </div>
                      ) : (
                        <span className="whitespace-nowrap text-muted-foreground">ISF via S7P only</span>
                      )}
                    </td>
                    <td className={cn(TD, 'whitespace-nowrap tabular-nums max-md:hidden')}>
                      {org.userCount} / {org.maxUsers}
                    </td>
                    <td className={cn(TD, 'tabular-nums max-md:hidden')}>{org.filingCount}</td>
                    <td className={cn(TD, 'whitespace-nowrap tabular-nums text-muted-foreground max-md:hidden')}>{formatDate(org.createdAt)}</td>
                    <td className="px-2 py-1.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${org.name}`}>
                            <MoreHorizontal className="h-4 w-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setCbpDialogOrg(org)}>
                            <Landmark className="mr-2 h-4 w-4" aria-hidden />
                            CBP setup…
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openPlanDialog(org)}>
                            <ArrowRightLeft className="mr-2 h-4 w-4" aria-hidden />
                            Change plan
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPricingDialogOrg(org)} disabled={!org.plan}>
                            <DollarSign className="mr-2 h-4 w-4" aria-hidden />
                            Pricing and billing…
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setUsageDialogOrg(org)} disabled={!org.plan}>
                            <FileText className="mr-2 h-4 w-4" aria-hidden />
                            Usage and invoices…
                          </DropdownMenuItem>
                          {org.owner && (
                            <DropdownMenuItem
                              onClick={() => handleResendSetup(org)}
                              disabled={resendSetup.isPending}
                            >
                              <Mail className="mr-2 h-4 w-4" aria-hidden />
                              Resend setup email
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <UserLookupCard />

      <CbpSetupDialog org={cbpDialogOrg} onClose={() => setCbpDialogOrg(null)} />
      <PricingDialog org={pricingDialogOrg} onClose={() => setPricingDialogOrg(null)} />
      <UsageInvoicesDialog org={usageDialogOrg} onClose={() => setUsageDialogOrg(null)} />

      {/* Change plan dialog */}
      <Dialog open={!!planDialogOrg} onOpenChange={(open) => !open && setPlanDialogOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change plan</DialogTitle>
            <DialogDescription>
              Update the plan for {planDialogOrg?.name}. The plan sets which features they can use; what they
              pay is set under Pricing. An unpaid charge stays owed after a plan change.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="change-plan">Plan</Label>
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger id="change-plan">
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="font-medium">{planLabel(p.id, p.name)}</span>
                  <span className="ml-2 text-[12.5px] tabular-nums text-muted-foreground">{planPrice(p)}</span>
                </SelectItem>
              ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOrg(null)}>Cancel</Button>
            <Button
              onClick={handleChangePlan}
              disabled={changePlan.isPending || !selectedPlan || selectedPlan === planDialogOrg?.plan?.id}
            >
              {changePlan.isPending && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
              Save plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
