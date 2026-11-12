#!/bin/sh
# 개인 작업 공간(②)을 로컬 bundle 로 남기고 private remote 로 push 한다 (NOR-198).
#
# 신뢰 경계: 작업 트리는 컨테이너가 쓸 수 있으므로 **내용만** 믿지 않는 데이터로 다룬다.
# git 메타데이터(설정·hooks)와 deploy key 는 작업 트리 밖에 두고 workbench-backup 계정만 가진다.
# 작업 트리 안에 .git 을 두면 컨테이너가 hooks·설정을 심어 이 스크립트에서 명령을 실행할 수 있다.
#
# 앱은 작업 공간을 커밋하지 않는다. 이 스크립트가 바뀐 파일을 하루 한 번 커밋한다.
# outbox(.workbench/)는 .gitignore 로 빠진다. 미전송 발행 산출물은 tar 에만 남는다.
set -eu
umask 077

GIT_DIR="${WORKSPACE_GIT_DIR:-/srv/workbench/workspace.git}"
WORKSPACE="${WORKSPACE_ROOT:-/srv/workbench/private-workspace}"
BACKUPS="${BACKUP_ROOT:-/srv/workbench/backups}"
BRANCH="${WORKSPACE_BRANCH:-main}"
KEEP="${BACKUP_KEEP:-14}"

case "$KEEP" in '' | *[!0-9]*) echo "BACKUP_KEEP must be a number" >&2; exit 2 ;; esac
for dir in "$GIT_DIR" "$WORKSPACE" "$BACKUPS"; do
  case "$dir" in /srv/workbench/?*) ;; *) echo "unexpected path: $dir" >&2; exit 2 ;; esac
done
if [ -e "$WORKSPACE/.git" ]; then
  echo "작업 트리 안에 .git 이 있다. 메타데이터는 $GIT_DIR 에만 둔다." >&2
  exit 2
fi

export GIT_DIR GIT_WORK_TREE="$WORKSPACE"
cd "$WORKSPACE"
[ "$(git symbolic-ref --short HEAD)" = "$BRANCH" ]
git check-ignore --quiet .workbench/publish-outbox

if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -q --no-verify -m "💾 backup: $(date -u +%Y-%m-%dT%H:%MZ) 작업 공간 스냅샷"
fi

# 로컬 백업을 먼저 만든다. 네트워크가 끊겨도 이 단계는 끝난다.
stamp="$(date -u +%Y%m%dT%H%MZ)"
git bundle create -q "$BACKUPS/.workspace-$stamp.bundle.tmp" --all
git bundle verify -q "$BACKUPS/.workspace-$stamp.bundle.tmp"
mv -- "$BACKUPS/.workspace-$stamp.bundle.tmp" "$BACKUPS/workspace-$stamp.bundle"
if [ -d .workbench/publish-outbox ]; then
  tar -C "$WORKSPACE" -cf "$BACKUPS/.outbox-$stamp.tar.tmp" .workbench/publish-outbox
  mv -- "$BACKUPS/.outbox-$stamp.tar.tmp" "$BACKUPS/outbox-$stamp.tar"
fi

# 오래된 백업은 개수로 정리한다(같은 종류끼리 최신 KEEP 개만 남긴다).
# 이름은 위의 stamp 형식(영숫자·T·Z)뿐이라 ls 정렬로 충분하다.
# shellcheck disable=SC2012
for pattern in 'workspace-*.bundle' 'outbox-*.tar'; do
  # shellcheck disable=SC2086
  ls -1t "$BACKUPS"/$pattern 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do rm -f -- "$old"; done
done

# push 는 마지막에 한다. 실패하면 단위가 실패로 끝나 journal 에 남는다.
git push -q origin "refs/heads/$BRANCH:refs/heads/$BRANCH"
