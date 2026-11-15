#!/bin/sh
# 댓글 DB(SQLite)를 온라인 백업한다 (NOR-200). 종류별로 최신 KEEP 개만 남긴다.
set -eu
umask 077

DB="${COMMENTS_DB:-/srv/comments/data/comentario.sqlite3}"
BACKUPS="${BACKUP_ROOT:-/srv/comments/backups}"
KEEP="${BACKUP_KEEP:-14}"

case "$KEEP" in '' | *[!0-9]*) echo "BACKUP_KEEP must be a number" >&2; exit 2 ;; esac
for path in "$DB" "$BACKUPS"; do
  case "$path" in *..*) echo "unexpected path: $path" >&2; exit 2 ;; esac
  case "$path" in /srv/comments/?*) ;; *) echo "unexpected path: $path" >&2; exit 2 ;; esac
done

stamp="$(date -u +%Y%m%dT%H%MZ)"
tmp="$BACKUPS/.comentario-$stamp.sqlite3.tmp"
rm -f -- "$BACKUPS"/.comentario-*.tmp

# .backup 은 서버가 쓰는 중에도 일관된 사본을 만든다. 사본을 검사한 뒤에만 이름을 바꾼다.
sqlite3 "file:$DB?mode=ro" ".backup '$tmp'"
[ "$(sqlite3 "$tmp" 'PRAGMA integrity_check;')" = ok ] || { rm -f -- "$tmp"; echo "integrity_check 실패" >&2; exit 1; }
mv -- "$tmp" "$BACKUPS/comentario-$stamp.sqlite3"

# 이름의 stamp(UTC, 고정 폭)가 시간 순이므로 이름 역순이 최신 순이다.
# shellcheck disable=SC2012
ls -1r "$BACKUPS"/comentario-*.sqlite3 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do rm -f -- "$old"; done
