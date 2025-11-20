'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  MobileModal, 
  MobileModalContent, 
  MobileModalHeader, 
  MobileModalTitle, 
  MobileModalDescription,
  MobileModalTrigger, 
  MobileModalFooter,
  MobileModalBody 
} from '@/components/ui/mobile-modal';
import { Loader2, Trash2, AlertTriangle, Mail, Shield, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function DeleteAccountSection() {
  const t = useTranslations();
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleteCode, setDeleteCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Función para limpiar el estado cuando se cierra el modal
  const resetDeleteState = () => {
    setDeleteEmail('');
    setDeleteCode('');
    setCodeSent(false);
    setDeleteLoading(false);
    setConfirmDialogOpen(false);
  };

  // Función para manejar el cambio del dialog
  const handleDialogChange = (open: boolean) => {
    setDeleteDialogOpen(open);
    // Si se está cerrando el dialog, limpiar el estado
    if (!open) {
      resetDeleteState();
    }
  };

  const sendDeleteCode = async () => {
    if (!deleteEmail) {
      toast({
        title: t('validation.required'),
        description: t('settings.enterEmail'),
        variant: "destructive",
      });
      return;
    }

    setDeleteLoading(true);
    try {
      const res = await fetch('/api/auth/delete-account/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: deleteEmail })
      });

      const data = await res.json();

      if (res.ok) {
        setCodeSent(true);
        toast({
          title: t('settings.codeSent'),
          description: t('settings.codeSent'),
          className: "bg-green-50 border-green-200",
        });
      } else if (res.status === 429 && data.error === 'rate_limit') {
        // Mostrar mensaje de rate limit con tiempo restante
        toast({
          title: t('common.loading'),
          description: data.message,
          variant: "default",
          className: "bg-yellow-50 border-yellow-200",
        });
      } else {
        toast({
          title: t('common.error'),
          description: data.message || t('settings.codeError'),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error sending delete code:', error);
      toast({
        title: t('common.error'),
        description: t('settings.codeError'),
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteClick = () => {
    if (!deleteEmail || !deleteCode) {
      toast({
        title: t('validation.required'),
        description: t('settings.fillAllFields'),
        variant: "destructive",
      });
      return;
    }
    
    // Abrir el diálogo de confirmación
    setConfirmDialogOpen(true);
  };

  const confirmDeleteAccount = async () => {
    setConfirmDialogOpen(false);
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: deleteEmail,
          code: deleteCode 
        })
      });

      if (res.ok) {
        toast({
          title: t('settings.accountDeleted'),
          description: t('settings.accountDeleted'),
          className: "bg-green-50 border-green-200",
        });
        // Esperar un momento para que el usuario vea el mensaje
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        const error = await res.json();
        toast({
          title: t('common.error'),
          description: error.message || t('settings.deleteError'),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: t('common.error'),
        description: t('settings.deleteError'),
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <Alert className="bg-primary/10 border-primary/30">
        <Shield className="h-4 w-4 text-primary" />
        <AlertDescription className="text-primary">
          {t('settings.securityInfoDesc')}
        </AlertDescription>
      </Alert>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive text-base">{t('settings.dangerZone')}</CardTitle>
        </CardHeader>
        <CardContent>
          <MobileModal open={deleteDialogOpen} onOpenChange={handleDialogChange}>
            <MobileModalTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="h-4 w-4 mr-2" />
                {t('settings.deleteAccount')}
              </Button>
            </MobileModalTrigger>
            <MobileModalContent className="sm:max-w-md">
              <MobileModalHeader>
                <MobileModalTitle className="text-destructive">
                  {t('settings.deleteAccountTitle')}
                </MobileModalTitle>
                <MobileModalDescription>
                  {t('settings.deleteAccountWarning')}
                </MobileModalDescription>
              </MobileModalHeader>

              <MobileModalBody>
                <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('settings.irreversible')}</AlertTitle>
                  <AlertDescription>
                    {t('settings.deleteAccountConsequences')}
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="deleteEmail">{t('settings.confirmEmail')}</Label>
                  <Input
                    id="deleteEmail"
                    type="email"
                    placeholder={t('settings.enterYourEmail')}
                    value={deleteEmail}
                    onChange={(e) => setDeleteEmail(e.target.value)}
                  />
                </div>

                {!codeSent ? (
                  <Button 
                    onClick={sendDeleteCode}
                    disabled={deleteLoading}
                    className="w-full"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {deleteLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('common.sending')}
                      </>
                    ) : (
                      t('settings.sendVerificationCode')
                    )}
                  </Button>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="deleteCode">{t('settings.verificationCode')}</Label>
                      <Input
                        id="deleteCode"
                        type="text"
                        placeholder={t('settings.enterCode')}
                        value={deleteCode}
                        onChange={(e) => setDeleteCode(e.target.value)}
                      />
                    </div>
                  </>
                )}
                </div>
              </MobileModalBody>
              <MobileModalFooter>
                <Button
                  variant="outline"
                  onClick={() => handleDialogChange(false)}
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteClick}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('common.deleting')}
                    </>
                  ) : (
                    t('settings.confirmDelete')
                  )}
                </Button>
              </MobileModalFooter>
            </MobileModalContent>
          </MobileModal>

          {/* Diálogo de confirmación final */}
          <MobileModal open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
            <MobileModalContent className="sm:max-w-md">
              <MobileModalHeader>
                <MobileModalTitle className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  {t('settings.finalConfirmation')}
                </MobileModalTitle>
                <MobileModalDescription className="space-y-3 pt-2">
                  <p className="font-medium">{t('settings.deleteConfirm')}</p>
                  <Alert variant="destructive" className="mt-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {t('settings.deleteAccountFinalWarning')}
                    </AlertDescription>
                  </Alert>
                </MobileModalDescription>
              </MobileModalHeader>
              <MobileModalFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setConfirmDialogOpen(false)}
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDeleteAccount}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('settings.deletingAccount')}
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('settings.yesDeleteAccount')}
                    </>
                  )}
                </Button>
              </MobileModalFooter>
            </MobileModalContent>
          </MobileModal>
        </CardContent>
      </Card>
    </>
  );
}
