import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTestCCConnection } from '@/hooks/useFilings';
import { integrationsApi } from '@/api/client';
import {
  CheckCircle2, XCircle, Loader2, Plug, Zap, Search, Activity, Globe, FileText, Mail, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function IntegrationsApi() {
  const testConnection = useTestCCConnection();

  const [connectionResult, setConnectionResult] = useState<{
    connected: boolean; environment: string; baseUrl: string;
  } | null>(null);

  // Email integration state
  const [emailStatus, setEmailStatus] = useState<{
    configured: boolean; connected: boolean; from: string;
  } | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);

  const handleTestConnection = async () => {
    try {
      const result = await testConnection.mutateAsync();
      setConnectionResult(result);
      if (result.connected) {
        toast.success('Connection successful');
      } else {
        toast.error('Connection failed');
      }
    } catch (err: any) {
      toast.error('Connection test failed');
    }
  };

  const handleCheckEmailStatus = async () => {
    setEmailChecking(true);
    try {
      const result = await integrationsApi.getEmailStatus();
      setEmailStatus(result);
      if (result.connected) {
        toast.success('Email SMTP connected');
      } else if (result.configured) {
        toast.error('SMTP configured but connection failed');
      } else {
        toast.warning('Email SMTP not configured');
      }
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
      if (result.success) {
        toast.success(result.message || 'Test email sent! Check your inbox.');
      } else {
        toast.error(result.error || 'Failed to send test email');
      }
    } catch {
      toast.error('Failed to send test email');
    } finally {
      setEmailTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="opacity-0 animate-fade-in-up" style={{ animationFillMode: 'forwards' }}>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
            <Plug className="h-5 w-5 text-white" />
          </div>
          API & Integrations
        </h1>
        <p className="text-muted-foreground text-sm mt-1">CustomsCity API connection status and capabilities</p>
      </div>

      {/* Connection Status */}
      <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '80ms', animationFillMode: 'forwards' }}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Connection Status
          </CardTitle>
          <CardDescription>Test your CustomsCity API connectivity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button onClick={handleTestConnection} disabled={testConnection.isPending}>
              {testConnection.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>

            {connectionResult && (
              <div className="flex items-center gap-2">
                {connectionResult.connected ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Connected</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">Failed</span>
                  </>
                )}
                <Badge variant="secondary" className="text-xs">
                  {connectionResult.environment}
                </Badge>
              </div>
            )}
          </div>

          {connectionResult && (
            <div className="rounded-xl bg-muted/50 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-0.5">Status</p>
                <div className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold',
                  connectionResult.connected
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                )}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', connectionResult.connected ? 'bg-emerald-500' : 'bg-red-500')} />
                  {connectionResult.connected ? 'Online' : 'Offline'}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-0.5">Environment</p>
                <p className="font-semibold capitalize">{connectionResult.environment}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-0.5">Base URL</p>
                <p className="font-mono text-xs truncate">{connectionResult.baseUrl}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Capabilities */}
      <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '160ms', animationFillMode: 'forwards' }}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Available API Capabilities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { icon: FileText, label: 'ISF-10 Filing', desc: 'Importer Security Filing (10+2) — full E2E with CBP', status: 'active' },
              { icon: FileText, label: 'ISF-5 Filing', desc: 'Carrier Security Filing (5+2)', status: 'active' },
              { icon: Activity, label: 'Status Polling', desc: 'Automated CBP response checking every 5 minutes', status: 'active' },
              { icon: Search, label: 'HTS Classification', desc: 'AI-powered tariff code suggestions', status: 'active' },
              { icon: Zap, label: 'Amendment/Cancel', desc: 'File amendments and cancellations via CC API', status: 'active' },
              { icon: Globe, label: 'MID Lookup', desc: 'Manufacturer Identification (MID) database', status: 'beta' },
            ].map((cap, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/30 transition-colors">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <cap.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{cap.label}</p>
                  <p className="text-xs text-muted-foreground">{cap.desc}</p>
                </div>
                <Badge variant={cap.status === 'active' ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
                  {cap.status === 'active' ? '✓ Active' : 'Beta'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email Integration */}
      <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: '240ms', animationFillMode: 'forwards' }}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Email Notifications
          </CardTitle>
          <CardDescription>Azure Communication Services SMTP — transactional email delivery</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleCheckEmailStatus} disabled={emailChecking} variant="outline">
              {emailChecking ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Activity className="h-4 w-4 mr-2" />
              )}
              Check Status
            </Button>

            <Button onClick={handleSendTestEmail} disabled={emailTesting} variant="default">
              {emailTesting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Test Email
            </Button>

            {emailStatus && (
              <div className="flex items-center gap-2">
                {emailStatus.connected ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Connected</span>
                  </>
                ) : emailStatus.configured ? (
                  <>
                    <XCircle className="h-5 w-5 text-amber-500" />
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">Configured but offline</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">Not configured</span>
                  </>
                )}
              </div>
            )}
          </div>

          {emailStatus && (
            <div className="rounded-xl bg-muted/50 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-0.5">Status</p>
                <div className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold',
                  emailStatus.connected
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                )}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', emailStatus.connected ? 'bg-emerald-500' : 'bg-red-500')} />
                  {emailStatus.connected ? 'Online' : 'Offline'}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-0.5">Provider</p>
                <p className="font-semibold">Azure Communication Services</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-0.5">From Address</p>
                <p className="font-mono text-xs truncate">{emailStatus.from}</p>
              </div>
            </div>
          )}

          {/* Email capabilities list */}
          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Automated Email Triggers</p>
            {[
              { label: 'Team Invitations', desc: 'Sent when a team member is invited to the organization' },
              { label: 'Welcome Email', desc: 'Sent after a new user registers' },
              { label: 'Filing Submitted', desc: 'Confirmation when an ISF filing is submitted to CBP' },
              { label: 'Filing Accepted', desc: 'All org members notified when CBP accepts a filing' },
              { label: 'Filing Rejected', desc: 'All org members alerted when CBP rejects a filing' },
              { label: 'Deadline Warning', desc: 'Alerts at 72h, 48h, and 24h before filing deadlines' },
            ].map((trigger, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/30 transition-colors">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{trigger.label}</p>
                  <p className="text-xs text-muted-foreground">{trigger.desc}</p>
                </div>
                <Badge variant="default" className="shrink-0 text-[10px]">✓ Active</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
