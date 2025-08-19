'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Edit3, Save, X, Key, Trash2, AlertTriangle } from 'lucide-react';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { createSupabaseClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface ProfileClientProps {
  user: any;
}

export function ProfileClient({ user }: ProfileClientProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: user.user_metadata?.first_name || '',
    last_name: user.user_metadata?.last_name || '',
    phone: user.phone || ''
  });
  const { toast } = useToast();
  const router = useRouter();

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
        title: "Perfil actualizado",
        description: "Tus datos han sido guardados exitosamente."
      });
      
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el perfil. Intenta de nuevo.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsLoading(true);
    const supabase = createSupabaseClient();
    
    try {
      // This would typically require server-side implementation
      toast({
        title: "Eliminación de cuenta",
        description: "Por favor contacta al soporte para eliminar tu cuenta.",
        variant: "destructive"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo procesar la solicitud.",
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
            <h3 className="text-lg font-semibold">Información Personal</h3>
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Editar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      first_name: user.user_metadata?.first_name || '',
                      last_name: user.user_metadata?.last_name || '',
                      phone: user.phone || ''
                    });
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveProfile}
                  disabled={isLoading}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Guardar
                </Button>
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">Nombre</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="Tu nombre"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Apellido</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Tu apellido"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+52 123 456 7890"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Los cambios a tu información personal se aplicarán inmediatamente.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seguridad */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Seguridad</h3>
          
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              disabled
            >
              <Key className="h-4 w-4 mr-2" />
              Cambiar Contraseña
              <span className="ml-auto text-xs text-muted-foreground">Próximamente</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Zona de Peligro */}
      <Card className="border-destructive/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="text-lg font-semibold text-destructive">Zona de Peligro</h3>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            Una vez que elimines tu cuenta, toda tu información se perderá permanentemente.
          </p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar Cuenta
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Eliminará permanentemente tu cuenta 
                  y todos los datos asociados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isLoading}
                >
                  Sí, eliminar cuenta
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </>
  );
}