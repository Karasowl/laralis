-- Migration 74: Inbox conversations + leads
-- Adds lead tracking and inbound campaign routing (WhatsApp first)

-- =============================================================================
-- 1. Leads table (pre-patient pipeline)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  source_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,

  -- Lead identity
  full_name TEXT,
  email TEXT,
  phone TEXT,

  -- Acquisition channel
  channel VARCHAR(20) NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'phone', 'web', 'email', 'other')),

  -- Lead state
  status VARCHAR(20) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  last_contacted_at TIMESTAMPTZ,

  -- Conversion link
  converted_patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,

  notes TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_clinic ON public.leads(clinic_id);
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON public.leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(clinic_id, phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_converted_patient ON public.leads(converted_patient_id);

CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 2. Campaign channels (map inbound numbers to campaigns)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_campaign_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,

  channel_type VARCHAR(20) NOT NULL
    CHECK (channel_type IN ('whatsapp', 'phone', 'web', 'other')),
  channel_address TEXT NOT NULL,
  provider VARCHAR(50),

  is_active BOOLEAN DEFAULT TRUE,
  is_primary BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (clinic_id, channel_type, channel_address)
);

CREATE INDEX IF NOT EXISTS idx_campaign_channels_clinic ON public.marketing_campaign_channels(clinic_id);
CREATE INDEX IF NOT EXISTS idx_campaign_channels_campaign ON public.marketing_campaign_channels(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_channels_address ON public.marketing_campaign_channels(channel_type, channel_address);

CREATE TRIGGER update_campaign_channels_updated_at
BEFORE UPDATE ON public.marketing_campaign_channels
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 3. Inbox conversations (WhatsApp and future channels)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.inbox_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,

  channel VARCHAR(20) NOT NULL
    CHECK (channel IN ('whatsapp', 'phone', 'web', 'email', 'other')),
  contact_address TEXT NOT NULL,
  contact_name TEXT,

  status VARCHAR(20) NOT NULL DEFAULT 'bot'
    CHECK (status IN ('bot', 'pending', 'in_progress', 'closed')),
  conversation_state VARCHAR(30) NOT NULL DEFAULT 'chatting'
    CHECK (conversation_state IN ('collecting_name', 'collecting_email', 'chatting')),

  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,

  metadata JSONB DEFAULT '{}'::JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inbox_conversations_clinic ON public.inbox_conversations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_status ON public.inbox_conversations(status);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_campaign ON public.inbox_conversations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_assigned ON public.inbox_conversations(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_contact ON public.inbox_conversations(clinic_id, contact_address);
CREATE INDEX IF NOT EXISTS idx_inbox_conversations_last_message ON public.inbox_conversations(last_message_at DESC);

CREATE TRIGGER update_inbox_conversations_updated_at
BEFORE UPDATE ON public.inbox_conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 4. Inbox messages
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.inbox_conversations(id) ON DELETE CASCADE,

  role VARCHAR(10) NOT NULL
    CHECK (role IN ('user', 'assistant', 'agent', 'system')),
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,

  message_type VARCHAR(20) DEFAULT 'text',
  direction VARCHAR(10) NOT NULL
    CHECK (direction IN ('inbound', 'outbound')),

  channel_message_id TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_conversation ON public.inbox_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_created_at ON public.inbox_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_channel_message ON public.inbox_messages(channel_message_id);

-- =============================================================================
-- 5. Conversation stats updater
-- =============================================================================

CREATE OR REPLACE FUNCTION update_inbox_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.inbox_conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(COALESCE(NEW.content, ''), 200),
    unread_count = CASE
      WHEN NEW.direction = 'inbound' THEN COALESCE(unread_count, 0) + 1
      ELSE COALESCE(unread_count, 0)
    END,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_inbox_conversation_stats ON public.inbox_messages;
CREATE TRIGGER trigger_update_inbox_conversation_stats
AFTER INSERT ON public.inbox_messages
FOR EACH ROW
EXECUTE FUNCTION update_inbox_conversation_stats();

-- =============================================================================
-- 6. RLS policies
-- =============================================================================

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaign_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

-- Leads
CREATE POLICY "leads_select_policy"
  ON public.leads
  FOR SELECT
  USING (
    is_clinic_member(clinic_id)
    AND has_permission(clinic_id, 'leads', 'view')
  );

CREATE POLICY "leads_insert_policy"
  ON public.leads
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      is_clinic_member(clinic_id)
      AND has_permission(clinic_id, 'leads', 'create')
    )
  );

