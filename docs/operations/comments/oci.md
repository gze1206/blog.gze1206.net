# OCI 호스트의 댓글 서버 (NOR-200)

댓글 서버 Comentario 를 워크벤치와 같은 OCI arm64 호스트에서 운영하는 형상과 절차다. 선택 이유는
[ADR 0019](../../decisions/0019-comment-server-comentario.md), 수용 기준은
[NOR-200 명세](../../spec/blog/NOR-200-comments.md) 에 있다. 배포 파일 원본은 `deploy/oci/comments/` 다.

## 형상

| 무엇           | 값                                                                                 |
| -------------- | ---------------------------------------------------------------------------------- |
| 공개 주소      | `https://comments.gze1206.net` (Cloudflare 프록시 → 공용 edge Caddy)               |
| 실행 계정      | 시스템 계정 `comments`(로그인 셸 없음). 컨테이너도 이 UID/GID 로 돈다              |
| 데이터         | `/srv/comments/data/comentario.sqlite3` (`comments`, 0700)                         |
| 백업           | `/srv/comments/backups` (`comments`, 0700), 매일 04:45 전후, 14개                  |
| compose·`.env` | `/srv/comments/deploy` (root, 0700). `secrets.yaml` 은 `comments` 만 읽는다        |
| 이미지         | `registry.gitlab.com/comentario/comentario@<digest>` (3.19.0, linux/arm64)         |
| 네트워크       | 공개 포트 없음. `edge` 네트워크의 alias `comentario:8080` 으로만 닿는다            |
| 컨테이너 제한  | 읽기 전용 루트, `cap_drop: ALL`, `no-new-privileges`, 메모리 256MB, 프로세스 128개 |

## 댓글 정책

- 가입 없이 **이름만** 받는다(`authAnonymous`, `login.unregistered.requireName`). 이메일은 묻지 않는다.
- 익명 댓글은 **승인 뒤 공개**한다(`modAnonymous`). 메일 발송(SMTP)이 없으므로 관리 화면에서 확인한다.
- 댓글 작성자 가입(`signup.enableLocal`·`enableFederated`)과 관리 화면 가입(`auth.signup.enabled`)을 끈다.
  관리자 로그인(`authLocal`)만 남는다.
- 이미지 마크다운과 Gravatar 를 끈다. 링크에는 `nofollow noopener` 가 붙는다.
- 허용 Origin 은 기본값 `$`(도메인 호스트 `gze1206.net`)다.

## 처음 설치

순서가 중요하다. **첫 가입자가 superuser 가 되고 기본값은 가입이 열려 있다.** 그래서 edge 에 사이트를
붙이기 전에, 밖에서 닿지 않는 상태로 계정을 만들고 가입을 닫는다.

1. 계정과 디렉터리를 만들고 `sqlite3` 를 설치한다.

   ```sh
   sudo apt-get install -y sqlite3
   sudo useradd --system --home-dir /var/lib/comments --no-create-home --shell /usr/sbin/nologin comments
   sudo install -d -m 0711 /srv/comments
   sudo install -d -m 0700 -o comments -g comments /srv/comments/data /srv/comments/backups
   sudo install -d -m 0700 /srv/comments/deploy
   ```

2. `compose.yml` 을 `/srv/comments/deploy` 에 두고, `secrets.yaml`(`comments` 소유 0400)과 `.env`(0600)를
   예시 파일대로 만든다. `.env` 의 UID/GID 는 `id -u comments`, `id -g comments` 값이다.
3. 컨테이너를 띄운다. 이 시점에는 edge 사이트가 없어서 밖에서 닿지 않는다.

   ```sh
   D=/srv/comments/deploy
   sudo docker compose --project-directory "$D" --env-file "$D/.env" up -d
   ```

4. edge 네트워크 안에서 첫 계정을 만들고 설정을 바꾼다. 로그인 쿠키에 `Secure` 가 붙으므로 http 로
   부를 때는 `Set-Cookie` 값을 `Cookie` 헤더로 직접 넘긴다. 관리자 자격은 `/srv/comments/deploy/owner-credentials`
   (root, 0600)에 둔다.
   - `POST /api/auth/profile` 로 첫 계정을 만든다.
   - `PATCH /api/config` 로 `auth.signup.enabled=false`, `integrations.useGravatar=false`,
     `operation.newOwner.enabled=false` 를 둔다. 두 번째 가입이 403 인지 확인한다.
   - `POST /api/domains` 로 도메인 `gze1206.net` 을 위 정책대로 등록한다.
5. Cloudflare DNS 에 `comments` A 레코드(호스트 공인 IP, **프록시**)를 만든다. SSL/TLS 는 Full (strict)다.
6. edge 에 사이트를 붙인다.

   ```sh
   sudo -u noru install -m 0644 comments.caddy /home/noru/edge/sites/comments.caddy
   cd /home/noru/edge
   sudo docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile
   sudo docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
   ```

7. 백업 타이머를 켠다.

   ```sh
   sudo install -d -m 0755 /usr/local/lib/comments
   sudo install -m 0755 comments-backup.sh /usr/local/lib/comments/
   sudo install -m 0644 comments-backup.service comments-backup.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now comments-backup.timer
   ```

8. 저장소에서 `pnpm check:domains` 를 돌린다. 댓글 스크립트(`/comentario.js`)도 함께 본다.

## 관리

- 관리 화면: `https://comments.gze1206.net/` 에 관리자 계정으로 로그인한다. 처음 로그인한 뒤 이메일과
  비밀번호를 바꾸고 `owner-credentials` 파일을 지운다.
- 승인 대기 댓글: 관리 화면 → 도메인 → Comments 에서 승인하거나 지운다.
- 상태 확인:

  ```sh
  sudo docker compose --project-directory /srv/comments/deploy --env-file /srv/comments/deploy/.env ps
  systemctl list-timers comments-backup.timer
  journalctl -u comments-backup.service -n 20
  ```

## 이미지 갱신과 복구

- 갱신: 새 버전의 arm64 digest 를 확인하고 `.env` 의 `COMENTARIO_DIGEST` 를 바꾼 뒤 `pull`·`up -d` 한다.
  갱신 전에 `sudo systemctl start comments-backup.service` 로 백업을 하나 남긴다. 롤백은 이전 digest 다.
- 복구: 컨테이너를 멈추고 백업 파일을 `/srv/comments/data/comentario.sqlite3` 로 복사한다(`comments` 소유,
  0600). 그 뒤 다시 띄운다.
