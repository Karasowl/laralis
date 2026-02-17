## Summary

- What changed:
- Why:

## Refactor Safety Checklist

- [ ] No breaking changes in API routes, methods, or response shape.
- [ ] `npm --prefix web run lint` passes locally.
- [ ] `npm --prefix web run typecheck` passes locally.
- [ ] `npm --prefix web run test:unit` passes locally.
- [ ] Added or updated tests for changed logic.
- [ ] No silent behavior changes without explicit note in this PR.
- [ ] No new `console.log` in `web/app/api/**`.
- [ ] No new direct `fetch()` in domain hooks/components unless justified.

## Validation

- Manual checks:
- Automated checks:

## Risk and Rollback

- Risk level:
- Rollback plan:
