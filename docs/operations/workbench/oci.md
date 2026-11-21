# OCI arm64 호스트의 워크벤치 (NOR-198)

워크벤치를 OCI arm64 인스턴스 한 대에서 Tailnet 전용으로 운영하는 실제 형상이다. 보안 경계와
일반 절차는 [tailnet-workbench.md](./tailnet-workbench.md) 를 따른다. 이 문서는 그 절차를 이 호스트에
적용한 결과와, 같은 호스트의 다른 서비스와 공존하는 방법을 적는다.

## 형상

| 무엇           | 값                                                                         |
| -------------- | -------------------------------------------------------------------------- |
| 실행 계정      | 시스템 계정 `workbench`(로그인 셸 없음). 컨테이너도 이 UID/GID 로 돈다     |
| 백업 계정      | 시스템 계정 `workbench-backup`. git 메타데이터·deploy key·백업을 가진다    |
| 작업 공간(②)   | `/srv/workbench/private-workspace` (`workbench`, 0700). 작업 트리만 있다   |
| git 메타데이터 | `/srv/workbench/workspace.git` (`workbench-backup`, 0700). 작업 트리 밖    |
| 백업           | `/srv/workbench/backups` (`workbench-backup`, 0700)                        |
| compose·`.env` | `/srv/workbench/deploy` (0700). 원본은 `apps/workbench/docker-compose.yml` |
| 이미지         | `ghcr.io/gze1206/workbench@<digest>` (linux/arm64, CI 가 게시)             |
| 서버 바인딩    | `127.0.0.1:3000` (host network, 공개 포트 없음)                            |
| Tailnet 진입점 | `tailscale serve --bg --https=8443 http://127.0.0.1:3000` (tailnet only)   |

## 다른 서비스와의 공존

이 호스트의 80·443 은 공용 edge Caddy 가 소유한다(다른 프로젝트와 함께 쓴다). 워크벤치는 **edge 에
붙지 않는다.** 공개 인터넷 경로가 없어야 하기 때문이다.

- 워크벤치는 루프백에서만 듣고, Tailscale Serve 가 tailnet 안에서 8443 으로 연다. 443 을 쓰지 않아
  edge 와 포트가 겹치지 않는다.
- Funnel 은 쓰지 않는다. 배포 뒤 `tailscale serve status` 가 `(tailnet only)` 로 표시되는지 확인한다.
- 공개 댓글 서버처럼 공개가 필요한 서비스는 edge 의 `sites/<name>.caddy` 로 붙는다(NOR-200).

## 작업 공간 저장소

작업 공간은 전용 private 저장소의 작업 트리다. 기존 개인 노트 vault 와 섞지 않는다.

**신뢰 경계.** 컨테이너는 작업 트리에 쓸 수 있다. 그래서 작업 트리 안에 `.git` 을 두면, 침해된 앱이
`.git/config` 나 hooks 를 심어 호스트에서 git 을 부르는 쪽이 그 명령을 실행하게 만들 수 있다. 이를 막으려고
git 메타데이터와 deploy key 를 작업 트리 밖에 두고, 컨테이너와 다른 계정(`workbench-backup`)이 갖는다.
컨테이너에는 작업 트리만 mount 한다.

- deploy key 는 그 저장소에만 쓸 수 있고 `~workbench-backup/.ssh/workspace_deploy` 에 있다. 이미지·
  `.env`·컨테이너에는 넣지 않는다. git 설정의 `core.sshCommand` 가 이 키와 `StrictHostKeyChecking=yes`
  를 지정하고, `core.hooksPath=/dev/null` 로 hooks 를 끈다.
- `.gitignore` 의 `.workbench/` 가 발행 outbox 를 뺀다. 작업 트리에 `.git` 이 없으므로 앱의 부팅 검사는
  건너뛰고, 커밋하는 백업 스크립트가 `git check-ignore` 로 확인한 뒤에만 커밋한다.
- 커밋 identity 는 GitHub noreply 주소를 쓴다. 발행 커밋 identity(`PUBLISH_GIT_AUTHOR_*`)도 같다.
- 직접 확인할 때는 이력과 원격만 본다. 백업 계정은 작업 트리를 읽을 수 없고(서비스만 읽기 권한을 갖는다),
  작업 트리 상태는 백업 단위를 실행해 확인한다. `safe.directory='*'` 는 설정하지 않는다. 작업 트리 안에
  중첩 저장소가 생기면 그 설정이 실행되기 때문이다.

