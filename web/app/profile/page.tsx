import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { 
  User,
  Settings,
  Shield,
  Bell,
  Globe,
  Moon,
  ChevronRight,
  Mail,
  Phone
} from 'lucide-react';
import { ProfileClient } from './ProfileClient';
import { createSupabaseClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';

async function getUserData() {
  const supabase = createSupabaseClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    redirect('/auth/login');
  }

  return user;
}

export default async function ProfilePage() {
  const t = await getTranslations();
  const user = await getUserData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mi Perfil"
        subtitle="Gestiona tu información personal y preferencias"
      />

      <div className="grid gap-6 max-w-2xl">
        {/* Información del Usuario */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
                <User className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  {user.user_metadata?.full_name || 
                   `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 
                   'Usuario'}
                </h2>
                <p className="text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>

              {user.phone && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Teléfono</p>
                    <p className="text-sm text-muted-foreground">{user.phone}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Autenticación</p>
                  <p className="text-sm text-muted-foreground">
                    {user.app_metadata?.provider || 'Email'} • 
                    Confirmado: {user.email_confirmed_at ? 'Sí' : 'No'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preferencias */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Preferencias</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Idioma</p>
                    <p className="text-sm text-muted-foreground">Español (México)</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Moon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Tema</p>
                    <p className="text-sm text-muted-foreground">Usar configuración del sistema</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Notificaciones</p>
                    <p className="text-sm text-muted-foreground">Activadas para eventos importantes</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cliente Components para funcionalidad interactiva */}
        <ProfileClient user={user} />
      </div>
    </div>
  );
}