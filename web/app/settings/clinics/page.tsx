'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase';
import { Plus, Edit2, Trash2, Building, MapPin, Phone, Mail } from 'lucide-react';
import { useWorkspace } from '@/contexts/workspace-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Clinic {
  id: string;
  workspace_id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function ClinicsPage() {
  const t = useTranslations();
  const { toast } = useToast();
  const { workspace, workspaces } = useWorkspace();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    workspace_id: '',
  });

  const supabase = createClient();

  const loadClinics = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('clinics')
        .select('*')
        .order('name');

      if (selectedWorkspaceId) {
        query = query.eq('workspace_id', selectedWorkspaceId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setClinics(data || []);
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
    if (workspace) {
      setSelectedWorkspaceId(workspace.id);
    }
  }, [workspace]);

  useEffect(() => {
    loadClinics();
  }, [selectedWorkspaceId]);

  const handleSubmit = async () => {
    try {
      const workspaceId = formData.workspace_id || selectedWorkspaceId;
      
      if (!workspaceId) {
        throw new Error(t('settings.clinics.selectWorkspace'));
      }

      if (editingClinic) {
        const { error } = await supabase
          .from('clinics')
          .update({
            name: formData.name,
            address: formData.address,
            phone: formData.phone,
            email: formData.email,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingClinic.id);

        if (error) throw error;

        toast({
          title: t('settings.clinics.updateSuccess'),
          description: t('settings.clinics.updateSuccessDesc'),
        });
      } else {
        const { error } = await supabase
          .from('clinics')
          .insert({
            workspace_id: workspaceId,
            name: formData.name,
            address: formData.address,
            phone: formData.phone,
            email: formData.email,
            is_active: true,
          });

        if (error) throw error;

        toast({
          title: t('settings.clinics.createSuccess'),
          description: t('settings.clinics.createSuccessDesc'),
        });
      }

      setDialogOpen(false);
      setEditingClinic(null);
      setFormData({ name: '', address: '', phone: '', email: '', workspace_id: '' });
      loadClinics();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('settings.clinics.deleteConfirm'))) return;

    try {
      const { error } = await supabase
        .from('clinics')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: t('settings.clinics.deleteSuccess'),
        description: t('settings.clinics.deleteSuccessDesc'),
      });

      loadClinics();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const toggleActive = async (clinic: Clinic) => {
    try {
      const { error } = await supabase
        .from('clinics')
        .update({
          is_active: !clinic.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clinic.id);

      if (error) throw error;

      toast({
        title: t('common.success'),
        description: clinic.is_active 
          ? t('settings.clinics.deactivated')
          : t('settings.clinics.activated'),
      });

      loadClinics();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (clinic: Clinic) => {
    setEditingClinic(clinic);
    setFormData({
      name: clinic.name,
      address: clinic.address || '',
      phone: clinic.phone || '',
      email: clinic.email || '',
      workspace_id: clinic.workspace_id,
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingClinic(null);
    setFormData({ 
      name: '', 
      address: '', 
      phone: '', 
      email: '', 
      workspace_id: selectedWorkspaceId 
    });
    setDialogOpen(true);
  };

  if (workspaces.length === 0) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <PageHeader
          title={t('settings.clinics.title')}
          description={t('settings.clinics.description')}
        />
        <Card className="p-12 text-center">
          <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {t('settings.clinics.noWorkspaces')}
          </h3>
          <p className="text-gray-500 mb-4">
            {t('settings.clinics.noWorkspacesDesc')}
          </p>
          <Button onClick={() => window.location.href = '/settings/workspaces'}>
            {t('settings.clinics.createWorkspace')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <PageHeader
        title={t('settings.clinics.title')}
        description={t('settings.clinics.description')}
      />

      <div className="mb-6 flex gap-4 items-center">
        <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder={t('settings.clinics.selectWorkspace')} />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((ws) => (
              <SelectItem key={ws.id} value={ws.id}>
                {ws.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          {t('settings.clinics.create')}
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
      ) : clinics.length === 0 ? (
        <Card className="p-12 text-center">
          <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {t('settings.clinics.empty')}
          </h3>
          <p className="text-gray-500 mb-4">
            {t('settings.clinics.emptyDesc')}
          </p>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {t('settings.clinics.createFirst')}
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clinics.map((clinic) => (
            <Card 
              key={clinic.id} 
              className={`p-6 ${!clinic.is_active ? 'opacity-60' : ''}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{clinic.name}</h3>
                  <span className={`inline-block px-2 py-1 text-xs rounded-full mt-2 ${
                    clinic.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {clinic.is_active ? t('common.active') : t('common.inactive')}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDialog(clinic)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(clinic.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                {clinic.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3" />
                    <span>{clinic.address}</span>
                  </div>
                )}
                {clinic.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3" />
                    <span>{clinic.phone}</span>
                  </div>
                )}
                {clinic.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3" />
                    <span>{clinic.email}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => toggleActive(clinic)}
                >
                  {clinic.is_active 
                    ? t('settings.clinics.deactivate')
                    : t('settings.clinics.activate')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingClinic
                ? t('settings.clinics.edit')
                : t('settings.clinics.create')}
            </DialogTitle>
            <DialogDescription>
              {editingClinic
                ? t('settings.clinics.editDesc')
                : t('settings.clinics.createDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!editingClinic && (
              <div className="grid gap-2">
                <Label htmlFor="workspace">
                  {t('settings.clinics.workspace')}
                </Label>
                <Select 
                  value={formData.workspace_id} 
                  onValueChange={(value) => 
                    setFormData({ ...formData, workspace_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('settings.clinics.selectWorkspace')} />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>
                        {ws.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="name">{t('settings.clinics.name')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder={t('settings.clinics.namePlaceholder')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">{t('settings.clinics.address')}</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder={t('settings.clinics.addressPlaceholder')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">{t('settings.clinics.phone')}</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder={t('settings.clinics.phonePlaceholder')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">{t('settings.clinics.email')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder={t('settings.clinics.emailPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit}>
              {editingClinic ? t('common.update') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}