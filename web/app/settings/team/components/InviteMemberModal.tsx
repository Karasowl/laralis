'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useInvitations } from '@/hooks/use-invitations';
import { WORKSPACE_ROLES, CLINIC_ROLES } from '@/lib/permissions/types';
import type { WorkspaceRole, ClinicRole, Role } from '@/lib/permissions/types';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.string().min(1),
  message: z.string().max(500).optional(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: 'workspace' | 'clinic';
  onSuccess?: () => void;
}

export function InviteMemberModal({
  open,
  onOpenChange,
  scope,
  onSuccess,
}: InviteMemberModalProps) {
  const t = useTranslations('team');
  const { createInvitation } = useInvitations();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: scope === 'workspace' ? 'editor' : 'doctor',
      message: '',
    },
  });

  const selectedRole = watch('role');

  const roles = scope === 'workspace'
    ? Object.entries(WORKSPACE_ROLES).filter(([key]) => key !== 'owner')
    : Object.entries(CLINIC_ROLES);

  const onSubmit = async (data: InviteFormData) => {
    setIsSubmitting(true);

    const result = await createInvitation({
      email: data.email,
      role: data.role as Role,
      message: data.message || undefined,
    });

    setIsSubmitting(false);

    if (result.success) {
      toast.success(t('invite.success'));
      reset();
      onSuccess?.();
    } else {
      toast.error(result.error || t('invite.error'));
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('invite.title')}</DialogTitle>
          <DialogDescription>{t('invite.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('invite.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('invite.emailPlaceholder')}
              {...register('email')}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{t('invite.invalidEmail')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">{t('invite.role')}</Label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setValue('role', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('invite.selectRole')} />
              </SelectTrigger>
              <SelectContent>
                {roles.map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex flex-col">
                      <span>{t(`roles.${key}`)}</span>
                      <span className="text-xs text-muted-foreground">
                        {value.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">
              {t('invite.message')}{' '}
              <span className="text-muted-foreground text-xs">
                ({t('invite.optional')})
              </span>
            </Label>
            <Textarea
              id="message"
              placeholder={t('invite.messagePlaceholder')}
              rows={3}
              {...register('message')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {t('invite.send')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
