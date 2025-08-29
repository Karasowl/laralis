'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Edit3, Save, X, Key, Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import { createSupabaseClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { DeleteAccountDialog } from '@/components/profile/DeleteAccountDialog';

interface ProfileClientProps {
  user: any;
}

export function ProfileClient({ user }: ProfileClientProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    first_name: user?.user_metadata?.first_name || '',
    last_name: user?.user_metadata?.last_name || '',
    phone: user?.phone || ''
  });
  const { toast } = useToast();
  const router = useRouter();
  const t = useTranslations('profile');

  const handleSaveProfile = async () => {
    setIsLoading(true);
    const supabase = createSupabaseClient();
    
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          full_name: `${formData.first_name} ${formData.last_name}`.trim()
        },
        phone: formData.phone || undefined
      });

      if (error) throw error;

      toast({
        title: t('profileUpdated'),
        description: t('profileUpdatedDesc')
      });
      
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      toast({
        title: t('error'),
        description: t('updateError'),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <>
      {/* Editar Información Personal */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{t('personalInformation')}</h3>
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit3 className="h-4 w-4 mr-2" />
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
                      phone: user?.phone || ''
                    });
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  {t('cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveProfile}
                  disabled={isLoading}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {t('save')}
                </Button>
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">{t('firstName')}</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder={t('firstNamePlaceholder')}
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">{t('lastName')}</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder={t('lastNamePlaceholder')}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">{t('phone')}</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
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

      {/* Seguridad */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">{t('security')}</h3>
          
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled
            >
              <Key className="h-4 w-4 mr-2" />
              {t('changePassword')}
              <span className="ml-auto text-xs text-muted-foreground">{t('comingSoon')}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Zona de Peligro */}
      <Card className="border-destructive/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="text-lg font-semibold text-destructive">{t('dangerZone')}</h3>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            {t('dangerDescription')}
          </p>

          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('deleteAccount')}
          </Button>
        </CardContent>
      </Card>

      {/* Diálogo de eliminación de cuenta */}
      <DeleteAccountDialog 
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        userEmail={user?.email || ''}
      />
    </>
  );
}