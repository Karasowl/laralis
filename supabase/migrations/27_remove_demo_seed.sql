-- Remove legacy demo organizations/clinics inserted by early migrations
DELETE FROM public.clinics
WHERE name IN ('Toluca Centro', 'Toluca Norte');

DELETE FROM public.organizations
WHERE name = 'PoDent Group'
  AND NOT EXISTS (
    SELECT 1 FROM public.clinics c WHERE c.org_id = organizations.id
  );

UPDATE public.settings_time
SET clinic_id = NULL
WHERE clinic_id IS NOT NULL
  AND clinic_id NOT IN (SELECT id FROM public.clinics);

UPDATE public.fixed_costs
SET clinic_id = NULL
WHERE clinic_id IS NOT NULL
  AND clinic_id NOT IN (SELECT id FROM public.clinics);
