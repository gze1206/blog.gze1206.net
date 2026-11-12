# 공개 댓글 서버 운영 (Waline)

미니PC 에서 블로그 댓글·반응을 받는 서버를 운영하는 절차다. 실제 Cloudflare 터널 생성과
DNS 연결은 사용자 승인 후 외부에서 수행한다.

## 왜 워크벤치와 갈라 두는가

두 서비스의 경계가 정반대다.

|                  | 워크벤치             | 댓글 서버          |
| ---------------- | -------------------- | ------------------ |
| 누가 닿아야 하나 | 나 하나 (Tailnet 안) | 블로그 방문자 전부 |
| 공개 경로        | 없음                 | Cloudflare Tunnel  |
| 보관하는 것      | 개인 저작 데이터     | 남이 쓴 댓글       |

같은 호스트에서 돌더라도 **compose 프로젝트와 네트워크를 분리**한다. 한 네트워크에 두면
터널이 열리는 순간 워크벤치도 같은 사설망 안의 이웃이 된다. 터널이 아는 것은 댓글 서버의
주소 하나뿐이어야 한다.

호스트 포트도 열지 않는다. 공개 경로는 터널 하나이므로 공유기·방화벽에 구멍을 내지 않고,
Waline 에 닿을 수 있는 것은 같은 네트워크의 터널 컨테이너뿐이다.

## 준비

```sh
sudo useradd --system --uid 10002 --user-group --shell /usr/sbin/nologin waline
sudo install -d -o waline -g waline -m 0700 /srv/comments/data
```

`.env` 를 만들고 값을 채운다. `WALINE_JWT_TOKEN` 은 새로 만든 무작위 값이어야 한다.

```sh
cp deploy/waline/.env.example deploy/waline/.env
chmod 0600 deploy/waline/.env
openssl rand -base64 48   # WALINE_JWT_TOKEN 에 넣는다
```

## 데이터베이스는 **먼저** 심는다

SQLite 저장소는 스키마가 든 파일을 미리 놓아야 한다. 빈 파일로 시작하면 서버는 뜨지만 모든
요청이 `no such table: wl_Comment` 로 실패한다.

```sh
curl -fsSL -o /srv/comments/data/waline.sqlite \
  https://raw.githubusercontent.com/walinejs/waline/main/assets/waline.sqlite
sudo chown waline:waline /srv/comments/data/waline.sqlite
sudo chmod 0600 /srv/comments/data/waline.sqlite
```

**컨테이너를 띄운 뒤에 파일을 바꿔치기하지 않는다.** 이미 열려 있는 파일을 교체해도 컨테이너는
예전 것을 계속 본다(실측). 파일을 갈아야 하면 내렸다가 다시 올린다.

## Cloudflare Tunnel

대시보드(Zero Trust → Networks → Tunnels)에서 터널을 만들고 토큰을 받아 `.env` 의
`CLOUDFLARE_TUNNEL_TOKEN` 에 넣는다. 라우팅은 대시보드가 갖는다.

- Public hostname: 예 `comments.gze1206.net`
- Service: `http://waline:8360` — compose 네트워크 안의 서비스 이름이다. `localhost` 가 아니다

이 hostname 하나만 공개한다. 워크벤치 쪽 hostname 을 같은 터널에 추가하지 않는다.

## 실행

```sh
cd deploy/waline
docker compose config --quiet
docker compose up -d
docker compose ps
docker compose logs --tail=50 waline
```

Waline 은 포트를 공개하지 않으므로 호스트에서 직접 `curl` 할 수 없다. 확인은 컨테이너 안에서
하거나, 터널이 붙은 뒤 공개 주소로 한다.

```sh
docker compose exec waline node -e "fetch('http://127.0.0.1:8360/').then(r=>console.log(r.status))"
```

## 관리자 계정과 검수

1. 공개 주소의 `/ui/register` 에서 가입한다. **`WALINE_AUTHOR_EMAIL` 과 같은 주소로 가입한
   계정이 관리자**가 된다. 그러니 사이트를 공개하기 전에 먼저 가입해 그 자리를 차지한다.
2. 관리 화면은 `/ui`. 여기서 댓글을 승인·삭제하고 스팸을 표시한다.

익명 댓글을 받으므로 방어선은 세 겹이다.

- `WALINE_COMMENT_AUDIT=true` — 새 댓글은 승인 전까지 보이지 않는다. 기본값으로 켜 둔다
- `WALINE_IPQPS` — 같은 IP 의 댓글 사이 최소 간격(초). 기본 60
- `WALINE_AKISMET_KEY` — Akismet 키가 있으면 넣는다. `false` 면 끈다
- `WALINE_SECURE_DOMAINS` — 이 도메인의 페이지에서 온 요청만 받는다. 다른 도메인에서 부르면
  `403 Forbidden` 이다(실측). 남의 사이트가 내 댓글 서버를 쓰지 못하게 하는 값이다

## 이미지 갱신과 롤백

워크벤치와 같은 방식이다. 태그가 아니라 digest 로 고정한다.

```sh
docker buildx imagetools inspect lizheming/waline:latest --format '{{.Manifest.Digest}}'
# .env 의 WALINE_DIGEST 를 그 값으로 바꾸고
docker compose pull && docker compose up -d
```

롤백은 이전 digest 로 되돌리고 같은 두 명령을 실행하는 것이다. 스키마가 바뀌는 갱신이라면
아래 백업을 먼저 뜬다.

## 백업

영속 상태는 SQLite 파일 하나다. 열린 채로 복사하면 깨질 수 있으므로 내리고 뜬다.

```sh
docker compose stop waline
sudo -u waline cp /srv/comments/data/waline.sqlite /srv/backups/waline-$(date +%Y%m%d).sqlite
sudo -u waline sqlite3 /srv/backups/waline-$(date +%Y%m%d).sqlite 'pragma integrity_check;'
docker compose start waline
```

댓글은 남이 쓴 글이다. 백업 파일에 이메일·IP 가 들어 있으므로 개인 저작 데이터와 같은
민감도로 보관한다.

## 블로그 쪽 연결 (아직)

서버가 안정된 뒤에 글 상세 페이지에 위젯을 붙인다. 그때 쓸 설정은 이렇다.

```js
{
  serverURL: 'https://comments.gze1206.net',
  lang: 'ko',
  login: 'disable',      // 로그인 없이 댓글 — 비개발자도 쓸 수 있어야 한다
  reaction: true,        // 이모지 반응
  requiredMeta: [],      // 닉네임·이메일도 선택
  dark: 'html.dark',     // 이 사이트의 다크 모드 신호와 맞춘다
}
```

위젯은 지연 로드로 붙이고, 스크립트가 없거나 서버가 죽어도 글 본문은 그대로 읽히게 둔다.
