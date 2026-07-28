import type { Permission } from '@/lib/permissions'

/**
 * Shared guards for the Lara AI routes.
 *
 * These routes call paid third-party providers (STT/TTS/LLM) on the project's own
 * API keys. `/api/ai/transcribe` and `/api/ai/synthesize` shipped with no auth at
 * all, which made them a free, uncapped transcription and text-to-speech service
 * for anyone who read the URL out of the client bundle.
 */

/**
 * A caller may use the shared AI plumbing (transcription, speech synthesis) if they
 * are allowed to use Lara in EITHER mode. The narrower per-mode check stays where
 * the mode is actually known — the session routes read it off `chat_sessions.mode`.
 */
export const LARA_ANY_MODE_PERMISSIONS: Permission[] = [
  'lara.use_entry_mode',
  'lara.use_query_mode',
]

/**
 * Per-mode permission for the routes that know which mode they are serving.
 * Mirrors the mapping that app/api/ai/sessions/[id]/route.ts applies to
 * `chat_sessions.mode`.
 */
export const laraPermissionForMode = (mode: string | null | undefined): Permission =>
  mode === 'query' ? 'lara.use_query_mode' : 'lara.use_entry_mode'

/** Upper bound on uploaded audio. Deepgram/Whisper bill by length, so this is a cost cap. */
export const MAX_TRANSCRIBE_AUDIO_BYTES = 25 * 1024 * 1024

/** Upper bound on text sent to the TTS provider, matching the existing Zod schema. */
export const MAX_SYNTHESIZE_TEXT_CHARS = 500
