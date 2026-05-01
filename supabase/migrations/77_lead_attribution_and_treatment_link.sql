-- Migration 77: Lead attribution (Click-to-WhatsApp metadata) + explicit lead -> treatment link
--
-- Why:
--  - Click-to-WhatsApp ads attach a `referral` object to the first inbound message
--    that includes ctwa_clid, ad_id, source_url, headline, body, media_type.
--    Capturing this lets us attribute every conversation back to the specific ad
--    that generated it, not just to the campaign.
--  - Today the link from a lead to a paying treatment is implicit
--    (leads.converted_patient_id -> patients.id -> treatments.patient_id).
--    Adding treatments.lead_id makes the funnel CTWA -> lead -> patient -> treatment
--    queryable in one join, which the marketing dashboard needs to compute
--    revenue per ad.
--
-- Backwards compatible: all new columns are nullable, all FKs ON DELETE SET NULL.

-- =============================================================================
-- 1. Click-to-WhatsApp attribution columns on leads
-- =============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ctwa_clid TEXT,
  ADD COLUMN IF NOT EXISTS ad_id TEXT,
  ADD COLUMN IF NOT EXISTS ad_source_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ad_source_url TEXT,
  ADD COLUMN IF NOT EXISTS ad_headline TEXT,
  ADD COLUMN IF NOT EXISTS ad_body TEXT,
  ADD COLUMN IF NOT EXISTS ad_media_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ad_media_url TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_ctwa_clid ON public.leads(ctwa_clid)
  WHERE ctwa_clid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_ad_id ON public.leads(ad_id)
  WHERE ad_id IS NOT NULL;

COMMENT ON COLUMN public.leads.ctwa_clid IS
  'Click-to-WhatsApp click identifier from Meta. Joinable with Meta Ads conversion exports for revenue attribution.';
COMMENT ON COLUMN public.leads.ad_id IS
  'Ad or post ID that generated the click (referral.source_id from WhatsApp Cloud API).';
COMMENT ON COLUMN public.leads.ad_source_type IS
  'Either "ad" or "post" (referral.source_type).';

-- =============================================================================
-- 2. Lead -> Treatment explicit link
-- =============================================================================

ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_treatments_lead ON public.treatments(lead_id)
  WHERE lead_id IS NOT NULL;

COMMENT ON COLUMN public.treatments.lead_id IS
  'Optional link to the lead that originated this treatment, used for marketing attribution.';

-- =============================================================================
-- 3. Backfill: link existing treatments to leads via converted_patient_id
-- =============================================================================
-- This connects historical leads that were already converted to patients
-- with their first treatment. Safe to re-run.

UPDATE public.treatments t
SET lead_id = l.id
FROM public.leads l
WHERE t.lead_id IS NULL
  AND l.converted_patient_id = t.patient_id
  AND l.clinic_id = t.clinic_id
  AND t.id = (
    SELECT t2.id FROM public.treatments t2
    WHERE t2.patient_id = l.converted_patient_id
      AND t2.clinic_id = l.clinic_id
    ORDER BY t2.treatment_date ASC NULLS LAST, t2.created_at ASC
    LIMIT 1
  );
