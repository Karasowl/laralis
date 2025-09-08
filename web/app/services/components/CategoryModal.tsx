'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { FormModal } from '@/components/ui/form-modal'
import { Badge } from '@/components/ui/badge'
import { InputField, FormSection } from '@/components/ui/form-field'

interface CategoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: any[]
  onCreateCategory: (name: string) => Promise<boolean>
}

export function CategoryModal({ 
  open, 
  onOpenChange, 
  categories, 
  onCreateCategory 
}: CategoryModalProps) {
  const t = useTranslations('services')
  const tCommon = useTranslations('common')
  const tRoot = useTranslations()
  const [newCategoryName, setNewCategoryName] = useState('')

  const handleSubmit = async () => {
    if (!newCategoryName.trim()) return
    const success = await onCreateCategory(newCategoryName)
    if (success) {
      setNewCategoryName('')
      onOpenChange(false)
    }
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('manage_categories')}
      onSubmit={handleSubmit}
      submitLabel={t('addCategory')}
      cancelLabel={tRoot('cancel')}
    >
      <FormSection>
        <InputField
          label={t('categoryName')}
          value={newCategoryName}
          onChange={setNewCategoryName}
          placeholder={t('categoryNamePlaceholder')}
        />
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{tRoot('existing_categories')}</p>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <Badge key={cat.id} variant="secondary">{cat.name}</Badge>
            ))}
          </div>
        </div>
      </FormSection>
    </FormModal>
  )
}
