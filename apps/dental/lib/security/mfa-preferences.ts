export interface MfaTwoFactor {
  enabled?: boolean
  secret?: string
  recoveryCodes?: string[]
  verifiedAt?: string | null
  disabledAt?: string | null
}

export interface MfaPreferences {
  two_factor?: MfaTwoFactor
  two_factor_pending?: {
    secret: string
    createdAt: string
  } | null
  [key: string]: unknown
}

const SECURITY_SETTINGS_KEY = 'security'

export function ensureMfaPreferences(input: unknown): MfaPreferences {
  if (typeof input === 'object' && input !== null) {
    return input as MfaPreferences
  }

  return {}
}

export async function loadMfaPreferences(supabase: any, userId: string): Promise<MfaPreferences> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('value')
    .eq('user_id', userId)
    .eq('key', SECURITY_SETTINGS_KEY)
    .maybeSingle()

  if (error) {
    throw error
  }

  return ensureMfaPreferences(data?.value)
}

export async function saveMfaPreferences(
  supabase: any,
  userId: string,
  preferences: MfaPreferences
) {
  const { error } = await supabase
    .from('user_settings')
    .upsert(
      {
        user_id: userId,
        key: SECURITY_SETTINGS_KEY,
        value: preferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,key' }
    )

  if (error) {
    throw error
  }
}
