'use client'

import * as React from 'react'
import { Search, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from '@/components/ui/dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { formatCurrency } from '@/lib/money'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface Supply {
  id: string
  name: string
  cost_per_portion_cents?: number
  cost_per_unit_cents?: number
  price_cents?: number
}

interface SupplyMultiSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplies: Supply[]
  onConfirm: (selectedIds: string[]) => void
  alreadySelectedIds: string[]
  t: (key: string) => string
}

export function SupplyMultiSelector({
  open,
  onOpenChange,
  supplies,
  onConfirm,
  alreadySelectedIds,
  t
}: SupplyMultiSelectorProps) {
  const [search, setSearch] = React.useState('')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  // Reset selection when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelected(new Set())
      setSearch('')
    }
  }, [open])

  // Filter supplies by search and exclude already added
  const availableSupplies = React.useMemo(() => {
    return supplies
      .filter(s => !alreadySelectedIds.includes(s.id))
      .filter(s => {
        if (!search) return true
        const searchLower = search.toLowerCase()
        return s.name.toLowerCase().includes(searchLower)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [supplies, search, alreadySelectedIds])

  const handleToggle = (id: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelected(newSelected)
  }

  const handleSelectAll = () => {
    if (selected.size === availableSupplies.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(availableSupplies.map(s => s.id)))
    }
  }

  const handleConfirm = () => {
    onConfirm(Array.from(selected))
    onOpenChange(false)
  }

  const getSupplyCost = (supply: Supply): number => {
    return supply.cost_per_portion_cents ?? supply.cost_per_unit_cents ?? supply.price_cents ?? 0
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Higher z-index overlay to appear above other modals */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[80] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        {/* Higher z-index content to appear above other modals */}
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-[90] grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg max-h-[80vh] flex flex-col"
          )}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
        <DialogHeader>
          <DialogTitle>{t('add_multiple_supplies')}</DialogTitle>
          <DialogDescription>
            {t('add_multiple_supplies_description')}
          </DialogDescription>
        </DialogHeader>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('search_supplies')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Select all button */}
        {availableSupplies.length > 0 && (
          <div className="flex items-center gap-2 px-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-8 text-xs"
            >
              {selected.size === availableSupplies.length ? t('deselect_all') : t('select_all')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t('selected_count', { count: selected.size })}
            </span>
          </div>
        )}

        {/* Supplies list */}
        <div className="flex-1 overflow-y-auto border rounded-md">
          {availableSupplies.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {search ? t('no_supplies_found') : t('all_supplies_added')}
            </div>
          ) : (
            <div className="divide-y">
              {availableSupplies.map((supply) => (
                <label
                  key={supply.id}
                  className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selected.has(supply.id)}
                    onCheckedChange={() => handleToggle(supply.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{supply.name}</p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(getSupplyCost(supply))}
                    </p>
                  </div>
                  {selected.has(supply.id) && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={selected.size === 0}
          >
            {t('add_selected', { count: selected.size })}
          </Button>
        </DialogFooter>

        {/* Close button */}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
