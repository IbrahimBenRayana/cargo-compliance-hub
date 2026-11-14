/**
 * Team: who is in the organization and which invitations are out. Owners and
 * admins can invite, change roles, remove people and revoke invitations.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { FILL, TINT, type Tone } from '@/components/dashboard/tones';
import { Copy, Crown, Eye, FileText, Loader2, MoreHorizontal, Shield, Trash2, UserPlus, XCircle, type IconType } from '@/components/icons';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/hooks/useAuth';
import {
  useChangeRole, useOrgInvitations, useOrgMembers, useOrgOverview, useRemoveMember, useRevokeInvitation, useSendInvitation,
} from '@/hooks/useFilings';
import { cn } from '@/lib/utils';

const PAGE = 'mx-auto flex max-w-[1360px] flex-col gap-5 -mx-2 sm:mx-auto pb-24 sm:pb-12';
const PANEL = 'overflow-hidden rounded-xl border border-border/70 bg-card shadow-card';
const TH = 'px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground';
const TD = 'px-4 py-2.5';
const TAB = '-mb-px rounded-none border-b-2 border-transparent px-0 pb-2.5 pt-1 text-[13px] font-medium text-muted-foreground shadow-none transition-colors duration-150 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none can-hover:hover:text-foreground';

const ROLES: Record<string, { label: string; icon: IconType; can: string }> = {
  owner: { label: 'Owner', icon: Crown, can: 'Everything, including the team and billing' },
  admin: { label: 'Admin', icon: Shield, can: 'Filings, the team and settings' },
  operator: { label: 'Operator', icon: FileText, can: 'Create and manage filings' },
  viewer: { label: 'Viewer', icon: Eye, can: 'Read filings only' },
};

const INVITE_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'soon' },
  accepted: { label: 'Accepted', tone: 'done' },
  expired: { label: 'Expired', tone: 'calm' },
  revoked: { label: 'Revoked', tone: 'urgent' },
};

function day(ts: string | null) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function lastActive(ts: string | null) {
  if (!ts) return 'Never';
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 30 ? `${days}d ago` : day(ts);
}

function Role({ role }: { role: string }) {
  const r = ROLES[role] ?? ROLES.viewer;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]">
      <r.icon weight="duotone" className={cn('h-4 w-4', role === 'owner' ? 'text-soon' : 'text-muted-foreground')} aria-hidden />{r.label}
    </span>
  );
}

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[12px] font-medium', TINT[tone])}>
      <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', FILL[tone])} />{children}
    </span>
  );
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
  // A pending invitation past its expiry shows as expired, so it is not counted as pending.
  const pendingInvites = invitations.filter((i) => i.status === 'pending' && new Date(i.expiresAt) >= new Date()).length;

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Email is required');
      return;
    }
    try {
      const result = await sendInvitation.mutateAsync({ email: inviteEmail.trim(), role: inviteRole });
      toast.success(`Invitation sent to ${inviteEmail}`);
      if (result.inviteLink) {
        const fullLink = `${window.location.origin}${result.inviteLink}`;
        await navigator.clipboard.writeText(fullLink);
        toast.info('Invite link copied');
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

  const copyInviteLink = async (token: string | undefined) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/register?invite=${token || ''}`);
      toast.success('Invite link copied');
    } catch {
      toast.error('The link could not be copied.');
    }
  };

  const facts: Array<[string, React.ReactNode]> = [
    ['Organization', overview?.name],
    ['Members', `${overview?._count?.users ?? 0} of ${overview?.maxUsers ?? 10}`],
    ['Filings', (overview?._count?.filings ?? 0).toLocaleString()],
    ['Pending invitations', pendingInvites],
  ];

  return (
    <div className={PAGE}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.015em]">Team</h1>
          <p className="text-[13px] text-muted-foreground">Who can work in your organization, and the invitations that are out.</p>
        </div>
        {isOwnerOrAdmin && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><UserPlus aria-hidden />Invite member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite team member</DialogTitle>
                <DialogDescription>
                  They get an email with a link to join {overview?.name || 'your organization'} and set a password.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input
                    id="invite-email" type="email" placeholder="colleague@company.com" autoComplete="off"
                    value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['operator', 'admin', 'viewer'] as const).map((r) => (
                        <SelectItem key={r} value={r}>
                          <span className="font-medium">{ROLES[r].label}</span>
                          <span className="ml-2 text-[12.5px] text-muted-foreground">{ROLES[r].can}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                <Button onClick={handleSendInvite} disabled={sendInvitation.isPending}>
                  {sendInvitation.isPending && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}Send invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </header>

      {overviewLoading ? (
        <Skeleton className="h-[74px] rounded-xl" />
      ) : (
        <dl className={cn(PANEL, 'grid grid-cols-2 divide-border/70 max-md:[&>div:nth-child(n+3)]:border-t md:grid-cols-4 md:divide-x')}>
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0 px-5 py-3.5">
              <dt className="text-[12px] text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 truncate text-[16px] font-semibold leading-6 tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <Tabs defaultValue="members" className="flex min-w-0 flex-col gap-5">
        <TabsList className="h-auto w-full justify-start gap-5 rounded-none border-b border-border/70 bg-transparent p-0">
          <TabsTrigger value="members" className={TAB}>
            Members <span className="ml-1.5 rounded-md bg-muted px-1.5 py-px text-[11.5px] tabular-nums text-muted-foreground">{members.length}</span>
          </TabsTrigger>
          <TabsTrigger value="invitations" className={TAB}>
            Invitations
            {pendingInvites > 0 && <span className={cn('ml-1.5 rounded-md px-1.5 py-px text-[11.5px] font-medium tabular-nums', TINT.soon)}>{pendingInvites}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-0 min-w-0">
          <section aria-label="Members" className={PANEL}>
            {membersLoading ? (
              <div className="space-y-2 p-4">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-11" />)}</div>
            ) : members.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">No members to show.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border/70">
                      <th scope="col" className={TH}>Member</th>
                      <th scope="col" className={TH}>Role</th>
                      <th scope="col" className={cn(TH, 'text-right')}>Filings</th>
                      <th scope="col" className={cn(TH, 'max-md:hidden')}>Last active</th>
                      <th scope="col" className={cn(TH, 'max-md:hidden')}>Joined</th>
                      {isOwnerOrAdmin && <th scope="col" aria-label="Actions" className="w-12" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {members.map((m) => {
                      const isCurrentUser = m.id === currentUser?.id;
                      const name = `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email;
                      return (
                        <tr key={m.id} className={cn(!m.isActive && 'opacity-55')}>
                          <td className={TD}>
                            <div className="flex items-center gap-3">
                              <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-[13px] font-semibold">
                                {(m.firstName?.[0] || m.email[0]).toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {name}{isCurrentUser && <span className="ml-1.5 font-normal text-muted-foreground">you</span>}
                                  {!m.isActive && <span className="ml-1.5 font-normal text-muted-foreground">removed</span>}
                                </p>
                                <p className="truncate text-[12.5px] text-muted-foreground">{m.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className={TD}><Role role={m.role} /></td>
                          <td className={cn(TD, 'text-right tabular-nums')}>{m._count.filings.toLocaleString()}</td>
                          <td className={cn(TD, 'whitespace-nowrap text-muted-foreground max-md:hidden')}>{lastActive(m.lastLoginAt)}</td>
                          <td className={cn(TD, 'whitespace-nowrap tabular-nums text-muted-foreground max-md:hidden')}>{day(m.createdAt)}</td>
                          {isOwnerOrAdmin && (
                            <td className="px-2">
                              {!isCurrentUser && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${name}`}>
                                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {(['viewer', 'operator', 'admin'] as const).filter((r) => r !== m.role).map((r) => {
                                      const Icon = ROLES[r].icon;
                                      return (
                                        <DropdownMenuItem key={r} onClick={() => handleChangeRole(m.id, r)}>
                                          <Icon className="mr-2 h-4 w-4" aria-hidden />Make {ROLES[r].label.toLowerCase()}
                                        </DropdownMenuItem>
                                      );
                                    })}
                                    {currentUser?.role === 'owner' && m.role !== 'owner' && (
                                      <DropdownMenuItem onClick={() => handleChangeRole(m.id, 'owner')}>
                                        <Crown className="mr-2 h-4 w-4" aria-hidden />Make owner
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-urgent focus:text-urgent">
                                          <Trash2 className="mr-2 h-4 w-4" aria-hidden />Remove member
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Their account is deactivated and they can no longer sign in. Their filings stay.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleRemoveMember(m.id, m.email)}>
                                            Remove
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </DropdownMenuContent>
                                </DropdownMenu>
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
          </section>
        </TabsContent>

        <TabsContent value="invitations" className="mt-0 min-w-0">
          <section aria-label="Invitations" className={PANEL}>
            {invitationsLoading ? (
              <div className="space-y-2 p-4">{Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : invitations.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-[14px] font-medium">No invitations sent yet.</p>
                <p className="mt-1 text-[13px] text-muted-foreground">Each one you send is listed here until it is accepted, expires or is revoked.</p>
                {isOwnerOrAdmin && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setInviteOpen(true)}><UserPlus aria-hidden />Invite member</Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border/70">
                      <th scope="col" className={TH}>Email</th>
                      <th scope="col" className={TH}>Role</th>
                      <th scope="col" className={TH}>Status</th>
                      <th scope="col" className={cn(TH, 'max-md:hidden')}>Invited by</th>
                      <th scope="col" className={cn(TH, 'max-md:hidden')}>Sent</th>
                      <th scope="col" className={cn(TH, 'max-sm:hidden')}>Expires</th>
                      {isOwnerOrAdmin && <th scope="col" aria-label="Actions" className="w-24" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {invitations.map((inv) => {
                      const lapsed = inv.status === 'pending' && new Date(inv.expiresAt) < new Date();
                      const status = INVITE_STATUS[lapsed ? 'expired' : inv.status] ?? INVITE_STATUS.pending;
                      const open = inv.status === 'pending' && !lapsed;
                      return (
                        <tr key={inv.id} className={cn(!open && 'text-muted-foreground')}>
                          <td className={cn(TD, 'font-medium')}>{inv.email}</td>
                          <td className={TD}><Role role={inv.role} /></td>
                          <td className={TD}><Pill tone={status.tone}>{status.label}</Pill></td>
                          <td className={cn(TD, 'text-muted-foreground max-md:hidden')}>{inv.invitedBy.firstName} {inv.invitedBy.lastName}</td>
                          <td className={cn(TD, 'whitespace-nowrap tabular-nums text-muted-foreground max-md:hidden')}>{day(inv.createdAt)}</td>
                          <td className={cn(TD, 'whitespace-nowrap tabular-nums text-muted-foreground max-sm:hidden')}>{day(inv.expiresAt)}</td>
                          {isOwnerOrAdmin && (
                            <td className="px-2">
                              {open && (
                                <div className="flex justify-end gap-0.5">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Copy invite link for ${inv.email}`} onClick={() => copyInviteLink((inv as { token?: string }).token)}>
                                    <Copy className="h-4 w-4" aria-hidden />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-urgent hover:text-urgent" aria-label={`Revoke invitation for ${inv.email}`}>
                                        <XCircle className="h-4 w-4" aria-hidden />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Revoke this invitation?</AlertDialogTitle>
                                        <AlertDialogDescription>The link sent to {inv.email} stops working. You can invite them again later.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleRevokeInvite(inv.id)}>Revoke</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
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
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