CREATE POLICY "leads_update_policy"
  ON public.leads
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (
      is_clinic_member(clinic_id)
      AND has_permission(clinic_id, 'leads', 'edit')
    )
  );

CREATE POLICY "leads_delete_policy"
  ON public.leads
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR (
      is_clinic_member(clinic_id)
      AND has_permission(clinic_id, 'leads', 'delete')
    )
  );

-- Campaign channels
CREATE POLICY "campaign_channels_select_policy"
  ON public.marketing_campaign_channels
  FOR SELECT
  USING (
    is_clinic_member(clinic_id)
    AND has_permission(clinic_id, 'campaigns', 'view')
  );

CREATE POLICY "campaign_channels_insert_policy"
  ON public.marketing_campaign_channels
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (
      is_clinic_member(clinic_id)
      AND has_permission(clinic_id, 'campaigns', 'create')
    )
  );

CREATE POLICY "campaign_channels_update_policy"
  ON public.marketing_campaign_channels
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (
      is_clinic_member(clinic_id)
      AND has_permission(clinic_id, 'campaigns', 'edit')
    )
  );

CREATE POLICY "campaign_channels_delete_policy"
  ON public.marketing_campaign_channels
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR (
      is_clinic_member(clinic_id)
      AND has_permission(clinic_id, 'campaigns', 'delete')
    )
  );

-- Inbox conversations
CREATE POLICY "inbox_conversations_select_policy"
  ON public.inbox_conversations
  FOR SELECT
  USING (
    is_clinic_member(clinic_id)
    AND has_permission(clinic_id, 'inbox', 'view')
  );

CREATE POLICY "inbox_conversations_insert_policy"
  ON public.inbox_conversations
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
  );

CREATE POLICY "inbox_conversations_update_policy"
  ON public.inbox_conversations
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR (
      is_clinic_member(clinic_id)
      AND (
        has_permission(clinic_id, 'inbox', 'assign')
        OR has_permission(clinic_id, 'inbox', 'close')
        OR has_permission(clinic_id, 'inbox', 'transfer')
      )
    )
  );

-- Inbox messages
CREATE POLICY "inbox_messages_select_policy"
  ON public.inbox_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.inbox_conversations ic
      WHERE ic.id = inbox_messages.conversation_id
        AND is_clinic_member(ic.clinic_id)
        AND has_permission(ic.clinic_id, 'inbox', 'view')
    )
  );

CREATE POLICY "inbox_messages_insert_policy"
  ON public.inbox_messages
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.inbox_conversations ic
      WHERE ic.id = inbox_messages.conversation_id
        AND is_clinic_member(ic.clinic_id)
        AND has_permission(ic.clinic_id, 'inbox', 'reply')
    )
  );

-- =============================================================================
-- 7. Default permissions for new resources
-- =============================================================================

-- Workspace roles
INSERT INTO public.role_permissions (role, scope, resource, action, allowed) VALUES
  ('admin', 'workspace', 'inbox', 'view', true),
  ('admin', 'workspace', 'inbox', 'assign', true),
  ('admin', 'workspace', 'inbox', 'reply', true),
  ('admin', 'workspace', 'inbox', 'close', true),
  ('admin', 'workspace', 'inbox', 'transfer', true),
  ('admin', 'workspace', 'leads', 'view', true),
  ('admin', 'workspace', 'leads', 'create', true),
  ('admin', 'workspace', 'leads', 'edit', true),
  ('admin', 'workspace', 'leads', 'delete', true),

  ('editor', 'workspace', 'inbox', 'view', true),
  ('editor', 'workspace', 'inbox', 'assign', false),
  ('editor', 'workspace', 'inbox', 'reply', true),
  ('editor', 'workspace', 'inbox', 'close', false),
  ('editor', 'workspace', 'inbox', 'transfer', false),
  ('editor', 'workspace', 'leads', 'view', true),
  ('editor', 'workspace', 'leads', 'create', false),
  ('editor', 'workspace', 'leads', 'edit', false),
  ('editor', 'workspace', 'leads', 'delete', false),

  ('viewer', 'workspace', 'inbox', 'view', false),
  ('viewer', 'workspace', 'inbox', 'assign', false),
  ('viewer', 'workspace', 'inbox', 'reply', false),
  ('viewer', 'workspace', 'inbox', 'close', false),
  ('viewer', 'workspace', 'inbox', 'transfer', false),
  ('viewer', 'workspace', 'leads', 'view', false),
  ('viewer', 'workspace', 'leads', 'create', false),
  ('viewer', 'workspace', 'leads', 'edit', false),
  ('viewer', 'workspace', 'leads', 'delete', false)
