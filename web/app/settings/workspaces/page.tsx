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
import { createSupabaseClient } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Building2 } from 'lucide-react';
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
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
  });

  const supabase = createSupabaseClient();

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkspaces(data || []);
    } catch (error: any) {
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
      if (editingWorkspace) {
        const { error } = await supabase
          .from('workspaces')
          .update({
            name: formData.name,
            description: formData.description,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingWorkspace.id);

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
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: t('settings.workspaces.deleteSuccess'),
        description: t('settings.workspaces.deleteSuccessDesc'),
      });

      loadWorkspaces();
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

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <PageHeader
        title={t('settings.workspaces.title')}
        description={t('settings.workspaces.description')}
      />

      <div className="mb-6">
        <Button onClick={openCreateDialog}>
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
      ) : workspaces.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {t('settings.workspaces.empty')}
          </h3>
          <p className="text-gray-500 mb-4">
            {t('settings.workspaces.emptyDesc')}
          </p>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {t('settings.workspaces.createFirst')}
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <Card key={workspace.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{workspace.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {workspace.slug}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDialog(workspace)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(workspace.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {workspace.description && (
                <p className="text-sm text-gray-600 mb-4">
                  {workspace.description}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {workspace.onboarding_completed
                    ? t('settings.workspaces.configured')
                    : t('settings.workspaces.pending')}
                </span>
                <span>
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