```sh
sudo -u workbench-backup git --git-dir=/srv/workbench/workspace.git log --oneline -5
sudo -u workbench-backup git --git-dir=/srv/workbench/workspace.git ls-remote origin main
sudo systemctl start workspace-backup.service
```

## 백업

`apps/workbench/deploy/oci/` 의 스크립트와 systemd 단위를 설치한다.

```sh
sudo install -d -m 0755 /usr/local/lib/workbench
sudo install -m 0755 workspace-backup.sh /usr/local/lib/workbench/
sudo install -m 0644 workspace-backup.service workspace-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now workspace-backup.timer
```

매일 한 번(04:30 전후) outbox tar 를 남기고, 바뀐 파일을 커밋하고, `git bundle --all` 을 남긴 뒤
마지막에 private remote 로 push 한다. 백업은 `/srv/workbench/backups` 에 종류별로 14개까지 둔다. 커밋
단계가 실패해도(작업 트리 안의 `.git`, `.gitignore` 에서 빠진 `.workbench/` 등) tar 와 bundle 은 남고 push 만
건너뛴다. 어느 단계든 실패하면 단위가 실패로 끝난다. 서비스는 작업 트리를 `CAP_DAC_READ_SEARCH` 로
읽기만 하고, 쓰는 곳은 git 디렉터리와 백업 디렉터리뿐이다. 상태 확인:

```sh
systemctl list-timers workspace-backup.timer
journalctl -u workspace-backup.service -n 20
systemd-analyze security workspace-backup.service
```

## 발행 릴레이 (NOR-210)

워크벤치가 확정한 발행을 공개 블로그의 `content/*` 브랜치로 보내는 호스트 서비스다. 컨테이너에는 공개
저장소 자격이 없고, 릴레이 계정만 deploy key 를 갖는다. 절차는
[tailnet-workbench.md](./tailnet-workbench.md) "확정한 커밋을 공개 블로그로 보내기".

| 무엇        | 값                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| 실행 계정   | 시스템 계정 `workbench-relay`. outbox 는 `CAP_DAC_READ_SEARCH` 로 읽기만 한다                                  |
| 상태        | `/var/lib/workbench-relay` (clone, `ledger`, `.ssh`)                                                           |
| 진행 사본   | `/var/lib/workbench-relay/public/ledger`(0755/0644). 컨테이너가 `/data/relay` 로 읽기 전용 마운트한다(NOR-228) |
| 자격        | 이 저장소의 write deploy key. main 은 ruleset(필수 체크·강제 push 금지)이 막는다                               |
| 관문        | base 가 main 의 조상, bundle 커밋 일치, 바뀐 경로가 모두 `content-paths.regex` 안·일반 파일만                  |
| 내보내는 것 | 받은 이력이 아니라 최종 트리로 base 위에 새로 만든 커밋 하나(중간 커밋·작성자·메시지는 버린다)                 |

```sh
sudo useradd --system --home-dir /var/lib/workbench-relay --create-home --shell /usr/sbin/nologin workbench-relay
sudo -u workbench-relay install -d -m 0700 /var/lib/workbench-relay/.ssh
sudo -u workbench-relay ssh-keygen -t ed25519 -N '' -C workbench-relay -f /var/lib/workbench-relay/.ssh/blog_deploy
ssh-keyscan -t ed25519,rsa,ecdsa github.com | sudo -u workbench-relay tee /var/lib/workbench-relay/.ssh/known_hosts >/dev/null
# 받은 호스트 키 지문이 GitHub 이 공개한 값(`gh api meta --jq .ssh_key_fingerprints`)과 같은지 대조한다.
sudo -u workbench-relay ssh-keygen -lf /var/lib/workbench-relay/.ssh/known_hosts
# 공개 키를 저장소 deploy key(쓰기 허용)로 등록한 뒤:
sudo install -m 0755 publish-relay.sh /usr/local/lib/workbench/
sudo install -m 0755 relay-helper.py /usr/local/lib/workbench/
sudo install -m 0644 content-paths.regex /usr/local/lib/workbench/
sudo install -m 0644 publish-relay.service publish-relay.timer /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now publish-relay.timer
```

