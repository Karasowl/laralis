'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useWorkspaceMembers } from '@/hooks/use-workspace-members';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, UserPlus, Shield, Trash2, Edit, Crown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Can } from '@/components/auth';
import { InviteMemberModal } from './InviteMemberModal';
import { EditMemberModal } from './EditMemberModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import type { WorkspaceMember, WorkspaceRole } from '@/lib/permissions/types';
import { WORKSPACE_ROLES } from '@/lib/permissions/types';

export function WorkspaceMembersTab() {
  const t = useTranslations('team');
  const { members, loading, removeMember, refetch } = useWorkspaceMembers();
  const { isSuperUser } = usePermissions();

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<WorkspaceMember | null>(null);
  const [removingMember, setRemovingMember] = useState<WorkspaceMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async () => {
    if (!removingMember) return;

    setIsRemoving(true);
    const result = await removeMember(removingMember.id);
    setIsRemoving(false);

    if (result.success) {
      toast.success(t('members.removeSuccess'));
      setRemovingMember(null);
    } else {
      toast.error(result.error || t('members.removeError'));
    }
  };

  const getRoleBadgeVariant = (role: WorkspaceRole) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'super_admin':
        return 'destructive';
      case 'admin':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-medium">
            {t('workspace.title')}
          </CardTitle>
          <Can permission="team.invite">
            <Button
              size="sm"
              onClick={() => setInviteModalOpen(true)}
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              {t('invite.button')}
            </Button>
          </Can>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('workspace.noMembers')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback>
                      {(member.full_name || member.email)
                        .substring(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {member.full_name || member.email.split('@')[0]}
                      </p>
                      {member.role === 'owner' && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {member.email}
                    </p>
                  </div>

                  <Badge variant={getRoleBadgeVariant(member.role)}>
                    {t(`roles.${member.role}`)}
                  </Badge>

                  {/* Only show actions if user has edit_roles permission and is not viewing owner */}
                  {member.role !== 'owner' && (
                    <Can permission="team.edit_roles">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setEditingMember(member)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            {t('actions.editPermissions')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setRemovingMember(member)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('actions.removeAccess')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Can>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <InviteMemberModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        scope="workspace"
        onSuccess={() => {
          setInviteModalOpen(false);
          refetch();
        }}
      />

      {editingMember && (
        <EditMemberModal
          open={!!editingMember}
          onOpenChange={(open) => !open && setEditingMember(null)}
          member={editingMember}
          scope="workspace"
          onSuccess={() => {
            setEditingMember(null);
            refetch();
          }}
        />
      )}

      <ConfirmDialog
        open={!!removingMember}
        onOpenChange={(open) => !open && setRemovingMember(null)}
        title={t('actions.confirmRemove')}
        description={t('actions.confirmRemoveDescription', {
          name: removingMember?.full_name || removingMember?.email,
        })}
        confirmText={t('actions.removeAccess')}
        variant="destructive"
        onConfirm={handleRemove}
        loading={isRemoving}
      />
    </>
  );
}
