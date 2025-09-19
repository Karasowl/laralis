/**
 * Cleans malformed Supabase cookies that can cause auth issues
 */
export function cleanSupabaseCookies() {
  if (typeof window === 'undefined') return

  try {
    // Get all cookies
    const cookies = document.cookie.split(';')

    // Look for malformed Supabase cookies
    cookies.forEach(cookie => {
      const [name] = cookie.trim().split('=')

      // Remove cookies with malformed names (containing brackets or quotes)
      if (name && (name.includes('[') || name.includes('"') || name.includes("'"))) {
        // Delete the malformed cookie
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`
        console.log('Cleaned malformed cookie:', name)
      }
    })
  } catch (error) {
    console.error('Error cleaning cookies:', error)
  }
}