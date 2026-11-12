# OCI arm64 호스트의 워크벤치 (NOR-198)

워크벤치를 OCI arm64 인스턴스 한 대에서 Tailnet 전용으로 운영하는 실제 형상이다. 보안 경계와
일반 절차는 [tailnet-workbench.md](./tailnet-workbench.md) 를 따른다. 이 문서는 그 절차를 이 호스트에
적용한 결과와, 같은 호스트의 다른 서비스와 공존하는 방법을 적는다.

## 형상

| 무엇           | 값                                                                         |
| -------------- | -------------------------------------------------------------------------- |
| 실행 계정      | 시스템 계정 `workbench`(로그인 셸 없음). 컨테이너도 이 UID/GID 로 돈다     |
| 작업 공간(②)   | `/srv/workbench/private-workspace` (0700). private 저장소의 작업 트리      |
| 백업           | `/srv/workbench/backups` (0700)                                            |
| compose·`.env` | `/srv/workbench/deploy` (0700). 원본은 `apps/workbench/docker-compose.yml` |
| 이미지         | `ghcr.io/gze1206/workbench@<digest>` (linux/arm64, CI 가 게시)             |
| 서버 바인딩    | `127.0.0.1:3000` (host network, 공개 포트 없음)                            |
| Tailnet 진입점 | `tailscale serve --bg --https=8443 http://127.0.0.1:3000` (tailnet only)   |

## 다른 서비스와의 공존

이 호스트의 80·443 은 공용 edge Caddy 가 소유한다(다른 프로젝트와 함께 쓴다). 워크벤치는 **edge 에
붙지 않는다.** 공개 인터넷 경로가 없어야 하기 때문이다.

- 워크벤치는 루프백에서만 듣고, Tailscale Serve 가 tailnet 안에서 8443 으로 연다. 443 을 쓰지 않아
  edge 와 포트가 겹치지 않는다.
- Funnel 은 쓰지 않는다. `tailscale funnel status` 가 비어 있어야 한다.
- 공개 댓글 서버처럼 공개가 필요한 서비스는 edge 의 `sites/<name>.caddy` 로 붙는다(NOR-200).

## 작업 공간 저장소

작업 공간은 전용 private 저장소의 작업 트리다. 기존 개인 노트 vault 와 섞지 않는다.

- 호스트의 `workbench` 계정이 그 저장소에만 쓸 수 있는 deploy key(`~workbench/.ssh/workspace_deploy`)를
  쓴다. 키는 이미지·`.env`·컨테이너에 넣지 않는다.
- `.gitignore` 의 `.workbench/` 가 발행 outbox 를 뺀다. 빠져 있지 않으면 워크벤치가 부팅을 거부한다.
- 커밋 identity 는 GitHub noreply 주소를 쓴다. 발행 커밋 identity(`PUBLISH_GIT_AUTHOR_*`)도 같다.

## 백업

`apps/workbench/deploy/oci/` 의 스크립트와 systemd 단위를 설치한다.

```sh
sudo install -d -m 0755 /usr/local/lib/workbench
sudo install -m 0755 workspace-backup.sh /usr/local/lib/workbench/
sudo install -m 0644 workspace-backup.service workspace-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now workspace-backup.timer
```

매일 한 번(04:30 전후) 바뀐 파일을 커밋해 private remote 로 push 하고, `git bundle --all` 과
outbox tar 를 `/srv/workbench/backups` 에 14개까지 남긴다. 상태 확인:

```sh
systemctl list-timers workspace-backup.timer
journalctl -u workspace-backup.service -n 20
```

## 이미지 갱신

CI 가 `main` push 나 `workbench-v*` 태그에서 arm64 이미지를 게시하고 실행 요약에 `IMAGE_DIGEST` 를
남긴다. 기본 브랜치에 워크플로가 생기기 전(런칭 전)에는 태그로 게시한다.

```sh
git tag -a workbench-v<버전> -m "<요약>" v4 && git push origin workbench-v<버전>
```

호스트에서는 `.env` 의 `IMAGE_DIGEST` 를 바꾸고 다음을 실행한다. 롤백은 이전 digest 로 같은 일을 한다.

```sh
cd /srv/workbench/deploy
sudo -u workbench sed -i 's|^IMAGE_DIGEST=.*|IMAGE_DIGEST=sha256:<new>|' .env
sudo docker compose --env-file .env pull
sudo docker compose --env-file .env up -d
curl --fail --silent http://127.0.0.1:3000/api/health
```

GHCR 패키지가 private 이면 호스트 Docker daemon 에 `read:packages` 자격이 있어야 한다. 소스가 공개
저장소에 있고 이미지에 비밀값이 없으므로, 패키지를 public 으로 두면 호스트에 자격을 두지 않아도 된다.
