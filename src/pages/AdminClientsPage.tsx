import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Building2, UserPlus, Loader2, MoreHorizontal, CheckCircle2, Clock,
  Mail, ArrowRightLeft,
} from 'lucide-react';
import { adminApi } from '@/api/client';
import type { AdminOrganization } from '@/api/client';
import { PLAN_META } from '@/lib/planMeta';
import { toast } from 'sonner';

function formatDate(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Display name for a plan id — prefer the app's PLAN_META label, fall back to
 *  the server-supplied name (covers the private `enterprise` tier). */
function planLabel(planId: string | undefined, fallbackName: string | undefined) {
  if (planId && PLAN_META[planId]) return PLAN_META[planId].name;
  return fallbackName ?? '—';
}

/** Price label for a plan: PLAN_META if known, else derive from perFilingCents. */
function planPrice(planId: string, perFilingCents: number) {
  if (PLAN_META[planId]) return PLAN_META[planId].priceLabel;
  return `$${Math.round(perFilingCents / 100)}`;
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
      toast.success(`Account created — a setup email was sent to ${form.ownerEmail.trim()}`);
      setForm(EMPTY_FORM);
      setProvisionOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
    } catch (err: any) {
      toast.error(err.body?.error || err.message || 'Failed to provision client');
    }
  };

  // ─── Change plan dialog ─────────────────────────────────
  const [planDialogOrg, setPlanDialogOrg] = useState<AdminOrganization | null>(null);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">Provision and manage client accounts</p>
        </div>
        <Dialog open={provisionOpen} onOpenChange={setProvisionOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Provision client
            </Button>
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
              <div className="space-y-2">
                <Label htmlFor="company-name">Company name</Label>
                <Input
                  id="company-name"
                  placeholder="Acme Imports LLC"
                  value={form.companyName}
                  onChange={(e) => setField('companyName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ior-number">IOR number <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="ior-number"
                  placeholder="12-3456789"
                  value={form.iorNumber}
                  onChange={(e) => setField('iorNumber', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="owner-first">Owner first name</Label>
                  <Input
                    id="owner-first"
                    placeholder="Jane"
                    value={form.ownerFirstName}
                    onChange={(e) => setField('ownerFirstName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner-last">Owner last name</Label>
                  <Input
                    id="owner-last"
                    placeholder="Doe"
                    value={form.ownerLastName}
                    onChange={(e) => setField('ownerLastName', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-email">Owner email</Label>
                <Input
                  id="owner-email"
                  type="email"
                  placeholder="jane@acme.com"
                  value={form.ownerEmail}
                  onChange={(e) => setField('ownerEmail', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={form.planId} onValueChange={(v) => setField('planId', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <span>{planLabel(p.id, p.name)}</span>
                          <span className="text-xs text-muted-foreground">
                            {planPrice(p.id, p.perFilingCents)} / shipment
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-users">Max users <span className="text-muted-foreground">(optional)</span></Label>
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
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <UserPlus className="mr-2 h-4 w-4" />}
                Create account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Clients table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Client accounts</CardTitle>
          <CardDescription>Organizations provisioned on the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          {orgsLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading clients…
            </div>
          ) : organizations.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No clients yet</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setProvisionOpen(true)}>
                <UserPlus className="mr-2 h-3.5 w-3.5" />
                Provision your first client
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Filings</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{org.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {org.iorNumber ? `IOR ${org.iorNumber}` : 'No IOR'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {org.plan ? (
                        <Badge variant="secondary" className="text-xs">
                          {planLabel(org.plan.id, org.plan.name)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No plan</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {org.owner ? (
                        <div className="space-y-1">
                          <p className="text-sm">{org.owner.email}</p>
                          {org.owner.emailVerified ? (
                            <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending setup
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {org.userCount} / {org.maxUsers}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{org.filingCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(org.createdAt)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openPlanDialog(org)}>
                            <ArrowRightLeft className="h-3.5 w-3.5 mr-2" />
                            Change plan
                          </DropdownMenuItem>
                          {org.owner && (
                            <DropdownMenuItem
                              onClick={() => handleResendSetup(org)}
                              disabled={resendSetup.isPending}
                            >
                              <Mail className="h-3.5 w-3.5 mr-2" />
                              Resend setup email
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Change plan dialog */}
      <Dialog open={!!planDialogOrg} onOpenChange={(open) => !open && setPlanDialogOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change plan</DialogTitle>
            <DialogDescription>
              Update the pricing tier for {planDialogOrg?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Plan</Label>
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger>
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <span>{planLabel(p.id, p.name)}</span>
                      <span className="text-xs text-muted-foreground">
                        {planPrice(p.id, p.perFilingCents)} / shipment
                      </span>
                    </span>
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
              {changePlan.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
