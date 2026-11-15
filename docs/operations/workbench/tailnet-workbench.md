# Tailnet 전용 개인 워크벤치 운영

이 문서는 개인 Linux 호스트에서 워크벤치를 **Tailnet 안에서만** 운영하기 위한 절차다.
이미지와 Compose 설정의 로컬 검증 범위까지만 이 저장소가 담당한다. 실제 호스트의 Tailscale
Serve/ACL 변경, DNS 공개, GHCR 패키지 발행은 외부 최종 단계로 남겨 두며 사용자 승인 전에는
실행하지 않는다.

> 지금 운영하는 호스트(OCI arm64)의 실제 형상은 [oci.md](./oci.md) 에 있다. Proxmox LXC 로 새로 만든다면
> [proxmox-lxc.md](./proxmox-lxc.md) 를 본다.
>
> 같은 호스트에서 공개 댓글 서버도 돌린다면 [waline-comments.md](./waline-comments.md) 를
> 함께 본다. 그 서비스는 이 문서의 Tailnet 경계 **밖**이며, 네트워크를 분리해 둔다.

## 저장소 경계

영속 데이터는 **하나**다.

| 무엇          | 어디                          | 성격                               |
| ------------- | ----------------------------- | ---------------------------------- |
| ① 앱 코드     | GHCR 이미지 (digest 고정)     | 불변. 호스트에 소스를 두지 않는다  |
| ② 개인 콘텐츠 | 호스트 bind mount (쓰기 가능) | 유일한 영속 저작 데이터. 백업 대상 |
| ③ 공개 블로그 | 발행 세션마다 임시 clone      | tmpfs. 세션이 끝나면 파기된다      |

③ 의 상시 clone 은 없다(NOR-148). 발행할 때마다 공개 블로그를 tmpfs 위에 얕게 clone 하고,
확정한 커밋을 ② 안의 outbox 로 내보낸 뒤 임시 clone 을 지운다. **앱은 push 하지 않는다.**

## 보안 경계

- Node 서버는 코드에 고정된 `127.0.0.1:3000`에서만 듣는다. Compose는 이 바인딩을 유지하기
  위해 Linux host network를 사용하며 `ports`를 공개하지 않는다.
- 컨테이너는 비루트 UID/GID, 모든 Linux capability 제거, `no-new-privileges`, 읽기 전용 root
  filesystem으로 실행한다. **쓰기 가능한 bind mount는 ② 하나뿐**이고, 그 밖의 쓰기 자리는
  `noexec,nosuid,nodev` tmpfs 두 개(`/run/publish`, `/tmp`)다.
- 컨테이너에는 **remote write 자격 증명이 없다.** clone 은 HTTPS 익명 읽기로만 하고, 상속된
  Git/프록시 환경 변수를 무력화하며 리다이렉트를 차단한다. 허용 호스트와 `/<owner>/<repo>`
  경로가 정확히 일치하지 않으면 부팅에서 거부한다.
- 발행 커밋의 identity 는 `PUBLISH_GIT_AUTHOR_NAME`·`PUBLISH_GIT_AUTHOR_EMAIL` 로 명시한다.
  값이 없으면 부팅하지 않는다 — `사용자@호스트` 를 추론해 남의 이름으로 커밋하지 않는다.
- outbox 는 ② 안에 있고 ② 의 `.gitignore` 로 무시돼 있어야 한다. 무시되지 않으면 부팅을
  거부하되 **앱이 `.gitignore` 를 고치지는 않는다.** 무시 규칙은 사람이 정한다.
- `/api/health`는 `{"status":"ready"}`만 반환한다. 경로, 환경 변수, remote URL, Git 정보, 키
  또는 오류 원문을 응답에 포함하지 않는다.
