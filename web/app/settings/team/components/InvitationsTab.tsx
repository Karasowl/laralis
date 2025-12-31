'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useInvitations } from '@/hooks/use-invitations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Mail,
  RefreshCw,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  UserPlus,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Can } from '@/components/auth';
import { InviteMemberModal } from './InviteMemberModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useLocale } from 'next-intl';
import type { InvitationWithInviter, InvitationStatus } from '@/lib/permissions/types';

export function InvitationsTab() {
  const t = useTranslations('team');
  const locale = useLocale();
  const {
    invitations,
    pendingInvitations,
    loading,
    resendInvitation,
    cancelInvitation,
    refetch,
  } = useInvitations({ status: 'all' });

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancellingInvitation, setCancellingInvitation] = useState<
    (InvitationWithInviter & { status: InvitationStatus }) | null
  >(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleResend = async (id: string) => {
    setResendingId(id);
    const result = await resendInvitation(id);
    setResendingId(null);

    if (result.success) {
      toast.success(t('invite.resendSuccess'));
    } else {
      toast.error(result.error || t('invite.resendError'));
    }
  };

  const handleCancel = async () => {
    if (!cancellingInvitation) return;

    setIsCancelling(true);
    const result = await cancelInvitation(cancellingInvitation.id);
    setIsCancelling(false);

    if (result.success) {
      toast.success(t('invite.cancelSuccess'));
      setCancellingInvitation(null);
    } else {
      toast.error(result.error || t('invite.cancelError'));
    }
  };

  const getStatusBadge = (status: InvitationStatus) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {t('invite.status.pending')}
          </Badge>
        );
      case 'accepted':
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle className="h-3 w-3" />
            {t('invite.status.accepted')}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="secondary" className="gap-1">
            <XCircle className="h-3 w-3" />
            {t('invite.status.rejected')}
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="destructive" className="gap-1">
            <Clock className="h-3 w-3" />
            {t('invite.status.expired')}
          </Badge>
        );
      default:
        return null;
    }
  };

  const dateLocale = locale === 'es' ? es : enUS;

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
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-medium">
              {t('invitations.title')}
            </CardTitle>
            {pendingInvitations.length > 0 && (
              <Badge variant="secondary">
                {pendingInvitations.length} {t('invitations.pending')}
              </Badge>
            )}
          </div>
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
          {invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('invitations.noInvitations')}</p>
              <p className="text-sm mt-2">{t('invitations.noInvitationsHint')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{invitation.email}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{t(`roles.${invitation.role}`)}</span>
                      <span>•</span>
                      <span>
                        {t('invitations.sentBy', {
                          name: invitation.inviter?.full_name || invitation.inviter?.email,
                        })}
                      </span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(invitation.created_at), {
                          addSuffix: true,
                          locale: dateLocale,
                        })}
                      </span>
                    </div>
                  </div>

                  {getStatusBadge(invitation.status)}

                  {invitation.status === 'pending' && (
                    <Can permission="team.invite">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleResend(invitation.id)}
                            disabled={resendingId === invitation.id}
                          >
                            <RefreshCw
                              className={`h-4 w-4 mr-2 ${
                                resendingId === invitation.id ? 'animate-spin' : ''
                              }`}
                            />
                            {t('invite.resend')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setCancellingInvitation(invitation)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('invite.cancel')}
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

      <ConfirmDialog
        open={!!cancellingInvitation}
        onOpenChange={(open) => !open && setCancellingInvitation(null)}
        title={t('invite.confirmCancel')}
        description={t('invite.confirmCancelDescription', {
          email: cancellingInvitation?.email,
        })}
        confirmText={t('invite.cancel')}
        variant="destructive"
        onConfirm={handleCancel}
        loading={isCancelling}
      />
    </>
  );
}
