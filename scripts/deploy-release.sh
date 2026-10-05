#!/usr/bin/env bash
# Atomic release deploy for the static site. Run by CI, or by hand over Tailscale.
#
#   scripts/deploy-release.sh [deploy]            rsync dist/ to releases/<id>/ and switch `current` to it
#   scripts/deploy-release.sh rollback [id]       point `current` at release <id>, or at the next older release
#   scripts/deploy-release.sh --dry-run [command] print every step, change nothing, make no network calls
#
# Remote layout (see docs/caddy/Caddyfile.proposed.md for the one-time host migration):
#   $DEPLOY_PATH/releases/<id>/   one directory per deploy
#   $DEPLOY_PATH/current          symlink to releases/<id>, the Caddy root
#
# Environment:
#   DEPLOY_HOST, DEPLOY_USER   SSH target (required, never committed)
#   DEPLOY_SSH_KEY_B64         base64 of the private key (or DEPLOY_SSH_KEY_FILE: path to the key)
#   DEPLOY_KNOWN_HOSTS         pinned host key lines (the SSH_KNOWN_HOSTS secret), required: no ssh-keyscan
#   DEPLOY_PATH                remote base directory (default /opt/static-web/sites/portfolio)
#   RELEASE_ID                 release name (default: <UTC timestamp>-<short git sha>; names must sort in deploy order)
#   KEEP_RELEASES              releases to keep (default 5)
#   DIST_DIR                   build output (default dist)
set -euo pipefail

DRY_RUN=0
COMMAND=deploy
ROLLBACK_TARGET=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    deploy | rollback) COMMAND="$arg" ;;
    -h | --help) sed -n '2,20p' "$0"; exit 0 ;;
    *) if [ "$COMMAND" = rollback ] && [ -z "$ROLLBACK_TARGET" ]; then ROLLBACK_TARGET="$arg"; else echo "unknown argument: $arg" >&2; exit 2; fi ;;
  esac
done

DEPLOY_PATH="${DEPLOY_PATH:-/opt/static-web/sites/portfolio}"
DIST_DIR="${DIST_DIR:-dist}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
# UTC timestamp first, so release names sort in deploy order (directory mtimes are not reliable after rsync -a).
if [ -z "${RELEASE_ID:-}" ]; then
  RELEASE_ID="$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short=12 HEAD 2>/dev/null || echo manual)"
fi

fail() { echo "deploy: $*" >&2; exit 1; }

