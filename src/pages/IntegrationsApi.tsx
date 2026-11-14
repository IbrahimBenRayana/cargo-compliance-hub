import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTestCCConnection } from '@/hooks/useFilings';
import { useAuthStore } from '@/hooks/useAuth';
import { integrationsApi, apiKeysApi, type ApiKey, type ApiKeyCreated } from '@/api/client';
import { CheckCircle2, Loader2, Zap, Activity, Send, KeyRound, Copy, Trash2, Plus } from '@/components/icons';
import { TINT, FILL, type Tone } from '@/components/dashboard/tones';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PAGE = 'mx-auto flex max-w-[1360px] flex-col gap-5 -mx-2 sm:mx-auto pb-24 sm:pb-12';
const PANEL = 'overflow-hidden rounded-xl border border-border/70 bg-card shadow-card';
const TH = 'px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground';
const TD = 'px-4 py-2.5';
const SPIN = 'animate-spin motion-reduce:animate-none';

type Health = 'ok' | 'error' | 'warning' | 'neutral';
const HEALTH_TONE: Record<Health, Tone> = { ok: 'done', error: 'urgent', warning: 'soon', neutral: 'calm' };

// ─── API Key scopes (must match server) ────────────────────
const API_KEY_SCOPES: { value: string; label: string; desc: string }[] = [
  { value: 'filings:read', label: 'filings:read', desc: 'Read filings and their status' },
  { value: 'filings:write', label: 'filings:write', desc: 'Create, update and submit filings' },
  { value: 'entries:read', label: 'entries:read', desc: 'Read entry summaries' },
  { value: 'entries:write', label: 'entries:write', desc: 'Create and amend entry summaries' },
];

const PUBLIC_API_BASE_URL = 'https://app.mycargolens.com/api/public/v1';

