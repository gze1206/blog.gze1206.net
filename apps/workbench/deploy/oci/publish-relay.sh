#!/usr/bin/env bash
# 워크벤치가 확정한 발행을 공개 블로그의 content/* 브랜치로 보낸다 (NOR-210).
#
# 신뢰 경계: outbox 는 컨테이너가 쓰는 곳이라 내용을 믿지 않는다. 이 스크립트가 관문이다.
#   - 매니페스트(JSON·이름·크기·심볼릭 링크 여부)를 relay-helper.py 로 엄격히 읽는다.
#   - base 가 origin/main 의 조상이어야 한다. bundle 은 매니페스트의 커밋과 같아야 한다(fsck 를 켠다).
#   - base 에서 최종 트리까지 바뀐 경로는 모두 content-paths.regex 안이고 일반 파일(100644)이어야 한다.
#   - push 하는 것은 받은 이력이 아니라 **최종 트리로 base 위에 새로 만든 커밋 하나**다. 중간 커밋·작성자·
#     메시지(TDD trailer 등)는 GitHub 에 가지 않는다.
# content/** 에서 도는 GitHub 워크플로는 그 브랜치의 파일로 실행되므로, 브랜치에 무엇이 들어가는지는 여기서 정한다.
# 매니페스트 하나가 잘못돼도 거절로 남기고 다음 것을 처리한다. outbox 는 고치지 않는다.
set -uo pipefail
umask 077

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTBOX="${RELAY_OUTBOX:-/srv/workbench/private-workspace/.workbench/publish-outbox}"
STATE="${RELAY_STATE:-/var/lib/workbench-relay}"
REMOTE="${RELAY_REMOTE:-git@github.com:gze1206/blog.gze1206.net.git}"
PATHS="${RELAY_PATHS:-$HERE/content-paths.regex}"
HELPER="$HERE/relay-helper.py"
MAX_EXPORT_BYTES=$((20 * 1024 * 1024))
REPO="$STATE/blog"
LEDGER="$STATE/ledger"
INCOMING=refs/relay/incoming
export GIT_AUTHOR_NAME="${RELAY_AUTHOR_NAME:-workbench-relay}"
export GIT_AUTHOR_EMAIL="${RELAY_AUTHOR_EMAIL:-workbench-relay@users.noreply.github.com}"
export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME" GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"

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
G() { git -C "$REPO" -c core.hooksPath=/dev/null -c fetch.fsckObjects=true -c transfer.fsckObjects=true "$@"; }
if [ ! -d "$REPO/.git" ]; then
  git clone -q "$REMOTE" "$REPO" || exit 1
fi
G fetch -q --prune origin main || exit 1

# 사유는 고정 코드만 받는다. 입력에서 온 글자가 섞이면 ledger 줄을 위조할 수 있다.
record() {
  local status=$2
  [[ $status =~ ^(ok\ content/[a-z0-9._-]+|stale\ [a-z-]+|rejected\ [a-z-]+)$ ]] || status="rejected unknown"
  printf '%s %s\n' "$1" "$status" >>"$LEDGER"
}
seen() { awk -v name="$1" '$1 == name { found = 1 } END { exit !found }' "$LEDGER"; }

# $1 매니페스트 경로, $2 ledger 키(파일 이름), $3 산출물 이름(.json 을 뗀 것)
process() {
  local file=$1 name=$2 stem=$3
  # 검사와 읽기 사이에 바꿔치기하지 못하게, 한 번 열어 릴레이 쪽 사본으로만 다룬다.
  local work="$STATE/work"
  rm -rf "$work" && mkdir -p "$work"
  local fields reason
  if ! reason=$(python3 "$HELPER" copy "$file" "$work/manifest.json" 65536); then record "$name" "rejected $reason"; return; fi
  if ! fields=$(python3 "$HELPER" manifest "$work/manifest.json"); then record "$name" "rejected ${fields:-bad-manifest}"; return; fi
  local base format ref commit source_branch
  { read -r base; read -r format; read -r ref; read -r commit; read -r source_branch; } <<<"$fields"
  local export="$work/export"
  if ! reason=$(python3 "$HELPER" copy "$OUTBOX/$ref" "$export" "$MAX_EXPORT_BYTES"); then record "$name" "rejected $reason"; return; fi
  if ! G merge-base --is-ancestor "$base" origin/main 2>/dev/null; then record "$name" "stale base-not-in-main"; return; fi

  G update-ref -d "$INCOMING" 2>/dev/null
  if [ "$format" = bundle ]; then
    if ! G bundle verify -q "$export" >/dev/null 2>&1 \
      || ! G fetch -q "$export" "$source_branch:$INCOMING" 2>/dev/null \
      || [ "$(G rev-parse "$INCOMING" 2>/dev/null)" != "$commit" ]; then
      record "$name" "rejected bad-bundle"; return
    fi
  else
    if ! G checkout -q --detach "$base" 2>/dev/null || ! G am -q --keep-cr "$export" >/dev/null 2>&1; then
      G am --abort >/dev/null 2>&1
      record "$name" "rejected bad-patch"; return
    fi
    G update-ref "$INCOMING" HEAD
  fi

  # 최종 트리만 본다. 중간 커밋은 가져가지 않으므로 검사할 필요도 없다.
  local tree diff
  if ! tree=$(G rev-parse --verify "$INCOMING^{tree}" 2>/dev/null); then record "$name" "rejected bad-tree"; return; fi
  diff=$(mktemp)
  if ! G diff --raw -z --no-renames "$base" "$tree" >"$diff"; then rm -f "$diff"; record "$name" "rejected bad-diff"; return; fi
  if ! reason=$(python3 "$HELPER" check "$PATHS" <"$diff"); then rm -f "$diff"; record "$name" "rejected $reason"; return; fi
  rm -f "$diff"

  local squashed branch
  branch="content/$(printf '%s' "$stem" | tr 'A-Z' 'a-z')"
  if ! squashed=$(G commit-tree "$tree" -p "$base" -m "📝 content: ${stem} 발행" -m "워크벤치 발행을 릴레이가 옮겼다(NOR-210). 원본 커밋 ${commit}."); then
    record "$name" "rejected commit-failed"; return
  fi
  # push 가 실패하면 기록하지 않는다(네트워크 등). 다음 실행이 다시 시도하고, 이번 실행은 다음 것으로 넘어간다.
  if ! G push -q origin "$squashed:refs/heads/$branch"; then
    echo "push 실패: $name" >&2
    return
  fi
  record "$name" "ok $branch"
}

shopt -s nullglob
for file in "$OUTBOX"/*.json; do
  base_name=$(basename "$file")
  # 이름부터 검증한다. 개행·공백이 든 이름은 ledger 를 어지럽힌다.
  if ! [[ $base_name =~ ^[A-Za-z0-9][A-Za-z0-9._-]*\.json$ ]]; then
    echo "이상한 이름을 건너뛴다" >&2
    continue
  fi
  seen "$base_name" && continue
  process "$file" "$base_name" "${base_name%.json}"
done
G update-ref -d "$INCOMING" 2>/dev/null
exit 0
