'use client';

import * as React from 'react';
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
  additionalContent,
  children,
  className,
  containerClassName,
}: CrudPageLayoutProps<T>) {
  // Add action column if edit/delete actions are provided
  const tableColumns = React.useMemo(() => {
    if (!onEdit && !onDelete) return columns;
    
    const actionColumn: Column<T> = {
      key: 'actions',
      label: 'Actions',
      render: (_value, item) => {
        const actions = [];
        if (onEdit) {
          actions.push(createEditAction(() => onEdit(item), 'Edit'));
        }
        if (onDelete) {
          actions.push(createDeleteAction(() => onDelete(item), 'Delete'));
        }
        return <ActionDropdown actions={actions} />;
      },
    };
    
    // Check if actions column already exists
    const hasActionsColumn = columns.some(col => col.key === 'actions');
    return hasActionsColumn ? columns : [...columns, actionColumn];
  }, [columns, onEdit, onDelete]);

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
            
            {onAdd && (
              <Button onClick={onAdd} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                {addButtonLabel}
              </Button>
            )}
          </div>
        )}
        
        {/* Data Table */}
        <Card className={className}>
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading...</span>
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
              <DataTable columns={tableColumns} mobileColumns={mobileColumns} data={items} />
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
  children,
}: SimpleCrudPageProps<T>) {
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
      addButtonLabel={`Add ${entityName}`}
      searchable={searchable}
      searchValue={data.searchTerm}
      onSearchChange={data.onSearchChange}
      searchPlaceholder={`Search ${entityName.toLowerCase()}...`}
      emptyIcon={emptyIcon}
      emptyTitle={`No ${entityName.toLowerCase()} found`}
      emptyDescription={`Get started by adding your first ${entityName.toLowerCase()}.`}
      deleteConfirmOpen={data.deleteConfirmOpen}
      onDeleteConfirmChange={data.onDeleteConfirmChange}
      deletingItem={data.deletingItem}
      onDeleteConfirm={data.onDeleteConfirm}
    >
      {children}
    </CrudPageLayout>
  );
}
