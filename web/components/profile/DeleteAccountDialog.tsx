'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

export function DeleteAccountDialog({ 
  open, 
  onOpenChange, 
  userEmail 
}: DeleteAccountDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('profile');

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') return;
    
    setIsDeleting(true);
    
    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete account');
      }

      toast({
        title: t('deletionTitle'),
        description: t('deletionDesc')
      });
      
      // Redirect to home page after short delay
      setTimeout(() => {
        router.push('/');
      }, 2000);
      
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: t('error'),
        description: t('deleteError'),
        variant: "destructive"
      });
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">
              {t('deleteConfirm')}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="mt-4 space-y-3">
            <p>{t('deleteDescription')}</p>
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
              <p className="text-sm font-medium text-destructive">
                {t('deleteWarning')}
              </p>
              <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                <li>• {t('deleteData1')}</li>
                <li>• {t('deleteData2')}</li>
                <li>• {t('deleteData3')}</li>
                <li>• {t('deleteData4')}</li>
              </ul>
            </div>
            <div className="space-y-2 pt-2">
              <Label htmlFor="confirm-delete">
                {t('typeDeleteToConfirm')}
              </Label>
              <Input
                id="confirm-delete"
                placeholder="DELETE"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="font-mono"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={() => {
              setConfirmText('');
              onOpenChange(false);
            }}
            disabled={isDeleting}
          >
            {t('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteAccount}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={confirmText !== 'DELETE' || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('deleting')}
              </>
            ) : (
              t('yesDelete')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}