# Names end up in remote shell commands, so keep them to a boring alphabet.
case "$RELEASE_ID" in "" | *[!A-Za-z0-9._-]*) fail "RELEASE_ID must be set and contain only letters, digits, dot, dash, underscore" ;; esac
case "$DEPLOY_PATH" in /*) ;; *) fail "DEPLOY_PATH must be an absolute path" ;; esac
case "$DEPLOY_PATH" in *[!A-Za-z0-9._/-]*) fail "DEPLOY_PATH contains unsupported characters" ;; esac
case "$KEEP_RELEASES" in "" | *[!0-9]* | 0) fail "KEEP_RELEASES must be a positive integer" ;; esac

[ -n "${DEPLOY_HOST:-}" ] || fail "DEPLOY_HOST is empty"
[ -n "${DEPLOY_USER:-}" ] || fail "DEPLOY_USER is empty"
[ -n "${DEPLOY_KNOWN_HOSTS:-}" ] || fail "DEPLOY_KNOWN_HOSTS is empty. Create the SSH_KNOWN_HOSTS secret (see docs/rollback.md); host keys are never scanned on the fly."

if [ "$COMMAND" = deploy ]; then
  # An empty or missing build must never reach the server.
  test -s "$DIST_DIR/index.html" || fail "$DIST_DIR/index.html is missing or empty; refusing to deploy"
fi

TARGET="$DEPLOY_USER@$DEPLOY_HOST"

run() {
  if [ "$DRY_RUN" = 1 ]; then
    printf 'DRY RUN:'; printf ' %q' "$@"; printf '\n'
  else
    "$@"
  fi
}

WORKDIR=""
cleanup() { [ -z "$WORKDIR" ] || rm -rf "$WORKDIR"; }
trap cleanup EXIT

SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes)
if [ "$DRY_RUN" = 0 ]; then
  WORKDIR="$(mktemp -d)"
  umask 077
  printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$WORKDIR/known_hosts"
  if [ -n "${DEPLOY_SSH_KEY_FILE:-}" ]; then
    KEY_FILE="$DEPLOY_SSH_KEY_FILE"
  else
    [ -n "${DEPLOY_SSH_KEY_B64:-}" ] || fail "DEPLOY_SSH_KEY_B64 (or DEPLOY_SSH_KEY_FILE) is empty"
    printf '%s' "$DEPLOY_SSH_KEY_B64" | base64 -d > "$WORKDIR/key"
    KEY_FILE="$WORKDIR/key"
  fi
  SSH_OPTS+=(-i "$KEY_FILE" -o "UserKnownHostsFile=$WORKDIR/known_hosts")
else
  SSH_OPTS+=(-i "<key>" -o "UserKnownHostsFile=<pinned known_hosts>")
fi

# Remote helper, fed to `bash -s` over ssh. Arguments: action path release keep.
REMOTE_SCRIPT='
set -euo pipefail
action="$1"; base="$2"; release="$3"; keep="$4"
cd "$base"
[ -d releases ] || { echo "remote: $base/releases is missing. Run the host migration first (docs/caddy/Caddyfile.proposed.md)." >&2; exit 1; }
[ -L current ] || { echo "remote: $base/current is not a symlink. Run the host migration first." >&2; exit 1; }
switch() {
  [ -s "releases/$1/index.html" ] || { echo "remote: releases/$1/index.html is missing or empty; not switching" >&2; exit 1; }
  rm -f current.new
  ln -s "releases/$1" current.new
  mv -T current.new current
  echo "remote: current -> releases/$1"
}
case "$action" in
  prepare) mkdir -p "releases/$release" ;;
  switch)
    switch "$release"
    current_name="$(basename "$(readlink current)")"
    # Keep the newest $keep releases (names sort in deploy order) and never remove the live one.
    ls -1 releases | sort -r | tail -n +"$((keep + 1))" | while read -r old; do
      [ "$old" = "$current_name" ] || { rm -rf -- "releases/$old"; echo "remote: pruned releases/$old"; }
    done ;;
  rollback)
    current_name="$(basename "$(readlink current)")"
    if [ -z "$release" ]; then
      # The newest release that is older than the live one, so repeated rollbacks keep stepping back.
      release=""
      for candidate in $(ls -1 releases | sort -r); do
        if [[ "$candidate" < "$current_name" ]]; then release="$candidate"; break; fi
      done
      [ -n "$release" ] || { echo "remote: no release older than $current_name to roll back to" >&2; exit 1; }
    fi
    switch "$release" ;;
  *) echo "remote: unknown action $action" >&2; exit 2 ;;
esac
'

remote() { run ssh "${SSH_OPTS[@]}" "$TARGET" bash -s -- "$@" <<< "$REMOTE_SCRIPT"; }

if [ "$COMMAND" = deploy ]; then
  echo "deploy: release $RELEASE_ID from $DIST_DIR/ to $DEPLOY_PATH/releases/$RELEASE_ID"
  remote prepare "$DEPLOY_PATH" "$RELEASE_ID" "$KEEP_RELEASES"
  # --delete is safe here: the destination is a brand new release directory, never the live tree.
  run rsync -az --delete -e "ssh ${SSH_OPTS[*]}" "$DIST_DIR/" "$TARGET:$DEPLOY_PATH/releases/$RELEASE_ID/"
  remote switch "$DEPLOY_PATH" "$RELEASE_ID" "$KEEP_RELEASES"
else
  echo "deploy: rollback on $DEPLOY_PATH to ${ROLLBACK_TARGET:-the previous release}"
  remote rollback "$DEPLOY_PATH" "$ROLLBACK_TARGET" "$KEEP_RELEASES"
fi
echo "deploy: done"
