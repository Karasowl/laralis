#!/usr/bin/env bash
#
# Vercel Firewall rate-limit rules for the dental app.
#
# Why these live here and not only in the dashboard: firewall config is not part of
# the repo by default, so a rule someone adds by hand is invisible in review and
# lost if the project is recreated. Running this script is idempotent enough to be
# the source of truth — `vercel firewall rules add` stages a draft, and nothing
# reaches production traffic until it is published.
#
# Why the firewall instead of application code: it cuts at the edge, before a
# function is invoked, so it covers /api regardless of which auth backend is active,
# and Vercel does not bill requests it rate-limits. The previous @upstash/ratelimit
# code in middleware.ts covered none of that (see the comment at the top of that file).
#
# Usage:
#   vercel login                         # once per machine
#   cd apps/dental && bash scripts/firewall/rules.sh
#   # then publish the staged draft from the Firewall tab in the dashboard
#
# Limits are deliberately generous: they exist to stop scripted abuse, not to shape
# normal clinic traffic. A busy front desk does single-digit requests per second.

set -euo pipefail

cd "$(dirname "$0")/../.."

vercel firewall rules add "rate-limit-api" \
  --condition '{"type":"path","op":"pre","value":"/api"}' \
  --action rate_limit \
  --rate-limit-window 60 \
  --rate-limit-requests 120 \
  --rate-limit-keys ip \
  --rate-limit-action deny \
  --description "General ceiling on the API surface" \
  --yes

# Public booking creates rows and, once confirmed, sends messages. It is
# unauthenticated, so it gets the tightest limit of the four.
vercel firewall rules add "rate-limit-public-booking" \
  --condition '{"type":"path","op":"pre","value":"/api/public/book"}' \
  --action rate_limit \
  --rate-limit-window 3600 \
  --rate-limit-requests 10 \
  --rate-limit-keys ip \
  --rate-limit-action deny \
  --description "Unauthenticated booking: 10 per hour per IP" \
  --yes

# The AI routes bill per call against the project's STT/TTS/LLM keys.
vercel firewall rules add "rate-limit-ai" \
  --condition '{"type":"path","op":"pre","value":"/api/ai"}' \
  --action rate_limit \
  --rate-limit-window 60 \
  --rate-limit-requests 30 \
  --rate-limit-keys ip \
  --rate-limit-action deny \
  --description "Metered AI providers: 30 per minute per IP" \
  --yes

# Credential stuffing and password-reset flooding.
vercel firewall rules add "rate-limit-auth" \
  --condition '{"type":"path","op":"pre","value":"/api/auth"}' \
  --action rate_limit \
  --rate-limit-window 300 \
  --rate-limit-requests 20 \
  --rate-limit-keys ip \
  --rate-limit-action deny \
  --description "Auth endpoints: 20 per 5 minutes per IP" \
  --yes

echo
echo "Rules staged as drafts. Publish them from the Firewall tab to take effect."
echo "Verify with: vercel firewall rules list --expand"
