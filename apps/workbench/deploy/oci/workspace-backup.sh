#!/bin/sh
# 개인 작업 공간(②)을 private remote 로 push 하고, 로컬 bundle 을 남긴다 (NOR-198).
#
# workbench 서비스 계정으로 실행한다(systemd 단위가 User=workbench 로 부른다).
# 앱은 작업 공간을 커밋하지 않는다. 이 스크립트가 바뀐 파일을 하루 한 번 커밋한다.
# outbox(.workbench/)는 .gitignore 로 빠진다. 미전송 발행 산출물은 bundle 에만 남는다.
set -eu

WORKSPACE="${WORKSPACE_ROOT:-/srv/workbench/private-workspace}"
BACKUPS="${BACKUP_ROOT:-/srv/workbench/backups}"
KEEP="${BACKUP_KEEP:-14}"

cd "$WORKSPACE"
git check-ignore --quiet .workbench/publish-outbox

if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -q -m "💾 backup: $(date -u +%Y-%m-%dT%H:%MZ) 작업 공간 스냅샷"
fi
git push -q origin HEAD

stamp="$(date -u +%Y%m%dT%H%MZ)"
umask 077
git bundle create -q "$BACKUPS/workspace-$stamp.bundle" --all
git bundle verify -q "$BACKUPS/workspace-$stamp.bundle"
if [ -d .workbench/publish-outbox ]; then
  tar -C "$WORKSPACE" -cf "$BACKUPS/outbox-$stamp.tar" .workbench/publish-outbox
fi

# 오래된 백업은 개수로 정리한다(같은 접두어끼리 최신 KEEP 개만 남긴다).
# 이름은 위의 stamp 형식(영숫자·T·Z)뿐이라 ls 정렬로 충분하다.
# shellcheck disable=SC2012
for prefix in workspace outbox; do
  ls -1t "$BACKUPS/$prefix-"* 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do rm -f -- "$old"; done
done
