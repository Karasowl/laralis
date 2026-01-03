'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useClinicMembers } from '@/hooks/use-clinic-members';
import { useCurrentClinic } from '@/hooks/use-current-clinic';
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
import { MoreHorizontal, UserPlus, Building2, Trash2, Edit, Stethoscope, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Can } from '@/components/auth';
import { EditMemberModal } from './EditMemberModal';
import { AddClinicMemberModal } from './AddClinicMemberModal';
import { InviteMemberModal } from './InviteMemberModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import type { ClinicMember, ClinicRole } from '@/lib/permissions/types';

export function ClinicMembersTab() {
  const t = useTranslations('team');
  const { clinic } = useCurrentClinic();
  const { members, loading, removeMember, refetch } = useClinicMembers(clinic?.id);

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<ClinicMember | null>(null);
  const [removingMember, setRemovingMember] = useState<ClinicMember | null>(null);
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

  const getRoleBadgeVariant = (role: ClinicRole) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'doctor':
        return 'secondary';
      case 'assistant':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getRoleIcon = (role: ClinicRole) => {
    if (role === 'doctor') {
      return <Stethoscope className="h-3 w-3 mr-1" />;
    }
    return null;
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
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-medium">
              {t('clinics.title')}
            </CardTitle>
            {clinic && (
              <Badge variant="outline" className="gap-1">
                <Building2 className="h-3 w-3" />
                {clinic.name}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Can permission="team.invite">
              <Button
                size="sm"
                onClick={() => setInviteModalOpen(true)}
                className="gap-2"
                disabled={!clinic}
              >
                <UserPlus className="h-4 w-4" />
                {t('invite.button')}
              </Button>
            </Can>
            <Can permission="team.edit_roles">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddMemberOpen(true)}
                className="gap-2"
                disabled={!clinic}
              >
                <Users className="h-4 w-4" />
                {t('clinics.addMember')}
              </Button>
            </Can>
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('clinics.noMembers')}</p>
              <p className="text-sm mt-2">{t('clinics.noMembersHint')}</p>
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
                    <p className="font-medium truncate">
                      {member.full_name || member.email.split('@')[0]}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="truncate">{member.email}</span>
                      {member.assigned_chair && (
                        <Badge variant="outline" className="text-xs">
                          {t('clinics.chair', { chair: member.assigned_chair })}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Badge
                    variant={getRoleBadgeVariant(member.role)}
                    className="flex items-center"
                  >
                    {getRoleIcon(member.role)}
                    {t(`roles.${member.role}`)}
                  </Badge>

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
                          {t('actions.removeFromClinic')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Can>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editingMember && (
        <EditMemberModal
          open={!!editingMember}
          onOpenChange={(open) => !open && setEditingMember(null)}
          member={editingMember}
          scope="clinic"
          onSuccess={() => {
            setEditingMember(null);
            refetch();
          }}
        />
      )}

      {clinic && (
        <AddClinicMemberModal
          open={addMemberOpen}
          onOpenChange={setAddMemberOpen}
          clinicId={clinic.id}
          existingMembers={members}
          onSuccess={() => {
            setAddMemberOpen(false);
            refetch();
          }}
        />
      )}

      <InviteMemberModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        scope="clinic"
        onSuccess={() => {
          setInviteModalOpen(false);
          refetch();
        }}
      />

      <ConfirmDialog
        open={!!removingMember}
        onOpenChange={(open) => !open && setRemovingMember(null)}
        title={t('actions.confirmRemoveFromClinic')}
        description={t('actions.confirmRemoveFromClinicDescription', {
          name: removingMember?.full_name || removingMember?.email,
          clinic: clinic?.name,
        })}
        confirmText={t('actions.removeFromClinic')}
        variant="destructive"
        onConfirm={handleRemove}
        loading={isRemoving}
      />
    </>
  );
}
