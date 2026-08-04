#!/usr/bin/env bash
set -Eeuo pipefail

# Commit the immutable release image and its host-nginx routes as one unit.
# Registry `latest` stays on the last committed image until the candidate has
# served its exact release marker and the new routes are live. The final latest
# push happens while holding the same lock used by `/root/redeploy.sh`, so a
# full-stack deploy can observe only the old committed image or the new one.

readonly IMAGE_REPOSITORY='contestvibe/contests-docs'
readonly IMAGE_LATEST="${IMAGE_REPOSITORY}:latest"
readonly CONTAINER_NAME='contests-docs'
readonly COMPOSE_SERVICE='docs'
readonly COMPOSE_DIRECTORY='/root/server'
readonly RELEASE_ENDPOINT='http://127.0.0.1:3002/.well-known/darebay-content-release.txt'
readonly ROLLBACK_READINESS_ENDPOINT='http://127.0.0.1:3002/zarabotok/'
readonly HOST_RELEASE_ENDPOINT='https://darebay.com/.well-known/darebay-content-release.txt'
readonly RELEASE_REPOSITORY='https://github.com/monolit9951/contests-docs.git'
readonly RELEASE_REF='refs/heads/release'
readonly DEPLOY_STATE_ROOT='/var/lib/darebay-deploy'
readonly LOCK_DIRECTORY="${DEPLOY_STATE_ROOT}/locks"
readonly REDEPLOY_LOCK="${LOCK_DIRECTORY}/redeploy.lock"
readonly RECOVERY_ROOT="${DEPLOY_STATE_ROOT}/content-recovery"
readonly RECOVERY_ACTIVE="${RECOVERY_ROOT}/active"
readonly RECOVERY_PREPARING="${RECOVERY_ROOT}/preparing"
readonly HOST_SNIPPET='/etc/nginx/snippets/darebay-content.conf'
readonly HOST_SNIPPET_DIRECTORY='/etc/nginx/snippets'
readonly STAGING_PARENT='/var/lib/darebay-content-deploy'

EXPECTED_SHA=''
EXPECTED_MANIFEST_DIGEST=''
CANDIDATE_IMAGE=''
CANDIDATE_TAG=''
CANDIDATE_IMAGE_ID=''
SNIPPET_FILE=''
INSTALLER_FILE=''
STAGING_DIRECTORY=''
AUTH_DIRECTORY=''
PREVIOUS_SNIPPET=''
OLD_IMAGE_ID=''
OLD_READINESS_DIGEST=''
ROLLBACK_TAG=''
JOURNAL_ACTIVE=0
RECOVERY_PHASE=''
RECOVERY_EXPECTED_SHA=''
RECOVERY_CANDIDATE_IMAGE_ID=''
ROLLBACK_READY=0
PREVIOUS_SNIPPET_READY=0
MUTATION_STARTED=0
ROUTES_INSTALLED=0
REGISTRY_COMMIT_STARTED=0
COMMITTED=0

valid_sha() {
  [[ $1 =~ ^[A-Fa-f0-9]{40}$ ]]
}

valid_digest() {
  [[ $1 =~ ^[a-f0-9]{64}$ ]]
}

valid_manifest_digest() {
  [[ $1 =~ ^sha256:[a-f0-9]{64}$ ]]
}

valid_image_id() {
  [[ $1 =~ ^sha256:[a-f0-9]{64}$ ]]
}

valid_rollback_tag() {
  [[ $1 =~ ^contestvibe/contests-docs:txn-rollback-[a-f0-9]{40}-[0-9]+-[0-9]+$ ]]
}

valid_recovery_phase() {
  [[ $1 =~ ^(prepared|container_pending|routes_pending|registry_pending|committed)$ ]]
}

