-- Add the missing custom role reference used by the team invitation API.
-- Idempotent so it can be applied safely to stage and later to production.

ALTER TABLE invitations
ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES custom_role_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invitations_custom_role_id
ON invitations(custom_role_id);
