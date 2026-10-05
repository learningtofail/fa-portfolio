# Runbook: make the repository private

This is a manual action for the owner. No automated change does it.

**RISK.** Private repositories use paid GitHub Actions minutes beyond the plan's free quota, and any workflow that fetches from this repo without credentials breaks. The vendored Orchis tokens come from the design-system repo, which must stay public, or `tokens:check` fails in CI. Rollback: Settings, General, Danger Zone, "Change visibility" back to public (history that was public before may already be cached or forked).

## Before

1. Confirm the Phase 5 host migration is done and the deploy has succeeded at least once.
2. Confirm the Orchis design-system repo is public (`git ls-remote https://github.com/<owner>/<design-system-repo>` works unauthenticated). Do not change it.
3. Check Actions usage in Settings, Billing, and confirm the free private-repo minutes cover roughly one CI run per PR and push.

## Do

1. Settings, General, Danger Zone, "Change repository visibility", Make private, and confirm.
2. Check that Actions are still enabled and that the `production` environment, `SSH_*` secrets and `SSH_KNOWN_HOSTS` secret are still present.

## Verify

```bash
git ls-remote https://github.com/learningtofail/fa-portfolio   # unauthenticated: must fail ("Repository not found")
gh run list --repo learningtofail/fa-portfolio --limit 3       # next push still builds
curl -sI https://portfolio.faysalahmed.ca/ | head -1           # site still 200
```