- Tailscale Funnel은 사용하지 않는다. Funnel은 public internet 노출 기능이므로 이 서비스의
  경계와 맞지 않는다. [Serve 공식 예시](https://tailscale.com/docs/reference/examples/serve)와
  [Funnel 공식 설명](https://tailscale.com/kb/1223/funnel)을 구분해 적용한다.

## 전용 서비스 계정과 디렉터리

아래 명령은 예시다. 실제 경로를 확정한 뒤 호스트 관리자가 실행한다.

```sh
sudo useradd --create-home --shell /usr/sbin/nologin workbench
sudo install -d -o workbench -g workbench -m 0700 /srv/workbench/private-workspace
sudo install -d -o workbench -g workbench -m 0700 /srv/workbench/backups
```

개인 콘텐츠 저장소는 서비스 계정만 읽고 쓰도록 디렉터리 `0700`, 파일 `0600`을 기본값으로
둔다. 부모 경로에 다른 사용자·그룹의 불필요한 쓰기 권한을 주지 않는다.

outbox 는 기본값이 `<WORKSPACE_ROOT>/.workbench/publish-outbox` 다. 부팅 전에 ② 의
`.gitignore` 에 그 경로를 넣어 둔다.

```sh
sudo -u workbench sh -c 'printf ".workbench/\n" >> /srv/workbench/private-workspace/.gitignore'
sudo -u workbench git -C /srv/workbench/private-workspace check-ignore --quiet .workbench/publish-outbox
```

SSH 키가 필요한 호스트 측 수동 Git 작업은 별도 deploy key를 사용한다.

- private workspace: 해당 private remote에만 read/write 가능한 전용 키
- 공개 블로그 push: 사람이 앱 밖에서 쓰는 자기 자격 증명. 컨테이너에는 넣지 않는다
- 키 파일: `workbench:workbench`, mode `0600`; `.ssh`는 `0700`
- 키는 이미지, `.env`, Compose secret, bind mount에 넣지 않는다

## 이미지는 CI 가 만든다

`.github/workflows/workbench-image.yml` 가 GHCR 에 linux/arm64 이미지를 올린다. 호스트에서 빌드하지 않는다.

- **언제**: `workbench-v*` 태그, 그리고 워크벤치·계약·설정·lockfile 이 바뀐 `main` 푸시. 문서만 고친 커밋으로는
  새 digest 를 만들지 않는다 — 그러면 digest 로 "무엇이 바뀌었나"를 알 수 없다. 수동 실행도 된다
- **무엇을 먼저**: lint · format · typecheck · test · build · e2e 를 통과해야 게시한다.
  검증하지 않은 이미지는 digest 로 고정해도 안전하지 않다
- **무엇이 나오나**: 사람이 읽는 보조 태그(`v<version>`, `sha-<git-sha>`, `edge`)와 **digest**.
  배포에 쓰는 것은 digest 하나이며, 워크플로 요약에 `IMAGE_DIGEST=sha256:...` 형태로 찍힌다
- **provenance**: buildx 가 이미지에 provenance·SBOM 을 붙인다.
  `docker buildx imagetools inspect <image>@<digest>` 로 확인한다.
  GitHub build attestation 은 쓰지 않는다(provenance·SBOM 으로 갈음한다)

한 번만 해 둘 것:

1. 저장소 Actions 설정에서 워크플로가 패키지에 쓸 수 있게 한다(워크플로가 `packages: write` 를 요청한다).
2. 첫 게시 후 GHCR 패키지 페이지에서 이 저장소를 연결하고 공개 범위를 정한다.
3. 패키지를 private 으로 둘 경우, 호스트에서 한 번 `docker login ghcr.io`(`read:packages` PAT).
   이 자격은 컨테이너 안이 아니라 **호스트 daemon** 에 둔다.

## GHCR digest 배포와 롤백

이미지는 태그가 아니라 **digest** 로 고정한다. 태그는 같은 이름이 다른 내용을 가리킬 수 있어
"지금 무엇이 돌고 있는가"를 나중에 확인할 수 없고, 롤백도 결정적이지 않다.

```sh
# 1. 올릴 digest 를 확인한다(CI 가 발행한 값). 태그로 pull 하지 않는다.
docker manifest inspect ghcr.io/gze1206/workbench:<tag> | sed -n 's/.*"digest": "\(sha256:[a-f0-9]*\)".*/\1/p'

# 2. .env 의 IMAGE_DIGEST 를 그 값으로 바꾼다. 이전 값은 롤백용으로 주석에 남긴다.
sudo -u workbench sed -i 's|^IMAGE_DIGEST=.*|IMAGE_DIGEST=sha256:<new>|' .env

# 3. 교체한다.
docker compose pull
docker compose up -d
curl --fail --silent http://127.0.0.1:3000/api/health
docker compose ps
```

롤백은 `IMAGE_DIGEST` 를 이전 값으로 되돌리고 같은 세 명령을 다시 실행하는 것이다. ② 의
데이터 형식이 바뀌지 않았다면 롤백에 추가 절차가 없다.

## 로컬 구성과 검증

`.env.example`을 `.env`로 복사하고 실제 절대 경로·전용 계정 UID/GID·digest 를 입력한다.

```sh
cp .env.example .env
id workbench
docker compose config --quiet
docker compose up -d
curl --fail --silent http://127.0.0.1:3000/api/health
docker compose ps
```

정상 health 응답은 다음 하나뿐이다.

```json
{ "status": "ready" }
```

빈 테스트 디렉터리만 ② 로 마운트해도 컨테이너와 health를 확인할 수 있다. 템플릿·Git 저장소가
필요한 기능은 해당 파일을 준비한 뒤 별도로 검증한다. Linux host network가 전제이므로 Docker
Desktop 환경에서는 host networking 지원 설정이 다를 수 있다. 실제 운영 검증은 Linux
호스트에서 한다.

발행 기능을 확인하려면 아웃바운드 443 이 열려 있어야 한다(공개 블로그 clone). 그 외의
아웃바운드는 필요하지 않다.

중지와 로그 확인:

```sh
docker compose logs --tail=100 workbench
docker compose down
```

## 확정한 커밋을 공개 블로그로 보내기

앱은 push 하지 않는다. 확정(confirm) 은 outbox 에 산출물 하나를 남기는 것으로 끝나고, 그것을
공개 블로그로 보내는 일은 사람이 앱 밖에서 한다. 화면이 보여 주는 절차와 아래가 같다.

먼저 **base 정합성**을 확인한다. 발행을 준비한 뒤 공개 블로그가 앞서 나갔다면 그 산출물은
그대로 얹을 수 없다.

```sh
cd /path/to/blog.gze1206.net        # 앱 밖의 사람 clone
git fetch origin
git merge-base --is-ancestor <baseSha> origin/main   # 실패하면 재검토·재발행
```

그다음 산출물 형식에 따라 갈린다. 형식은 confirm 응답의 `exportFormat` 에 있다.

```sh
# bundle — 커밋 객체가 그대로 들어 있다
git bundle verify <exportRef>
git fetch <exportRef> content/<slug>:content/<slug>

# format-patch — base 에서 새 브랜치를 만들고 패치를 얹는다
git switch -c content/<slug> <baseSha>
git am <exportRef>
```

내용을 다시 확인한 뒤에만 push 한다.

```sh
git switch content/<slug>
git log --stat origin/main..HEAD
git push origin content/<slug>
```

보낸 산출물은 outbox 에서 지운다. 남겨 두면 다음 백업이 이미 보낸 커밋을 미push 산출물로
오해하게 된다.

## 상시 clone 은퇴 (마이그레이션)

기존 형상에서 넘어올 때, 상시 clone 안에만 있던 것을 먼저 배수(drain)한다. mount 를 떼는
순간 그 안의 로컬 브랜치와 미커밋 파일은 되찾을 수 없다.

```sh
docker compose stop workbench

# 1. 아직 보내지 않은 발행 브랜치와 미커밋 파일을 열거한다.
sudo -u workbench git -C /srv/workbench/public-blog status --short
sudo -u workbench git -C /srv/workbench/public-blog branch --list 'content/*'
sudo -u workbench git -C /srv/workbench/public-blog log --oneline --branches='content/*' --not --remotes

# 2. 남아 있으면 push 하거나 bundle 로 빼 둔다.
sudo -u workbench git -C /srv/workbench/public-blog bundle create \
  /srv/workbench/backups/drain-content.bundle --branches='content/*'
sudo -u workbench git bundle verify /srv/workbench/backups/drain-content.bundle

# 3. 비어 있음을 확인한 뒤에만 다음으로 간다.
```

배수를 확인한 다음 전환한다.

1. `.env` 를 새 키로 바꾼다: `PUBLIC_BLOG_ROOT` 제거, `PUBLIC_BLOG_REMOTE`·`PUBLIC_BLOG_BRANCH`·
   `PUBLISH_GIT_AUTHOR_NAME`·`PUBLISH_GIT_AUTHOR_EMAIL`·`IMAGE_DIGEST` 추가.
2. ② 의 `.gitignore` 에 outbox 경로를 넣고 `git check-ignore` 로 확인한다(앱은 고치지 않는다).
3. `docker compose up -d` 후 health 와 발행 드라이런을 확인한다.
4. 그 확인이 끝난 뒤에만 호스트의 상시 clone 디렉터리를 제거한다.

롤백은 이전 `IMAGE_DIGEST` 와 이전 `.env` 로 되돌리는 것이다. 상시 clone 디렉터리를 4단계
전에 지우지 않았다면 되돌릴 것이 남아 있다 — 그래서 제거를 마지막에 둔다.

## 백업

컨테이너는 상태를 갖지 않는다. 인메모리 인덱스는 Markdown에서 재생성된다. 백업 대상은 ②
하나이며, 그 안에서 특히 다음을 놓치지 않는다.

- 미커밋·untracked 저작 파일
- **outbox 의 미push 산출물** — 확정했지만 아직 공개 블로그로 보내지 않은 커밋이 여기 있다.
  임시 clone 은 이미 파기됐으므로 그 커밋은 outbox 파일에만 남아 있다

```sh
docker compose stop workbench
sudo -u workbench git -C /srv/workbench/private-workspace status --short
sudo -u workbench ls -la /srv/workbench/private-workspace/.workbench/publish-outbox
sudo -u workbench git -C /srv/workbench/private-workspace bundle create /srv/workbench/backups/private-workspace.bundle --all
sudo -u workbench tar --acls --xattrs -C /srv/workbench/private-workspace -cpf /srv/workbench/backups/private-workspace-repository.tar .
docker compose start workbench
```

bundle은 커밋된 ref만 포함하는 이식 가능한 보조본이다. 전체 저장소 snapshot 이 미커밋 원본과
outbox 산출물을 함께 보존한다. snapshot은 `.git`까지 포함하므로 백업 파일을 private 원본과
같은 민감도로 암호화·보관하고 복구 테스트를 주기적으로 수행한다.

## 복구

원본 경로를 덮어쓰지 말고 새 경로에서 먼저 검증한다.

```sh
test ! -e /srv/workbench/restore-private-workspace
sudo install -d -o workbench -g workbench -m 0700 /srv/workbench/restore-private-workspace
sudo -u workbench tar --acls --xattrs -C /srv/workbench/restore-private-workspace -xpf /srv/workbench/backups/private-workspace-repository.tar
sudo -u workbench git bundle verify /srv/workbench/backups/private-workspace.bundle
sudo -u workbench git -C /srv/workbench/restore-private-workspace fsck --full
sudo -u workbench git -C /srv/workbench/restore-private-workspace status --short
sudo -u workbench ls -la /srv/workbench/restore-private-workspace/.workbench/publish-outbox
```

복구 대상 경로가 없음을 `test ! -e`로 먼저 확인하므로 기존 데이터에 덮어쓰지 않는다. 백업
직전 기록한 `git status --short` 결과와 복구 경로의 결과를 대조하고, outbox 산출물이 그대로
있는지 확인한다. 임시 `.env`가 복구 경로를 가리키게 한 뒤 health와 읽기·발행 드라이런을
확인한다. 검증이 끝난 뒤에만 운영 경로 전환을 별도로 승인한다.

## 외부 최종 단계: 현재 보류

다음은 로컬 구현 완료 조건이 아니며 **사용자의 명시적 최종 승인 후에만** 호스트에서 수행할
변경이다.

1. Tailnet 정책에서 이 장치와 사용자 한 명만 서비스에 접근하도록 ACL/grant를 검토한다.
2. 현재 설정을 `tailscale serve status`로 기록한다.
3. CI 에서 GHCR 패키지를 발행하고 그 digest 를 `.env` 에 넣는다.
4. 공개 블로그 remote 주소와 발행 identity 값을 확정한다.
