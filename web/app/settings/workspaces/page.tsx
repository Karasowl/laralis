'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { SimpleCrudPage } from '@/components/ui/crud-page-layout';
import { FormModal } from '@/components/ui/form-modal';
import { InputField, TextareaField } from '@/components/ui/form-field';
import { useCrudOperations } from '@/hooks/use-crud-operations';
import { Building2 } from 'lucide-react';

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

const workspaceFormSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  slug: z.string().optional(),
  description: z.string().optional()
});

type WorkspaceFormData = z.infer<typeof workspaceFormSchema>;

export default function WorkspacesPage() {
  const t = useTranslations();
  
  // Use the centralized CRUD hook
  const crud = useCrudOperations<Workspace>({
    endpoint: '/api/workspaces',
    entityName: t('settings.workspaces.entity', 'Workspace'),
    includeClinicId: false,
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
  } = useForm<WorkspaceFormData>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: ''
    }
  });

  const workspaceInitialValues: WorkspaceFormData = {
    name: '',
    slug: '',
    description: ''
  };

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Form submission
  const onSubmit = async (data: WorkspaceFormData) => {
    const payload = {
      name: data.name,
      slug: data.slug || generateSlug(data.name),
      description: data.description,
      onboarding_completed: false,
      onboarding_step: 0
    };

    const success = crud.editingItem
      ? await crud.handleUpdate(crud.editingItem.id, {
          name: data.name,
          description: data.description
        })
      : await crud.handleCreate(payload);

    if (success) {
      crud.closeDialog();
      reset();
    }
  };

  // Handle edit
  const handleEdit = (workspace: Workspace) => {
    crud.handleEdit(workspace);
    
    reset({
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description || ''
    });
  };

  // Handle dialog open
  const handleOpenDialog = () => {
    reset(workspaceInitialValues);
    crud.openDialog();
  };

  // Table columns
  const columns = [
    { 
      key: 'name', 
      label: t('settings.workspaces.name') 
    },
    { 
      key: 'slug', 
      label: t('settings.workspaces.slug'),
      render: (_value: any, workspace: Workspace) =>
        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{workspace.slug}</code>
    },
    { 
      key: 'description', 
      label: t('settings.workspaces.description'), 
      render: (_value: any, workspace: Workspace) => 
        workspace.description || '-'
    },
    { 
      key: 'onboarding_completed', 
      label: t('common.status'), 
      render: (_value: any, workspace: Workspace) => 
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
          workspace.onboarding_completed
            ? 'bg-green-100 text-green-700'
            : 'bg-amber-100 text-amber-700'
        }`}>
          {workspace.onboarding_completed
            ? t('settings.workspaces.configured')
            : t('settings.workspaces.pending')}
        </span>
    },
    { 
      key: 'created_at', 
      label: t('common.created'), 
      render: (_value: any, workspace: Workspace) => 
        new Date(workspace.created_at).toLocaleDateString()
    }
  ];

  return (
    <SimpleCrudPage
      title={t('settings.workspaces.title')}
      subtitle={t('settings.workspaces.description')}
      entityName={t('settings.workspaces.entity', 'Workspace')}
      data={{
        items: crud.items || [],
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
      emptyIcon={<Building2 className="h-8 w-8" />}
      searchable={true}
    >
      <FormModal
        open={crud.isDialogOpen}
        onOpenChange={() => { crud.closeDialog(); reset(workspaceInitialValues); }}
        title={crud.editingItem ? t('settings.workspaces.edit') : t('settings.workspaces.create')}
        onSubmit={handleSubmit(onSubmit)}
        isSubmitting={crud.isSubmitting}
        cancelLabel={t('common.cancel')}
        submitLabel={crud.editingItem ? t('common.update') : t('common.create')}
      >
        <div className="space-y-4">
          <InputField
            label={t('settings.workspaces.name')}
            value={watch('name')}
            onChange={(v) => setValue('name', v as string)}
            error={errors.name?.message}
            required
            placeholder={t('settings.workspaces.namePlaceholder')}
          />

          {!crud.editingItem && (
            <InputField
              label={t('settings.workspaces.slug')}
              value={watch('slug') || generateSlug(watch('name'))}
              onChange={(v) => setValue('slug', v as string)}
              error={errors.slug?.message}
              placeholder={t('settings.workspaces.slugPlaceholder')}
            />
          )}

          <TextareaField
            label={t('settings.workspaces.description')}
            value={watch('description')}
            onChange={(v) => setValue('description', v as string)}
            error={errors.description?.message}
            placeholder={t('settings.workspaces.descriptionPlaceholder')}
            rows={3}
          />
        </div>
      </FormModal>
    </SimpleCrudPage>
  );
}
