# 블로그 인프라용 Proxmox LXC 사양

블로그를 둘러싼 것들 — 워크벤치, 댓글 서버, 터널, Tailscale — 을 한 LXC 컨테이너에 담을 때의
사양이다. 숫자는 대부분 **실측**이고, 재 본 방법과 조건을 함께 적었다.

## 무엇이 도는가

| 프로세스     | 무엇                  | 바깥과의 관계               |
| ------------ | --------------------- | --------------------------- |
| `dockerd`    | 컨테이너 런타임       | —                           |
| `tailscaled` | Tailnet 가입 + Serve  | Tailnet                     |
| workbench    | 개인 작업대 (Node)    | Tailnet 안에서만            |
| waline       | 공개 댓글 서버 (Node) | Cloudflare Tunnel 을 통해서 |
| cloudflared  | 터널                  | Cloudflare 로 outbound      |

워크벤치와 댓글은 **compose 스택이 서로 다르다**. 한 호스트에 있어도 네트워크를 나눈다 —
이유는 [waline-comments.md](./waline-comments.md) 참고.

## 실측

이미지 크기 (압축 해제, `docker image ls`):

| 이미지                               | 크기          |
| ------------------------------------ | ------------- |
| `lizheming/waline`                   | **1.55 GB**   |
| `ghcr.io/gze1206/personal-workbench` | 510 MB        |
| `cloudflare/cloudflared`             | 97 MB         |
| 합계                                 | **약 2.2 GB** |

메모리 (유휴):

| 프로세스    | 실측       | 잡을 예산     | 재 본 방법                                             |
| ----------- | ---------- | ------------- | ------------------------------------------------------ |
| waline      | **350 MB** | 400 MB        | `docker stats`, amd64 이미지를 arm64 맥에서 에뮬레이션 |
| workbench   | **35 MB**  | 150 MB        | `node dist/server/index.js`, 요청 20회 후 RSS          |
| cloudflared | (안 재 봄) | 50 MB         | 토큰이 있어야 떠서 미측정                              |
| dockerd     | (안 재 봄) | 150 MB        | —                                                      |
| tailscaled  | (안 재 봄) | 60 MB         | —                                                      |
| Debian 기본 | (안 재 봄) | 120 MB        | systemd + journald                                     |
| 합계 예산   |            | **약 930 MB** |                                                        |

두 실측 모두 x86-64 리눅스가 아닌 곳에서 잰 값이라 그대로 옮길 수는 없다. 에뮬레이션은
메모리를 부풀리는 쪽이므로 waline 350 MB 는 **위쪽 추정**으로 보면 된다.

## 권장 사양

|        | 권장      | 최소   | 왜                                                                              |
| ------ | --------- | ------ | ------------------------------------------------------------------------------- |
| vCPU   | 2 코어    | 1      | 유휴 CPU 는 1% 미만이다. 두 번째 코어는 이미지 pull 과 git 이 겹칠 때를 위한 것 |
| RAM    | **4 GB**  | 2 GB   | 유휴 1 GB + tmpfs + 페이지 캐시. 아래 함정 참고                                 |
| Swap   | 512 MB    | 512 MB | 순간 peak 를 흡수하는 용도. 상시로 쓰이면 RAM 이 모자란 것                      |
| 디스크 | **16 GB** | 8 GB   | 이미지 2.2 GB + 갱신 중 이전 digest 를 함께 들고 있는 몫 + 개인 콘텐츠          |

디스크 내역: Debian 기본 1.2 GB, 이미지 2.2 GB, digest 교체 중 겹치는 몫 0.6 GB, 로그
상한 0.1 GB(compose 에서 10m × 3 으로 걸어 둠), 개인 콘텐츠 1 GB. 여기까지 5 GB 남짓이라
8 GB 로도 돌지만, Docker 는 여유가 없을 때 정리하기가 성가시다.

## Debian 인가 Alpine 인가

**Debian 을 권한다.** Alpine 이 아껴 주는 것은 디스크 100 MB 와 RAM 80 MB 남짓인데,
waline 하나가 350 MB 를 쓰는 판에서는 결정적이지 않다. 대신 Debian 에서 얻는 것이 크다:

- Docker 와 Tailscale 모두 **공식 apt 저장소**를 제공한다. Alpine 은 community 저장소의
  패키지를 쓰게 되고, 버전이 늦거나 옵션이 다를 때 판단할 거리가 하나 늘어난다.
