# Summary

<!-- One or two sentences: what does this PR do, and why? -->

## Scope

<!-- What is explicitly included and excluded? Link the phase/task if relevant. -->

## Product or domain decision

<!-- Does this change or clarify a product/business/architecture rule from CLAUDE.md?
     If so, which source-of-truth document was updated? If not, write "None." -->

## Validation performed

<!-- Commands actually run locally: mvnw test/package, npm test/typecheck/lint/expo-doctor, etc. -->

## Manual validation

<!-- UI/browser/device walkthroughs actually performed, if any. Write "None." if not applicable. -->

## Database migration

<!-- New Flyway migration file(s)? Forward-only? Safe for existing rows? Write "None." if not applicable. -->

## Security and tenant-isolation impact

<!-- Any change to authentication, authorization, tenant scoping, or data exposure? Write "None." if not applicable. -->

## Known limitations

<!-- Anything deliberately deferred, or a known issue this PR introduces or leaves unresolved. -->

## Checklist

- [ ] Source-of-truth documents (`CLAUDE.md`, `apps/*/CLAUDE.md`, `docs/IMPLEMENTATION_PLAN.md`) updated where required
- [ ] Backend tests passed (`mvnw test`)
- [ ] Mobile tests passed (`npm test`)
- [ ] Typecheck passed (`npm run typecheck`)
- [ ] Lint passed (`npm run lint`)
- [ ] Expo Doctor result reported when relevant to a native dependency change (not a required CI check — see `docs/DEVELOPMENT_WORKFLOW.md`)
- [ ] No secret or token committed
- [ ] No unrelated changes included
- [ ] Any database migration is forward-only
- [ ] Tenant isolation preserved
- [ ] Working tree reviewed (`git status` / `git diff`) before commit