rollback_tag_for() {
  local sha=${1,,}
  printf '%s:txn-rollback-%s-%s-%s\n' "$IMAGE_REPOSITORY" "$sha" "$(date -u +%s)" "$$"
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

artifact_contract() {
  local file=$1 expected_mode=$2 expected_digest=$3 real parent metadata actual
  valid_digest "$expected_digest" || {
    echo "deploy-content-transaction: invalid artifact digest for $file" >&2
    return 1
  }
  [[ -f $file && ! -L $file ]] || {
    echo "deploy-content-transaction: artifact is not a regular non-symlink file: $file" >&2
    return 1
  }
  real=$(readlink -f -- "$file")
  parent=$(dirname -- "$real")
  [[ $parent == "$STAGING_DIRECTORY" ]] || {
    echo "deploy-content-transaction: artifact escaped private staging: $file" >&2
    return 1
  }
  metadata=$(stat -c '%u:%g:%a' -- "$real")
  [[ $metadata == "0:0:${expected_mode}" ]] || {
    echo "deploy-content-transaction: unsafe artifact owner/mode for $file: $metadata" >&2
    return 1
  }
  actual=$(sha256sum -- "$real")
  actual=${actual%% *}
  [[ $actual == "$expected_digest" ]] || {
    echo "deploy-content-transaction: artifact digest mismatch for $file" >&2
    return 1
  }
}

managed_snippet_contract() {
  local file=$1 proxy_count
  [[ -f $file && ! -L $file ]] || return 1
  # The first transactional rollout starts from the previous generated
  # snippet, which predates the two release-manifest locations. It is still a
  # safe rollback baseline as long as it is generator-owned and routes only to
  # the docs container. The incoming snippet is validated more strictly by the
  # installer before it can replace this file.
  grep -q '^# ⚙️ GENERATED — do not edit\.$' "$file" || return 1
  safe_managed_snippet_syntax "$file" || return 1
  proxy_count=$(grep -c '^[[:space:]]*proxy_pass[[:space:]]' "$file" || true)
  ((proxy_count > 0)) || return 1
  ! grep '^[[:space:]]*proxy_pass[[:space:]]' "$file" |
    grep -qvE '^[[:space:]]*proxy_pass[[:space:]]+http://127\.0\.0\.1:3002;[[:space:]]*$'
}

secure_host_snippet_path() {
  local directory_metadata target_metadata
  [[ -d $HOST_SNIPPET_DIRECTORY && ! -L $HOST_SNIPPET_DIRECTORY ]] || {
    echo "deploy-content-transaction: unsafe host snippet directory: $HOST_SNIPPET_DIRECTORY" >&2
    return 1
  }
  [[ -f $HOST_SNIPPET && ! -L $HOST_SNIPPET ]] || {
    echo "deploy-content-transaction: unsafe host snippet: $HOST_SNIPPET" >&2
    return 1
  }

  # First rollout removes the legacy deployment account's effective write bit.
  # POSIX ACL entries are bounded by the group-class mask represented by these
  # mode bits, so 0755/0644 also neutralize a pre-existing named-user ACL.
  chown root:root "$HOST_SNIPPET_DIRECTORY" "$HOST_SNIPPET"
  chmod 0755 "$HOST_SNIPPET_DIRECTORY"
  chmod 0644 "$HOST_SNIPPET"
  directory_metadata=$(stat -c '%u:%g:%a' -- "$HOST_SNIPPET_DIRECTORY")
  target_metadata=$(stat -c '%u:%g:%a' -- "$HOST_SNIPPET")
  [[ $directory_metadata == '0:0:755' && $target_metadata == '0:0:644' ]] || {
    echo "deploy-content-transaction: could not protect nginx snippet path: dir=$directory_metadata target=$target_metadata" >&2
    return 1
  }
  managed_snippet_contract "$HOST_SNIPPET" || {
    echo "deploy-content-transaction: current host snippet is unmanaged after protection" >&2
    return 1
  }
}

ensure_private_directory() {
  local path=$1 metadata
  if [[ -e $path || -L $path ]]; then
    [[ -d $path && ! -L $path ]] || {
      echo "deploy-content-transaction: unsafe deploy directory: $path" >&2
      return 1
    }
  else
    install -d -o root -g root -m 0700 -- "$path"
  fi
  metadata=$(stat -c '%u:%g:%a' -- "$path")
  [[ $metadata == '0:0:700' ]] || {
    echo "deploy-content-transaction: deploy directory must be root:root 0700, got $metadata: $path" >&2
    return 1
  }
}

ensure_private_lock() {
  local path=$1 metadata
  if [[ -e $path || -L $path ]]; then
    [[ -f $path && ! -L $path ]] || {
      echo "deploy-content-transaction: unsafe lock file: $path" >&2
      return 1
    }
  else
    # Atomic first-rollout bootstrap: two independent deployers may discover
    # the shared lock simultaneously. noclobber maps to O_EXCL creation, so a
    # loser validates the winner's inode instead of replacing it.
    (umask 077; set -o noclobber; : > "$path") 2>/dev/null || true
  fi
  [[ -f $path && ! -L $path ]] || return 1
  metadata=$(stat -c '%u:%g:%a' -- "$path")
  [[ $metadata == '0:0:600' ]] || {
    echo "deploy-content-transaction: lock must be root:root 0600, got $metadata: $path" >&2
    return 1
  }
}

private_file_contract() {
  local file=$1 expected_parent=$2 metadata real parent
  [[ -f $file && ! -L $file ]] || return 1
  real=$(readlink -f -- "$file")
  parent=$(dirname -- "$real")
  [[ $parent == "$expected_parent" ]] || return 1
  metadata=$(stat -c '%u:%g:%a' -- "$real")
  [[ $metadata == '0:0:600' ]]
}

private_recovery_directory_contract() {
  local path=$1 metadata
  [[ $path == "$RECOVERY_ACTIVE" || $path == "$RECOVERY_PREPARING" ]] || return 1
  [[ -d $path && ! -L $path ]] || return 1
  metadata=$(stat -c '%u:%g:%a' -- "$path")
  [[ $metadata == '0:0:700' ]]
}

remove_recovery_directory() {
  local path=$1
  private_recovery_directory_contract "$path" || {
    echo "deploy-content-transaction: refusing unsafe recovery cleanup: $path" >&2
    return 1
  }
  rm -rf --one-file-system -- "$path" || return 1
  sync -f "$RECOVERY_ROOT" || return 1
}

write_private_value() {
  local directory=$1 name=$2 value=$3 temporary
  [[ $directory == "$RECOVERY_ACTIVE" || $directory == "$RECOVERY_PREPARING" ]] || return 1
  [[ $name =~ ^(phase|expected-sha|candidate-image-id|old-image-id|rollback-tag|old-readiness-digest|previous-snippet-digest)$ ]] || return 1
  [[ -n $value && $value != *$'\n'* && $value != *$'\r'* ]] || return 1
  temporary=$(mktemp "${directory}/.${name}.XXXXXX") || return 1
  printf '%s\n' "$value" > "$temporary" || return 1
  chown root:root "$temporary" || return 1
  chmod 0600 "$temporary" || return 1
  mv -fT -- "$temporary" "${directory}/${name}" || return 1
}

read_private_value() {
  local directory=$1 name=$2 value
  private_file_contract "${directory}/${name}" "$directory" || return 1
  value=$(<"${directory}/${name}")
  [[ -n $value && $value != *$'\n'* && $value != *$'\r'* ]] || return 1
  printf '%s\n' "$value"
}

require_production_inputs() {
  if [[ ${EUID} -ne 0 ]]; then
    echo 'deploy-content-transaction: root is required' >&2
    return 1
  fi
  if [[ $# -ne 7 ]]; then
    echo 'usage: deploy-content-transaction.sh <release-sha> <candidate-manifest-digest> <snippet> <snippet-sha256> <installer> <installer-sha256> <transaction-sha256>' >&2
    return 1
  fi
  valid_sha "$1" || {
    echo "deploy-content-transaction: invalid exact release SHA: $1" >&2
    return 1
  }
  valid_manifest_digest "$2" || {
    echo "deploy-content-transaction: invalid candidate manifest digest: $2" >&2
    return 1
  }
  for command in docker curl flock git sha256sum stat readlink mktemp install grep awk chown chmod mv rm sync; do
    command -v "$command" >/dev/null || {
      echo "deploy-content-transaction: missing command: $command" >&2
      return 1
    }
  done
  [[ -n ${DOCKER_DEPLOY_USERNAME:-} && -n ${DOCKER_DEPLOY_TOKEN:-} ]] || {
    echo 'deploy-content-transaction: ephemeral Docker registry credentials are required' >&2
    return 1
  }
  docker compose version >/dev/null
  docker compose up --help | grep -q -- '--pull string'
  [[ -d $COMPOSE_DIRECTORY ]] || {
    echo "deploy-content-transaction: missing compose directory: $COMPOSE_DIRECTORY" >&2
    return 1
  }
  docker compose --project-directory "$COMPOSE_DIRECTORY" config --services | grep -Fxq "$COMPOSE_SERVICE" || {
    echo "deploy-content-transaction: compose service '$COMPOSE_SERVICE' is missing" >&2
    return 1
  }
  [[ -f $HOST_SNIPPET && ! -L $HOST_SNIPPET ]] || {
    echo "deploy-content-transaction: current host snippet is missing or unsafe: $HOST_SNIPPET" >&2
    return 1
  }
  ensure_private_directory "$DEPLOY_STATE_ROOT"
  ensure_private_directory "$LOCK_DIRECTORY"
  ensure_private_directory "$RECOVERY_ROOT"
  ensure_private_lock "$REDEPLOY_LOCK"

  local script_real staging_metadata parent_metadata
  script_real=$(readlink -f -- "${BASH_SOURCE[0]}")
  STAGING_DIRECTORY=$(dirname -- "$script_real")
  [[ $STAGING_DIRECTORY =~ ^/var/lib/darebay-content-deploy/transaction\.[A-Za-z0-9]+$ && ! -L $STAGING_DIRECTORY ]] || {
    echo "deploy-content-transaction: unsafe staging directory: $STAGING_DIRECTORY" >&2
    return 1
  }
  [[ -d $STAGING_PARENT && ! -L $STAGING_PARENT ]] || {
    echo "deploy-content-transaction: unsafe staging parent: $STAGING_PARENT" >&2
    return 1
  }
  parent_metadata=$(stat -c '%u:%g:%a' -- "$STAGING_PARENT")
  [[ $parent_metadata == '0:0:700' ]] || {
    echo "deploy-content-transaction: staging parent must be root:root 0700, got $parent_metadata" >&2
    return 1
  }
  staging_metadata=$(stat -c '%u:%g:%a' -- "$STAGING_DIRECTORY")
  [[ $staging_metadata == '0:0:700' ]] || {
    echo "deploy-content-transaction: staging must be root:root 0700, got $staging_metadata" >&2
    return 1
  }

  EXPECTED_SHA=${1,,}
  EXPECTED_MANIFEST_DIGEST=$2
  CANDIDATE_IMAGE="${IMAGE_REPOSITORY}@${EXPECTED_MANIFEST_DIGEST}"
  CANDIDATE_TAG="${IMAGE_REPOSITORY}:${EXPECTED_SHA}"
  SNIPPET_FILE=$(readlink -f -- "$3")
  INSTALLER_FILE=$(readlink -f -- "$5")
  artifact_contract "$SNIPPET_FILE" 600 "$4"
  artifact_contract "$INSTALLER_FILE" 600 "$6"
  artifact_contract "$script_real" 700 "$7"
}

arm_signal_traps() {
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM
  trap 'exit 141' PIPE
}

acquire_redeploy_lock() {
  # The containing directory is root-only, so the verified regular file cannot
  # be swapped between this open and flock (unlike a first-use /var/lock name).
  exec 8<>"$REDEPLOY_LOCK"
  if ! flock -n 8; then
    echo 'deploy-content-transaction: another stack deployment is active; waiting'
    flock 8
  fi
}

assert_release_tip() {
  local output tip ref
  output=$(git ls-remote --exit-code "$RELEASE_REPOSITORY" "$RELEASE_REF")
  if [[ $output == *$'\n'* || $output != *$'\t'* ]]; then
    echo 'deploy-content-transaction: malformed release ref response' >&2
    return 1
  fi
  tip=${output%%$'\t'*}
  ref=${output#*$'\t'}
  if [[ $ref != "$RELEASE_REF" || ! $tip =~ ^[a-f0-9]{40}$ || $tip != "$EXPECTED_SHA" ]]; then
    echo "deploy-content-transaction: stale release; expected=$EXPECTED_SHA current=${tip:-unknown}" >&2
    return 1
  fi
  echo "deploy-content-transaction: release tip confirmed at $EXPECTED_SHA"
}

prepare_registry_auth() {
  AUTH_DIRECTORY=$(mktemp -d "${STAGING_DIRECTORY}/.docker-auth.XXXXXX")
  chmod 0700 "$AUTH_DIRECTORY"
  printf '%s' "$DOCKER_DEPLOY_TOKEN" |
    docker --config "$AUTH_DIRECTORY" login --username "$DOCKER_DEPLOY_USERNAME" --password-stdin
  unset DOCKER_DEPLOY_TOKEN DOCKER_DEPLOY_USERNAME
  [[ -f $AUTH_DIRECTORY/config.json && ! -L $AUTH_DIRECTORY/config.json ]]
  chown root:root "$AUTH_DIRECTORY/config.json"
  chmod 0600 "$AUTH_DIRECTORY/config.json"
}

pin_current_image() {
  local old_running
  OLD_IMAGE_ID=$(docker inspect --format '{{.Image}}' "$CONTAINER_NAME")
  old_running=$(docker inspect --format '{{.State.Running}}' "$CONTAINER_NAME")
  if ! valid_image_id "$OLD_IMAGE_ID"; then
    echo "deploy-content-transaction: invalid current image id: $OLD_IMAGE_ID" >&2
    return 1
  fi
  if [[ $old_running != true ]]; then
    echo 'deploy-content-transaction: current docs container is not running; refusing an unsafe rollback baseline' >&2
    return 1
  fi
  docker image inspect "$OLD_IMAGE_ID" >/dev/null
  ROLLBACK_TAG=$(rollback_tag_for "$EXPECTED_SHA")
  docker image tag "$OLD_IMAGE_ID" "$ROLLBACK_TAG"
  ROLLBACK_READY=1
  echo "deploy-content-transaction: pinned rollback image $OLD_IMAGE_ID"
}

assert_registry_latest_matches_running() {
  docker --config "$AUTH_DIRECTORY" pull "$IMAGE_LATEST"
  local registry_latest
  registry_latest=$(docker image inspect --format '{{.Id}}' "$IMAGE_LATEST")
  if [[ $registry_latest != "$OLD_IMAGE_ID" ]]; then
    docker image tag "$ROLLBACK_TAG" "$IMAGE_LATEST"
    echo "deploy-content-transaction: registry latest $registry_latest differs from running $OLD_IMAGE_ID" >&2
    return 1
  fi
}

fetch_and_prove_candidate() {
  docker --config "$AUTH_DIRECTORY" pull "$CANDIDATE_IMAGE"
  CANDIDATE_IMAGE_ID=$(docker image inspect --format '{{.Id}}' "$CANDIDATE_IMAGE")
  if [[ ! $CANDIDATE_IMAGE_ID =~ ^sha256:[a-f0-9]{64}$ ]]; then
    echo "deploy-content-transaction: invalid candidate image id: $CANDIDATE_IMAGE_ID" >&2
    return 1
  fi
  # Pulling by digest makes the deployed bytes immutable even if somebody
  # later moves the human-readable SHA tag. Re-pushing that tag to the exact
  # pulled image is idempotent and proves WRITE permission before prod changes.
  docker image tag "$CANDIDATE_IMAGE_ID" "$CANDIDATE_TAG"
  docker --config "$AUTH_DIRECTORY" push "$CANDIDATE_TAG"
  docker --config "$AUTH_DIRECTORY" pull "$CANDIDATE_TAG"
  local confirmed_id
  confirmed_id=$(docker image inspect --format '{{.Id}}' "$CANDIDATE_TAG")
  [[ $confirmed_id == "$CANDIDATE_IMAGE_ID" ]] || {
    echo 'deploy-content-transaction: immutable candidate tag verification failed' >&2
    return 1
  }
}

snapshot_previous_routes() {
  PREVIOUS_SNIPPET="${STAGING_DIRECTORY}/previous-darebay-content.conf"
  install -m 0600 "$HOST_SNIPPET" "$PREVIOUS_SNIPPET"
  chown root:root "$PREVIOUS_SNIPPET"
  # Validate the bytes we actually pinned, not only the pathname inspected
  # during preflight. This closes the check/copy gap on the legacy host where
  # the nginx tree is writable by the deployment account.
  managed_snippet_contract "$PREVIOUS_SNIPPET" || {
    echo 'deploy-content-transaction: rollback snippet changed or is unmanaged' >&2
    return 1
  }
  PREVIOUS_SNIPPET_READY=1
}

http_200_body_digest() {
  local url=$1 response status digest=''
  response=$(mktemp "${STAGING_DIRECTORY}/.http-readiness.XXXXXX") || return 1
  if status=$(curl --fail --silent --show-error --noproxy '*' --max-time 3 \
    --output "$response" --write-out '%{http_code}' "$url" 2>/dev/null); then
    status=${status//$'\r'/}
    status=${status//$'\n'/}
    if [[ $status == 200 ]]; then
      digest=$(sha256sum -- "$response")
      digest=${digest%% *}
    fi
  fi
  rm -f -- "$response" || return 1
  valid_digest "$digest" || return 1
  printf '%s\n' "$digest"
}

capture_old_readiness() {
  local attempt digest
  for ((attempt = 1; attempt <= 15; attempt += 1)); do
    if digest=$(http_200_body_digest "$ROLLBACK_READINESS_ENDPOINT"); then
      OLD_READINESS_DIGEST=$digest
      echo "deploy-content-transaction: pinned rollback HTTP 200 proof $OLD_READINESS_DIGEST"
      return 0
    fi
    if ((attempt < 15)); then sleep 1; fi
  done
  echo 'deploy-content-transaction: current docs HTTP endpoint is not ready; refusing an unverifiable rollback baseline' >&2
  return 1
}

persist_recovery_journal() {
  local previous_snippet_digest
  [[ $ROLLBACK_READY -eq 1 && $PREVIOUS_SNIPPET_READY -eq 1 ]] || return 1
  valid_image_id "$OLD_IMAGE_ID" || return 1
  valid_image_id "$CANDIDATE_IMAGE_ID" || return 1
  valid_rollback_tag "$ROLLBACK_TAG" || return 1
  valid_digest "$OLD_READINESS_DIGEST" || return 1
  [[ ! -e $RECOVERY_ACTIVE && ! -L $RECOVERY_ACTIVE ]] || {
    echo 'deploy-content-transaction: an unrecovered content transaction already exists' >&2
    return 1
  }
  if [[ -e $RECOVERY_PREPARING || -L $RECOVERY_PREPARING ]]; then
    remove_recovery_directory "$RECOVERY_PREPARING" || return 1
  fi

  install -d -o root -g root -m 0700 -- "$RECOVERY_PREPARING" || return 1
  install -o root -g root -m 0600 -- "$PREVIOUS_SNIPPET" \
    "$RECOVERY_PREPARING/previous-snippet" || return 1
  private_file_contract "$RECOVERY_PREPARING/previous-snippet" "$RECOVERY_PREPARING" || return 1
  managed_snippet_contract "$RECOVERY_PREPARING/previous-snippet" || return 1
  previous_snippet_digest=$(sha256sum -- "$RECOVERY_PREPARING/previous-snippet") || return 1
  previous_snippet_digest=${previous_snippet_digest%% *}
  write_private_value "$RECOVERY_PREPARING" phase prepared || return 1
  write_private_value "$RECOVERY_PREPARING" expected-sha "$EXPECTED_SHA" || return 1
  write_private_value "$RECOVERY_PREPARING" candidate-image-id "$CANDIDATE_IMAGE_ID" || return 1
  write_private_value "$RECOVERY_PREPARING" old-image-id "$OLD_IMAGE_ID" || return 1
  write_private_value "$RECOVERY_PREPARING" rollback-tag "$ROLLBACK_TAG" || return 1
  write_private_value "$RECOVERY_PREPARING" old-readiness-digest "$OLD_READINESS_DIGEST" || return 1
  write_private_value "$RECOVERY_PREPARING" previous-snippet-digest "$previous_snippet_digest" || return 1
  sync -f "$RECOVERY_PREPARING" || return 1
  mv -T -- "$RECOVERY_PREPARING" "$RECOVERY_ACTIVE" || return 1
  private_recovery_directory_contract "$RECOVERY_ACTIVE" || return 1
  sync -f "$RECOVERY_ROOT" || return 1
  JOURNAL_ACTIVE=1
  echo 'deploy-content-transaction: durable recovery journal armed'
}

set_recovery_phase() {
  local phase=$1
  ((JOURNAL_ACTIVE == 1)) || return 1
  valid_recovery_phase "$phase" || return 1
  private_recovery_directory_contract "$RECOVERY_ACTIVE" || return 1
  write_private_value "$RECOVERY_ACTIVE" phase "$phase" || return 1
  sync -f "$RECOVERY_ACTIVE" || return 1
}

clear_recovery_journal() {
  if ((JOURNAL_ACTIVE == 0)); then
    [[ ! -e $RECOVERY_ACTIVE && ! -L $RECOVERY_ACTIVE ]] || return 1
    return 0
  fi
  remove_recovery_directory "$RECOVERY_ACTIVE" || return 1
  JOURNAL_ACTIVE=0
}

cleanup_stale_docs_containers() {
  local stale=() stale_output
  stale_output=$(docker ps -aq --filter 'name=_contests-docs$')
  if [[ -n $stale_output ]]; then mapfile -t stale <<< "$stale_output"; fi
  if ((${#stale[@]})); then docker rm -f "${stale[@]}" >/dev/null; fi
}

activate_candidate_container() {
  docker image tag "$CANDIDATE_IMAGE_ID" "$IMAGE_LATEST"
  docker compose --project-directory "$COMPOSE_DIRECTORY" up \
    -d --no-deps --force-recreate --pull never "$COMPOSE_SERVICE"
}

wait_for_expected_release() {
  local expected=${1:-$EXPECTED_SHA} attempt body last='no response'
  for ((attempt = 1; attempt <= 60; attempt += 1)); do
    body=$(curl --fail --silent --show-error --noproxy '*' --max-time 3 \
      "${RELEASE_ENDPOINT}?expected=${expected}" 2>/dev/null || true)
    body=${body//$'\r'/}
    body=${body//$'\n'/}
    last=${body:-'no response'}
    if [[ $body == "$expected" ]]; then
      echo "deploy-content-transaction: exact candidate $expected is ready (attempt $attempt)"
      return 0
    fi
    if ((attempt < 60)); then sleep 1; fi
  done
  echo "deploy-content-transaction: candidate marker mismatch; expected=$expected last=$last" >&2
  return 1
}

wait_for_host_release() {
  local expected=${1:-$EXPECTED_SHA} attempt body last='no response'
  for ((attempt = 1; attempt <= 30; attempt += 1)); do
    # --resolve exercises the production TLS vhost and SNI locally, without
    # trusting external DNS/CDN state. Certificate verification stays enabled.
    body=$(curl --fail --silent --show-error --noproxy '*' --max-time 5 \
      --resolve 'darebay.com:443:127.0.0.1' \
      "${HOST_RELEASE_ENDPOINT}?expected=${expected}" 2>/dev/null || true)
    body=${body//$'\r'/}
    body=${body//$'\n'/}
    last=${body:-'no response'}
    if [[ $body == "$expected" ]]; then
      echo "deploy-content-transaction: host/SNI route serves exact release $expected (attempt $attempt)"
      return 0
    fi
    if ((attempt < 30)); then sleep 1; fi
  done
  echo "deploy-content-transaction: host/SNI marker mismatch; expected=$expected last=$last" >&2
  return 1
}

install_host_routes() {
  /bin/bash "$INSTALLER_FILE" "$SNIPPET_FILE"
}

restore_previous_routes() {
  [[ $PREVIOUS_SNIPPET_READY -eq 1 ]] || return 1
  /bin/bash "$INSTALLER_FILE" --restore-managed "$PREVIOUS_SNIPPET"
}

commit_registry_latest() {
  local attempt latest_id
  REGISTRY_COMMIT_STARTED=1
  # The registry tag update is the final commit edge. Ignore transport signals
  # while Docker performs the atomic manifest write and read-after-write check.
  # A failed/ambiguous push enters EXIT rollback, which restores and verifies
  # the pinned old image before the shared redeploy lock can be released.
  trap '' HUP INT TERM PIPE
  for ((attempt = 1; attempt <= 5; attempt += 1)); do
    docker image tag "$CANDIDATE_IMAGE_ID" "$IMAGE_LATEST"
    if docker --config "$AUTH_DIRECTORY" push "$IMAGE_LATEST"; then
      if docker --config "$AUTH_DIRECTORY" pull "$IMAGE_LATEST" >&2; then
        latest_id=$(docker image inspect --format '{{.Id}}' "$IMAGE_LATEST")
        if [[ $latest_id == "$CANDIDATE_IMAGE_ID" ]]; then
          # A release can advance during the registry write itself. Do not
          # publish a stale latest even when the read-after-write succeeded.
          # This failure remains inside the rollback boundary.
          assert_release_tip || return 1
          set_recovery_phase committed || return 1
          COMMITTED=1
          arm_signal_traps
          return 0
        fi
      fi
    fi
    sleep 2
  done
  echo 'deploy-content-transaction: registry latest commit could not be verified' >&2
  return 1
}

restore_registry_latest() {
  local attempt latest_id
  for ((attempt = 1; attempt <= 5; attempt += 1)); do
    docker image tag "$ROLLBACK_TAG" "$IMAGE_LATEST" || return 1
    if docker --config "$AUTH_DIRECTORY" push "$IMAGE_LATEST"; then
      if docker --config "$AUTH_DIRECTORY" pull "$IMAGE_LATEST" >&2; then
        latest_id=$(docker image inspect --format '{{.Id}}' "$IMAGE_LATEST")
        if [[ $latest_id == "$OLD_IMAGE_ID" ]]; then
          echo "deploy-content-transaction: registry latest restored to $OLD_IMAGE_ID" >&2
          return 0
        fi
      fi
    fi
    sleep 2
  done
  return 1
}

rollback_container() {
  cleanup_stale_docs_containers || return 1
  docker image tag "$ROLLBACK_TAG" "$IMAGE_LATEST" || return 1
  docker compose --project-directory "$COMPOSE_DIRECTORY" up \
    -d --no-deps --force-recreate --pull never "$COMPOSE_SERVICE" || return 1
  local attempt restored running digest last='no response'
  for ((attempt = 1; attempt <= 60; attempt += 1)); do
    restored=$(docker inspect --format '{{.Image}}' "$CONTAINER_NAME" 2>/dev/null || true)
    running=$(docker inspect --format '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || true)
    digest=''
    if [[ $restored == "$OLD_IMAGE_ID" && $running == true ]]; then
      if digest=$(http_200_body_digest "$ROLLBACK_READINESS_ENDPOINT"); then
        last=${digest:-'empty response'}
        if [[ $digest == "$OLD_READINESS_DIGEST" ]]; then
          echo "deploy-content-transaction: rollback container is HTTP-ready (attempt $attempt)" >&2
          return 0
        fi
      fi
    fi
    if ((attempt < 60)); then sleep 1; fi
  done
  echo "deploy-content-transaction: rollback readiness FAILED; image=${restored:-unknown} running=${running:-unknown} response_digest=$last expected_digest=$OLD_READINESS_DIGEST" >&2
  return 1
}

load_recovery_journal() {
  local previous_digest actual_previous_digest rollback_id
  if [[ -e $RECOVERY_PREPARING || -L $RECOVERY_PREPARING ]]; then
    # `preparing` is written and synced before the atomic rename to `active`.
    # Its presence alone therefore proves that no production mutation followed.
    remove_recovery_directory "$RECOVERY_PREPARING" || return 1
  fi
  if [[ ! -e $RECOVERY_ACTIVE && ! -L $RECOVERY_ACTIVE ]]; then
    return 2
  fi
  private_recovery_directory_contract "$RECOVERY_ACTIVE" || {
    echo 'deploy-content-transaction: malformed durable recovery directory' >&2
    return 1
  }

  RECOVERY_PHASE=$(read_private_value "$RECOVERY_ACTIVE" phase)
  RECOVERY_EXPECTED_SHA=$(read_private_value "$RECOVERY_ACTIVE" expected-sha)
  RECOVERY_CANDIDATE_IMAGE_ID=$(read_private_value "$RECOVERY_ACTIVE" candidate-image-id)
  OLD_IMAGE_ID=$(read_private_value "$RECOVERY_ACTIVE" old-image-id)
  ROLLBACK_TAG=$(read_private_value "$RECOVERY_ACTIVE" rollback-tag)
  OLD_READINESS_DIGEST=$(read_private_value "$RECOVERY_ACTIVE" old-readiness-digest)
  previous_digest=$(read_private_value "$RECOVERY_ACTIVE" previous-snippet-digest)
  PREVIOUS_SNIPPET="$RECOVERY_ACTIVE/previous-snippet"

  valid_recovery_phase "$RECOVERY_PHASE" &&
    valid_sha "$RECOVERY_EXPECTED_SHA" &&
    valid_image_id "$RECOVERY_CANDIDATE_IMAGE_ID" &&
    valid_image_id "$OLD_IMAGE_ID" &&
    valid_rollback_tag "$ROLLBACK_TAG" &&
    valid_digest "$OLD_READINESS_DIGEST" &&
    valid_digest "$previous_digest" &&
    private_file_contract "$PREVIOUS_SNIPPET" "$RECOVERY_ACTIVE" &&
    managed_snippet_contract "$PREVIOUS_SNIPPET" || {
      echo 'deploy-content-transaction: malformed durable recovery journal' >&2
      return 1
    }
  actual_previous_digest=$(sha256sum -- "$PREVIOUS_SNIPPET")
  actual_previous_digest=${actual_previous_digest%% *}
  [[ $actual_previous_digest == "$previous_digest" ]] || {
    echo 'deploy-content-transaction: recovery snippet digest mismatch' >&2
    return 1
  }
  rollback_id=$(docker image inspect --format '{{.Id}}' "$ROLLBACK_TAG" 2>/dev/null || true)
  [[ $rollback_id == "$OLD_IMAGE_ID" ]] || {
    echo "deploy-content-transaction: durable rollback image is missing or changed: ${rollback_id:-missing}" >&2
    return 1
  }
  JOURNAL_ACTIVE=1
  ROLLBACK_READY=1
  PREVIOUS_SNIPPET_READY=1
}

verify_recovered_commit() {
  local latest_id running_id running
  docker --config "$AUTH_DIRECTORY" pull "$IMAGE_LATEST" || return 1
  latest_id=$(docker image inspect --format '{{.Id}}' "$IMAGE_LATEST") || return 1
  running_id=$(docker inspect --format '{{.Image}}' "$CONTAINER_NAME") || return 1
  running=$(docker inspect --format '{{.State.Running}}' "$CONTAINER_NAME") || return 1
  [[ $latest_id == "$RECOVERY_CANDIDATE_IMAGE_ID" &&
     $running_id == "$RECOVERY_CANDIDATE_IMAGE_ID" && $running == true ]] || return 1
  wait_for_expected_release "$RECOVERY_EXPECTED_SHA" || return 1
  wait_for_host_release "$RECOVERY_EXPECTED_SHA"
}

reset_recovery_state() {
  OLD_IMAGE_ID=''
  OLD_READINESS_DIGEST=''
  ROLLBACK_TAG=''
  PREVIOUS_SNIPPET=''
  RECOVERY_PHASE=''
  RECOVERY_EXPECTED_SHA=''
  RECOVERY_CANDIDATE_IMAGE_ID=''
  JOURNAL_ACTIVE=0
  ROLLBACK_READY=0
  PREVIOUS_SNIPPET_READY=0
  MUTATION_STARTED=0
  ROUTES_INSTALLED=0
  REGISTRY_COMMIT_STARTED=0
  COMMITTED=0
}

recover_loaded_transaction() {
  local rollback_pin
  rollback_pin=$ROLLBACK_TAG
  echo "deploy-content-transaction: found durable recovery phase $RECOVERY_PHASE for $RECOVERY_EXPECTED_SHA" >&2

  if [[ $RECOVERY_PHASE == prepared ]]; then
    clear_recovery_journal
    docker image rm "$rollback_pin" >/dev/null 2>&1 || true
    reset_recovery_state
    echo 'deploy-content-transaction: cleared pre-mutation recovery journal' >&2
    return 0
  fi

  if [[ $RECOVERY_PHASE == committed ]] && verify_recovered_commit; then
    clear_recovery_journal
    docker image rm "$rollback_pin" >/dev/null 2>&1 || true
    reset_recovery_state
    echo 'deploy-content-transaction: finalized previously committed release' >&2
    return 0
  fi

  # Every mutating phase is write-ahead. A crash can therefore be recovered by
  # conservatively restoring all three old components, even if the associated
  # command had not started yet. All restores are idempotent and verified.
  MUTATION_STARTED=1
  ROUTES_INSTALLED=1
  REGISTRY_COMMIT_STARTED=1
  COMMITTED=0
  trap '' HUP INT TERM PIPE
  if restore_registry_latest && restore_previous_routes && rollback_container; then
    clear_recovery_journal
    docker image rm "$rollback_pin" >/dev/null 2>&1 || true
    reset_recovery_state
    arm_signal_traps
    echo 'deploy-content-transaction: recovered incomplete deployment to last committed release' >&2
    return 0
  fi
  arm_signal_traps
  echo 'deploy-content-transaction: durable recovery FAILED; journal and rollback image preserved' >&2
  return 1
}

recover_incomplete_transaction() {
  local load_status
  set +e
  load_recovery_journal
  load_status=$?
  set -e
  if ((load_status == 2)); then
    return 0
  fi
  ((load_status == 0)) || return 1
  recover_loaded_transaction
}

cleanup_auth() {
  if [[ -n $AUTH_DIRECTORY && $AUTH_DIRECTORY == "${STAGING_DIRECTORY}/.docker-auth."* ]]; then
    rm -f -- "$AUTH_DIRECTORY/config.json" 2>/dev/null || true
    rmdir -- "$AUTH_DIRECTORY" 2>/dev/null || true
  fi
}

cleanup_image_pins() {
  [[ -n $ROLLBACK_TAG ]] && docker image rm "$ROLLBACK_TAG" >/dev/null 2>&1 || true
  [[ -n $CANDIDATE_IMAGE ]] && docker image rm "$CANDIDATE_IMAGE" >/dev/null 2>&1 || true
  [[ -n $CANDIDATE_TAG ]] && docker image rm "$CANDIDATE_TAG" >/dev/null 2>&1 || true
}

rollback_on_exit() {
  local original_status=$?
  local final_status=$original_status rollback_failed=0
  trap - EXIT
  trap '' HUP INT TERM PIPE
  set +e

  if ((COMMITTED == 0)); then
    if ((REGISTRY_COMMIT_STARTED == 1 && ROLLBACK_READY == 1)); then
      restore_registry_latest || rollback_failed=1
    fi
    if ((ROUTES_INSTALLED == 1)); then
      restore_previous_routes || rollback_failed=1
    fi
    if ((MUTATION_STARTED == 1 && ROLLBACK_READY == 1)); then
      rollback_container || rollback_failed=1
    fi
  fi

  cleanup_auth
  if ((rollback_failed == 0)); then
    clear_recovery_journal || rollback_failed=1
  fi
  if ((rollback_failed == 0)); then
    cleanup_image_pins
  else
    final_status=1
    echo "deploy-content-transaction: rollback FAILED; preserved image pin ${ROLLBACK_TAG:-none}" >&2
  fi
  exit "$final_status"
}

execute_transaction() {
  trap rollback_on_exit EXIT
  arm_signal_traps

  acquire_redeploy_lock
  assert_release_tip
  prepare_registry_auth
  recover_incomplete_transaction
  secure_host_snippet_path
  pin_current_image
  assert_registry_latest_matches_running
  fetch_and_prove_candidate
  snapshot_previous_routes
  capture_old_readiness
  persist_recovery_journal

  # Preflight can take time. Re-read GitHub while holding the shared lock,
  # immediately before every operation that can alter production state.
  assert_release_tip
  set_recovery_phase container_pending
  MUTATION_STARTED=1
  cleanup_stale_docs_containers
  assert_release_tip
  activate_candidate_container
  wait_for_expected_release
  assert_release_tip

  # Close the signal gap between a successful nginx reload and our state flag.
  trap '' HUP INT TERM PIPE
  set_recovery_phase routes_pending
  ROUTES_INSTALLED=1
  install_host_routes
  arm_signal_traps

  # This is the transaction's routing proof: exercise the real HTTPS server
  # name and certificate against local nginx, and require the exact candidate.
  wait_for_host_release

  # If release advanced while the candidate booted, roll both halves back and
  # leave registry latest untouched.
  assert_release_tip
  set_recovery_phase registry_pending
  REGISTRY_COMMIT_STARTED=1
  commit_registry_latest

  cleanup_auth
  clear_recovery_journal
  cleanup_image_pins
  echo "deploy-content-transaction: committed immutable release $EXPECTED_SHA as registry latest"
  trap - EXIT HUP INT TERM PIPE
}

self_test_case() {
  local fail_at=$1 expected_status=$2 expected_events=$3 work events status
  work=$(mktemp -d)
  events="$work/events"
  set +e
  (
    set -Eeuo pipefail
    JOURNAL_ACTIVE=0 ROLLBACK_READY=0 PREVIOUS_SNIPPET_READY=0 MUTATION_STARTED=0
    ROUTES_INSTALLED=0 REGISTRY_COMMIT_STARTED=0 COMMITTED=0
    OLD_IMAGE_ID='sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    ROLLBACK_TAG='contestvibe/contests-docs:txn-rollback-test'
    CANDIDATE_IMAGE='contestvibe/contests-docs:0123456789abcdef0123456789abcdef01234567'
    CANDIDATE_TAG='contestvibe/contests-docs:0123456789abcdef0123456789abcdef01234567'
    EXPECTED_SHA='0123456789abcdef0123456789abcdef01234567'
    OLD_READINESS_DIGEST='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    record() { printf '%s\n' "$1" >> "$events"; }
    fail_here() { [[ ",$fail_at," != *",$1,"* ]]; }
    acquire_redeploy_lock() { record lock; fail_here lock; }
    assert_release_tip() { record tip; fail_here "tip$(($(grep -c '^tip$' "$events") + 0))"; }
    prepare_registry_auth() { record auth; fail_here auth; }
    recover_incomplete_transaction() { record recover; fail_here recover; }
    secure_host_snippet_path() { record secure-host; fail_here secure-host; }
    pin_current_image() { record pin; fail_here pin; ROLLBACK_READY=1; }
    assert_registry_latest_matches_running() { record latest-old; fail_here latest-old; }
    fetch_and_prove_candidate() { record candidate; fail_here candidate; }
    snapshot_previous_routes() { record snapshot; fail_here snapshot; PREVIOUS_SNIPPET_READY=1; }
    capture_old_readiness() { record old-http; fail_here old-http; }
    persist_recovery_journal() { record journal; fail_here journal; JOURNAL_ACTIVE=1; }
    set_recovery_phase() { record "phase-$1"; fail_here "phase-$1"; }
    cleanup_stale_docs_containers() { record stale; fail_here stale; }
    activate_candidate_container() { record up; fail_here up; }
    wait_for_expected_release() { record verify; fail_here verify; }
    install_host_routes() { record install; fail_here install; }
    wait_for_host_release() { record host-sni; fail_here host-sni; }
    commit_registry_latest() {
      record push-latest
      REGISTRY_COMMIT_STARTED=1
      fail_here push-latest
      assert_release_tip
      set_recovery_phase committed
      COMMITTED=1
      arm_signal_traps
    }
    restore_registry_latest() { record rollback-registry; fail_here rollback-registry; }
    restore_previous_routes() { record rollback-routes; fail_here rollback-routes; }
    rollback_container() { record rollback-container; fail_here rollback-container; }
    cleanup_auth() { record cleanup-auth; }
    clear_recovery_journal() {
      if ((JOURNAL_ACTIVE == 1)); then
        record clear-journal
        fail_here clear-journal || return 1
        JOURNAL_ACTIVE=0
      fi
    }
    cleanup_image_pins() { record cleanup-images; }
    execute_transaction
  )
  status=$?
  set -e
  local actual
  actual=$(paste -sd, "$events" 2>/dev/null || true)
  rm -rf -- "$work"
  if [[ $status -ne $expected_status || $actual != "$expected_events" ]]; then
    echo "deploy-content-transaction self-test failed: fail=$fail_at status=$status events=$actual" >&2
    echo "  expected status=$expected_status events=$expected_events" >&2
    return 1
  fi
}

self_test_recovery_case() {
  local phase=$1 fail_at=$2 expected_status=$3 expected_events=$4 work events status
  work=$(mktemp -d)
  events="$work/events"
  set +e
  (
    set -Eeuo pipefail
    RECOVERY_PHASE=$phase
    RECOVERY_EXPECTED_SHA='0123456789abcdef0123456789abcdef01234567'
    RECOVERY_CANDIDATE_IMAGE_ID='sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
    OLD_IMAGE_ID='sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    ROLLBACK_TAG='contestvibe/contests-docs:txn-rollback-0123456789abcdef0123456789abcdef01234567-1-1'
    JOURNAL_ACTIVE=1 ROLLBACK_READY=1 PREVIOUS_SNIPPET_READY=1
    MUTATION_STARTED=0 ROUTES_INSTALLED=0 REGISTRY_COMMIT_STARTED=0 COMMITTED=0
    record() { printf '%s\n' "$1" >> "$events"; }
    fail_here() { [[ ",$fail_at," != *",$1,"* ]]; }
    verify_recovered_commit() { record verify-commit; fail_here verify-commit; }
    restore_registry_latest() { record restore-registry; fail_here restore-registry; }
    restore_previous_routes() { record restore-routes; fail_here restore-routes; }
    rollback_container() { record restore-container-http; fail_here restore-container-http; }
    clear_recovery_journal() { record clear-journal; fail_here clear-journal || return 1; JOURNAL_ACTIVE=0; }
    reset_recovery_state() { record reset-state; }
    arm_signal_traps() { :; }
    docker() {
      [[ $1 == image && $2 == rm ]]
      record remove-pin
    }
    recover_loaded_transaction
  )
  status=$?
  set -e
  local actual
  actual=$(paste -sd, "$events" 2>/dev/null || true)
  rm -rf -- "$work"
  if [[ $status -ne $expected_status || $actual != "$expected_events" ]]; then
    echo "deploy-content-transaction recovery self-test failed: phase=$phase fail=$fail_at status=$status events=$actual" >&2
    echo "  expected status=$expected_status events=$expected_events" >&2
    return 1
  fi
}

self_test() {
  valid_sha 0123456789abcdef0123456789abcdef01234567
  ! valid_sha 0123456
  ! valid_sha '0123456789abcdef0123456789abcdef0123456;'
  valid_digest aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  ! valid_digest aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaz
  valid_manifest_digest sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  ! valid_manifest_digest aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  [[ $(rollback_tag_for ABCDEF0123456789ABCDEF0123456789ABCDEF01) =~ ^contestvibe/contests-docs:txn-rollback-abcdef0123456789abcdef0123456789abcdef01-[0-9]+-[0-9]+$ ]]

  local snippet_test_directory managed_sample unmanaged_sample
  snippet_test_directory=$(mktemp -d)
  managed_sample="$snippet_test_directory/managed.conf"
  unmanaged_sample="$snippet_test_directory/unmanaged.conf"
  printf '%s\n' '# ⚙️ GENERATED — do not edit.' \
    'location = /safe {' \
    'proxy_pass http://127.0.0.1:3002;' \
    '}' > "$managed_sample"
  printf '%s\n' '# ⚙️ GENERATED — do not edit.' \
    'location = /unsafe {' \
    'proxy_pass http://127.0.0.1:3002;' \
    'return 200 "forged";' \
    '}' > "$unmanaged_sample"
  managed_snippet_contract "$managed_sample"
  ! managed_snippet_contract "$unmanaged_sample"
  rm -rf -- "$snippet_test_directory"

  local prefix='lock,tip,auth,recover,secure-host,pin,latest-old,candidate,snapshot,old-http,journal'
  local mutated="${prefix},tip,phase-container_pending,stale,tip,up,verify,tip"
  local routed="${mutated},phase-routes_pending,install,host-sni,tip"
  local success="${routed},phase-registry_pending,push-latest,tip,phase-committed,cleanup-auth,clear-journal,cleanup-images"
  self_test_case none 0 "$success"
  self_test_case lock 1 'lock,cleanup-auth,cleanup-images'
  self_test_case auth 1 'lock,tip,auth,cleanup-auth,cleanup-images'
  self_test_case recover 1 'lock,tip,auth,recover,cleanup-auth,cleanup-images'
  self_test_case latest-old 1 'lock,tip,auth,recover,secure-host,pin,latest-old,cleanup-auth,cleanup-images'
  self_test_case candidate 1 'lock,tip,auth,recover,secure-host,pin,latest-old,candidate,cleanup-auth,cleanup-images'
  self_test_case tip2 1 "${prefix},tip,cleanup-auth,clear-journal,cleanup-images"
  self_test_case phase-container_pending 1 "${prefix},tip,phase-container_pending,cleanup-auth,clear-journal,cleanup-images"
  self_test_case stale 1 "${prefix},tip,phase-container_pending,stale,rollback-container,cleanup-auth,clear-journal,cleanup-images"
  self_test_case tip3 1 "${prefix},tip,phase-container_pending,stale,tip,rollback-container,cleanup-auth,clear-journal,cleanup-images"
  self_test_case up 1 "${prefix},tip,phase-container_pending,stale,tip,up,rollback-container,cleanup-auth,clear-journal,cleanup-images"
  self_test_case verify 1 "${prefix},tip,phase-container_pending,stale,tip,up,verify,rollback-container,cleanup-auth,clear-journal,cleanup-images"
  self_test_case tip4 1 "${mutated},rollback-container,cleanup-auth,clear-journal,cleanup-images"
  self_test_case phase-routes_pending 1 "${mutated},phase-routes_pending,rollback-container,cleanup-auth,clear-journal,cleanup-images"
  self_test_case install 1 "${mutated},phase-routes_pending,install,rollback-routes,rollback-container,cleanup-auth,clear-journal,cleanup-images"
  self_test_case host-sni 1 "${mutated},phase-routes_pending,install,host-sni,rollback-routes,rollback-container,cleanup-auth,clear-journal,cleanup-images"
  self_test_case tip5 1 "${routed},rollback-routes,rollback-container,cleanup-auth,clear-journal,cleanup-images"
  self_test_case phase-registry_pending 1 "${routed},phase-registry_pending,rollback-routes,rollback-container,cleanup-auth,clear-journal,cleanup-images"
  self_test_case push-latest 1 "${routed},phase-registry_pending,push-latest,rollback-registry,rollback-routes,rollback-container,cleanup-auth,clear-journal,cleanup-images"
  self_test_case tip6 1 "${routed},phase-registry_pending,push-latest,tip,rollback-registry,rollback-routes,rollback-container,cleanup-auth,clear-journal,cleanup-images"
  self_test_case phase-committed 1 "${routed},phase-registry_pending,push-latest,tip,phase-committed,rollback-registry,rollback-routes,rollback-container,cleanup-auth,clear-journal,cleanup-images"
  self_test_case 'push-latest,rollback-registry' 1 "${routed},phase-registry_pending,push-latest,rollback-registry,rollback-routes,rollback-container,cleanup-auth"
  self_test_case 'tip5,rollback-routes' 1 "${routed},rollback-routes,rollback-container,cleanup-auth"
  self_test_case 'verify,rollback-container' 1 "${prefix},tip,phase-container_pending,stale,tip,up,verify,rollback-container,cleanup-auth"
  self_test_case clear-journal 1 "${routed},phase-registry_pending,push-latest,tip,phase-committed,cleanup-auth,clear-journal,cleanup-auth,clear-journal"
  self_test_recovery_case prepared none 0 'clear-journal,remove-pin,reset-state'
  self_test_recovery_case committed none 0 'verify-commit,clear-journal,remove-pin,reset-state'
  self_test_recovery_case committed verify-commit 0 'verify-commit,restore-registry,restore-routes,restore-container-http,clear-journal,remove-pin,reset-state'
  self_test_recovery_case registry_pending none 0 'restore-registry,restore-routes,restore-container-http,clear-journal,remove-pin,reset-state'
  self_test_recovery_case routes_pending restore-routes 1 'restore-registry,restore-routes'
  echo 'deploy-content-transaction: immutable-publication rollback self-test passed'
}

if [[ ${1:-} == --self-test ]]; then
  self_test
  exit 0
fi

require_production_inputs "$@"
execute_transaction