저장소 설정: Allow auto-merge 켬, Actions 의 "Allow GitHub Actions to create and approve pull requests" 켬.
발행 진행 토스트(NOR-228)는 ledger 의 공개 사본과 공개 저장소의 GitHub API(자격 없음)로 단계를 읽는다.
사본에는 매니페스트 이름·브랜치 이름·고정 사유 코드만 있다. 릴레이를 한 번 돌려 `public/` 이 생긴 뒤에
compose 를 올린다(`create_host_path: false` 라 없으면 컨테이너가 뜨지 않는다).
콘텐츠 경로를 넓힐 때는 `content-paths.regex` 를 고치고 호스트에도 다시 설치한다(워크플로는 main 의 것을 읽는다).

## 짧은 주소: Tailscale Services (NOR-232)

노드 주소의 443 에는 Serve 를 붙일 수 없다. Docker 가 `PREROUTING -m addrtype --dst-type LOCAL` 규칙으로
이 호스트에 오는 443 을 모두 edge Caddy 컨테이너로 돌리기 때문이다. Tailscale Services 는 서비스마다 전용
가상 IP(TailVIP)를 주고 tailscaled 가 그 주소를 직접 받으므로 이 규칙과 겹치지 않는다. 결과 주소는
`https://workbench.<tailnet>.ts.net` 이다(포트 없음). 공개 인터넷 경로는 여전히 없다.

**소유자 작업 (관리 콘솔)**

1. Services 페이지에서 서비스를 정의한다. 이름 `workbench`, 엔드포인트 `tcp:443`.
2. 접근 정책에 소유자 계정이 `svc:workbench` 의 443 에 닿는 grant 를 더한다. 호스트는 이미 태그 노드다.
3. 아래 호스트 작업 뒤 같은 페이지의 Service hosts 에서 이 호스트를 승인한다(또는 `autoApprovers.services` 에
   `"svc:workbench": ["<호스트 태그>"]` 를 둔다).

**호스트 작업**

```sh
sudo tailscale serve --service=svc:workbench --https=443 http://127.0.0.1:3000
tailscale serve status            # svc:workbench 와 기존 :8443 이 함께 보여야 한다
```

- 새 주소에서 문서 목록·저장·발행 검토가 되는 것을 확인할 때까지 8443 을 남긴다. 확인한 뒤
  `sudo tailscale serve --https=8443 off` 로 내린다.
- 되돌리기: `sudo tailscale serve --service=svc:workbench --https=443 off` 후 관리 콘솔에서 서비스를 지운다.
- 설치한 앱(PWA)은 주소(origin)에 묶인다. 주소를 옮긴 뒤 새 주소에서 다시 설치한다.

## 앱처럼 쓰기 (NOR-232)

- 맥 Chrome: 주소창의 설치 아이콘 → 설치. Safari: 파일 → Dock 에 추가.
- iPhone·iPad Safari: 공유 → 홈 화면에 추가. Android Chrome: 메뉴 → 앱 설치.
- Tailscale 이 꺼져 있으면 열리지 않는다. 오프라인 캐시(service worker)는 일부러 두지 않았다.

## 이미지 갱신

CI 가 `main` push(워크벤치·계약 패키지 변경 시)나 `workbench-v*` 태그에서 arm64 이미지를 게시하고 실행
요약에 `IMAGE_DIGEST` 를 남긴다. 변경 없이 다시 게시할 때만 태그를 쓴다.

```sh
git tag -a workbench-v<버전> -m "<요약>" origin/main && git push origin workbench-v<버전>
```

호스트에서는 `.env` 의 `IMAGE_DIGEST` 를 바꾸고 다음을 실행한다. 롤백은 이전 digest 로 같은 일을 한다.

```sh
D=/srv/workbench/deploy
sudo -u workbench sed -i 's|^IMAGE_DIGEST=.*|IMAGE_DIGEST=sha256:<new>|' "$D/.env"
sudo docker compose --project-directory "$D" --env-file "$D/.env" pull
sudo docker compose --project-directory "$D" --env-file "$D/.env" up -d
curl --fail --silent http://127.0.0.1:3000/api/health
```

GHCR 패키지가 private 이면 호스트 Docker daemon 에 `read:packages` 자격이 있어야 한다. 소스가 공개
저장소에 있고 이미지에 비밀값이 없으므로, 패키지를 public 으로 두면 호스트에 자격을 두지 않아도 된다.
