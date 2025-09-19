'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { FormModal } from '@/components/ui/form-modal'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { InputField, FormSection } from '@/components/ui/form-field'

interface CategoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: any[]
  onCreateCategory: (name: string) => Promise<boolean>
  onUpdateCategory: (id: string, name: string) => Promise<boolean>
  onDeleteCategory: (id: string) => Promise<boolean>
}

export function CategoryModal({ 
  open, 
  onOpenChange, 
  categories, 
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory
}: CategoryModalProps) {
  const t = useTranslations('services')
  const tCommon = useTranslations('common')
  const tRoot = useTranslations()
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const handleSubmit = async () => {
    if (!newCategoryName.trim()) return
    const success = await onCreateCategory(newCategoryName)
    if (success) {
      setNewCategoryName('')
      onOpenChange(false)
    }
  }

  const startEdit = (cat: any) => {
    setEditingId(cat.id)
    setEditingName(cat.display_name || cat.name || cat.code || '')
  }

  const saveEdit = async () => {
    if (!editingId) return
    const name = editingName.trim()
    if (!name) return
    try {
      const ok = await onUpdateCategory(editingId, name)
      if (ok) {
        toast.success(tCommon('updateSuccess', { entity: t('category') }))
      } else {
        toast.error(tCommon('updateError', { entity: t('category') }))
      }
      setEditingId(null)
      setEditingName('')
    } catch (e: any) {
      toast.error(tCommon('updateError', { entity: t('category') }))
    }
  }

  const removeCategory = async (id: string) => {
    try {
      const ok = await onDeleteCategory(id)
      if (ok) {
        toast.success(tCommon('deleteSuccess', { entity: t('category') }))
      } else {
        toast.error(tCommon('deleteError', { entity: t('category') }))
      }
      if (ok && editingId === id) {
        setEditingId(null)
        setEditingName('')
      }
    } catch (e: any) {
      toast.error(tCommon('deleteError', { entity: t('category') }))
    }
  }

  const list = Array.isArray(categories) ? categories : []

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('manage_categories')}
      onSubmit={handleSubmit}
      submitLabel={t('addCategory')}
      cancelLabel={tCommon('cancel')}
    >
      <FormSection>
        <InputField
          label={t('categoryName')}
          value={newCategoryName}
          onChange={(v) => setNewCategoryName(String(v))}
          placeholder={t('categoryNamePlaceholder')}
        />
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{tRoot('existing_categories')}</p>
          <div className="flex flex-col gap-2">
            {list.map((cat: any) => {
              const label = cat.display_name || cat.name || cat.code || ''
              const system = !!cat.is_system && !cat.clinic_id
              const isEditing = editingId === (cat.id as string)
              return (
                <div key={cat.id || cat.code || cat.name} className="flex items-center gap-2">
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                      />
                      <button type="button" className="text-primary text-sm" onClick={saveEdit}>{tCommon('update')}</button>
                      <button type="button" className="text-muted-foreground text-sm" onClick={() => { setEditingId(null); setEditingName('') }}>{tCommon('cancel')}</button>
                    </div>
                  ) : (
                    <>
                      <Badge variant="secondary" className="flex-1 justify-start">
                        {label}
                        {system && <span className="ml-2 text-[10px] opacity-60">(system)</span>}
                      </Badge>
                      {!system && (
                        <>
                          <button type="button" className="text-sm text-primary" onClick={() => startEdit(cat)}>{tCommon('edit')}</button>
                          <button type="button" className="text-sm text-destructive" onClick={() => removeCategory(cat.id)}>{tCommon('delete')}</button>
                        </>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </FormSection>
    </FormModal>
  )
}
