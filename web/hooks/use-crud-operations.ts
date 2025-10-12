'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { useWorkspace } from '@/contexts/workspace-context';
import { useCurrentClinic } from '@/hooks/use-current-clinic';

interface CrudConfig<T> {
  endpoint: string;
  entityName: string; // Para mensajes de toast
  includeClinicId?: boolean;
  searchParam?: string;
  staticParams?: Record<string, string>; // Parámetros estáticos para todas las solicitudes GET
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
  // Fallback to cookie/default clinic when Workspace context is not ready
  const { currentClinic: fallbackClinic } = useCurrentClinic();
  
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
  const lastFetchIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Stringified key for static params to use in effect deps
  const staticParamsKey = JSON.stringify(config.staticParams || {});

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
      const fetchId = ++lastFetchIdRef.current;
      try { abortRef.current?.abort() } catch {}
      const controller = new AbortController();
      abortRef.current = controller;

      // Construir URL combinando parámetros existentes + estáticos + búsqueda
      let urlString = config.endpoint;
      const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
      const urlObj = new URL(urlString, base);

      // Incluir clinic id si está configurado y disponible. Si aún no está
      // resuelto en el cliente, dejamos que el backend determine la clínica
      // a partir de la cookie o de un valor por defecto.
      if (config.includeClinicId) {
        let clinicIdToUse = currentClinic?.id || fallbackClinic?.id;
        if (!clinicIdToUse) {
          try {
            if (typeof document !== 'undefined') {
              const m = document.cookie.match(/(?:^|; )clinicId=([^;]+)/);
              if (m) clinicIdToUse = decodeURIComponent(m[1]);
            }
            if (!clinicIdToUse && typeof localStorage !== 'undefined') {
              const stored = localStorage.getItem('selectedClinicId');
              if (stored) clinicIdToUse = stored;
            }
          } catch {}
        }
        if (clinicIdToUse) {
          urlObj.searchParams.set('clinic_id', clinicIdToUse);
          urlObj.searchParams.set('clinicId', clinicIdToUse);
        }
      }

      // Parámetros estáticos (por ejemplo, list=true)
      if (config.staticParams) {
        for (const [k, v] of Object.entries(config.staticParams)) {
          urlObj.searchParams.set(k, v);
        }
      }

      // Parámetro de búsqueda
      if (searchDebounce && config.searchParam) {
        urlObj.searchParams.set(config.searchParam, searchDebounce);
      }

      const url = urlObj.pathname + (urlObj.search ? urlObj.search : '')
      try { console.log('[useCrudOperations] fetch', url) } catch {}
      const response = await fetch(url, { credentials: 'include', signal: controller.signal })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${config.entityName}`);
      }
      
      const result = await response.json();
      const data = result.data || result || [];
      
      const transformedData = config.transformData 
        ? data.map(config.transformData)
        : data;
      
      if (fetchId === lastFetchIdRef.current) {
        try { console.log('[useCrudOperations] fetched', config.endpoint, Array.isArray(transformedData) ? transformedData.length : 'n/a') } catch {}
        setItems(transformedData);
      }
    } catch (error) {
      if ((error as any)?.name === 'AbortError') return;
      console.error(`Error fetching ${config.entityName}:`, error);
      toast.error(t('common.loadError', { entity: config.entityName }));
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, config.entityName, config.searchParam, config.transformData, config.includeClinicId, currentClinic?.id, fallbackClinic?.id, searchDebounce, t, staticParamsKey]);

  // Initial load and search updates
  useEffect(() => {
    // Siempre intentamos cargar. Si no hay clínica en Workspace,
    // se usa la de cookie/fallback y, si tampoco existe, el fetch 
    // seguirá pero sin el parámetro, evitando quedar en loading eterno.
    fetchItems();
  }, [config.endpoint, config.entityName, config.includeClinicId, currentClinic?.id, fallbackClinic?.id, searchDebounce, fetchItems, staticParamsKey]);

  // Create handler
  const handleCreate = async (data: any): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      // Include clinic_id if configured (use fallback if workspace not ready)
      let clinicIdToUse = currentClinic?.id || fallbackClinic?.id;
      if (!clinicIdToUse) {
        try {
          if (typeof document !== 'undefined') {
            const m = document.cookie.match(/(?:^|; )clinicId=([^;]+)/);
            if (m) clinicIdToUse = decodeURIComponent(m[1]);
          }
          if (!clinicIdToUse && typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem('selectedClinicId');
            if (stored) clinicIdToUse = stored;
          }
        } catch {}
      }
      const payload = config.includeClinicId && clinicIdToUse
        ? { ...data, clinic_id: clinicIdToUse }
        : data;
      
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        // Handle precondition failed (412) with a persistent banner-like toast
        if (response.status === 412) {
          let error: any = {};
          try { error = await response.json() } catch {}
          const msg = String(error?.message || 'Missing prerequisites');
          toast.warning(msg, { duration: 8000 });
          return false;
        }
        const error = await response.json();
        throw new Error(error.message || error.error);
      }
      
      try { console.log('[useCrudOperations] create response ok', config.endpoint) } catch {}
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
        credentials: 'include',
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
        credentials: 'include',
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
    setDeleteConfirmOpen(false);
    setDeletingItem(null);
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
