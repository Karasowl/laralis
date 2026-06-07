import { httpRouter } from 'convex/server'
import { auth } from './auth'

/**
 * Convex HTTP router. auth.addHttpRoutes registers the @convex-dev/auth endpoints
 * (sign-in/sign-up/verify/reset/refresh) on the Convex deployment's HTTP actions.
 */
const http = httpRouter()
auth.addHttpRoutes(http)

export default http
