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
- 작업 트리에서 git 을 직접 쓸 때는 백업 계정으로 git 디렉터리를 지정한다.

```sh
sudo -u workbench-backup git --git-dir=/srv/workbench/workspace.git status
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

매일 한 번(04:30 전후) 바뀐 파일을 커밋하고, 먼저 `git bundle --all` 과 outbox tar 를
`/srv/workbench/backups` 에 14개까지 남긴 뒤 마지막에 private remote 로 push 한다. 네트워크가 끊겨도
로컬 백업은 남고, push 가 실패하면 단위가 실패로 끝난다. 서비스는 작업 트리를 `CAP_DAC_READ_SEARCH` 로
읽기만 하고, 쓰는 곳은 git 디렉터리와 백업 디렉터리뿐이다. 상태 확인:

```sh
systemctl list-timers workspace-backup.timer
journalctl -u workspace-backup.service -n 20
systemd-analyze security workspace-backup.service
```

## 이미지 갱신

CI 가 `main` push 나 `workbench-v*` 태그에서 arm64 이미지를 게시하고 실행 요약에 `IMAGE_DIGEST` 를
남긴다. 기본 브랜치에 워크플로가 생기기 전(런칭 전)에는 태그로 게시한다.

```sh
git tag -a workbench-v<버전> -m "<요약>" v4 && git push origin workbench-v<버전>
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
