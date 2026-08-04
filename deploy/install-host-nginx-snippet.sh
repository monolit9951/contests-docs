#!/usr/bin/env bash
set -Eeuo pipefail

# Atomically install the generated content-routing snippet on the production
# host. The canonical vhost includes this exact target before its SPA fallback.
# A rejected config is restored before nginx is ever reloaded.

is_managed_backup_name() {
  [[ $1 =~ ^darebay-content\.conf\.[0-9]{8}T[0-9]{6}Z\.[[:alnum:]]{6}$ ]]
}

safe_managed_snippet_syntax() {
  local file=$1
  LC_ALL=C awk '
    {
      line = $0
      sub(/^[[:space:]]+/, "", line)
      sub(/[[:space:]]+$/, "", line)
      gsub(/[[:space:]]+/, " ", line)
      if (line == "" || line ~ /^#/) next
      if (line ~ /^location (=|\^~) \/[A-Za-z0-9._~\/-]+ \{$/) { opens += 1; next }
      if (line == "}") { closes += 1; next }
      if (line == "proxy_pass http://127.0.0.1:3002;") { proxies += 1; next }
      if (line == "proxy_http_version 1.1;") next
      if (line == "proxy_set_header Host $host;") next
      if (line == "proxy_set_header X-Real-IP $remote_addr;") next
      if (line == "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;") next
      if (line == "proxy_set_header X-Forwarded-Proto https;") next
      if (line == "proxy_set_header X-Forwarded-Host $host;") next
      if (line == "proxy_set_header X-Forwarded-Port 443;") next
      if (line == "proxy_read_timeout 60;") next
      bad = 1
    }
    END { exit(bad || opens == 0 || opens != closes || proxies != opens) }
  ' "$file"
}

# The retention guard is deliberately executable without root so CI verifies
# that pruning can never escape the one timestamped backup namespace.
if [[ ${1:-} == --self-test ]]; then
  for accepted in \
    darebay-content.conf.20260804T120000Z.A1b2C3 \
    darebay-content.conf.19990101T000000Z.000000; do
    is_managed_backup_name "$accepted" || {
      echo "install-host-nginx-snippet: self-test rejected $accepted" >&2
      exit 1
    }
  done
  for rejected in \
    darebay-content.conf \
    darebay-content.conf.old \
    darebay-content.conf.20260804T120000Z \
    darebay-content.conf.20260804T120000Z.A1b2C3/../../nginx.conf \
    nginx.conf.20260804T120000Z.A1b2C3; do
    if is_managed_backup_name "$rejected"; then
      echo "install-host-nginx-snippet: self-test accepted unsafe $rejected" >&2
      exit 1
    fi
  done
  sample_backups=()
  for second in {00..24}; do
    sample_backups+=("darebay-content.conf.20260804T1200${second}Z.A1b2C3")
  done
  mapfile -t sorted_sample < <(printf '%s\n' "${sample_backups[@]}" | LC_ALL=C sort -r)
  prune_sample=("${sorted_sample[@]:20}")
  if [[ ${#prune_sample[@]} -ne 5 ]]; then
    echo "install-host-nginx-snippet: retention self-test did not keep exactly 20" >&2
    exit 1
  fi
  for name in "${prune_sample[@]}"; do
    is_managed_backup_name "$name" || {
      echo "install-host-nginx-snippet: retention self-test selected unsafe $name" >&2
      exit 1
    }
  done
  echo "install-host-nginx-snippet: retention namespace self-test passed"
  exit 0
fi

if [[ ${EUID} -ne 0 ]]; then
  echo "install-host-nginx-snippet: root is required" >&2
  exit 1
fi
restore_managed=0
if [[ $# -eq 2 && $1 == --restore-managed ]]; then
  restore_managed=1
  source_file=$2
elif [[ $# -eq 1 ]]; then
  source_file=$1
else
  echo "usage: install-host-nginx-snippet.sh [--restore-managed] <generated-snippet>" >&2
  exit 1
fi
[[ -s $source_file && -f $source_file && ! -L $source_file ]] || {
  echo "install-host-nginx-snippet: source must be a non-symlink regular file" >&2
  exit 1
}

target=/etc/nginx/snippets/darebay-content.conf
target_directory=/etc/nginx/snippets
deploy_state_root=/var/lib/darebay-deploy
lock_directory=$deploy_state_root/locks
backup_dir=$deploy_state_root/nginx-backups/content
# Shared with the frontend host-vhost migrator. Both delivery pipelines mutate
# nginx configuration and must validate/reload one complete state at a time.
lock_file=$lock_directory/nginx-config.lock

ensure_private_directory() {
  local path=$1 metadata
  if [[ -e $path || -L $path ]]; then
    [[ -d $path && ! -L $path ]] || return 1
  else
    install -d -o root -g root -m 0700 -- "$path"
  fi
  metadata=$(stat -c '%u:%g:%a' -- "$path")
  [[ $metadata == '0:0:700' ]]
}

ensure_private_lock() {
  local path=$1 metadata
  if [[ -e $path || -L $path ]]; then
    [[ -f $path && ! -L $path ]] || return 1
  else
    # Both frontend and docs may bootstrap this shared lock on first rollout.
    # O_EXCL-style noclobber prevents either process from replacing the inode
    # that the other process is about to flock.
    (umask 077; set -o noclobber; : > "$path") 2>/dev/null || true
  fi
  [[ -f $path && ! -L $path ]] || return 1
  metadata=$(stat -c '%u:%g:%a' -- "$path")
  [[ $metadata == '0:0:600' ]]
}

ensure_private_directory "$deploy_state_root" || {
  echo "install-host-nginx-snippet: unsafe deploy state root" >&2
  exit 1
}
ensure_private_directory "$lock_directory" || {
  echo "install-host-nginx-snippet: unsafe lock directory" >&2
  exit 1
}
ensure_private_directory "$deploy_state_root/nginx-backups" || {
  echo "install-host-nginx-snippet: unsafe nginx backup directory" >&2
  exit 1
}
ensure_private_directory "$backup_dir" || {
  echo "install-host-nginx-snippet: unsafe content backup directory" >&2
  exit 1
}
ensure_private_lock "$lock_file" || {
  echo "install-host-nginx-snippet: unsafe nginx lock" >&2
  exit 1
}

exec 9<>"$lock_file"
flock -x 9

[[ -d $target_directory && ! -L $target_directory ]] || {
  echo 'install-host-nginx-snippet: unsafe nginx snippet directory' >&2
  exit 1
}
chown root:root "$target_directory"
chmod 0755 "$target_directory"
[[ $(stat -c '%u:%g:%a' -- "$target_directory") == '0:0:755' ]] || {
  echo 'install-host-nginx-snippet: nginx snippet directory is writable by a non-root principal' >&2
  exit 1
}
if [[ -e $target || -L $target ]]; then
  [[ -f $target && ! -L $target ]] || {
    echo 'install-host-nginx-snippet: unsafe nginx snippet target' >&2
    exit 1
  }
  chown root:root "$target"
  chmod 0644 "$target"
  [[ $(stat -c '%u:%g:%a' -- "$target") == '0:0:644' ]] || {
    echo 'install-host-nginx-snippet: nginx snippet target is writable by a non-root principal' >&2
    exit 1
  }
fi

grep -q '^# ⚙️ GENERATED — do not edit\.$' "$source_file"
safe_managed_snippet_syntax "$source_file"
grep -q 'proxy_pass[[:space:]]\+http://127.0.0.1:3002;' "$source_file"
! grep '^[[:space:]]*proxy_pass[[:space:]]' "$source_file" |
  grep -qvE '^[[:space:]]*proxy_pass[[:space:]]+http://127\.0\.0\.1:3002;[[:space:]]*$'
if ((restore_managed == 0)); then
  # New candidates must expose the publication proof endpoints. A legacy
  # rollback snapshot predates those locations, but is still generator-owned
  # and is allowed only through the explicit internal restore mode.
  grep -q 'location = /.well-known/darebay-content-pages.json {' "$source_file"
  grep -q 'location = /.well-known/darebay-content-release.txt {' "$source_file"
fi

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup=''
candidate=$(mktemp /etc/nginx/snippets/.darebay-content.conf.XXXXXX)
rollback=$(mktemp /etc/nginx/snippets/.darebay-content.rollback.XXXXXX)
target_mutated=0
committed=0

restore() {
  local restored
  restored=$(mktemp /etc/nginx/snippets/.darebay-content.restore.XXXXXX) || return 1
  if [[ -s $rollback ]]; then
    install -m 0644 "$rollback" "$restored" || { rm -f "$restored"; return 1; }
    mv -fT -- "$restored" "$target" || { rm -f "$restored"; return 1; }
  else
    rm -f "$restored" "$target" || return 1
  fi
}

cleanup() {
  local status=$?
  trap - EXIT HUP INT TERM
  if ((status != 0 && target_mutated == 1 && committed == 0)); then
    # Covers signals and every unexpected command failure between the atomic
    # file move and the commit point, not only the two explicit nginx calls.
    set +e
    if restore; then
      if nginx -t; then
        if ! systemctl reload nginx && ! nginx -s reload; then
          echo "install-host-nginx-snippet: restored file but nginx reload FAILED" >&2
        fi
      else
        echo "install-host-nginx-snippet: restored file is invalid; persistent backup: ${backup:-none}" >&2
      fi
    else
      echo "install-host-nginx-snippet: automatic restore FAILED; persistent backup: ${backup:-none}" >&2
    fi
  fi
  rm -f "$candidate" "$rollback"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ -f $target ]]; then
  backup=$(mktemp "$backup_dir/darebay-content.conf.${timestamp}.XXXXXX")
  install -m 0644 "$target" "$backup"
  install -m 0644 "$target" "$rollback"
else
  : > "$rollback"
fi
install -m 0644 "$source_file" "$candidate"
target_mutated=1
mv -fT -- "$candidate" "$target"
[[ $(stat -c '%u:%g:%a' -- "$target") == '0:0:644' ]]

if ! nginx -t; then
  echo "install-host-nginx-snippet: rejected config; restoring previous snippet (backup: ${backup:-none})" >&2
  exit 1
fi

if ! systemctl reload nginx; then
  echo "install-host-nginx-snippet: reload failed; restoring previous snippet" >&2
  exit 1
fi
committed=1
# From this exact point the new host route is live. Retention is housekeeping,
# not part of correctness; it must never turn a committed install into a
# non-zero return that makes the outer transaction roll back only the container.
trap '' HUP INT TERM
set +e

# Keep a bounded recovery window. Only exact, self-generated filenames are
# eligible; unrelated files under the backup directory are never touched.
mapfile -t managed_backups < <(
  find "$backup_dir" -maxdepth 1 -type f -printf '%f\n' |
    while IFS= read -r name; do
      if is_managed_backup_name "$name"; then printf '%s\n' "$name"; fi
    done |
    LC_ALL=C sort -r
)
for old_name in "${managed_backups[@]:20}"; do
  if ! is_managed_backup_name "$old_name"; then
    echo "install-host-nginx-snippet: skipped unsafe backup name after commit: $old_name" >&2
    continue
  fi
  rm -f -- "$backup_dir/$old_name" ||
    echo "install-host-nginx-snippet: could not prune backup after commit: $old_name" >&2
done

echo "install-host-nginx-snippet: installed atomically (backup: ${backup:-none})"
exit 0
