#!/bin/sh
# 댓글 DB(SQLite)를 온라인 백업한다 (NOR-200). 최신 KEEP 개만 남긴다.
# 서비스(comments)와 다른 계정(comments-backup)이 돌린다. 데이터는 읽기 권한 우회로 읽기만 한다.
set -eu
umask 077

DB=/srv/comments/data/comentario.sqlite3
BACKUPS=/srv/comments/backups
KEEP=14

# 타이머와 수동 실행이 겹치지 않게 한다.
exec 9>"$BACKUPS/.lock"
flock -n 9 || { echo "다른 백업이 실행 중이다" >&2; exit 1; }

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
tmp="$(mktemp "$BACKUPS/.comentario-$stamp.XXXXXX")"
trap 'rm -f -- "$tmp"' EXIT

# .backup 은 서버가 쓰는 중에도 일관된 사본을 만든다. 사본을 검사한 뒤에만 이름을 바꾼다.
sqlite3 "file:$DB?mode=ro" ".backup '$tmp'"
[ "$(sqlite3 "$tmp" 'PRAGMA integrity_check;')" = ok ] || { echo "integrity_check 실패" >&2; exit 1; }
mv -- "$tmp" "$BACKUPS/comentario-$stamp.sqlite3"
trap - EXIT

# 이름의 stamp(UTC, 고정 폭)가 시간 순이므로 이름 역순이 최신 순이다.
# shellcheck disable=SC2012
ls -1r "$BACKUPS"/comentario-*.sqlite3 | tail -n "+$((KEEP + 1))" | while read -r old; do rm -f -- "$old"; done
