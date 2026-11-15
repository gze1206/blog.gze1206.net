#!/bin/sh
# 개인 작업 공간(②)을 로컬 백업으로 남기고 private remote 로 push 한다 (NOR-198).
#
# 신뢰 경계: 작업 트리는 컨테이너가 쓸 수 있으므로 **내용만** 믿지 않는 데이터로 다룬다.
# git 메타데이터(설정·hooks)와 deploy key 는 작업 트리 밖에 두고 workbench-backup 계정만 가진다.
# 작업 트리 안에 .git 을 두면 컨테이너가 hooks·설정을 심어 이 스크립트에서 명령을 실행할 수 있다.
# safe.directory='*' 는 설정하지 않는다. 중첩 저장소의 설정(core.fsmonitor 등)이 실행되기 때문이다.
#
# 순서: outbox tar → git 커밋 → bundle → push. git 단계가 실패해도 tar 와 bundle 은 남기고,
# 실패는 마지막에 종료 코드로 알린다. push 는 git 단계가 성공했을 때만 한다.
set -eu
umask 077

GIT_DIR="${WORKSPACE_GIT_DIR:-/srv/workbench/workspace.git}"
WORKSPACE="${WORKSPACE_ROOT:-/srv/workbench/private-workspace}"
BACKUPS="${BACKUP_ROOT:-/srv/workbench/backups}"
BRANCH="${WORKSPACE_BRANCH:-main}"
KEEP="${BACKUP_KEEP:-14}"

case "$KEEP" in '' | *[!0-9]*) echo "BACKUP_KEEP must be a number" >&2; exit 2 ;; esac
for dir in "$GIT_DIR" "$WORKSPACE" "$BACKUPS"; do
  case "$dir" in *..*) echo "unexpected path: $dir" >&2; exit 2 ;; esac
  case "$dir" in /srv/workbench/?*) ;; *) echo "unexpected path: $dir" >&2; exit 2 ;; esac
done

export GIT_DIR GIT_WORK_TREE="$WORKSPACE"
cd "$WORKSPACE"
stamp="$(date -u +%Y%m%dT%H%MZ)"
rc=0

# 이전 실행이 중간에 끊겨 남은 임시 파일을 지운다.
rm -f -- "$BACKUPS"/.workspace-*.tmp "$BACKUPS"/.outbox-*.tmp

# 1. outbox 는 git 에 들어가지 않으므로 git 상태와 무관하게 먼저 남긴다.
if [ -d .workbench/publish-outbox ]; then
  tar -C "$WORKSPACE" -cf "$BACKUPS/.outbox-$stamp.tar.tmp" .workbench/publish-outbox
  mv -- "$BACKUPS/.outbox-$stamp.tar.tmp" "$BACKUPS/outbox-$stamp.tar"
fi

# 2. 바뀐 파일을 커밋한다. 실패하면 push 만 건너뛴다.
commit_snapshot() {
  # 작업 트리 안의 .git(최상위·중첩)은 메타데이터가 섞인 것이다. 커밋하지 않고 사람에게 넘긴다.
  nested="$(find "$WORKSPACE" -path "$WORKSPACE/.workbench" -prune -o -name .git -print -quit)"
  if [ -n "$nested" ]; then
    echo "작업 트리 안에 .git 이 있다: $nested (메타데이터는 $GIT_DIR 에만 둔다)" >&2
    return 1
  fi
  [ "$(git symbolic-ref --short HEAD)" = "$BRANCH" ] || { echo "HEAD 가 $BRANCH 가 아니다" >&2; return 1; }
  git check-ignore --quiet .workbench/publish-outbox || { echo ".workbench/ 가 .gitignore 에서 빠졌다" >&2; return 1; }
  if [ -n "$(git status --porcelain)" ]; then
    git add -A || return 1
    git commit -q --no-verify -m "💾 backup: $(date -u +%Y-%m-%dT%H:%MZ) 작업 공간 스냅샷" || return 1
  fi
}
committed=1
commit_snapshot || { committed=0; rc=1; }

# 3. git 이력 전체를 bundle 로 남긴다. 네트워크가 끊겨도 이 단계는 끝난다.
if git bundle create -q "$BACKUPS/.workspace-$stamp.bundle.tmp" --all \
  && git bundle verify -q "$BACKUPS/.workspace-$stamp.bundle.tmp"; then
  mv -- "$BACKUPS/.workspace-$stamp.bundle.tmp" "$BACKUPS/workspace-$stamp.bundle"
else
  rc=1
fi

# 오래된 백업은 개수로 정리한다(같은 종류끼리 최신 KEEP 개만 남긴다).
# 이름의 stamp(UTC, 고정 폭)가 시간 순이므로 이름 역순이 최신 순이다.
# shellcheck disable=SC2012
for pattern in 'workspace-*.bundle' 'outbox-*.tar'; do
  # shellcheck disable=SC2086
  ls -1r "$BACKUPS"/$pattern 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do rm -f -- "$old"; done
done

# 4. push 는 마지막에, 커밋 단계가 성공했을 때만 한다.
if [ "$committed" = 1 ]; then
  git push -q origin "refs/heads/$BRANCH:refs/heads/$BRANCH" || rc=1
fi
exit "$rc"
