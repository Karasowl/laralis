/**
 * Convex Auth JWT config. CONVEX_SITE_URL is auto-provided by the Convex
 * deployment; the issuer (domain) must equal the JWT issuer. applicationID
 * 'convex' is the @convex-dev/auth convention.
 *
 * JWT_PRIVATE_KEY + JWKS are set on the Convex deployment by `npx @convex-dev/auth`
 * (operator step A2) — never in .env.local.
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
}
