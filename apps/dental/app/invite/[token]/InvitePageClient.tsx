'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useInvitation } from '@/hooks/use-invitations';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Building2,
  User,
  Loader2,
  LogIn,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

interface InvitePageClientProps {
  token: string;
}

export function InvitePageClient({ token }: InvitePageClientProps) {
  const t = useTranslations('invite');
  const locale = useLocale();
  const router = useRouter();
  const { invitation, loading, error, accept, reject } = useInvitation(token);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [status, setStatus] = useState<'pending' | 'accepted' | 'rejected' | 'error'>('pending');

  const dateLocale = locale === 'es' ? es : enUS;

  // Check auth status
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };
    checkAuth();
  }, []);

  const handleAccept = async () => {
    setIsAccepting(true);
    const result = await accept();
    setIsAccepting(false);

    if (result.success) {
      setStatus('accepted');
      toast.success(t('acceptSuccess'));
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } else {
      toast.error(result.error || t('acceptError'));
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    const result = await reject();
    setIsRejecting(false);

    if (result.success) {
      setStatus('rejected');
      toast.success(t('rejectSuccess'));
    } else {
      toast.error(result.error || t('rejectError'));
    }
  };

  const handleLogin = () => {
    // Redirect to login with return URL
    const returnUrl = encodeURIComponent(`/invite/${token}`);
    router.push(`/login?returnUrl=${returnUrl}`);
  };

  const handleSignup = () => {
    // Redirect to signup with return URL and pre-filled email
    const returnUrl = encodeURIComponent(`/invite/${token}`);
    const email = encodeURIComponent(invitation?.email || '');
    router.push(`/signup?returnUrl=${returnUrl}&email=${email}`);
  };

  // Loading state
  if (loading || isAuthenticated === null) {
    return (
      <Card>
        <CardHeader className="text-center">
          <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
          <Skeleton className="h-6 w-48 mx-auto mb-2" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
        <CardFooter className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
        </CardFooter>
      </Card>
    );
  }

  // Error state (invalid token, expired, etc.)
  if (error) {
    const errorData = error as { status?: string };
    const errorStatus = errorData?.status;

    return (
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            {errorStatus === 'expired' ? (
              <Clock className="h-6 w-6 text-destructive" />
            ) : errorStatus === 'accepted' ? (
              <CheckCircle className="h-6 w-6 text-green-600" />
            ) : errorStatus === 'rejected' ? (
              <XCircle className="h-6 w-6 text-muted-foreground" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-destructive" />
            )}
          </div>
          <CardTitle>
            {errorStatus === 'expired'
              ? t('expired.title')
              : errorStatus === 'accepted'
              ? t('alreadyAccepted.title')
              : errorStatus === 'rejected'
              ? t('alreadyRejected.title')
              : t('invalid.title')}
          </CardTitle>
          <CardDescription>
            {errorStatus === 'expired'
              ? t('expired.description')
              : errorStatus === 'accepted'
              ? t('alreadyAccepted.description')
              : errorStatus === 'rejected'
              ? t('alreadyRejected.description')
              : t('invalid.description')}
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button variant="outline" onClick={() => router.push('/login')}>
            {t('goToLogin')}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Success states
  if (status === 'accepted') {
    return (
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle>{t('accepted.title')}</CardTitle>
          <CardDescription>{t('accepted.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('accepted.redirecting')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === 'rejected') {
    return (
      <Card className="text-center">
        <CardHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <XCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>{t('rejected.title')}</CardTitle>
          <CardDescription>{t('rejected.description')}</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button variant="outline" onClick={() => router.push('/')}>
            {t('goHome')}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Main invitation view
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>
          {t('description', { workspace: invitation?.workspace?.name })}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Inviter info */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <Avatar className="h-10 w-10">
            <AvatarFallback>
              {(invitation?.inviter?.full_name || invitation?.inviter?.email || '')
                .substring(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {invitation?.inviter?.full_name || invitation?.inviter?.email}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('invitedYou')}
            </p>
          </div>
        </div>

        {/* Role and workspace info */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('workspace')}</span>
            <span className="font-medium">{invitation?.workspace?.name}</span>
          </div>
          {invitation?.clinic && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('clinic')}</span>
              <span className="font-medium">{invitation.clinic.name}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('role')}</span>
            <Badge variant="secondary">{t(`roles.${invitation?.role}`)}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('expires')}</span>
            <span className="text-muted-foreground">
              {invitation?.expires_at &&
                formatDistanceToNow(new Date(invitation.expires_at), {
                  addSuffix: true,
                  locale: dateLocale,
                })}
            </span>
          </div>
        </div>

        {/* Personal message */}
        {invitation?.message && (
          <div className="p-3 rounded-lg bg-muted/50 border-l-4 border-primary">
            <p className="text-sm italic">&ldquo;{invitation.message}&rdquo;</p>
          </div>
        )}

        {/* Auth required notice */}
        {!isAuthenticated && (
          <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {t('authRequired')}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-3">
        {isAuthenticated ? (
          // Authenticated: Show accept/reject buttons
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleReject}
              disabled={isRejecting || isAccepting}
            >
              {isRejecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('reject')}
            </Button>
            <Button
              className="flex-1"
              onClick={handleAccept}
              disabled={isAccepting || isRejecting}
            >
              {isAccepting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('accept')}
            </Button>
          </div>
        ) : (
          // Not authenticated: Show login/signup buttons
          <>
            <Button className="w-full" onClick={handleLogin}>
              <LogIn className="h-4 w-4 mr-2" />
              {t('loginToAccept')}
            </Button>
            <Button variant="outline" className="w-full" onClick={handleSignup}>
              <User className="h-4 w-4 mr-2" />
              {t('createAccount')}
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
