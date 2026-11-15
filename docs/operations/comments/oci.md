# OCI 호스트의 댓글 서버 (NOR-200)

댓글 서버 Comentario 를 워크벤치와 같은 OCI arm64 호스트에서 운영하는 형상과 절차다. 선택 이유는
[ADR 0019](../../decisions/0019-comment-server-comentario.md), 수용 기준은
[NOR-200 명세](../../spec/blog/NOR-200-comments.md) 에 있다. 배포 파일 원본은 `deploy/oci/comments/` 다.

## 형상

| 무엇           | 값                                                                                     |
| -------------- | -------------------------------------------------------------------------------------- |
| 공개 주소      | `https://comments.gze1206.net` (Cloudflare 프록시 → 공용 edge Caddy)                   |
| 실행 계정      | 시스템 계정 `comments`(로그인 셸 없음). 컨테이너도 이 UID/GID 로 돈다                  |
| 데이터         | `/srv/comments/data/comentario.sqlite3` (`comments`, 0700)                             |
| 백업           | `/srv/comments/backups` (`comments-backup`, 0700), 매일 04:45 전후, 14개               |
| compose·`.env` | `/srv/comments/deploy` (root, 0700). `secrets.yaml` 은 `comments` 만 읽는다            |
| 이미지         | `registry.gitlab.com/comentario/comentario@<digest>` (3.19.0, linux/arm64)             |
| 네트워크       | 공개 포트 없음. `edge` 네트워크의 alias `comentario:8080` 으로만 닿는다                |
| 컨테이너 제한  | 읽기 전용 루트, `cap_drop: ALL`, `no-new-privileges`, CPU 0.5, 메모리 256MB, 로그 30MB |

## 댓글 정책

- 가입 없이 **이름만** 받는다(`authAnonymous`, `login.unregistered.requireName`). 이메일은 묻지 않는다.
  익명 방문자에게 로그인 창을 띄우지 않는다(`login.showForUnauth=false`).
- 익명 댓글은 **승인 뒤 공개**한다(`modAnonymous`). 메일 발송(SMTP)이 없으므로 관리 화면에서 확인한다.
- 댓글 작성자 가입(`signup.enableLocal`·`enableFederated`)과 관리 화면 가입(`auth.signup.enabled`)을 끈다.
  관리자 로그인(`authLocal`)만 남는다.
- 이미지 마크다운과 Gravatar 를 끈다. 링크에는 `nofollow noopener` 가 붙는다.
- 허용 Origin 은 기본값 `$`(도메인 호스트 `gze1206.net`)다.
- 블로그는 `comentario.js` 를 SRI 해시와 함께 불러온다(`apps/blog/src/lib/comments.ts`). **이미지를 갱신하면
  이 해시도 함께 바꿔야 한다.** 바꾸지 않으면 브라우저가 스크립트를 거부해 댓글 창이 뜨지 않는다.
  `pnpm check:domains` 가 서버 본문과 해시를 대조한다.

## 남은 위험

- **공유 edge 네트워크.** edge 네트워크의 다른 컨테이너는 `comentario:8080` 에 직접 닿는다. Cloudflare 와
  Caddy 의 제한을 거치지 않는다. 관리 API 는 로그인이 필요하고 로그인 실패 10회에 잠긴다
  (`auth.login.local.maxAttempts`). 사이트별 내부 네트워크는 edge 쪽 구성이 바뀌어야 가능하다.
- **레이트 리밋.** Caddy 에는 없다. Cloudflare 의 Rate limiting rule 로 `PUT /api/embed/comments` 와
  `POST /api/auth/login` 을 제한한다(대시보드 작업). 익명 댓글은 승인 전에 공개되지 않는다.
- **관리 화면 공개.** 관리 화면은 공개 주소에 있다. 긴 무작위 비밀번호를 쓰고, 필요하면 Cloudflare Access 로
  관리 경로를 막는다.
- **백업 위치.** 백업은 같은 호스트에만 있다.

## 처음 설치

순서가 중요하다. **첫 가입자가 superuser 가 되고 기본값은 가입이 열려 있다.** edge 네트워크는 다른 서비스와
함께 쓰므로, 처음에는 바깥과 끊긴 내부 네트워크(`compose.bootstrap.yml`)에서 계정을 만들고 가입을 닫은 뒤
edge 에 붙인다.

1. 계정과 디렉터리를 만들고 `sqlite3` 를 설치한다.

   ```sh
   sudo apt-get install -y sqlite3
   sudo useradd --system --home-dir /var/lib/comments --no-create-home --shell /usr/sbin/nologin comments
   sudo install -d -m 0711 /srv/comments
   sudo useradd --system --home-dir /var/lib/comments-backup --no-create-home --shell /usr/sbin/nologin comments-backup
   sudo install -d -m 0700 -o comments -g comments /srv/comments/data
   sudo install -d -m 0700 -o comments-backup -g comments-backup /srv/comments/backups
   sudo install -d -m 0700 /srv/comments/deploy
   ```