ON CONFLICT (role, scope, resource, action) DO NOTHING;

-- Clinic roles
INSERT INTO public.role_permissions (role, scope, resource, action, allowed) VALUES
  ('admin', 'clinic', 'inbox', 'view', true),
  ('admin', 'clinic', 'inbox', 'assign', true),
  ('admin', 'clinic', 'inbox', 'reply', true),
  ('admin', 'clinic', 'inbox', 'close', true),
  ('admin', 'clinic', 'inbox', 'transfer', true),
  ('admin', 'clinic', 'leads', 'view', true),
  ('admin', 'clinic', 'leads', 'create', true),
  ('admin', 'clinic', 'leads', 'edit', true),
  ('admin', 'clinic', 'leads', 'delete', true),

  ('receptionist', 'clinic', 'inbox', 'view', true),
  ('receptionist', 'clinic', 'inbox', 'assign', true),
  ('receptionist', 'clinic', 'inbox', 'reply', true),
  ('receptionist', 'clinic', 'inbox', 'close', true),
  ('receptionist', 'clinic', 'inbox', 'transfer', true),
  ('receptionist', 'clinic', 'leads', 'view', true),
  ('receptionist', 'clinic', 'leads', 'create', true),
  ('receptionist', 'clinic', 'leads', 'edit', true),
  ('receptionist', 'clinic', 'leads', 'delete', true),

  ('assistant', 'clinic', 'inbox', 'view', true),
  ('assistant', 'clinic', 'inbox', 'assign', false),
  ('assistant', 'clinic', 'inbox', 'reply', true),
  ('assistant', 'clinic', 'inbox', 'close', true),
  ('assistant', 'clinic', 'inbox', 'transfer', false),
  ('assistant', 'clinic', 'leads', 'view', true),
  ('assistant', 'clinic', 'leads', 'create', false),
  ('assistant', 'clinic', 'leads', 'edit', false),
  ('assistant', 'clinic', 'leads', 'delete', false),

  ('doctor', 'clinic', 'inbox', 'view', true),
  ('doctor', 'clinic', 'inbox', 'assign', false),
  ('doctor', 'clinic', 'inbox', 'reply', false),
  ('doctor', 'clinic', 'inbox', 'close', false),
  ('doctor', 'clinic', 'inbox', 'transfer', false),
  ('doctor', 'clinic', 'leads', 'view', true),
  ('doctor', 'clinic', 'leads', 'create', false),
  ('doctor', 'clinic', 'leads', 'edit', false),
  ('doctor', 'clinic', 'leads', 'delete', false),

  ('viewer', 'clinic', 'inbox', 'view', false),
  ('viewer', 'clinic', 'inbox', 'assign', false),
  ('viewer', 'clinic', 'inbox', 'reply', false),
  ('viewer', 'clinic', 'inbox', 'close', false),
  ('viewer', 'clinic', 'inbox', 'transfer', false),
  ('viewer', 'clinic', 'leads', 'view', false),
  ('viewer', 'clinic', 'leads', 'create', false),
  ('viewer', 'clinic', 'leads', 'edit', false),
  ('viewer', 'clinic', 'leads', 'delete', false)
ON CONFLICT (role, scope, resource, action) DO NOTHING;

-- =============================================================================
-- 8. Comments
-- =============================================================================

COMMENT ON TABLE public.leads IS 'Inbound leads tied to campaigns before conversion to patients';
COMMENT ON TABLE public.marketing_campaign_channels IS 'Campaign channel routing (WhatsApp numbers, phone lines, etc.)';
COMMENT ON TABLE public.inbox_conversations IS 'Inbound/outbound conversation threads by clinic';
COMMENT ON TABLE public.inbox_messages IS 'Messages within inbox conversations';
