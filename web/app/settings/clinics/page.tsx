'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { SimpleCrudPage } from '@/components/ui/crud-page-layout';
import { FormModal } from '@/components/ui/form-modal';
import { InputField, SelectField, FormGrid } from '@/components/ui/form-field';
import { useCrudOperations } from '@/hooks/use-crud-operations';
import { useWorkspace } from '@/contexts/workspace-context';
import { Building, MapPin, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AppLayout } from '@/components/layouts/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';

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

const clinicFormSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  workspace_id: z.string().min(1, 'Workspace es requerido')
});

type ClinicFormData = z.infer<typeof clinicFormSchema>;

export default function ClinicsPage() {
  const t = useTranslations();
  const { workspace, workspaces } = useWorkspace();
  
  // Use the centralized CRUD hook
  const crud = useCrudOperations<Clinic>({
    endpoint: '/api/clinics',
    entityName: t('settings.clinics.entity', 'Clínica'),
    includeClinicId: false, // No necesita clinicId porque puede manejar múltiples workspaces
    searchParam: 'search',
  });

  // Form handling
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<ClinicFormData>({
    resolver: zodResolver(clinicFormSchema),
    defaultValues: {
      name: '',
      address: '',
      phone: '',
      email: '',
      workspace_id: workspace?.id || ''
    }
  });

  // Form submission
  const onSubmit = async (data: ClinicFormData) => {
    const payload = {
      name: data.name,
      address: data.address,
      phone: data.phone,
      email: data.email,
      workspace_id: data.workspace_id,
      is_active: true
    };

    const success = crud.editingItem
      ? await crud.handleUpdate(crud.editingItem.id, payload)
      : await crud.handleCreate(payload);

    if (success) {
      crud.closeDialog();
      reset();
    }
  };

  // Handle edit
  const handleEdit = (clinic: Clinic) => {
    crud.handleEdit(clinic);
    
    reset({
      name: clinic.name,
      address: clinic.address || '',
      phone: clinic.phone || '',
      email: clinic.email || '',
      workspace_id: clinic.workspace_id
    });
  };

  // Handle dialog open
  const handleOpenDialog = () => {
    reset({
      name: '',
      address: '',
      phone: '',
      email: '',
      workspace_id: workspace?.id || ''
    });
    crud.openDialog();
  };

  // Table columns
  const columns = [
    { 
      key: 'name', 
      label: t('settings.clinics.name') 
    },
    { 
      key: 'address', 
      label: t('settings.clinics.address'), 
      render: (_value: any, clinic: Clinic) => 
        clinic.address || '-'
    },
    { 
      key: 'phone', 
      label: t('settings.clinics.phone'), 
      render: (_value: any, clinic: Clinic) => 
        clinic.phone || '-'
    },
    { 
      key: 'email', 
      label: t('settings.clinics.email'), 
      render: (_value: any, clinic: Clinic) => 
        clinic.email || '-'
    },
    { 
      key: 'is_active', 
      label: t('common.status'), 
      render: (_value: any, clinic: Clinic) => 
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
          clinic.is_active 
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-700'
        }`}>
          {clinic.is_active ? t('common.active') : t('common.inactive')}
        </span>
    }
  ];

  // Workspace options for select
  const workspaceOptions = workspaces.map(ws => ({
    value: ws.id,
    label: ws.name
  }));

  if (workspaces.length === 0) {
    return (
      <AppLayout>
        <div className="p-4 lg:p-8 max-w-[1600px] mx-auto">
          <PageHeader
            title={t('settings.clinics.title')}
            subtitle={t('settings.clinics.description')}
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
      </AppLayout>
    );
  }

  return (
    <SimpleCrudPage
      title={t('settings.clinics.title')}
      subtitle={t('settings.clinics.description')}
      entityName={t('settings.clinics.entity', 'Clínica')}
      data={{
        items: crud.items,
        loading: crud.loading,
        searchTerm: crud.searchTerm,
        onSearchChange: crud.setSearchTerm,
        onAdd: handleOpenDialog,
        onEdit: handleEdit,
        onDelete: crud.handleDeleteClick,
        deleteConfirmOpen: crud.deleteConfirmOpen,
        onDeleteConfirmChange: (open) => open ? null : crud.closeDialog(),
        deletingItem: crud.deletingItem,
        onDeleteConfirm: crud.handleDeleteConfirm,
      }}
      columns={columns}
      emptyIcon={<Building className="h-8 w-8" />}
      searchable={true}
    >
      <FormModal
        open={crud.isDialogOpen}
        onOpenChange={crud.closeDialog}
        title={crud.editingItem ? t('settings.clinics.edit') : t('settings.clinics.create')}
        onSubmit={handleSubmit(onSubmit)}
        isSubmitting={crud.isSubmitting}
        cancelLabel={t('common.cancel')}
        submitLabel={crud.editingItem ? t('common.update') : t('common.create')}
      >
        <div className="space-y-4">
          <InputField
            label={t('settings.clinics.name')}
            value={watch('name')}
            onChange={(v) => setValue('name', v as string)}
            error={errors.name?.message}
            required
            placeholder={t('settings.clinics.namePlaceholder')}
          />

          {!crud.editingItem && (
            <SelectField
              label={t('settings.clinics.workspace')}
              value={watch('workspace_id')}
              onChange={(v) => setValue('workspace_id', v as string)}
              options={workspaceOptions}
              error={errors.workspace_id?.message}
              required
            />
          )}

          <InputField
            label={t('settings.clinics.address')}
            value={watch('address')}
            onChange={(v) => setValue('address', v as string)}
            error={errors.address?.message}
            placeholder={t('settings.clinics.addressPlaceholder')}
          />

          <FormGrid columns={2}>
            <InputField
              label={t('settings.clinics.phone')}
              value={watch('phone')}
              onChange={(v) => setValue('phone', v as string)}
              error={errors.phone?.message}
              placeholder={t('settings.clinics.phonePlaceholder')}
            />

            <InputField
              label={t('settings.clinics.email')}
              type="email"
              value={watch('email')}
              onChange={(v) => setValue('email', v as string)}
              error={errors.email?.message}
              placeholder={t('settings.clinics.emailPlaceholder')}
            />
          </FormGrid>
        </div>
      </FormModal>
    </SimpleCrudPage>
  );
}