2. `compose.yml`·`compose.bootstrap.yml` 을 `/srv/comments/deploy` 에 두고, `secrets.yaml`(`comments` 소유 0400)과 `.env`(0600)를
   예시 파일대로 만든다. `.env` 의 UID/GID 는 `id -u comments`, `id -g comments` 값이다.
3. 내부 네트워크에서 컨테이너를 띄운다. 이 네트워크에는 Comentario 와 아래의 일회용 curl 컨테이너만 있다.

   ```sh
   D=/srv/comments/deploy
   C="sudo docker compose --project-directory $D --env-file $D/.env"
   $C -f $D/compose.yml -f $D/compose.bootstrap.yml up -d
   ```

4. 같은 내부 네트워크에서 첫 계정을 만들고 설정을 바꾼다. 관리자 자격은 `/srv/comments/deploy/owner-credentials.json`
   (root, 0600)에 두고, 요청 본문은 stdin 으로 넘겨 셸 이력과 `ps` 에 남기지 않는다. 로그인 쿠키에 `Secure` 가
   붙으므로 http 로 부를 때는 `Set-Cookie` 값을 `Cookie` 헤더로 직접 넘긴다.

   ```sh
   CURL="sudo docker run --rm -i --network comments_bootstrap curlimages/curl:8.11.1 -sS"
   sudo cat $D/owner-credentials.json | $CURL -X POST http://comentario:8080/api/auth/profile \
     -H 'content-type: application/json' --data-binary @-
   ```

   - `POST /api/auth/profile` 로 첫 계정을 만든다.
   - `PATCH /api/config` 로 `auth.signup.enabled=false`, `integrations.useGravatar=false`,
     `operation.newOwner.enabled=false` 를 둔다. 두 번째 가입이 403 인지 확인한다.
   - `POST /api/domains` 로 도메인 `gze1206.net` 을 위 정책대로 등록한다.
   - 끝나면 edge 네트워크로 옮긴다: `$C up -d --force-recreate` (`compose.yml` 만).

5. Cloudflare DNS 에 `comments` A 레코드(호스트 공인 IP, **프록시**)를 만든다. SSL/TLS 는 Full (strict)다.
6. edge 에 사이트를 붙인다.

   ```sh
   # EDGE 는 공용 edge 디렉터리, 파일 소유자는 edge 소유 계정이다(edge 의 README 참고).
   sudo -u <edge 소유자> install -m 0644 comments.caddy "$EDGE/sites/comments.caddy"
   sudo docker compose --project-directory "$EDGE" exec caddy caddy validate --config /etc/caddy/Caddyfile
   sudo docker compose --project-directory "$EDGE" exec caddy caddy reload --config /etc/caddy/Caddyfile
   ```

7. 백업 타이머를 켠다.

   ```sh
   sudo install -d -m 0755 /usr/local/lib/comments
   sudo install -m 0755 comments-backup.sh /usr/local/lib/comments/
   sudo install -m 0644 comments-backup.service comments-backup.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now comments-backup.timer
   ```

8. 저장소에서 `pnpm check:domains` 를 돌린다. 댓글 스크립트(`/comentario.js`)의 상태와 SRI 해시도 함께 본다.

## 관리

- 관리 화면: `https://comments.gze1206.net/` 에 관리자 계정으로 로그인한다. 처음 로그인한 뒤 이메일과
  비밀번호를 바꾸고 자격 파일을 지운다(`shred -u`).
- 승인 대기 댓글: 관리 화면 → 도메인 → Comments 에서 승인하거나 지운다.
- 상태 확인:

  ```sh
  sudo docker compose --project-directory /srv/comments/deploy --env-file /srv/comments/deploy/.env ps
  systemctl list-timers comments-backup.timer
  journalctl -u comments-backup.service -n 20
  ```

## 이미지 갱신과 복구

- 갱신 순서:
  1. `sudo systemctl start comments-backup.service` 로 백업을 하나 남긴다.
  2. 새 버전의 arm64 digest 를 확인하고 `.env` 의 `COMENTARIO_DIGEST` 를 바꾼 뒤 `pull`·`up -d` 한다.
  3. 새 `comentario.js` 의 sha384 를 구해 블로그의 `COMMENTS_SCRIPT_INTEGRITY` 를 바꾸는 PR 을 낸다.
     `openssl dgst -sha384 -binary comentario.js | openssl base64 -A` 로 구한다.
  4. `pnpm check:domains` 가 실패 0 인지 본다. 롤백은 이전 digest 와 이전 해시다.
- 복구: 컨테이너를 멈추고, 지금 DB 와 보조 파일(`-journal`, `-wal`, `-shm`)을 다른 곳에 옮겨 둔 뒤 백업을
  넣는다. 그 뒤 다시 띄운다.

  ```sh
  $C stop
  sudo mkdir -m 0700 /srv/comments/data.before-restore
  sudo sh -c 'mv /srv/comments/data/comentario.sqlite3* /srv/comments/data.before-restore/'
  sudo install -o comments -g comments -m 0600 /srv/comments/backups/<백업 파일> /srv/comments/data/comentario.sqlite3
  sudo sqlite3 /srv/comments/data/comentario.sqlite3 'PRAGMA integrity_check;'
  $C start
  ```
