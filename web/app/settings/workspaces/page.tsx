'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { Plus, Edit2, Trash2, Building2, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export default function WorkspacesPage() {
  const t = useTranslations();
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [search, setSearch] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
  });

  const supabase = createSupabaseBrowserClient();

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      
      // Primero obtener el usuario autenticado
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: 'Error',
          description: 'No se encontró usuario autenticado',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
      
      // Cargar solo los workspaces del usuario actual
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkspaces(data || []);
    } catch (error: any) {
      console.error('Error loading workspaces:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleSubmit = async () => {
    try {
      // Obtener el usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: 'Error',
          description: 'No se encontró usuario autenticado',
          variant: 'destructive',
        });
        return;
      }
      
      if (editingWorkspace) {
        const { error } = await supabase
          .from('workspaces')
          .update({
            name: formData.name,
            description: formData.description,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingWorkspace.id)
          .eq('owner_id', user.id); // Asegurar que solo edite sus propios workspaces

        if (error) throw error;

        toast({
          title: t('settings.workspaces.updateSuccess'),
          description: t('settings.workspaces.updateSuccessDesc'),
        });
      } else {
        const { error } = await supabase
          .from('workspaces')
          .insert({
            name: formData.name,
            slug: formData.slug || generateSlug(formData.name),
            description: formData.description,
            owner_id: user.id,
            onboarding_completed: false,
            onboarding_step: 0,
          });

        if (error) throw error;

        toast({
          title: t('settings.workspaces.createSuccess'),
          description: t('settings.workspaces.createSuccessDesc'),
        });
      }

      setDialogOpen(false);
      setEditingWorkspace(null);
      setFormData({ name: '', slug: '', description: '' });
      loadWorkspaces();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('settings.workspaces.deleteConfirm'))) return;

    try {
      // Primero eliminar todas las clínicas del workspace
      await supabase
        .from('clinics')
        .delete()
        .eq('workspace_id', id);
      
      // Luego eliminar el workspace
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: t('settings.workspaces.deleteSuccess'),
        description: t('settings.workspaces.deleteSuccessDesc'),
      });

      // Recargar workspaces
      const { data: remainingWorkspaces } = await supabase
        .from('workspaces')
        .select('*');
      
      // Si no quedan workspaces, redirigir al onboarding
      if (!remainingWorkspaces || remainingWorkspaces.length === 0) {
        window.location.href = '/onboarding';
      } else {
        loadWorkspaces();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (workspace: Workspace) => {
    setEditingWorkspace(workspace);
    setFormData({
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description || '',
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingWorkspace(null);
    setFormData({ name: '', slug: '', description: '' });
    setDialogOpen(true);
  };

  const filteredWorkspaces = workspaces.filter((ws) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      ws.name.toLowerCase().includes(q) ||
      ws.slug.toLowerCase().includes(q) ||
      (ws.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="container mx-auto p-6 md:py-8 max-w-7xl">
      <PageHeader
        title={t('settings.workspaces.title')}
        description={t('settings.workspaces.description')}
      />

      <div className="mt-2 mb-8 flex flex-col-reverse sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80 md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="pl-10 h-11"
            aria-label={t('common.search')}
          />
        </div>
        <Button onClick={openCreateDialog} className="h-11 px-4 self-end sm:self-auto">
          <Plus className="h-4 w-4 mr-2" />
          {t('settings.workspaces.create')}
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </Card>
          ))}
        </div>
      ) : filteredWorkspaces.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {search ? t('common.noData') : t('settings.workspaces.empty')}
          </h3>
          <p className="text-gray-500 mb-4">
            {search ? '' : t('settings.workspaces.emptyDesc')}
          </p>
          {!search && (
          <Button onClick={openCreateDialog} className="h-11">
            <Plus className="h-4 w-4 mr-2" />
            {t('settings.workspaces.createFirst')}
          </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-7 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredWorkspaces.map((workspace) => (
            <Card
              key={workspace.id}
              className="p-6 lg:p-7 rounded-2xl border bg-card shadow-sm hover:shadow-md transition-shadow min-h-[152px]"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-base truncate leading-6">{workspace.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{workspace.slug}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    aria-label={t('common.edit')}
                    onClick={() => openEditDialog(workspace)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    aria-label={t('common.delete')}
                    onClick={() => handleDelete(workspace.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {workspace.description && (
                <p className="text-sm text-muted-foreground mb-5 line-clamp-2">{workspace.description}</p>
              )}
              <div className="flex items-center justify-between">
                <span
                  className={
                    workspace.onboarding_completed
                      ? 'inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700'
                      : 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700'
                  }
                >
                  {workspace.onboarding_completed
                    ? t('settings.workspaces.configured')
                    : t('settings.workspaces.pending')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(workspace.created_at).toLocaleDateString()}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingWorkspace
                ? t('settings.workspaces.edit')
                : t('settings.workspaces.create')}
            </DialogTitle>
            <DialogDescription>
              {editingWorkspace
                ? t('settings.workspaces.editDesc')
                : t('settings.workspaces.createDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{t('settings.workspaces.name')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder={t('settings.workspaces.namePlaceholder')}
              />
            </div>
            {!editingWorkspace && (
              <div className="grid gap-2">
                <Label htmlFor="slug">{t('settings.workspaces.slug')}</Label>
                <Input
                  id="slug"
                  value={formData.slug || generateSlug(formData.name)}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  placeholder={t('settings.workspaces.slugPlaceholder')}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="description">
                {t('settings.workspaces.description')}
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder={t('settings.workspaces.descriptionPlaceholder')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit}>
              {editingWorkspace ? t('common.update') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}