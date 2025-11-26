'use client';

import * as React from 'react';
import { useT } from '@/lib/i18n';
import { AppLayout } from '@/components/layouts/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ActionDropdown, createEditAction, createDeleteAction } from '@/components/ui/ActionDropdown';
import { ConfirmDialog, createDeleteConfirm } from '@/components/ui/ConfirmDialog';
import { Search, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CrudPageLayoutProps<T extends { id: string; name?: string }> {
  // Page header
  title: string;
  subtitle?: string;
  
  // Data
  items: T[];
  loading: boolean;
  
  // Table
  columns: Column<T>[];
  mobileColumns?: Column<T>[]; // optional simplified set for mobile
  
  // Actions
  onAdd?: () => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  addButtonLabel?: string;
  
  // Search
  searchable?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  
  // Empty state
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  
  // Delete confirmation
  deleteConfirmOpen?: boolean;
  onDeleteConfirmChange?: (open: boolean) => void;
  deletingItem?: T | null;
  onDeleteConfirm?: () => void;
  
  // Additional content
  summaryCards?: React.ReactNode;
  beforeTable?: React.ReactNode; // Content before the table (e.g., filters)
  additionalContent?: React.ReactNode;
  children?: React.ReactNode; // For modal or additional components
  
  // Styling
  className?: string;
  containerClassName?: string;
}

export function CrudPageLayout<T extends { id: string; name?: string }>({
  title,
  subtitle,
  items,
  loading,
  columns,
  mobileColumns,
  onAdd,
  onEdit,
  onDelete,
  addButtonLabel = 'Add',
  searchable = false,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  emptyIcon,
  emptyTitle = 'No items found',
  emptyDescription = 'Get started by adding your first item.',
  deleteConfirmOpen = false,
  onDeleteConfirmChange,
  deletingItem,
  onDeleteConfirm,
  summaryCards,
  beforeTable,
  additionalContent,
  children,
  className,
  containerClassName,
}: CrudPageLayoutProps<T>) {
  const t = useT();
  // Build columns, auto-adding an actions column when handlers are provided.
  const { tableColumns, mobileTableColumns } = React.useMemo(() => {
    // Base columns as provided
    let base = columns;

    // Create an actions column only if edit/delete handlers are present
    const shouldAddActions = !!onEdit || !!onDelete;
    const hasActionsColumn = columns.some(col => col.key === 'actions');

    const actionColumn: Column<T> | null = shouldAddActions
      ? {
          key: 'actions',
          label: t('common.actions'),
          render: (_value, item) => {
            const actions: any[] = [];
            if (onEdit) actions.push(createEditAction(() => onEdit(item), t('common.edit')));
            if (onDelete) actions.push(createDeleteAction(() => onDelete(item), t('common.delete')));
            return <ActionDropdown actions={actions} />;
          },
        }
      : null;

    // Table columns include actions if not already present
    const tableCols = hasActionsColumn || !actionColumn ? base : [...base, actionColumn];

    // Mobile columns: if not provided, use first two plus actions (when available)
    let mobileCols = mobileColumns;
    if (!mobileCols) {
      const firstTwo = base.slice(0, Math.min(2, base.length));
      mobileCols = (actionColumn && !hasActionsColumn)
        ? ([...firstTwo, actionColumn] as Column<T>[])
        : firstTwo;
    }

    return { tableColumns: tableCols, mobileTableColumns: mobileCols };
  }, [columns, mobileColumns, onEdit, onDelete, t]);

  return (
    <AppLayout>
      <div className={cn('p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6', containerClassName)}>
        <PageHeader title={title} subtitle={subtitle} />
        
        {/* Summary Cards */}
        {summaryCards}
        
        {/* Search and Add Button */}
        {(searchable || onAdd) && (
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            {searchable && onSearchChange && (
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}
            
            {onAdd && items.length > 0 && (
              <Button onClick={onAdd} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                {addButtonLabel}
              </Button>
            )}
          </div>
        )}

        {/* Before Table Content (e.g., filters) */}
        {beforeTable}

        {/* Data Table */}
        <Card className={className}>
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">{t('common.loading')}</span>
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={emptyIcon}
                title={emptyTitle}
                description={emptyDescription}
                action={
                  onAdd && (
                    <Button onClick={onAdd}>
                      <Plus className="h-4 w-4 mr-2" />
                      {addButtonLabel}
                    </Button>
                  )
                }
              />
            ) : (
              <DataTable
                columns={tableColumns}
                mobileColumns={mobileTableColumns}
                data={items}
                showCount={true}
              />
            )}
          </div>
        </Card>
        
        {/* Additional Content */}
        {additionalContent}
        
        {/* Delete Confirmation Dialog */}
        {onDeleteConfirmChange && onDeleteConfirm && (
          <ConfirmDialog
            open={deleteConfirmOpen}
            onOpenChange={onDeleteConfirmChange}
            onConfirm={onDeleteConfirm}
            title="¿Eliminar registro?"
            {...createDeleteConfirm(onDeleteConfirm, deletingItem?.name)}
          />
        )}
        
        {/* Additional children (usually modals) */}
        {children}
      </div>
    </AppLayout>
  );
}

// Export a simpler version for basic CRUD pages
interface SimpleCrudPageProps<T extends { id: string; name?: string }> {
  title: string;
  subtitle?: string;
  entityName: string;
  data: {
    items: T[];
    loading: boolean;
    searchTerm?: string;
    onSearchChange?: (value: string) => void;
    onAdd: () => void;
    onEdit: (item: T) => void;
    onDelete: (item: T) => void;
    deleteConfirmOpen: boolean;
    onDeleteConfirmChange: (open: boolean) => void;
    deletingItem: T | null;
    onDeleteConfirm: () => void;
  };
  columns: Column<T>[];
  mobileColumns?: Column<T>[];
  emptyIcon?: React.ReactNode;
  searchable?: boolean;
  beforeTable?: React.ReactNode;
  children?: React.ReactNode;
}

export function SimpleCrudPage<T extends { id: string; name?: string }>({
  title,
  subtitle,
  entityName,
  data,
  columns,
  mobileColumns,
  emptyIcon,
  searchable = true,
  beforeTable,
  children,
}: SimpleCrudPageProps<T>) {
  // Localized common strings
  // We avoid hardcoded English in composed labels
  const t = useT();
  const addLabel = `${t('common.add')} ${entityName}`;
  const searchLabel = `${t('common.search')} ${entityName.toLowerCase()}...`;
  const emptyTitle = t('common.noData');
  const emptyDesc = t('common.createNewDescription', { entity: entityName.toLowerCase() });

  return (
    <CrudPageLayout
      title={title}
      subtitle={subtitle}
      items={data.items}
      loading={data.loading}
      columns={columns}
      mobileColumns={mobileColumns}
      onAdd={data.onAdd}
      onEdit={data.onEdit}
      onDelete={data.onDelete}
      addButtonLabel={addLabel}
      searchable={searchable}
      searchValue={data.searchTerm}
      onSearchChange={data.onSearchChange}
      searchPlaceholder={searchLabel}
      emptyIcon={emptyIcon}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDesc}
      deleteConfirmOpen={data.deleteConfirmOpen}
      onDeleteConfirmChange={data.onDeleteConfirmChange}
      deletingItem={data.deletingItem}
      onDeleteConfirm={data.onDeleteConfirm}
      beforeTable={beforeTable}
    >
      {children}
    </CrudPageLayout>
  );
}
