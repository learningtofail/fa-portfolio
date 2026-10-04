# Proposed Caddy site block for portfolio.faysalahmed.ca

**Status: proposed, not applied.** This repository cannot see the host's Caddyfile. Lines marked `[verify]` are assumptions to confirm on the host before you change anything. Nothing in this file changes production until you edit the host's Caddyfile yourself.

**The Phase 5 pull request must not be merged until steps 1 to 4 below are done.** The new deploy job writes to `releases/<id>/` and refuses to run against a host that has no `current` symlink, so merging early makes every deploy fail (the live site keeps serving, nothing breaks, but deploys stop until you finish the migration).

## Complete site block

```caddyfile
# portfolio.faysalahmed.ca: resume and client-side tools. Stateless, rebuilt from git on every deploy.
# [verify] Keep the site address form the current block uses (for example `http://portfolio.faysalahmed.ca`
# when Cloudflare Tunnel terminates TLS in front of Caddy).
http://portfolio.faysalahmed.ca {
	# Atomic releases: the deploy script switches this symlink. [verify] the base path matches DEPLOY_PATH.
	root * /opt/static-web/sites/portfolio/current
	encode zstd gzip
	file_server

	header {
		# Enforced now. This is the only part of the policy that cannot break the page: it limits who may
		# embed it. www.faysalahmed.ca embeds the tools in an iframe, so it must stay allowed.
		Content-Security-Policy "frame-ancestors https://www.faysalahmed.ca"

		# Report-only first: the full policy, with hashes for Astro's inline island code. Browsers log violations
		# to the console without blocking anything. Promote it (rename the header) after a clean review.
		Content-Security-Policy-Report-Only "default-src 'none'; script-src 'self' 'sha256-Q2BPg90ZMplYY+FSdApNErhpWafg2hcRRbndmvxuL/Q=' 'sha256-Ya0pUYrC7nM5Cn/056TyVuEiz6dFGrzmkWzgON0pF0U='; style-src 'self' 'sha256-vv9IoKo7BSLbWcUHr3tNmfNVmm5L/9Cfn2H6LMk7/ow='; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors https://www.faysalahmed.ca"

		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
		X-Robots-Tag "noindex, nofollow"
		-Server
	}

	# Fingerprinted build output never changes, so it can be cached for a year. HTML must revalidate so a new
	# release shows up right after the symlink switch.
	@assets path /_astro/*
	header @assets Cache-Control "public, max-age=31536000, immutable"
	@pages not path /_astro/*
	header @pages Cache-Control "no-cache"
}
```

Notes on the policy:

- `frame-ancestors` is enforced by itself so the iframe rule is live from day one. It supersedes `X-Frame-Options`; do not add that header, because `ALLOW-FROM` is obsolete and `SAMEORIGIN` would block www.
- The two script hashes are Astro's island bootstrap and hydration scripts; the style hash is Astro's one-line `astro-island { display: contents }` rule. All other CSS and JS is same-origin (`astro.config.mjs` sets `inlineStylesheets: "never"`). The page itself has no inline `style` attributes (an e2e test enforces it).
- Hashes change when Astro changes those snippets. Run `npm run csp:hashes` after an Astro upgrade; CI warns when this file holds a stale hash (`npm run csp:check`). The e2e suite loads every page under this exact policy, enforced, and fails on any violation or on a tool that stops working.
- `connect-src 'self'`, `form-action 'none'` and `default-src 'none'` encode the privacy statement: nothing a visitor enters can be sent to another origin.
- The matching `frame-src https://portfolio.faysalahmed.ca` belongs in www's own Caddy block. That is the other repository; this document does not change it.

## One-time host migration (do this before merging the Phase 5 PR)

All commands run **on the static host** (`[verify]` which machine serves `/opt/static-web`), unless a step says otherwise.

### 0. Record the current state

```bash
cd /opt/static-web/sites/portfolio
ls -la | head
sudo cp /path/to/Caddyfile "/path/to/Caddyfile.bak-$(date -u +%Y%m%d%H%M%S)"   # [verify] real Caddyfile path
```

### 1. Create the releases layout and seed it from the live files

The live site is a flat directory today. Seed the first release from it so the cutover serves identical content.

```bash
cd /opt/static-web/sites/portfolio
test -s index.html && test ! -e current              # flat layout, not migrated yet
SEED="$(date -u +%Y%m%d%H%M%S)-seed"
mkdir -p releases "releases/$SEED"
rsync -a --exclude releases --exclude current --exclude current.new ./ "releases/$SEED/"
test -s "releases/$SEED/index.html" && test -s "releases/$SEED/faysal-ahmed-resume.pdf"
ln -s "releases/$SEED" current
readlink current                                     # prints releases/<SEED>
```

The deploy user must own `releases/` and be able to create files in `/opt/static-web/sites/portfolio` (the script creates and renames `current.new`). `[verify]`: `ls -ld . releases` and `id <deploy user>`.

### 2. Create the pinned host key secret

The deploy no longer runs `ssh-keyscan` (which trusts whatever key answers first). Build the `known_hosts` line from the host's own key, on the host:

```bash
printf '%s %s\n' '<value of the SSH_HOST secret, exactly>' "$(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"
```

Copy the one line it prints. In the GitHub repository (Settings, Secrets and variables, Actions) create the secret `SSH_KNOWN_HOSTS` with that line, or from a machine with `gh` logged in:

```bash
gh secret set SSH_KNOWN_HOSTS --repo learningtofail/fa-portfolio     # paste the line, then Ctrl-D
```

The name in the line must match the `SSH_HOST` secret exactly (the Tailscale name or IP the runner connects to). Also create the `production` environment (Settings, Environments) if it does not exist; add required reviewers if you want a manual approval before each deploy.

### 3. Point Caddy at `current` and add the headers

Edit the existing `portfolio.faysalahmed.ca` block to match the site block above, then validate and reload:

```bash
caddy validate --config /path/to/Caddyfile --adapter caddyfile      # [verify] real path
sudo systemctl reload caddy || sudo systemctl restart caddy
```

If the global options set `admin off`, `reload` cannot work and you need the `restart` (a brief blip). `[verify]` whether that applies here.

RISK: a wrong `root` path serves 404 until you revert that line, and a bad `Content-Security-Policy` blanks the page. The policy is report-only except for `frame-ancestors`, so the realistic failure is the `root` path. Roll back by restoring the backup from step 0 and reloading (or restarting) Caddy.

### 4. Verify, from any machine

```bash
curl -sI https://portfolio.faysalahmed.ca/ | grep -iE '^(HTTP|content-security|x-content-type|referrer-policy|x-robots)'
curl -s https://portfolio.faysalahmed.ca/ | grep -c 'Faysal Ahmed'
curl -s https://portfolio.faysalahmed.ca/tools/utm-auditor/ | grep -c 'UTM Governance Auditor'
curl -sI https://portfolio.faysalahmed.ca/faysal-ahmed-resume.pdf | grep -i 'content-type'
```

On the host: `readlink /opt/static-web/sites/portfolio/current` must show the seed release. In a browser, open the home page and each tool, and open `https://www.faysalahmed.ca` to confirm the Tools window still loads the tools inside its iframe. The console must show no `Content-Security-Policy-Report-Only` violations.

### 5. Add the health check

In Uptime Kuma add an HTTP(s) Keyword monitor per hostname: `https://portfolio.faysalahmed.ca/` with keyword `Faysal Ahmed`, interval 5 minutes, alert on keyword missing. Phase 6 adds one per tool URL (`docs/monitoring.md`).

### 6. Merge the Phase 5 PR

Only now. The first deploy creates `releases/<timestamp>-<sha>/` and switches `current`. Check with the commands in step 4. The old flat files left in `/opt/static-web/sites/portfolio/` are no longer served; remove them after a week of clean deploys:

```bash
cd /opt/static-web/sites/portfolio
find . -maxdepth 1 ! -name . ! -name releases ! -name current          # review this list first
# then, only if it lists nothing but old site files:
find . -maxdepth 1 ! -name . ! -name releases ! -name current -exec rm -rf -- {} +
```

RISK: that `rm` is irreversible. The previous releases are the backup; both sites are stateless and rebuild from git.

## Promoting the CSP from report-only to enforced

After the console is clean on every page and on the www iframe, change the header name `Content-Security-Policy-Report-Only` to `Content-Security-Policy` for the full policy (the `frame-ancestors`-only header can then be deleted), validate, and reload. If anything breaks, rename it back and reload.
