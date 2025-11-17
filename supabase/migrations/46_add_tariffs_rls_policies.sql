-- Migration: Add RLS policies for tariffs table
-- Created: 2025-11-17
-- Purpose: Enable RLS and add policies for tariffs table to allow AI queries

-- Enable RLS on tariffs table
ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view tariffs for their clinic's services
CREATE POLICY "Users can view tariffs for their clinic services"
ON public.tariffs
FOR SELECT
USING (
  service_id IN (
    SELECT s.id
    FROM public.services s
    INNER JOIN public.clinic_members cm ON cm.clinic_id = s.clinic_id
    WHERE cm.user_id = auth.uid()
  )
);

-- Policy: Users can insert tariffs for their clinic's services
CREATE POLICY "Users can insert tariffs for their clinic services"
ON public.tariffs
FOR INSERT
WITH CHECK (
  service_id IN (
    SELECT s.id
    FROM public.services s
    INNER JOIN public.clinic_members cm ON cm.clinic_id = s.clinic_id
    WHERE cm.user_id = auth.uid()
  )
);

-- Policy: Users can update tariffs for their clinic's services
CREATE POLICY "Users can update tariffs for their clinic services"
ON public.tariffs
FOR UPDATE
USING (
  service_id IN (
    SELECT s.id
    FROM public.services s
    INNER JOIN public.clinic_members cm ON cm.clinic_id = s.clinic_id
    WHERE cm.user_id = auth.uid()
  )
);

-- Policy: Users can delete tariffs for their clinic's services
CREATE POLICY "Users can delete tariffs for their clinic services"
ON public.tariffs
FOR DELETE
USING (
  service_id IN (
    SELECT s.id
    FROM public.services s
    INNER JOIN public.clinic_members cm ON cm.clinic_id = s.clinic_id
    WHERE cm.user_id = auth.uid()
  )
);

-- Create index for better performance on RLS checks
CREATE INDEX IF NOT EXISTS idx_tariffs_service_active
ON public.tariffs(service_id, is_active)
WHERE is_active = true;
