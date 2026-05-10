'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Edit3, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/contexts/workspace-context';

interface ProfileClientProps {
  user: any;
}

export function ProfileClient({ user }: ProfileClientProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: user?.user_metadata?.first_name || '',
    last_name: user?.user_metadata?.last_name || '',
    phone: user?.user_metadata?.phone || '',
  });
  const { toast } = useToast();
  const router = useRouter();
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const { refreshUser } = useWorkspace();

  const handleSaveProfile = async () => {
    console.log('[ProfileClient] Saving profile...', formData);
    setIsLoading(true);
    const supabase = createClient();

    try {
      console.log('[ProfileClient] Updating user...');
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          full_name: `${formData.first_name} ${formData.last_name}`.trim(),
          phone: formData.phone || '',
        },
      });

      if (error) {
        console.error('[ProfileClient] Update error:', error);
        throw error;
      }

      console.log('[ProfileClient] User updated successfully');

      // Refresh user context to get updated metadata immediately
      console.log('[ProfileClient] Refreshing user context...');
      await refreshUser();
      console.log('[ProfileClient] User context refreshed');

      toast({
        title: t('profileUpdated'),
        description: t('profileUpdatedDesc'),
      });

      setIsEditing(false);
      router.refresh();
    } catch (error) {
      console.error('[ProfileClient] Error saving profile:', error);
      toast({
        title: t('error'),
        description: t('updateError'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('personalInformation')}</h3>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit3 className="mr-2 h-4 w-4" />
              {t('edit')}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    first_name: user?.user_metadata?.first_name || '',
                    last_name: user?.user_metadata?.last_name || '',
                    phone: user?.user_metadata?.phone || '',
                  });
                }}
              >
                <X className="mr-2 h-4 w-4" />
                {t('cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveProfile}
                disabled={isLoading}
              >
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? tCommon('saving') : t('save')}
              </Button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="first_name">{t('firstName')}</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, first_name: event.target.value }))
                  }
                  placeholder={t('firstNamePlaceholder')}
                />
              </div>
              <div>
                <Label htmlFor="last_name">{t('lastName')}</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, last_name: event.target.value }))
                  }
                  placeholder={t('lastNamePlaceholder')}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="phone">{t('phone')}</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, phone: event.target.value }))
                }
                placeholder={t('phonePlaceholder')}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{t('changeInfo')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
