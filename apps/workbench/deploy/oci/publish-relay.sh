#!/usr/bin/env bash
# 워크벤치가 확정한 발행을 공개 블로그의 content/* 브랜치로 보낸다 (NOR-210).
#
# 신뢰 경계: outbox 는 컨테이너가 쓰는 곳이라 내용을 믿지 않는다. 이 스크립트가 관문이다.
#   - 매니페스트의 base 가 origin/main 의 조상이어야 한다.
#   - bundle 은 매니페스트의 커밋과 같아야 한다. format-patch 는 base 위에 적용한다.
#   - base 에서 바뀐 경로는 모두 content-paths.regex 안이어야 하고, 심볼릭 링크·서브모듈·병합 커밋은 받지 않는다.
# content/** 에서 도는 GitHub 워크플로는 그 브랜치의 파일로 실행되므로, 브랜치에 무엇이 들어가는지는 여기서 정한다.
# outbox 는 고치지 않는다. 처리한 매니페스트는 ledger 에 남기고 다시 처리하지 않는다.
set -euo pipefail
umask 077

OUTBOX="${RELAY_OUTBOX:-/srv/workbench/private-workspace/.workbench/publish-outbox}"
STATE="${RELAY_STATE:-/var/lib/workbench-relay}"
REMOTE="${RELAY_REMOTE:-git@github.com:gze1206/blog.gze1206.net.git}"
PATHS="${RELAY_PATHS:-/usr/local/lib/workbench/content-paths.regex}"
REPO="$STATE/blog"
LEDGER="$STATE/ledger"
INCOMING=refs/relay/incoming

if [ -n "${RELAY_SSH_KEY:-}" ]; then
  export GIT_SSH_COMMAND="ssh -i $RELAY_SSH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$STATE/.ssh/known_hosts"
fi

# 잠금. mkdir 은 원자적이라 두 실행 중 하나만 성공한다.
if ! mkdir "$STATE/.lock" 2>/dev/null; then
  echo "다른 릴레이가 실행 중이다" >&2
  exit 75
fi
trap 'rm -rf "$STATE/.lock"' EXIT

touch "$LEDGER"
if [ ! -d "$REPO/.git" ]; then
  git clone -q "$REMOTE" "$REPO"
fi
G() { git -C "$REPO" -c core.hooksPath=/dev/null "$@"; }
G fetch -q --prune origin main

record() { printf '%s\n' "$*" >>"$LEDGER"; }
field() { python3 -c 'import json,sys; v=json.load(open(sys.argv[1])).get(sys.argv[2]); print("" if v is None else v)' "$1" "$2"; }

# base..incoming 가 내보내도 되는 변경인지 본다. 이유를 stdout 에 쓰고 실패를 돌려준다.
check_changes() {
  local base=$1
  if ! G merge-base --is-ancestor "$base" "$INCOMING"; then echo "not-descendant"; return 1; fi
  if [ -n "$(G rev-list --merges "$base..$INCOMING")" ]; then echo "merge-commit"; return 1; fi
  local line mode path
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    mode=$(printf '%s' "$line" | cut -d' ' -f2)
    path=${line#*$'\t'}
    if [ "$mode" = 120000 ] || [ "$mode" = 160000 ]; then echo "link:$path"; return 1; fi
    if ! printf '%s\n' "$path" | grep -qE -f "$PATHS"; then echo "path:$path"; return 1; fi
  done < <(G diff --raw --no-renames "$base" "$INCOMING")
}

shopt -s nullglob
for manifest in "$OUTBOX"/*.json; do
  name=$(basename "$manifest" .json)
  if grep -q "^$name\.json " "$LEDGER"; then continue; fi
  branch="content/$(printf '%s' "$name" | tr 'A-Z' 'a-z')"
  if ! [[ $name =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then record "$name.json rejected bad-name"; continue; fi

  base=$(field "$manifest" baseSha)
  format=$(field "$manifest" exportFormat)
  ref=$(field "$manifest" exportRef)
  commit=$(field "$manifest" commit)
  source_branch=$(field "$manifest" branch)
  if ! [[ $base =~ ^[0-9a-f]{40}$ ]] || ! [[ $ref =~ ^[A-Za-z0-9._-]+\.(bundle|patch)$ ]] || [ ! -f "$OUTBOX/$ref" ]; then
    record "$name.json rejected bad-manifest"
    continue
  fi
  if ! G merge-base --is-ancestor "$base" origin/main 2>/dev/null; then
    record "$name.json stale base-not-in-main"
    continue
  fi

  G update-ref -d "$INCOMING" 2>/dev/null || true
  case "$format" in
    bundle)
      if ! [[ $source_branch =~ ^content/[A-Za-z0-9._-]+$ ]] \
        || ! G bundle verify -q "$OUTBOX/$ref" >/dev/null 2>&1 \
        || ! G fetch -q "$OUTBOX/$ref" "$source_branch:$INCOMING" 2>/dev/null \
        || [ "$(G rev-parse "$INCOMING")" != "$commit" ]; then
        record "$name.json rejected bad-bundle"
        continue
      fi
      ;;
    format-patch)
      G checkout -q --detach "$base"
      if ! G am -q --keep-cr "$OUTBOX/$ref" >/dev/null 2>&1; then
        G am --abort >/dev/null 2>&1 || true
        record "$name.json rejected bad-patch"
        continue
      fi
      G update-ref "$INCOMING" HEAD
      ;;
    *)
      record "$name.json rejected bad-format"
      continue
      ;;
  esac

  if ! reason=$(check_changes "$base"); then
    record "$name.json rejected $reason"
    continue
  fi
  # push 가 실패하면(네트워크 등) 기록하지 않는다. 다음 실행이 다시 시도한다.
  G push -q origin "$INCOMING:refs/heads/$branch"
  record "$name.json ok $branch"
done
G update-ref -d "$INCOMING" 2>/dev/null || true
