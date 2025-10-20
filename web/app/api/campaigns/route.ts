
export const dynamic = 'force-dynamic'

// Unified endpoint: Delegate legacy `/api/campaigns` to `/api/marketing/campaigns`
// to keep backward compatibility while using the single source of truth.
export { GET, POST, PUT } from '../marketing/campaigns/route'