- 문제가 생겼을 때 찾게 되는 문서와 사례가 systemd + glibc 기준이다.
- 앱은 어차피 컨테이너 안에서 도므로(워크벤치 이미지는 `node:22-bookworm-slim` 기반)
  호스트 배포판이 앱에 미치는 영향이 없다. 즉 Alpine 을 골라도 **앱이 가벼워지지는 않는다**.

Alpine 을 고른다면 OpenRC 로 `docker`·`tailscale` 서비스를 올리고, `cgroup` 마운트가
자동으로 되지 않는 경우가 있으니 부팅 후 `docker info` 로 한 번 확인한다.

## LXC 설정

Proxmox 는 Docker 를 LXC 안에서 돌리는 것을 공식적으로 권하지 않는다(VM 을 권한다).
그래도 LXC 로 가려면 아래가 필요하다.

- **unprivileged 컨테이너**로 만든다. privileged 로 만들면 이 문서의 다른 모든 격리가
  의미를 잃는다.
- **`nesting=1`** — 없으면 컨테이너 안에서 컨테이너가 뜨지 않는다.
- **`keyctl=1`** — unprivileged + Docker 조합에서 필요하다.
- **`/dev/net/tun`** — Tailscale 이 쓴다. unprivileged 컨테이너에는 기본으로 없으므로
  `/etc/pve/lxc/<vmid>.conf` 에 두 줄을 넣는다:

  ```
  lxc.cgroup2.devices.allow: c 10:200 rwm
  lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
  ```

- **저장소가 ZFS 라면** Docker 의 `overlay2` 가 LXC rootfs 위에서 동작하지 않는다.
  `fuse-overlayfs`(`features: fuse=1`)를 쓰거나, `/var/lib/docker` 를 ext4 마운트
  포인트로 따로 붙인다. LVM-thin·dir 저장소면 `overlay2` 가 그대로 된다.
  올린 뒤 `docker info | grep "Storage Driver"` 로 무엇이 잡혔는지 확인한다.

## 마운트와 백업

```
/data/workspace     ← 개인 작업 공간 (워크벤치의 유일한 쓰기 대상)
/data/waline        ← 댓글 SQLite
/var/lib/docker     ← 이미지·컨테이너 (ZFS 라면 별도 볼륨)
```

**백업 대상은 앞의 두 개뿐이다.** 이미지는 digest 로 다시 받을 수 있고, 컨테이너는 상태를
갖지 않는다. 두 디렉터리를 Proxmox 백업이나 별도 스냅숏으로 챙기면 전체를 잃어도
`docker compose up -d` 두 번으로 돌아온다.

## 함정

- **tmpfs 는 컨테이너의 메모리로 잡힌다.** 워크벤치 compose 는 발행용 임시 clone 자리를
  `PUBLISH_TMPFS_SIZE`(기본 **512m**)로 잡는데, 이 값이 통째로 메모리 한도에서 나간다.
  실제로 블로그 저장소의 shallow clone 은 **8 MB** 다. RAM 을 2 GB 로 잡는다면
  `PUBLISH_TMPFS_SIZE=128m` 으로 낮춰 두는 편이 낫다 — 그래도 열여섯 배 여유다.
- **waline 의 SQLite 는 첫 기동 전에 공식 `waline.sqlite` 를 넣어 두어야 한다.** 빈 파일로
  시작하면 스키마가 없고, 뜬 뒤에 파일만 바꿔 넣어도 반영되지 않는다(실측).
- **워크벤치는 `network_mode: host`** 다. LXC 안의 host 네트워크이므로 Tailscale Serve 가
  같은 네트워크 이름공간에서 `127.0.0.1:3000` 을 본다. 컨테이너를 나누면 이 경로가 끊긴다.
- 이미지 갱신은 **digest 교체**다. `latest` 를 따라가게 두면 "지금 무엇이 도는가"를 나중에
  확인할 수 없고 롤백도 결정적이지 않다.

## LXC 대신 VM

Docker 를 LXC 에 넣는 것이 마음에 걸린다면 VM 이 정공법이다. 위 사양에서 RAM 을 512 MB,
디스크를 2 GB 쯤 더 얹으면 된다(게스트 커널 몫). 대신 `nesting`·`keyctl`·`/dev/net/tun`·
저장소 드라이버 이야기가 전부 사라진다. 이 컨테이너가 하는 일의 규모를 생각하면 그 대가는
크지 않다.
