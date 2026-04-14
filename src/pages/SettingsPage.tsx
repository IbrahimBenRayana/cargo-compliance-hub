import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useProfile, useUpdateProfile, useChangePassword,
  useOrganization, useUpdateOrganization, useAuditLog, useTestCCConnection,
} from '@/hooks/useFilings';
import {
  User, Building2, Shield, Key, Activity, CheckCircle2, XCircle,
  Loader2, Clock, Users, FileText, Save, Eye, EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: org, isLoading: orgLoading } = useOrganization();
  const { data: auditData, isLoading: auditLoading } = useAuditLog({ limit: 20 });
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const updateOrganization = useUpdateOrganization();
  const testConnection = useTestCCConnection();

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
  const [connectionResult, setConnectionResult] = useState<{ connected: boolean; environment: string; baseUrl: string } | null>(null);

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
      toast.success('Profile updated successfully');
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
      toast.success('Password changed successfully');
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
      toast.success('Organization settings saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update organization');
    }
  };

  const handleTestConnection = async () => {
    try {
      const result = await testConnection.mutateAsync();
      setConnectionResult(result);
      if (result.connected) {
        toast.success('CBP Filing Gateway connection successful');
      } else {
        toast.error('CBP Filing Gateway connection failed');
      }
    } catch (err: any) {
      toast.error('Connection test failed: ' + (err.message || 'Unknown error'));
    }
  };

  if (profileLoading || orgLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[200px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="opacity-0 animate-fade-in-up" style={{ animationFillMode: 'forwards' }}>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-md">
            <Shield className="h-5 w-5 text-white" />
          </div>
          Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account, organization, and integrations</p>
      </div>

      <Tabs defaultValue="profile" className="opacity-0 animate-fade-in-up" style={{ animationDelay: '80ms', animationFillMode: 'forwards' }}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="profile" className="text-xs"><User className="h-3.5 w-3.5 mr-1.5" />Profile</TabsTrigger>
          <TabsTrigger value="organization" className="text-xs"><Building2 className="h-3.5 w-3.5 mr-1.5" />Organization</TabsTrigger>
          <TabsTrigger value="api" className="text-xs"><Key className="h-3.5 w-3.5 mr-1.5" />API</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs"><Activity className="h-3.5 w-3.5 mr-1.5" />Activity</TabsTrigger>
        </TabsList>

        {/* ─── Profile Tab ────────────────────────────────── */}
        <TabsContent value="profile" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Personal Information
              </CardTitle>
              <CardDescription>Update your name and email address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>First Name</Label>
                  <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name</Label>
                  <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email@company.com" />
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleSaveProfile} disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>
                {profile && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                Change Password
              </CardTitle>
              <CardDescription>Update your login password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Current Password</Label>
                <div className="relative">
                  <Input type={showPasswords ? 'text' : 'password'} value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
                  <button onClick={() => setShowPasswords(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>New Password</Label>
                  <Input type={showPasswords ? 'text' : 'password'} value={newPassword}
                    onChange={e => setNewPassword(e.target.value)} placeholder="Min 8 characters" />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm New Password</Label>
                  <Input type={showPasswords ? 'text' : 'password'} value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
                </div>
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
              <Button onClick={handleChangePassword}
                disabled={changePassword.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}>
                {changePassword.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                Change Password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Organization Tab ───────────────────────────── */}
        <TabsContent value="organization" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Company Details
              </CardTitle>
              <CardDescription>Your Importer of Record information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Company Name</Label>
                <Input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Company name" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>IOR Number</Label>
                  <Input value={iorNumber} onChange={e => setIorNumber(e.target.value)} placeholder="IOR-XXXX-XXXX" />
                  <p className="text-[10px] text-muted-foreground">Importer of Record number</p>
                </div>
                <div className="space-y-1.5">
                  <Label>EIN</Label>
                  <Input value={einNumber} onChange={e => setEinNumber(e.target.value)} placeholder="XX-XXXXXXX" />
                  <p className="text-[10px] text-muted-foreground">Employer Identification Number</p>
                </div>
              </div>
              <Button onClick={handleSaveOrg} disabled={updateOrganization.isPending}>
                {updateOrganization.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Organization
              </Button>
            </CardContent>
          </Card>

          {org && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Organization Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-xl bg-muted/50">
                    <Users className="h-5 w-5 text-primary mx-auto mb-1" />
                    <p className="text-2xl font-black tabular-nums">{org._count.users}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Users</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-muted/50">
                    <FileText className="h-5 w-5 text-primary mx-auto mb-1" />
                    <p className="text-2xl font-black tabular-nums">{org._count.filings}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Filings</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-muted/50">
                    <FileText className="h-5 w-5 text-primary mx-auto mb-1" />
                    <p className="text-2xl font-black tabular-nums">{org._count.filingTemplates}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Templates</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── API Tab ────────────────────────────────────── */}
        <TabsContent value="api" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                CBP Filing Gateway
              </CardTitle>
              <CardDescription>Test and manage your filing gateway integration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Button onClick={handleTestConnection} disabled={testConnection.isPending} variant="outline">
                  {testConnection.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Activity className="h-4 w-4 mr-2" />}
                  Test Connection
                </Button>

                {connectionResult && (
                  <div className="flex items-center gap-2">
                    {connectionResult.connected ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Connected</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-red-500" />
                        <span className="text-sm font-medium text-red-600 dark:text-red-400">Disconnected</span>
                      </>
                    )}
                    <Badge variant="secondary" className="text-xs ml-1">
                      {connectionResult.environment}
                    </Badge>
                  </div>
                )}
              </div>

              {connectionResult && (
                <div className="rounded-xl bg-muted/50 p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Environment</p>
                      <p className="font-semibold capitalize">{connectionResult.environment}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">API Base URL</p>
                      <p className="font-mono text-xs">{connectionResult.baseUrl}</p>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-4">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">API Configuration</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Filing gateway API credentials are configured via environment variables on the server
                  (<code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded text-[10px]">CC_API_EMAIL</code>, <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded text-[10px]">CC_API_PASSWORD</code>).
                  Contact your administrator to update API credentials.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Activity Tab ───────────────────────────────── */}
        <TabsContent value="activity" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Audit Log
              </CardTitle>
              <CardDescription>Recent activity across your organization</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
              ) : !auditData?.data?.length ? (
                <div className="text-center py-12">
                  <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">No activity yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Activity will appear here as you use the platform</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {auditData.data.map((log: any) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors border border-transparent hover:border-border/50">
                      <div className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                        log.action.includes('create') ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                        log.action.includes('delete') || log.action.includes('cancel') ? 'bg-red-100 dark:bg-red-900/30' :
                        log.action.includes('submit') ? 'bg-blue-100 dark:bg-blue-900/30' :
                        'bg-muted',
                      )}>
                        <Activity className={cn(
                          'h-4 w-4',
                          log.action.includes('create') ? 'text-emerald-600' :
                          log.action.includes('delete') || log.action.includes('cancel') ? 'text-red-600' :
                          log.action.includes('submit') ? 'text-blue-600' :
                          'text-muted-foreground',
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{formatAction(log.action)}</p>
                          {log.entityType && (
                            <Badge variant="outline" className="text-[9px] shrink-0">{log.entityType}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground">
                            {log.user ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email : 'System'}
                          </p>
                          <span className="text-xs text-muted-foreground">•</span>
                          <p className="text-xs text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatAction(action: string): string {
  return action
    .replace(/\./g, ' › ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
