'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { 
  expenseFormSchema, 
  type ExpenseFormData,
  EXPENSE_CATEGORIES,
  EXPENSE_SUBCATEGORIES 
} from '@/lib/types/expenses'
import { useCurrentClinic } from '@/hooks/use-current-clinic'
import { parseMoney } from '@/lib/money'

interface Supply {
  id: string
  name: string
  category: string
}

export default function CreateExpenseDialog() {
  const t = useTranslations('expenses')
  const { currentClinic, loading: clinicLoading } = useCurrentClinic()
  
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [supplies, setSupplies] = useState<Supply[]>([])
  const [showAssetFields, setShowAssetFields] = useState(false)
  
  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      expense_date: new Date().toISOString().split('T')[0],
      category: '',
      subcategory: '',
      description: '',
      amount_cents: 0,
      vendor: '',
      invoice_number: '',
      is_recurring: false,
      quantity: undefined,
      related_supply_id: undefined,
      create_asset: false,
      asset_name: '',
      asset_useful_life_years: undefined
    }
  })

  const watchCategory = form.watch('category')
  const watchCreateAsset = form.watch('create_asset')

  // Fetch supplies when component mounts
  useEffect(() => {
    const fetchSupplies = async () => {
      if (!currentClinic?.id) return

      try {
        const response = await fetch(`/api/supplies?clinic_id=${currentClinic.id}`)
        const data = await response.json()
        if (response.ok) {
          setSupplies(data.data)
        }
      } catch (error) {
        console.error('Error fetching supplies:', error)
      }
    }

    fetchSupplies()
  }, [currentClinic?.id])

  // Show asset fields when category is "Equipos"
  useEffect(() => {
    setShowAssetFields(watchCategory === 'Equipos')
    if (watchCategory === 'Equipos') {
      form.setValue('create_asset', true)
    } else {
      form.setValue('create_asset', false)
      form.setValue('asset_name', '')
      form.setValue('asset_useful_life_years', undefined)
    }
  }, [watchCategory, form])

  const getSubcategoriesForCategory = (category: string) => {
    const subcategoryMap: Record<string, string[]> = {
      'Equipos': ['DENTAL', 'MOBILIARIO', 'TECNOLOGIA', 'HERRAMIENTAS'],
      'Insumos': ['ANESTESIA', 'MATERIALES', 'LIMPIEZA', 'PROTECCION'],
      'Servicios': ['ELECTRICIDAD', 'AGUA', 'INTERNET', 'TELEFONO', 'GAS'],
      'Mantenimiento': ['EQUIPOS_MANT', 'INSTALACIONES', 'SOFTWARE'],
      'Marketing': ['PUBLICIDAD', 'PROMOCIONES', 'EVENTOS'],
      'Administrativos': ['PAPELERIA', 'CONTABILIDAD', 'LEGAL'],
      'Personal': ['NOMINA', 'BENEFICIOS', 'CAPACITACION']
    }

    return subcategoryMap[category] || []
  }

  const onSubmit = async (data: ExpenseFormData) => {
    if (!currentClinic?.id) {
      toast.error(t('no_business_selected'))
      return
    }

    try {
      setLoading(true)

      const payload = {
        ...data,
        clinic_id: currentClinic.id,
        amount_cents: typeof data.amount_cents === 'string' 
          ? parseMoney(data.amount_cents) 
          : data.amount_cents
      }

      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create expense')
      }

      toast.success(t('create_success'))
      form.reset()
      setOpen(false)
      
      // Trigger a refresh of the expenses list
      window.location.reload()

    } catch (error) {
      console.error('Error creating expense:', error)
      toast.error(t('create_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {t('create_expense')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('create_expense')}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="expense_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.date')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount_cents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.amount')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) * 100)}
                        value={field.value ? (field.value / 100).toFixed(2) : ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Category and Subcategory */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.category')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('select_category')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
                          <SelectItem key={key} value={label}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subcategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.subcategory')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('select_subcategory')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getSubcategoriesForCategory(watchCategory).map((subcat) => (
                          <SelectItem key={subcat} value={EXPENSE_SUBCATEGORIES[subcat as keyof typeof EXPENSE_SUBCATEGORIES]}>
                            {EXPENSE_SUBCATEGORIES[subcat as keyof typeof EXPENSE_SUBCATEGORIES]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.description')}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={t('description_placeholder')}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Vendor and Invoice */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vendor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.vendor')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('vendor_placeholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="invoice_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fields.invoice_number')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('invoice_placeholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Supply Integration */}
            {watchCategory === 'Insumos' && (
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <h3 className="font-medium">{t('supply_integration')}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="related_supply_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('fields.supply')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('select_supply')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {supplies.map((supply) => (
                              <SelectItem key={supply.id} value={supply.id}>
                                {supply.name} ({supply.category})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('fields.quantity')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder={t('quantity_placeholder')}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Asset Creation */}
            {showAssetFields && (
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <FormField
                    control={form.control}
                    name="create_asset"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>{t('create_asset')}</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                {watchCreateAsset && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="asset_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('fields.asset_name')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('asset_name_placeholder')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="asset_useful_life_years"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('fields.useful_life')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder={t('useful_life_placeholder')}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Recurring */}
            <FormField
              control={form.control}
              name="is_recurring"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>{t('fields.recurring')}</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('create')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}