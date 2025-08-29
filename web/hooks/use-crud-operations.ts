'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { useWorkspace } from '@/contexts/workspace-context';

interface CrudConfig<T> {
  endpoint: string;
  entityName: string; // Para mensajes de toast
  includeClinicId?: boolean;
  searchParam?: string;
  transformData?: (data: any) => T;
}

interface CrudState<T> {
  items: T[];
  loading: boolean;
  isSubmitting: boolean;
  editingItem: T | null;
  isDialogOpen: boolean;
  deleteConfirmOpen: boolean;
  deletingItem: T | null;
  searchTerm: string;
  searchDebounce: string;
}

interface CrudActions<T> {
  fetchItems: () => Promise<void>;
  handleCreate: (data: any) => Promise<boolean>;
  handleUpdate: (id: string, data: any) => Promise<boolean>;
  handleDelete: (id: string) => Promise<boolean>;
  handleEdit: (item: T) => void;
  handleDeleteClick: (item: T) => void;
  handleDeleteConfirm: () => Promise<void>;
  openDialog: () => void;
  closeDialog: () => void;
  setSearchTerm: (term: string) => void;
  reset: () => void;
}

export function useCrudOperations<T extends { id: string; name?: string }>(
  config: CrudConfig<T>
): CrudState<T> & CrudActions<T> {
  const t = useTranslations();
  const { currentClinic } = useWorkspace();
  
  // State
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<T | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch items
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      // Don't send clinicId - let backend get it from cookies
      if (searchDebounce && config.searchParam) {
        params.append(config.searchParam, searchDebounce);
      }
      
      const url = `${config.endpoint}${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${config.entityName}`);
      }
      
      const result = await response.json();
      const data = result.data || result || [];
      
      const transformedData = config.transformData 
        ? data.map(config.transformData)
        : data;
      
      setItems(transformedData);
    } catch (error) {
      console.error(`Error fetching ${config.entityName}:`, error);
      toast.error(t('common.loadError', { entity: config.entityName }));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, config.entityName, config.searchParam, config.transformData, searchDebounce, t]);

  // Initial load and search updates
  useEffect(() => {
    fetchItems();
  }, [config.endpoint, config.entityName, searchDebounce]);

  // Create handler
  const handleCreate = async (data: any): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      // Don't include clinic_id in payload - backend gets it from cookies
      const payload = data;
      
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error);
      }
      
      toast.success(t('common.createSuccess', { entity: config.entityName }));
      await fetchItems();
      return true;
    } catch (error) {
      console.error(`Error creating ${config.entityName}:`, error);
      toast.error(error instanceof Error ? error.message : t('common.createError'));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update handler
  const handleUpdate = async (id: string, data: any): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${config.endpoint}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error);
      }
      
      toast.success(t('common.updateSuccess', { entity: config.entityName }));
      await fetchItems();
      return true;
    } catch (error) {
      console.error(`Error updating ${config.entityName}:`, error);
      toast.error(error instanceof Error ? error.message : t('common.updateError'));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete handler
  const handleDelete = async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${config.endpoint}/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error);
      }
      
      toast.success(t('common.deleteSuccess', { entity: config.entityName }));
      await fetchItems();
      return true;
    } catch (error) {
      console.error(`Error deleting ${config.entityName}:`, error);
      toast.error(error instanceof Error ? error.message : t('common.deleteError'));
      return false;
    }
  };

  // UI handlers
  const handleEdit = (item: T) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (item: T) => {
    setDeletingItem(item);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    
    const success = await handleDelete(deletingItem.id);
    if (success) {
      setDeleteConfirmOpen(false);
      setDeletingItem(null);
    }
  };

  const openDialog = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
  };

  const reset = () => {
    setEditingItem(null);
    setIsDialogOpen(false);
    setDeleteConfirmOpen(false);
    setDeletingItem(null);
    setSearchTerm('');
  };

  return {
    // State
    items,
    loading,
    isSubmitting,
    editingItem,
    isDialogOpen,
    deleteConfirmOpen,
    deletingItem,
    searchTerm,
    searchDebounce,
    
    // Actions
    fetchItems,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleEdit,
    handleDeleteClick,
    handleDeleteConfirm,
    openDialog,
    closeDialog,
    setSearchTerm,
    reset,
  };
}