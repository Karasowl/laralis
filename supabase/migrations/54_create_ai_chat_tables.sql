-- Migration: Create AI Chat Tables
-- Description: Tables for persisting Lara (AI assistant) conversations
-- This enables conversation history and context continuity

-- ============================================================================
-- Chat Sessions Table
-- ============================================================================
-- Stores metadata about each conversation session with Lara

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session metadata
  mode VARCHAR(10) NOT NULL CHECK (mode IN ('entry', 'query')),
  title VARCHAR(255), -- Auto-generated or user-set title

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ, -- NULL if session is still active
  last_message_at TIMESTAMPTZ DEFAULT NOW(),

  -- Stats
  message_count INT NOT NULL DEFAULT 0,

  -- Soft delete
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for chat_sessions
CREATE INDEX idx_chat_sessions_clinic_id ON chat_sessions(clinic_id);
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_last_message ON chat_sessions(last_message_at DESC);
CREATE INDEX idx_chat_sessions_active ON chat_sessions(clinic_id, user_id, ended_at)
  WHERE ended_at IS NULL AND is_archived = FALSE;

-- ============================================================================
-- Chat Messages Table
-- ============================================================================
-- Stores individual messages within a session

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,

  -- Message content
  role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- AI-specific fields
  thinking_process TEXT, -- For Kimi K2 thinking mode
  model_used VARCHAR(50), -- Which LLM model was used
  tokens_used INT, -- Approximate token count

  -- Action suggestion (if any)
  action_suggested JSONB, -- ActionSuggestion object
  action_executed BOOLEAN DEFAULT FALSE,
  action_result JSONB, -- ActionResult if executed

  -- Entry mode specific
  entity_type VARCHAR(50), -- For entry mode: 'patient', 'expense', etc.
  extracted_data JSONB, -- Extracted form data

  -- Audio (if voice was used)
  audio_duration_ms INT, -- Duration of audio message

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for chat_messages
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(session_id, created_at);
CREATE INDEX idx_chat_messages_with_actions ON chat_messages(session_id)
  WHERE action_suggested IS NOT NULL;

-- ============================================================================
-- AI Feedback Table
-- ============================================================================
-- Stores user feedback on AI responses for quality improvement

CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Feedback
  rating VARCHAR(10) NOT NULL CHECK (rating IN ('positive', 'negative')),
  comment TEXT, -- Optional user comment

  -- Context
  query_type VARCHAR(50), -- 'financial', 'patient', 'scheduling', etc.

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for ai_feedback
CREATE INDEX idx_ai_feedback_message_id ON ai_feedback(message_id);
CREATE INDEX idx_ai_feedback_clinic_id ON ai_feedback(clinic_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

-- Chat Sessions: Users can only see their own sessions
CREATE POLICY "Users can view own chat sessions"
  ON chat_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions"
  ON chat_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat sessions"
  ON chat_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Chat Messages: Users can only see messages from their sessions
CREATE POLICY "Users can view messages from own sessions"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions
      WHERE chat_sessions.id = chat_messages.session_id
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to own sessions"
  ON chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions
      WHERE chat_sessions.id = chat_messages.session_id
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- AI Feedback: Users can only manage their own feedback
CREATE POLICY "Users can view own feedback"
  ON ai_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback"
  ON ai_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Trigger: Update session stats on new message
-- ============================================================================

CREATE OR REPLACE FUNCTION update_chat_session_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.session_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_chat_session_stats
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_session_stats();

-- ============================================================================
-- Trigger: Auto-generate session title from first user message
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_generate_session_title()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for user messages, and only if session has no title
  IF NEW.role = 'user' THEN
    UPDATE chat_sessions
    SET title = LEFT(NEW.content, 100)
    WHERE id = NEW.session_id
    AND title IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_auto_generate_session_title
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_session_title();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE chat_sessions IS 'Stores conversation sessions with Lara AI assistant';
COMMENT ON TABLE chat_messages IS 'Individual messages within chat sessions';
COMMENT ON TABLE ai_feedback IS 'User feedback on AI responses for quality tracking';

COMMENT ON COLUMN chat_sessions.mode IS 'entry = data entry mode, query = analytics/question mode';
COMMENT ON COLUMN chat_messages.thinking_process IS 'Kimi K2 thinking process (visible to user)';
COMMENT ON COLUMN chat_messages.action_suggested IS 'ActionSuggestion JSON if AI suggested an action';
COMMENT ON COLUMN chat_messages.extracted_data IS 'Form data extracted during entry mode';
