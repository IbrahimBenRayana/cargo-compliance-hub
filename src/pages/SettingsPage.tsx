import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useProfile, useUpdateProfile, useChangePassword,
  useOrganization, useUpdateOrganization, useAuditLog, useTestCCConnection,
} from '@/hooks/useFilings';
import {
  User, Building2, Shield, Key, Activity, CheckCircle2, XCircle,
  Loader2, Clock, Users, FileText, Save, Eye, EyeOff, ChevronRight,
  Mail, CalendarDays, BadgeCheck, Plus, Trash2, Copy, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type SettingsTab = 'profile' | 'organization' | 'api' | 'activity';

const tabs: { id: SettingsTab; label: string; desc: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', desc: 'Personal info & security', icon: User },
  { id: 'organization', label: 'Organization', desc: 'Company & IOR details', icon: Building2 },
  { id: 'api', label: 'API & Integrations', desc: 'Filing gateway connection', icon: Key },
  { id: 'activity', label: 'Audit Log', desc: 'Recent activity', icon: Activity },
];

export default function SettingsPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: org, isLoading: orgLoading } = useOrganization();
  const { data: auditData, isLoading: auditLoading } = useAuditLog({ limit: 30 });
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const updateOrganization = useUpdateOrganization();
  const testConnection = useTestCCConnection();

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Profile form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  // Org form
  const [orgName, setOrgName] = useState('');
  const [iorNumber, setIorNumber] = useState('');
  const [einNumber, setEinNumber] = useState('');

  // Connection test
  const [connectionResult, setConnectionResult] = useState<{
    connected: boolean; environment: string; baseUrl: string;
  } | null>(null);

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
    }
  }, [org]);

  const handleSaveProfile = async () => {
    try {
      await updateProfile.mutateAsync({ firstName, lastName, email });
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      toast.success('Password changed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    }
  };

  const handleSaveOrg = async () => {
    try {
      await updateOrganization.mutateAsync({ name: orgName, iorNumber, einNumber });
      toast.success('Organization saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update organization');
    }
  };

  const handleTestConnection = async () => {
    try {
      const result = await testConnection.mutateAsync();
      setConnectionResult(result);
      if (result.connected) toast.success('CBP Filing Gateway connected');
      else toast.error('CBP Filing Gateway connection failed');
    } catch (err: any) {
      toast.error('Connection test failed: ' + (err.message || 'Unknown error'));
    }
  };

  const initials = ((profile?.firstName?.[0] || '') + (profile?.lastName?.[0] || '')).toUpperCase() || 'U';

  if (profileLoading || orgLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Skeleton className="h-[400px] rounded-2xl" />
          <Skeleton className="h-[600px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between opacity-0 animate-fade-in-up" style={{ animationFillMode: 'forwards' }}>
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account, organization, and platform integrations
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs font-medium">
          <ShieldCheck className="h-3.5 w-3.5" />
          {profile?.role?.toUpperCase() || 'USER'}
        </Badge>
      </div>

      {/* ─── Two-column Layout: Sidebar Nav + Content ─────────── */}
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* ── Left: Profile card + nav (sticky) ── */}
        <aside className="space-y-4 lg:sticky lg:top-[92px] lg:self-start opacity-0 animate-fade-in-up" style={{ animationDelay: '80ms', animationFillMode: 'forwards' }}>
          {/* Profile summary card */}
          <Card className="overflow-hidden">
            <div className="h-16 bg-gradient-to-br from-amber-400/80 via-amber-500/70 to-amber-600/80 relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.2),transparent_60%)]" />
            </div>
            <CardContent className="px-5 pb-5 -mt-8 relative">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 ring-4 ring-background flex items-center justify-center text-white font-bold text-xl tracking-tight shadow-lg">
                {initials}
              </div>
              <div className="mt-3">
                <p className="font-semibold text-foreground tracking-tight truncate">
                  {profile?.firstName} {profile?.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                  <Mail className="h-3 w-3 shrink-0" />
                  {profile?.email}
                </p>
              </div>
              {profile?.createdAt && (
                <div className="mt-3 pt-3 border-t flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vertical tab nav */}
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer',
                    'hover:bg-muted/60',
                    isActive && 'bg-gradient-to-r from-amber-500/10 to-amber-500/5 ring-1 ring-amber-500/20',
                  )}
                >
                  <div
                    className={cn(
                      'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                      isActive
                        ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-amber-950 shadow-sm shadow-amber-500/30'
                        : 'bg-muted text-muted-foreground group-hover:bg-muted-foreground/10',
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-[13px] font-semibold', isActive ? 'text-foreground' : 'text-foreground/80')}>
                      {tab.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{tab.desc}</p>
                  </div>
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 text-muted-foreground shrink-0 transition-transform',
                      isActive && 'translate-x-0.5 text-amber-600',
                    )}
                  />
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Right: Content panel ── */}
        <section className="space-y-6 min-w-0 opacity-0 animate-fade-in-up" style={{ animationDelay: '160ms', animationFillMode: 'forwards' }}>
          {/* ── PROFILE ── */}
          {activeTab === 'profile' && (
            <>
              <Card>
                <CardHeader className="border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-amber-600" />
                    Personal Information
                  </CardTitle>
                  <CardDescription>Update your display name and email address</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">First Name</Label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Name</Label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address</Label>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@company.com" />
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
                      Email verified
                    </p>
                    <Button onClick={handleSaveProfile} disabled={updateProfile.isPending} className="cursor-pointer">
                      {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-600" />
                    Password & Security
                  </CardTitle>
                  <CardDescription>Use a strong password to protect your account</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Password</Label>
                    <div className="relative">
                      <Input
                        type={showPasswords ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((p) => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label={showPasswords ? 'Hide password' : 'Show password'}
                      >
                        {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Password</Label>
                      <Input
                        type={showPasswords ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 8 characters"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm Password</Label>
                      <Input
                        type={showPasswords ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                      />
                    </div>
                  </div>
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleChangePassword}
                      disabled={changePassword.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
                      className="cursor-pointer"
                    >
                      {changePassword.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Shield className="h-4 w-4 mr-2" />
                      )}
                      Update Password
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* ── ORGANIZATION ── */}
          {activeTab === 'organization' && (
            <>
              <Card>
                <CardHeader className="border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-amber-600" />
                    Company Details
                  </CardTitle>
                  <CardDescription>Your Importer of Record information used on filings</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company Name</Label>
                    <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Legal company name" />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">IOR Number</Label>
                      <Input value={iorNumber} onChange={(e) => setIorNumber(e.target.value)} placeholder="XX-XXXXXXXXX" className="font-mono" />
                      <p className="text-[11px] text-muted-foreground">Importer of Record — used on all ISF filings</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">EIN / Tax ID</Label>
                      <Input value={einNumber} onChange={(e) => setEinNumber(e.target.value)} placeholder="XX-XXXXXXX" className="font-mono" />
                      <p className="text-[11px] text-muted-foreground">Employer Identification Number</p>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSaveOrg} disabled={updateOrganization.isPending} className="cursor-pointer">
                      {updateOrganization.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Organization
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {org && (
                <Card>
                  <CardHeader className="border-b">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-amber-600" />
                      Organization Overview
                    </CardTitle>
                    <CardDescription>Resources provisioned on your account</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="relative rounded-xl border bg-gradient-to-br from-slate-50 to-slate-50/50 dark:from-slate-900/50 dark:to-slate-950/30 p-5 overflow-hidden">
                        <Users className="h-5 w-5 text-slate-500 mb-3" />
                        <p className="text-3xl font-bold tabular-nums tracking-tight">{org._count.users}</p>
                        <p className="text-xs text-muted-foreground font-medium mt-1">Active Users</p>
                      </div>
                      <div className="relative rounded-xl border bg-gradient-to-br from-amber-50 to-amber-50/50 dark:from-amber-950/30 dark:to-amber-950/10 p-5 overflow-hidden">
                        <FileText className="h-5 w-5 text-amber-600 mb-3" />
                        <p className="text-3xl font-bold tabular-nums tracking-tight">{org._count.filings}</p>
                        <p className="text-xs text-muted-foreground font-medium mt-1">Total Filings</p>
                      </div>
                      <div className="relative rounded-xl border bg-gradient-to-br from-blue-50 to-blue-50/50 dark:from-blue-950/30 dark:to-blue-950/10 p-5 overflow-hidden">
                        <FileText className="h-5 w-5 text-blue-600 mb-3" />
                        <p className="text-3xl font-bold tabular-nums tracking-tight">{org._count.filingTemplates}</p>
                        <p className="text-xs text-muted-foreground font-medium mt-1">Templates</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* ── API ── */}
          {activeTab === 'api' && (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="h-4 w-4 text-amber-600" />
                  CBP Filing Gateway
                </CardTitle>
                <CardDescription>Test and manage your filing gateway integration</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">
                <div className="flex items-center gap-3 flex-wrap">
                  <Button onClick={handleTestConnection} disabled={testConnection.isPending} variant="outline" className="cursor-pointer">
                    {testConnection.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Activity className="h-4 w-4 mr-2" />
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
                      <Badge variant="secondary" className="text-xs ml-1">
                        {connectionResult.environment}
                      </Badge>
                    </div>
                  )}
                </div>

                {connectionResult && (
                  <div className="rounded-xl border bg-muted/30 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Status</p>
                      <div
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold',
                          connectionResult.connected
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', connectionResult.connected ? 'bg-emerald-500' : 'bg-red-500')} />
                        {connectionResult.connected ? 'Online' : 'Offline'}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Environment</p>
                      <p className="font-semibold capitalize">{connectionResult.environment}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">API Base URL</p>
                      <p className="font-mono text-xs truncate">{connectionResult.baseUrl}</p>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 p-4 flex gap-3">
                  <Key className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    <p className="font-semibold mb-1">API Credentials Managed Server-Side</p>
                    <p className="text-amber-700 dark:text-amber-400/90">
                      Filing gateway credentials are configured via environment variables on the server
                      (<code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded font-mono">CC_API_EMAIL</code>,
                      {' '}<code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded font-mono">CC_API_PASSWORD</code>).
                      Contact your administrator to update them.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── ACTIVITY ── */}
          {activeTab === 'activity' && (
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-amber-600" />
                      Audit Log
                    </CardTitle>
                    <CardDescription className="mt-1">Immutable record of recent actions across your organization</CardDescription>
                  </div>
                  {auditData?.data?.length ? (
                    <Badge variant="secondary" className="text-[11px]">{auditData.data.length} events</Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {auditLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
                  </div>
                ) : !auditData?.data?.length ? (
                  <div className="text-center py-16">
                    <div className="h-12 w-12 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-3">
                      <Activity className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No activity yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Activity will appear here as you use the platform</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {auditData.data.map((log: any) => {
                      const actionType = log.action.includes('create') ? 'create'
                        : log.action.includes('delete') || log.action.includes('cancel') ? 'delete'
                        : log.action.includes('submit') ? 'submit'
                        : 'other';
                      const ActionIcon = actionType === 'create' ? Plus
                        : actionType === 'delete' ? Trash2
                        : actionType === 'submit' ? Copy
                        : Activity;
                      return (
                        <div
                          key={log.id}
                          className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors border border-transparent hover:border-border/60 cursor-default"
                        >
                          <div
                            className={cn(
                              'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
                              actionType === 'create' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                              actionType === 'delete' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                              actionType === 'submit' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                              actionType === 'other' && 'bg-muted text-muted-foreground',
                            )}
                          >
                            <ActionIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold truncate">{formatAction(log.action)}</p>
                              {log.entityType && (
                                <Badge variant="outline" className="text-[9px] shrink-0 font-mono">
                                  {log.entityType}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-muted-foreground truncate">
                                {log.user
                                  ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email
                                  : 'System'}
                              </p>
                              <span className="text-xs text-muted-foreground">•</span>
                              <p className="text-xs text-muted-foreground tabular-nums shrink-0">
                                {new Date(log.createdAt).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

function formatAction(action: string): string {
  return action
    .replace(/\./g, ' › ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
