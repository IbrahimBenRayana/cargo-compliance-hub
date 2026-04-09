import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  useOrgOverview, useOrgMembers, useChangeRole, useRemoveMember,
  useOrgInvitations, useSendInvitation, useRevokeInvitation,
} from '@/hooks/useFilings';
import { useAuthStore } from '@/hooks/useAuth';
import {
  Users, UserPlus, Mail, Shield, Building2, Crown, Eye,
  Loader2, MoreHorizontal, Trash2, ChevronDown, Clock,
  CheckCircle2, XCircle, Copy, FileText, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; description: string }> = {
  owner: { label: 'Owner', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200', icon: Crown, description: 'Full access, manage team & billing' },
  admin: { label: 'Admin', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Shield, description: 'Manage filings, team members & settings' },
  operator: { label: 'Operator', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: FileText, description: 'Create & manage filings' },
  viewer: { label: 'Viewer', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200', icon: Eye, description: 'View-only access to filings' },
};

const INVITE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-600', icon: XCircle },
  revoked: { label: 'Revoked', color: 'bg-red-100 text-red-800', icon: XCircle },
};

function formatDate(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function relativeTime(ts: string | null) {
  if (!ts) return 'Never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(ts);
}

export default function TeamPage() {
  const currentUser = useAuthStore((s) => s.user);
  const { data: overview, isLoading: overviewLoading } = useOrgOverview();
  const { data: membersData, isLoading: membersLoading } = useOrgMembers();
  const { data: invitationsData, isLoading: invitationsLoading } = useOrgInvitations();
  const changeRole = useChangeRole();
  const removeMember = useRemoveMember();
  const sendInvitation = useSendInvitation();
  const revokeInvitation = useRevokeInvitation();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('operator');

  const members = membersData?.data ?? [];
  const invitations = invitationsData?.data ?? [];
  const isOwnerOrAdmin = currentUser?.role === 'owner' || currentUser?.role === 'admin';
  const pendingInvites = invitations.filter(i => i.status === 'pending').length;

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Email is required');
      return;
    }
    try {
      const result = await sendInvitation.mutateAsync({ email: inviteEmail.trim(), role: inviteRole });
      toast.success(`Invitation sent to ${inviteEmail}`);
      // Copy invite link
      if (result.inviteLink) {
        const fullLink = `${window.location.origin}${result.inviteLink}`;
        await navigator.clipboard.writeText(fullLink);
        toast.info('Invite link copied to clipboard');
      }
      setInviteEmail('');
      setInviteRole('operator');
      setInviteOpen(false);
    } catch (err: any) {
      toast.error(err.body?.error || err.message || 'Failed to send invitation');
    }
  };

  const handleChangeRole = async (memberId: string, role: string) => {
    try {
      await changeRole.mutateAsync({ memberId, role });
      toast.success('Role updated');
    } catch (err: any) {
      toast.error(err.body?.error || err.message || 'Failed to change role');
    }
  };

  const handleRemoveMember = async (memberId: string, email: string) => {
    try {
      await removeMember.mutateAsync(memberId);
      toast.success(`${email} removed from organization`);
    } catch (err: any) {
      toast.error(err.body?.error || err.message || 'Failed to remove member');
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    try {
      await revokeInvitation.mutateAsync(invitationId);
      toast.success('Invitation revoked');
    } catch (err: any) {
      toast.error(err.body?.error || 'Failed to revoke invitation');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Management</h1>
          <p className="text-muted-foreground">
            Manage your organization members and invitations
          </p>
        </div>
        {isOwnerOrAdmin && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join {overview?.name || 'your organization'}.
                  They'll receive a link to create their account.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendInvite()}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['operator', 'admin', 'viewer'] as const).map(r => {
                        const cfg = ROLE_CONFIG[r];
                        return (
                          <SelectItem key={r} value={r}>
                            <div className="flex items-center gap-2">
                              <cfg.icon className="h-3.5 w-3.5" />
                              <span>{cfg.label}</span>
                              <span className="text-xs text-muted-foreground">— {cfg.description}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                <Button onClick={handleSendInvite} disabled={sendInvitation.isPending}>
                  {sendInvitation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Org Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {overviewLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Organization</p>
                  <p className="font-semibold">{overview?.name}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center dark:bg-blue-900">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                  <p className="font-semibold">{overview?._count?.users ?? 0} / {overview?.maxUsers ?? 10}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center dark:bg-green-900">
                  <FileText className="h-5 w-5 text-green-600 dark:text-green-300" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Filings</p>
                  <p className="font-semibold">{overview?._count?.filings ?? 0}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-yellow-100 flex items-center justify-center dark:bg-yellow-900">
                  <Mail className="h-5 w-5 text-yellow-600 dark:text-yellow-300" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Invites</p>
                  <p className="font-semibold">{pendingInvites}</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Members & Invitations Tabs */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            Members ({members.length})
          </TabsTrigger>
          <TabsTrigger value="invitations" className="gap-2">
            <Mail className="h-4 w-4" />
            Invitations
            {pendingInvites > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{pendingInvites}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Team Members</CardTitle>
              <CardDescription>
                People who have access to your organization's filings and data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
                </div>
              ) : members.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No members found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Filings</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Joined</TableHead>
                      {isOwnerOrAdmin && <TableHead className="w-[50px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map(m => {
                      const cfg = ROLE_CONFIG[m.role] || ROLE_CONFIG.viewer;
                      const isCurrentUser = m.id === currentUser?.id;
                      return (
                        <TableRow key={m.id} className={cn(!m.isActive && 'opacity-50')}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-semibold text-primary">
                                {(m.firstName?.[0] || m.email[0]).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {m.firstName} {m.lastName}
                                  {isCurrentUser && <span className="text-muted-foreground ml-1">(you)</span>}
                                </p>
                                <p className="text-xs text-muted-foreground">{m.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={cn('text-xs', cfg.color)}>
                              <cfg.icon className="h-3 w-3 mr-1" />
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">{m._count.filings}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{relativeTime(m.lastLoginAt)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(m.createdAt)}</TableCell>
                          {isOwnerOrAdmin && (
                            <TableCell>
                              {!isCurrentUser && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {(['viewer', 'operator', 'admin'] as const)
                                      .filter(r => r !== m.role)
                                      .map(r => {
                                        const rc = ROLE_CONFIG[r];
                                        return (
                                          <DropdownMenuItem key={r} onClick={() => handleChangeRole(m.id, r)}>
                                            <rc.icon className="h-3.5 w-3.5 mr-2" />
                                            Change to {rc.label}
                                          </DropdownMenuItem>
                                        );
                                      })}
                                    {currentUser?.role === 'owner' && m.role !== 'owner' && (
                                      <DropdownMenuItem onClick={() => handleChangeRole(m.id, 'owner')}>
                                        <Crown className="h-3.5 w-3.5 mr-2" />
                                        Promote to Owner
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-red-600">
                                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                                          Remove Member
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Remove {m.firstName} {m.lastName}?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            This will deactivate their account. Their filings will be preserved, but they won't be able to log in.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            className="bg-red-600 hover:bg-red-700"
                                            onClick={() => handleRemoveMember(m.id, m.email)}
                                          >
                                            Remove
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invitations Tab */}
        <TabsContent value="invitations">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Invitations</CardTitle>
                <CardDescription>Pending and past invitations to your organization.</CardDescription>
              </div>
              {isOwnerOrAdmin && (
                <Button size="sm" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="mr-2 h-3.5 w-3.5" />
                  New Invite
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {invitationsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
                </div>
              ) : invitations.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">No invitations yet</p>
                  {isOwnerOrAdmin && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setInviteOpen(true)}>
                      <UserPlus className="mr-2 h-3.5 w-3.5" />
                      Send first invite
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Invited By</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Expires</TableHead>
                      {isOwnerOrAdmin && <TableHead className="w-[50px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map(inv => {
                      const roleCfg = ROLE_CONFIG[inv.role] || ROLE_CONFIG.viewer;
                      const statusCfg = INVITE_STATUS_CONFIG[inv.status] || INVITE_STATUS_CONFIG.pending;
                      const isExpired = new Date(inv.expiresAt) < new Date() && inv.status === 'pending';
                      return (
                        <TableRow key={inv.id} className={cn(inv.status !== 'pending' && 'opacity-60')}>
                          <TableCell className="font-medium text-sm">{inv.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={cn('text-xs', roleCfg.color)}>
                              {roleCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={cn('text-xs', isExpired ? 'bg-gray-100 text-gray-600' : statusCfg.color)}>
                              <statusCfg.icon className="h-3 w-3 mr-1" />
                              {isExpired ? 'Expired' : statusCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {inv.invitedBy.firstName} {inv.invitedBy.lastName}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(inv.createdAt)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(inv.expiresAt)}</TableCell>
                          {isOwnerOrAdmin && (
                            <TableCell>
                              {inv.status === 'pending' && !isExpired && (
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost" size="icon" className="h-8 w-8"
                                    title="Copy invite link"
                                    onClick={() => {
                                      const link = `${window.location.origin}/register?invite=${(inv as any).token || ''}`;
                                      navigator.clipboard.writeText(link);
                                      toast.success('Invite link copied');
                                    }}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon" className="h-8 w-8 text-red-600"
                                    title="Revoke invitation"
                                    onClick={() => handleRevokeInvite(inv.id)}
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
