-- Add inventory fields to supplies table
-- Migration: 19_add_inventory_to_supplies

-- Add inventory management fields to supplies
ALTER TABLE public.supplies 
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS last_purchase_price_cents INTEGER,
ADD COLUMN IF NOT EXISTS last_purchase_date DATE;

-- Add inventory tracking fields to expenses for integration
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS related_asset_id UUID REFERENCES public.assets(id),
ADD COLUMN IF NOT EXISTS related_supply_id UUID REFERENCES public.supplies(id),
ADD COLUMN IF NOT EXISTS quantity INTEGER,
ADD COLUMN IF NOT EXISTS auto_processed BOOLEAN DEFAULT false;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_supplies_stock_quantity ON public.supplies(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_supplies_min_stock_alert ON public.supplies(min_stock_alert);
CREATE INDEX IF NOT EXISTS idx_expenses_related_supply ON public.expenses(related_supply_id);
CREATE INDEX IF NOT EXISTS idx_expenses_related_asset ON public.expenses(related_asset_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);

-- Add comments for documentation
COMMENT ON COLUMN public.supplies.stock_quantity IS 'Current inventory quantity available';
COMMENT ON COLUMN public.supplies.min_stock_alert IS 'Minimum stock level before alert';
COMMENT ON COLUMN public.supplies.last_purchase_price_cents IS 'Last purchase price in cents';
COMMENT ON COLUMN public.supplies.last_purchase_date IS 'Date of last purchase';

COMMENT ON COLUMN public.expenses.related_asset_id IS 'If expense created an asset, reference to it';
COMMENT ON COLUMN public.expenses.related_supply_id IS 'If expense updated supply inventory, reference to it';
COMMENT ON COLUMN public.expenses.quantity IS 'Quantity purchased (for supply purchases)';
COMMENT ON COLUMN public.expenses.auto_processed IS 'Whether the expense was automatically integrated';

-- Create a view for low stock alerts
CREATE OR REPLACE VIEW public.low_stock_alerts AS
SELECT 
    s.id,
    s.name,
    s.category,
    s.stock_quantity,
    s.min_stock_alert,
    s.clinic_id,
    c.name as clinic_name
FROM public.supplies s
JOIN public.clinics c ON s.clinic_id = c.id
WHERE s.stock_quantity <= s.min_stock_alert
  AND s.stock_quantity >= 0;

COMMENT ON VIEW public.low_stock_alerts IS 'View for supplies with low stock levels';