function fmtKeyDate(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtKeyRelative(ts: string | null) {
  if (!ts) return 'Never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtKeyDate(ts);
}

export default function IntegrationsApi() {
  // The connection test is a platform-admin check; for anyone else it always failed (BUG-003).
  const isPlatformAdmin = useAuthStore((st) => !!st.user?.isPlatformAdmin);
  const testConnection = useTestCCConnection();

  const [connectionResult, setConnectionResult] = useState<{
    connected: boolean; environment: string; baseUrl: string;
  } | null>(null);

  const [emailStatus, setEmailStatus] = useState<{
    configured: boolean; connected: boolean; from: string;
  } | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);

  const handleTestConnection = async () => {
    try {
      const result = await testConnection.mutateAsync();
      setConnectionResult(result);
      if (result.connected) toast.success('Connection successful');
      else toast.error('Connection failed');
    } catch {
      toast.error('Connection test failed');
    }
  };

  const handleCheckEmailStatus = async () => {
    setEmailChecking(true);
    try {
      const result = await integrationsApi.getEmailStatus();
      setEmailStatus(result);
      if (result.connected) toast.success('Email SMTP connected');
      else if (result.configured) toast.error('SMTP configured but connection failed');
      else toast.warning('Email SMTP not configured');
    } catch {
      toast.error('Failed to check email status');
    } finally {
      setEmailChecking(false);
    }
  };

  const handleSendTestEmail = async () => {
    setEmailTesting(true);
    try {
      const result = await integrationsApi.testEmail();
      if (result.success) toast.success(result.message || 'Test email sent! Check your inbox.');
      else toast.error(result.error || 'Failed to send test email');
    } catch {
      toast.error('Failed to send test email');
    } finally {
      setEmailTesting(false);
    }
  };

  const capabilities = [
    { label: 'ISF-10 filing', desc: 'Importer Security Filing (10+2)', status: 'active' as const },
    { label: 'ISF-5 filing', desc: 'Carrier Security Filing (5+2)', status: 'active' as const },
    { label: 'Status updates', desc: 'CBP responses are checked automatically', status: 'active' as const },
    { label: 'HTS classification', desc: 'AI-powered tariff code suggestions', status: 'active' as const },
    { label: 'Amendment and cancel', desc: 'File amendments and cancellations', status: 'active' as const },
    { label: 'MID lookup', desc: 'Manufacturer Identification (MID) database', status: 'beta' as const },
  ];

  const emailTriggers = [
    { label: 'Team invitations', desc: 'Sent when a team member is invited to the organization' },
    { label: 'Welcome email', desc: 'Sent after a new user registers' },
    { label: 'Filing sent', desc: 'Confirmation when an ISF filing is sent to CBP' },
    { label: 'Filing accepted', desc: 'All org members notified when CBP accepts a filing' },
    { label: 'Filing rejected', desc: 'All org members alerted when CBP rejects a filing' },
    { label: 'Deadline warning', desc: 'Alerts at 72h, 48h, and 24h before filing deadlines' },
  ];

  return (
    <div className={PAGE}>
      {/* ─── Header ─────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.015em]">API & integrations</h1>
          <p className="text-[13px] text-muted-foreground">
            Filing connectivity, email delivery and API keys for your organization.
          </p>
        </div>
        {isPlatformAdmin && (
        <Button size="sm" onClick={handleTestConnection} disabled={testConnection.isPending} className="shrink-0">
          {testConnection.isPending ? <Loader2 className={SPIN} aria-hidden /> : <Zap aria-hidden />}
          Test all connections
        </Button>
        )}
      </header>

      {/* ─── Top stats ──────────────────────────────────── */}
      <dl className={cn(PANEL, 'grid grid-cols-2 divide-border/70 max-md:[&>div:nth-child(n+3)]:border-t md:grid-cols-4 md:divide-x')}>
        <Stat
          label="Filing gateway"
          value={connectionResult ? (connectionResult.connected ? 'Online' : 'Offline') : 'Unchecked'}
          status={connectionResult ? (connectionResult.connected ? 'ok' : 'error') : 'neutral'}
        />
        <Stat
          label="Email service"
          value={emailStatus ? (emailStatus.connected ? 'Online' : 'Offline') : 'Unchecked'}
          status={emailStatus ? (emailStatus.connected ? 'ok' : 'error') : 'neutral'}
        />
        <Stat label="Status poller" value="5 min interval" status="ok" />
        <Stat label="Environment" value={connectionResult?.environment || 'Unchecked'} status={connectionResult?.environment ? 'ok' : 'neutral'} />
      </dl>

      {/* ─── Filing gateway ─────────────────────────────── */}
      <section className={PANEL}>
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold">
              CBP filing gateway
              <span className="rounded-md bg-muted px-1.5 py-px font-mono text-[11.5px] font-normal text-muted-foreground">v2</span>
            </h2>
            <p className="text-[13px] text-muted-foreground">
              Transmits your ISF and entry filings to US Customs and Border Protection.
            </p>
          </div>
          <Button onClick={handleTestConnection} disabled={testConnection.isPending} variant="outline" size="sm">
            {testConnection.isPending ? <Loader2 className={SPIN} aria-hidden /> : <Activity aria-hidden />}
            Test
          </Button>
        </div>
        {connectionResult && (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-border/70 px-5 py-4 sm:grid-cols-3">
            <InfoTile label="Connection" value={connectionResult.connected ? 'Connected' : 'Failed'} variant={connectionResult.connected ? 'ok' : 'error'} />
            <InfoTile label="Environment" value={connectionResult.environment} variant="neutral" uppercase />
            <InfoTile label="Base URL" value={connectionResult.baseUrl} variant="neutral" mono />
          </dl>
        )}

        {/* Capabilities */}
        <div className="border-t border-border/70 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-muted-foreground">Available capabilities</p>
            <span className="text-[12px] tabular-nums text-muted-foreground">
              {capabilities.filter((c) => c.status === 'active').length} / {capabilities.length} active
            </span>
          </div>
          <ul className="mt-2 grid gap-x-8 md:grid-cols-2">
            {capabilities.map((cap) => (
              <li key={cap.label} className="flex min-w-0 items-start justify-between gap-3 border-t border-border/60 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{cap.label}</p>
                  <p className="text-[12.5px] text-muted-foreground">{cap.desc}</p>
                </div>
                <Pill tone={cap.status === 'active' ? 'done' : 'info'}>{cap.status === 'active' ? 'Active' : 'Beta'}</Pill>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── Email notifications ────────────────────────── */}
      <section className={PANEL}>
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold">Email notifications</h2>
            <p className="text-[13px] text-muted-foreground">
              Transactional email delivery via Azure Communication Services.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCheckEmailStatus} disabled={emailChecking} variant="outline" size="sm">
              {emailChecking ? <Loader2 className={SPIN} aria-hidden /> : <Activity aria-hidden />}
              Check status
            </Button>
            <Button onClick={handleSendTestEmail} disabled={emailTesting} size="sm">
              {emailTesting ? <Loader2 className={SPIN} aria-hidden /> : <Send aria-hidden />}
              Send test
            </Button>
          </div>
        </div>
        {emailStatus && (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 border-t border-border/70 px-5 py-4 sm:grid-cols-3">
            <InfoTile
              label="Connection"
              value={
                emailStatus.connected ? 'Connected' : emailStatus.configured ? 'Configured' : 'Not set up'
              }
              variant={emailStatus.connected ? 'ok' : emailStatus.configured ? 'warning' : 'error'}
            />
            <InfoTile label="Provider" value="Azure Comm Services" variant="neutral" />
            <InfoTile label="From address" value={emailStatus.from} variant="neutral" mono />
          </dl>
        )}

        <div className="border-t border-border/70 px-5 py-4">
          <p className="text-[12px] text-muted-foreground">Automated email triggers</p>
          <ul className="mt-2 grid gap-x-8 md:grid-cols-2">
            {emailTriggers.map((trigger) => (
              <li key={trigger.label} className="flex min-w-0 items-start justify-between gap-3 border-t border-border/60 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{trigger.label}</p>
                  <p className="text-[12.5px] text-muted-foreground">{trigger.desc}</p>
                </div>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-done" aria-hidden />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── API keys ────────────────────────────────────── */}
      <ApiKeysCard />
    </div>
  );
}

// ─── API Keys ───────────────────────────────────────────────

function ApiKeysCard() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const canManage = currentUser?.role === 'owner' || currentUser?.role === 'admin';

  const { data, isLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => apiKeysApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; scopes: string[] }) => apiKeysApi.create(body),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.revoke(id),
    onSuccess: () => {
      toast.success('API key revoked');
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
    onError: (err: any) => {
      toast.error(err?.body?.error || err?.message || 'Failed to revoke API key');
    },
  });

  // Create-dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  // The one-time secret, held only until the user dismisses it.
  const [created, setCreated] = useState<ApiKeyCreated | null>(null);

  const keys: ApiKey[] = data?.apiKeys ?? [];
  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);

  const resetForm = () => {
    setName('');
    setScopes([]);
  };

  const toggleScope = (scope: string) => {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (scopes.length === 0) {
      toast.error('Select at least one scope');
      return;
    }
    try {
      const result = await createMutation.mutateAsync({ name: name.trim(), scopes });
      setCreated(result);
      setCreateOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err?.body?.error || err?.message || 'Failed to create API key');
    }
  };

  // After the secret has been shown and dismissed, refresh the list.
  const dismissSecret = () => {
    setCreated(null);
    queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
  };

  const copySecret = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
      toast.success('API key copied to clipboard');
    } catch {
      toast.error('Could not copy. Copy it manually.');
    }
  };

  return (
    <section className={PANEL}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold">API keys</h2>
          <p className="text-[13px] text-muted-foreground">
            Programmatic credentials for the MyCargoLens public API.
          </p>
        </div>
        {canManage && (
          <Dialog
            open={createOpen}
            onOpenChange={(open) => {
              setCreateOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus aria-hidden />
                Create API key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create API key</DialogTitle>
                <DialogDescription>
                  Give the key a name and choose the scopes it can access. The secret is shown only once.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="api-key-name">Name</Label>
                  <Input
                    id="api-key-name"
                    placeholder="e.g. Production server"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Scopes</Label>
                  <div className="grid gap-2">
                    {API_KEY_SCOPES.map((scope) => (
                      <label
                        key={scope.value}
                        htmlFor={`scope-${scope.value}`}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 p-3 transition-colors duration-150 can-hover:hover:bg-muted/50"
                      >
                        <Checkbox
                          id={`scope-${scope.value}`}
                          checked={scopes.includes(scope.value)}
                          onCheckedChange={() => toggleScope(scope.value)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[13px] font-medium">{scope.label}</p>
                          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{scope.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className={SPIN} aria-hidden /> : <KeyRound aria-hidden />}
                  Create key
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* How to use */}
      <p className="border-t border-border/70 px-5 py-4 text-[13px] leading-6 text-muted-foreground">
        Keys authenticate the public API at{' '}
        <code className="break-all rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">{PUBLIC_API_BASE_URL}</code>{' '}
        via the{' '}
        <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px] text-foreground">Authorization: Bearer &lt;key&gt;</code>{' '}
        header.
      </p>

      {isLoading ? (
        <div className="space-y-2 border-t border-border/70 p-4">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : keys.length === 0 ? (
        <div className="border-t border-border/70 px-5 py-10 text-center">
          <p className="text-[14px] font-medium">No API keys yet</p>
          {canManage && (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              Create your first key
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-border/70">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/70">
                <th scope="col" className={TH}>Name</th>
                <th scope="col" className={TH}>Key</th>
                <th scope="col" className={TH}>Scopes</th>
                <th scope="col" className={cn(TH, 'max-md:hidden')}>Last used</th>
                <th scope="col" className={cn(TH, 'max-md:hidden')}>Created</th>
                {canManage && <th scope="col" aria-label="Actions" className="w-12" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {[...activeKeys, ...revokedKeys].map((k) => {
                const isRevoked = !!k.revokedAt;
                return (
                  <tr key={k.id} className={cn(isRevoked && 'text-muted-foreground')}>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <span className={cn('font-medium', isRevoked && 'line-through')}>{k.name}</span>
                        {isRevoked && <Pill tone="urgent">Revoked</Pill>}
                      </div>
                    </td>
                    <td className={cn(TD, 'whitespace-nowrap')}>
                      <code className="font-mono text-[12.5px] text-muted-foreground">{k.prefix}…</code>
                    </td>
                    <td className={TD}>
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map((s) => (
                          <span key={s} className="whitespace-nowrap rounded-md bg-muted px-1.5 py-px font-mono text-[11.5px] text-muted-foreground">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className={cn(TD, 'whitespace-nowrap tabular-nums text-muted-foreground max-md:hidden')}>{fmtKeyRelative(k.lastUsedAt)}</td>
                    <td className={cn(TD, 'whitespace-nowrap tabular-nums text-muted-foreground max-md:hidden')}>{fmtKeyDate(k.createdAt)}</td>
                    {canManage && (
                      <td className="px-2">
                        {!isRevoked && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-urgent hover:text-urgent" aria-label={`Revoke key ${k.name}`}>
                                <Trash2 className="h-4 w-4" aria-hidden />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke "{k.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Any integration using this key will immediately stop working. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => revokeMutation.mutate(k.id)}
                                >
                                  Revoke key
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* One-time secret reveal dialog */}
      <Dialog open={!!created} onOpenChange={(open) => { if (!open) dismissSecret(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key created</DialogTitle>
            <DialogDescription>
              Copy this key now. You won't be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="rounded-lg bg-soon-tint px-4 py-3 text-[13px] text-soon">
              This is the only time the full secret is shown. Store it somewhere safe.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="created-key">Secret key</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="created-key"
                  readOnly
                  value={created?.key ?? ''}
                  className="min-w-0 font-mono text-[12px]"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button variant="outline" size="icon" className="shrink-0" onClick={copySecret} aria-label="Copy key">
                  <Copy className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={dismissSecret}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-medium', TINT[tone])}>
      <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', FILL[tone])} />{children}
    </span>
  );
}

function Stat({ label, value, status }: { label: string; value: string; status: Health }) {
  return (
    <div className="min-w-0 px-5 py-3.5">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="truncate text-[16px] font-semibold leading-6 tabular-nums">{value}</span>
        <Pill tone={HEALTH_TONE[status]}>
          {status === 'ok' ? 'Live' : status === 'error' ? 'Down' : status === 'warning' ? 'Warn' : 'Idle'}
        </Pill>
      </dd>
    </div>
  );
}

function InfoTile({
  label,
  value,
  variant,
  mono,
  uppercase,
}: {
  label: string;
  value: string;
  variant: Health;
  mono?: boolean;
  uppercase?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex min-w-0 items-center gap-2">
        {variant !== 'neutral' && (
          <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', FILL[HEALTH_TONE[variant]])} />
        )}
        <span
          className={cn(
            'truncate text-[14px] font-medium',
            mono && 'font-mono text-[13px]',
            uppercase && 'capitalize',
            variant === 'ok' && 'text-done',
            variant === 'error' && 'text-urgent',
            variant === 'warning' && 'text-soon',
          )}
        >
          {value}
        </span>
      </dd>
    </div>
  );
}
