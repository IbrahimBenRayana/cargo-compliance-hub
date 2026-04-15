import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTestCCConnection } from '@/hooks/useFilings';
import { integrationsApi } from '@/api/client';
import {
  CheckCircle2, XCircle, Loader2, Plug, Zap, Search, Activity, Globe,
  FileText, Mail, Send, Server, ShieldCheck, Radio, Sparkles, ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function IntegrationsApi() {
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
    { icon: FileText, label: 'ISF-10 Filing', desc: 'Importer Security Filing (10+2) — full E2E with CBP', status: 'active' as const },
    { icon: FileText, label: 'ISF-5 Filing', desc: 'Carrier Security Filing (5+2)', status: 'active' as const },
    { icon: Radio, label: 'Status Polling', desc: 'Automated CBP response checking every 5 minutes', status: 'active' as const },
    { icon: Search, label: 'HTS Classification', desc: 'AI-powered tariff code suggestions', status: 'active' as const },
    { icon: Zap, label: 'Amendment & Cancel', desc: 'File amendments and cancellations via filing gateway', status: 'active' as const },
    { icon: Globe, label: 'MID Lookup', desc: 'Manufacturer Identification (MID) database', status: 'beta' as const },
  ];

  const emailTriggers = [
    { label: 'Team Invitations', desc: 'Sent when a team member is invited to the organization' },
    { label: 'Welcome Email', desc: 'Sent after a new user registers' },
    { label: 'Filing Submitted', desc: 'Confirmation when an ISF filing is submitted to CBP' },
    { label: 'Filing Accepted', desc: 'All org members notified when CBP accepts a filing' },
    { label: 'Filing Rejected', desc: 'All org members alerted when CBP rejects a filing' },
    { label: 'Deadline Warning', desc: 'Alerts at 72h, 48h, and 24h before filing deadlines' },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 opacity-0 animate-fade-in-up" style={{ animationFillMode: 'forwards' }}>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-bold tracking-tight text-foreground">API & Integrations</h1>
            <Badge variant="secondary" className="gap-1 text-[10px] font-bold uppercase tracking-wider px-2">
              <Sparkles className="h-3 w-3" />
              Live
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage your filing gateway connectivity, email delivery, and data services
          </p>
        </div>
        <Button onClick={handleTestConnection} disabled={testConnection.isPending} className="cursor-pointer shrink-0">
          {testConnection.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Zap className="h-4 w-4 mr-2" />
          )}
          Test All Connections
        </Button>
      </div>

      {/* ─── Top Stat Cards ─────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Plug}
          label="Filing Gateway"
          value={connectionResult ? (connectionResult.connected ? 'Online' : 'Offline') : 'Unchecked'}
          status={connectionResult ? (connectionResult.connected ? 'ok' : 'error') : 'neutral'}
          delay={80}
        />
        <StatCard
          icon={Mail}
          label="Email Service"
          value={emailStatus ? (emailStatus.connected ? 'Online' : 'Offline') : 'Unchecked'}
          status={emailStatus ? (emailStatus.connected ? 'ok' : 'error') : 'neutral'}
          delay={160}
        />
        <StatCard
          icon={Radio}
          label="Status Poller"
          value="5 min interval"
          status="ok"
          delay={240}
        />
        <StatCard
          icon={ShieldCheck}
          label="Environment"
          value={connectionResult?.environment || 'Production'}
          status="ok"
          delay={320}
        />
      </div>

      {/* ─── Filing Gateway Card ────────────────────────── */}
      <Card className="opacity-0 animate-fade-in-up overflow-hidden" style={{ animationDelay: '380ms', animationFillMode: 'forwards' }}>
        <CardHeader className="border-b bg-gradient-to-r from-amber-500/5 via-transparent to-transparent">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/30">
                <Plug className="h-5 w-5 text-amber-950" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  CBP Filing Gateway
                  <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">v2</span>
                </CardTitle>
                <CardDescription className="mt-0.5">
                  Direct integration with US Customs &amp; Border Protection for ISF filings
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={handleTestConnection}
              disabled={testConnection.isPending}
              variant="outline"
              size="sm"
              className="cursor-pointer"
            >
              {testConnection.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
              ) : (
                <Activity className="h-3.5 w-3.5 mr-2" />
              )}
              Test
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          {connectionResult && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <InfoTile label="Connection" value={connectionResult.connected ? 'Connected' : 'Failed'} variant={connectionResult.connected ? 'ok' : 'error'} />
              <InfoTile label="Environment" value={connectionResult.environment} variant="neutral" uppercase />
              <InfoTile label="Base URL" value={connectionResult.baseUrl} variant="neutral" mono />
            </div>
          )}

          {/* Capabilities grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Available Capabilities
              </p>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {capabilities.filter((c) => c.status === 'active').length} / {capabilities.length} active
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {capabilities.map((cap) => (
                <div
                  key={cap.label}
                  className="group flex items-start gap-3 p-4 rounded-xl border bg-card hover:bg-muted/40 hover:border-amber-500/30 transition-all cursor-default"
                >
                  <div
                    className={cn(
                      'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105',
                      cap.status === 'active'
                        ? 'bg-gradient-to-br from-amber-400/20 to-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <cap.icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{cap.label}</p>
                      <Badge
                        variant={cap.status === 'active' ? 'default' : 'secondary'}
                        className={cn(
                          'text-[9px] px-1.5 py-0 h-4 uppercase font-bold tracking-wider',
                          cap.status === 'active' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20',
                        )}
                      >
                        {cap.status === 'active' ? 'Active' : 'Beta'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{cap.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Email Integration Card ─────────────────────── */}
      <Card className="opacity-0 animate-fade-in-up overflow-hidden" style={{ animationDelay: '460ms', animationFillMode: 'forwards' }}>
        <CardHeader className="border-b bg-gradient-to-r from-blue-500/5 via-transparent to-transparent">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shadow-blue-500/30">
                <Mail className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">Email Notifications</CardTitle>
                <CardDescription className="mt-0.5">
                  Transactional email delivery via Azure Communication Services
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCheckEmailStatus}
                disabled={emailChecking}
                variant="outline"
                size="sm"
                className="cursor-pointer"
              >
                {emailChecking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                ) : (
                  <Activity className="h-3.5 w-3.5 mr-2" />
                )}
                Check Status
              </Button>
              <Button onClick={handleSendTestEmail} disabled={emailTesting} size="sm" className="cursor-pointer">
                {emailTesting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-2" />
                )}
                Send Test
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          {emailStatus && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <InfoTile
                label="Connection"
                value={
                  emailStatus.connected ? 'Connected' : emailStatus.configured ? 'Configured' : 'Not set up'
                }
                variant={emailStatus.connected ? 'ok' : emailStatus.configured ? 'warning' : 'error'}
              />
              <InfoTile label="Provider" value="Azure Comm Services" variant="neutral" />
              <InfoTile label="From Address" value={emailStatus.from} variant="neutral" mono />
            </div>
          )}

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Automated Email Triggers
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {emailTriggers.map((trigger) => (
                <div
                  key={trigger.label}
                  className="flex items-start gap-3 p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors cursor-default"
                >
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{trigger.label}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{trigger.desc}</p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-1" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  status,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  status: 'ok' | 'error' | 'warning' | 'neutral';
  delay: number;
}) {
  return (
    <Card
      className="relative overflow-hidden opacity-0 animate-fade-in-up hover:shadow-md transition-shadow"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div
            className={cn(
              'h-10 w-10 rounded-xl flex items-center justify-center',
              status === 'ok' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              status === 'error' && 'bg-red-500/10 text-red-600 dark:text-red-400',
              status === 'warning' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
              status === 'neutral' && 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
              status === 'ok' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
              status === 'error' && 'bg-red-500/15 text-red-700 dark:text-red-400',
              status === 'warning' && 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
              status === 'neutral' && 'bg-muted text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                status === 'ok' && 'bg-emerald-500 animate-pulse',
                status === 'error' && 'bg-red-500',
                status === 'warning' && 'bg-amber-500',
                status === 'neutral' && 'bg-muted-foreground/60',
              )}
            />
            {status === 'ok' ? 'Live' : status === 'error' ? 'Down' : status === 'warning' ? 'Warn' : 'Idle'}
          </span>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tracking-tight mt-1 truncate">{value}</p>
      </CardContent>
    </Card>
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
  variant: 'ok' | 'error' | 'warning' | 'neutral';
  mono?: boolean;
  uppercase?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3.5 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        {variant !== 'neutral' && (
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full shrink-0',
              variant === 'ok' && 'bg-emerald-500',
              variant === 'error' && 'bg-red-500',
              variant === 'warning' && 'bg-amber-500',
            )}
          />
        )}
        <p
          className={cn(
            'text-sm font-semibold truncate',
            mono && 'font-mono text-xs',
            uppercase && 'capitalize',
            variant === 'ok' && 'text-emerald-700 dark:text-emerald-400',
            variant === 'error' && 'text-red-700 dark:text-red-400',
            variant === 'warning' && 'text-amber-700 dark:text-amber-400',
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
