# Rollback and recovery

The site is stateless: everything rebuilds from git. Recovery means serving an earlier release, which is one command.

## How releases work

Every deploy of `main` (`.github/workflows/ci.yml`, job `deploy`, script `scripts/deploy-release.sh`):

1. uses the single `dist/` artifact built and tested earlier in the same run (an empty `dist/` is refused),
2. rsyncs it to `/opt/static-web/sites/portfolio/releases/<UTC timestamp>-<short sha>/` (never into the live tree),
3. switches the `current` symlink to that directory in one atomic rename (`mv -T`),
4. keeps the newest five releases and never removes the live one.

Caddy serves `/opt/static-web/sites/portfolio/current`. The one-time host setup is in `docs/caddy/Caddyfile.proposed.md`.

## Roll back by hand on lxc-staticweb

The quickest path, with no checkout needed. Run as root after `pct enter 105` on `srv-saraswati`:

```bash
cd /opt/static-web/sites/portfolio
ls -1 releases                                      # names sort in deploy order; `readlink current` shows the live one
ln -s releases/<previous-id> .current.tmp && mv -T -f .current.tmp current
readlink current
curl -sI -H 'Host: portfolio.faysalahmed.ca' http://127.0.0.1/ | head -n 1
```

The script-based rollback below needs a bash shell and a checkout (not Windows PowerShell).

## Roll back one release (the normal case)

From any machine on the tailnet that has the deploy key, or from the host itself:

```bash
# On the static host, as the deploy user. Lists releases newest first and shows the live one:
cd /opt/static-web/sites/portfolio && ls -1 releases | sort -r && readlink current

# Switch to the previous release (replace <id> with a name from the list):
ln -s "releases/<id>" current.new && mv -T current.new current
```

Or with the script (set `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_SSH_KEY_FILE`):

```bash
scripts/deploy-release.sh rollback            # the next older release than the live one
scripts/deploy-release.sh rollback <id>       # a named release
scripts/deploy-release.sh --dry-run rollback  # print the plan, change nothing
```

Rolling back does not delete anything, and it refuses a release with no `index.html`. Run it again to step back further.

## Restore check

```bash
readlink /opt/static-web/sites/portfolio/current                       # on the host: shows the release you chose
curl -sI https://portfolio.faysalahmed.ca/ | head -n 1                 # HTTP/2 200
curl -s  https://portfolio.faysalahmed.ca/ | grep -c 'Faysal Ahmed'    # 1 or more
```

Then fix forward: revert the bad commit on a branch, open a PR, merge. The next deploy becomes the new `current`.

## If the deploy job fails

| Message                                             | Cause                                                   | Fix                                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SSH_KNOWN_HOSTS is empty`                          | The secret is missing                                   | Create it (`docs/caddy/Caddyfile.proposed.md`, step 2). The job stops before any network step.                                                     |
| `refusing to deploy`                                | `dist/index.html` missing or empty                      | Fix the build; nothing was sent to the host.                                                                                                       |
| `Host key verification failed`                      | The host key changed or the secret holds the wrong name | Rebuild the `known_hosts` line on the host and update the secret. Never replace it with `ssh-keyscan` output without checking the key on the host. |
| `releases is missing` or `current is not a symlink` | Host migration not done                                 | Do steps 1 to 4 of the migration. The live site is untouched.                                                                                      |
| `index.html is missing or empty; not switching`     | The rsync did not complete                              | Re-run the job. `current` still points at the previous release.                                                                                    |

Concurrent pushes queue: the `deploy-production` concurrency group never cancels a running deploy, and a newer pending run replaces an older pending one.

## If a Caddy change breaks the site

Restore the Caddyfile backup taken in migration step 0 and reload (or restart if `admin off` is set), then re-run the restore check. A wrong `root` path serves 404; a bad `Content-Security-Policy` header blanks the page, which is why only `frame-ancestors` is enforced at first.

## Health check

Uptime Kuma, HTTP(s) Keyword monitor, per hostname: `https://portfolio.faysalahmed.ca/` with keyword `Faysal Ahmed`. It fails on a 404, a blank page or the wrong site. Per-tool checks are in `docs/monitoring.md`.

## Backup

Nothing stateful lives here. The restore path for the whole site is `git clone`, `npm ci`, `npm run build`, and the deploy script; the restore check above proves it.
