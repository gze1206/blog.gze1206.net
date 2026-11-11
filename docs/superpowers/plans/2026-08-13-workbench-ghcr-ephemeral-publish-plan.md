# GHCR 이미지 배포·임시 발행 워크스페이스 실행 계획 (NOR-148)

> **에이전트 워커용:** 태스크 단위 TDD로 실행한다. 각 스텝은 실패 테스트 → 구현 → 통과 → 커밋 순서다. 체크박스(`- [ ]`)로 진행을 추적한다.
> 근거 스펙: [`docs/specs/2026-08-13-workbench-ghcr-ephemeral-publish.md`](../../spec/workbench/2026-08-13-workbench-ghcr-ephemeral-publish.md)

**목표:** miniPC 영속 프로젝트 clone을 ②(개인 콘텐츠) 하나로 줄인다. 앱은 GHCR digest 고정 불변 이미지로 실행하고, 공개 블로그는 발행 세션마다 임시 shallow clone 후 파기하며, 확정 커밋은 ②의 비추적 outbox에 이식 가능한 Git export(bundle 우선, format-patch 폴백)로 남기고, 사람이 앱 밖 전체 clone에서 push 한다. 명시적 검토·diff·확정과 no-auto-push를 보존한다.

**주의(불변):** 이 계획을 실제 수행할 때도 공개 블로그 저장소·GHCR 패키지·인증키·Tailnet·Cloudflare·miniPC 호스트를 자동 변경하지 않는다. CI 워크플로 추가와 실제 배포는 사용자 승인 후 외부 단계다.

## 전역 제약(승계+신규)

- 발행은 사람이 diff를 확정한 뒤에만 산출물을 만든다. 앱은 어떤 remote에도 push 하지 않는다.
- ③은 상시 clone을 두지 않는다. 세션마다 tmpfs에 임시 clone → 세션 종료 시 파기.
- 컨테이너에 remote write 자격 증명을 넣지 않는다. clone은 **HTTPS 전용** 익명 read이며, 상속 Git 환경(GIT_CONFIG·askpass·credential·proxy)을 무력화한다.
- 발행 커밋은 **명시 identity**(`PUBLISH_GIT_AUTHOR_NAME/EMAIL` + `user.useConfigOnly=true`)로만 만든다. 미설정이면 커밋·export 없이 실패한다.
- 배포 이미지는 digest 고정(부동 태그 금지). 호스트는 앱 소스·빌드가 없다.
- 어댑터 메서드 시그니처(`listAssets`/`review`/`publish`)·라우트 엔드포인트·leak 검사는 유지한다. 단 `publish` 확정 **응답 형태**는 **형식 중립 outbox 산출물 참조 `{ outboxRef, exportRef, exportFormat, ... }`**(영속 로컬 브랜치 아님, 파일명만·서버 경로/비밀 미노출)로 바뀌고, 이를 소비하는 웹(`src/web/api.ts`·`src/web/PublishReview.tsx`)도 함께 조정한다. UI·runbook은 `exportFormat`별로 분기(bundle verify/fetch vs `git am`).
- reviewId는 **CSPRNG `randomBytes(32)` 불투명 토큰**이며 결정적 SHA를 키로 쓰지 않는다. baseSha·fingerprint는 세션 레지스트리에 분리 저장한다.
- remote URL allowlist/전송 구성은 **주입된 `RemotePolicy`** 다. **프로덕션 진입점 `src/server/index.ts`가 `ProductionRemotePolicy`(github.com·443·https)를 구성·주입하는 유일한 생산자**이고 `src/server/app.ts`는 이미 만들어진 publisher를 받는 주입 경계(합성 루트 아님)다. loopback 허용 정책은 테스트 코드만 소유한다(런타임 플래그로 프로덕션 검증을 약화할 수 없음).
- 모든 파일 write는 설정 루트 안으로 realpath 검증하고 밖이면 거부한다. outbox 쓰기는 원자적 rename(디렉터리 `0700`·파일 `0600`).
- **앱은 ②의 `.gitignore`를 수정하지 않는다.** outbox가 ② 안이면 시작 시 `git check-ignore`로 무시 확인, 미무시면 부팅 거부.

## 의존 순서

```
T1 (발행 어댑터: 임시 clone + outbox export)  ── 핵심. 인터페이스 불변.
   └──▶ T2 (설정·config 검증 전환: REMOTE/BRANCH/tmpfs/outbox)
            └──▶ T3 (컨테이너·Compose·배포 문서: GHCR digest, ③ mount 제거, tmpfs)
                     └──▶ T4 (마이그레이션 runbook·drain·최종 검증)
```

- **T1이 선행.** 발행 산출 방식 전환이 다른 모든 변경의 근거다.
- T2는 T1이 요구하는 설정 표면을 확정한다.
- T3은 런타임 형상(이미지 출처·mount·tmpfs)을 T1/T2에 맞춘다. **실제 CI/GHCR·호스트 적용은 외부 단계.**
- T4는 은퇴 절차와 전체 회귀를 마무리한다.

---

### Task 1 — 임시 clone 발행 어댑터와 outbox export (NOR-148 / 핵심)

선행: 없음(기존 `PublicBlogAdapter` 위에서 내부 재구성).

**Files:** `src/server/adapters/publicBlog.ts`(프로비저닝·export 내부 교체, `RemotePolicy` 주입), `src/server/adapters/remotePolicy.ts`(신규 포트 + `ProductionRemotePolicy`), `src/server/adapters/ephemeralClone.ts`(신규), `src/server/adapters/publishOutbox.ts`(신규), `src/server/adapters/sessionRegistry.ts`(신규, reviewId·레지스트리), `src/server/index.ts`(진입점=합성 루트: `ProductionRemotePolicy` 구성·어댑터 주입), `src/server/app.ts`(publisher 주입 경계, 어댑터·정책 생성 안 함), `src/server/routes/publish.ts`(응답 형태만), **`src/web/api.ts`(confirm 응답 타입)**, **`src/web/PublishReview.tsx`(exportFormat별 확정 결과·사람 push 안내 렌더)**. 테스트 전용(프로덕션이 import 금지): `test/fixtures/httpsGitServer.ts`, `test/fixtures/loopbackRemotePolicy.ts`, 대응 `*.test.ts`. core는 불변. 라우트 엔드포인트·어댑터 메서드 시그니처는 유지하되 **confirm 응답 형태**만 바뀐다(§4.1).

- [x] **Step 1: 임시 clone + export 왕복을 실패 테스트로 고정 — HTTPS fixture + 주입 정책(§14.1-B)**
  - **`file://` bare repo를 remote로 쓰지 않는다**(프로덕션 deny 구성에서 `file`은 거부됨). 대신 **격리된 로컬 HTTPS Git fixture**(`git http-backend`를 감싼 Node `https` 서버 + 테스트 생성 자체서명 CA, `127.0.0.1:<임의포트>`)를 remote로 삼는다.
  - **allowlist 문제 해결(주입 정책):** `https://127.0.0.1:<port>`는 프로덕션 allowlist를 통과 못 하므로, 테스트는 어댑터에 **테스트 소유 `LoopbackTestRemotePolicy`**(loopback·임의 포트·test CA 허용, `-c http.sslCAInfo=<testCA>`)를 주입한다. 프로토콜 게이트·리다이렉트·깨끗한 env·identity는 프로덕션과 동일. allowlist만 교체.
  - `--depth=1 --single-branch --branch main` 임시 clone → `content/<slug>` 커밋 → **두 형식 왕복 단언:** (a) bundle → 별도 전체 clone에서 `git bundle verify` 후 `git fetch <exportRef> content/<slug>` 성공, (b) format-patch(폴백 강제) → 별도 전체 clone에서 `git switch -c content/<slug> <baseSha>` 후 `git am <exportRef>` 성공. 두 경우 `.mdoc`·자산 내용 일치.
  - 세션 예외·타임아웃에서 임시 디렉터리가 파기됨을 단언.

- [x] **Step 2: 세션 생명주기·프로비저닝·하드닝 구현(§9.1)**
  - `ephemeralClone`: 유일 이름 작업 디렉터리(tmpfs 베이스) 생성 → **HTTPS 전용 + 깨끗한 자식 환경**으로 clone:
    - 프로토콜: `-c protocol.allow=never -c protocol.https.allow=always`(HTTPS만 허용, file/ssh/git 거부. `protocol.allow=never` 단독은 HTTPS까지 막으므로 금지).
    - 리다이렉트: `-c http.followRedirects=false`. clone 후 `remote.origin.url`이 설정 remote와 **정확 일치**하는지 재검증.
    - 상속 환경 무력화: 화이트리스트 env로만 실행. `GIT_CONFIG*` 제거, `GIT_CONFIG_NOSYSTEM=1`, `HOME`을 빈 위치로, `GIT_ASKPASS`/`SSH_ASKPASS`/`GIT_PROXY_COMMAND`/`GIT_SSH*`/프록시 env 제거, `GIT_TERMINAL_PROMPT=0`, `-c credential.helper=`.
    - 적대 저장소: `--no-tags --single-branch --depth=1 --no-recurse-submodules`, `-c core.hooksPath=<빈 디렉터리>`.
  - **`RemotePolicy` 주입 시임(§9.1, D10):** `remotePolicy.ts`에 포트 + `ProductionRemotePolicy`(host allowlist=설정값, https, 443, 정확 검증) 구현. 어댑터는 생성자로 정책을 받고, **진입점 `src/server/index.ts`(합성 루트)가 `ProductionRemotePolicy`만** 구성·주입한다. `src/server/app.ts`는 이미 만들어진 publisher를 받는 주입 경계라 어댑터·정책을 만들지 않는다. 런타임 플래그로 느슨한 정책 교체 불가(느슨한 정책은 테스트 코드만 소유). 정책이 `assertAllowed(url)` + `cloneConfig(url)`(프로토콜 allow·CA)를 제공.
  - `try/finally` 파기 → 시작·세션 전 고아 정리.
  - `PublicBlogAdapter.review`/`publish`가 세션 clone 위에서 동작. review→confirm은 같은 세션·같은 fetched base tip 재사용.
  - **reviewId = CSPRNG(§7.1, D4a):** `crypto.randomBytes(32)` 불투명 토큰(hex/base64url). **결정적 SHA 금지.** 현행 `reviewId()`의 결정적 다이제스트는 레지스트리 엔트리의 **`fingerprint` 필드로 이동**(키가 아니라 무결성 값). CSPRNG 부재 시 발행 비활성(역량 게이트).
  - **세션 레지스트리(§7.1)** `src/server/adapters/sessionRegistry.ts`: `reviewId(무작위) → {cloneDir, baseSha, fingerprint, createdAt, leaseExpiry, consumed}` 인메모리 맵. confirm은 무작위 reviewId 조회 후 **재계산 fingerprint 일치·base 일치**를 확인. one-time(confirm 성공 시 소비·제거), lease 만료·재시작 스윕이 매핑과 clone을 함께 회수.

- [x] **Step 3: 커밋 identity·outbox export·결과 계약 구현(§9.2, §6, §4.1)**
  - 커밋은 명시 identity로만: `git -c user.useConfigOnly=true -c user.name="$PUBLISH_GIT_AUTHOR_NAME" -c user.email="$PUBLISH_GIT_AUTHOR_EMAIL" commit`. identity 미설정이면 커밋 이전에 실패하고 outbox 산출물·매니페스트를 만들지 않음(자동 `사용자@호스트` 추론 금지).
  - `publishOutbox`: export 형식별 파일(`<slug>-<utc>.bundle` 또는 `<slug>-<utc>.patch`) + `.diff`/`.mdoc`/`.json` 을 예약 outbox에 **임시 파일→fsync→원자적 rename**. 디렉터리 `0700`·파일 `0600`. format-patch는 `git format-patch --binary --stdout <base>..content/<slug>` 단일 파일. 매니페스트에 `baseSha/branch/commit/targetPath/commitMessage/exportFormat/exportRef/author/assets[].sha256`. 경로는 outbox 루트 안으로 symlink/`..`/절대경로 가드.
  - **confirm 결과 계약(§4.1, D11)**: `{ outboxRef, exportRef, exportFormat, baseSha, branch, commit, targetPath }` — 영속 로컬 브랜치 아님. `outboxRef`/`exportRef`는 **outbox 루트 기준 파일명만**(절대 경로·remote URL·tmpfs/clone 경로·비밀 미노출). `src/web/api.ts` 응답 타입과 `src/web/PublishReview.tsx`가 이 참조와 **`exportFormat`별 사람 outbox push 절차(§6.4)**(bundle verify/fetch vs `git am`)를 렌더하되 서버 절대 경로·remote URL은 렌더하지 않는다.
  - 성공·실패 무관 임시 clone 파기. 실패 시 outbox·②·원본 무변경.

- [x] **Step 4: 보안·identity·정리 회귀 테스트(§14)**
  - **프로토콜 게이트(§14.1):** (A) 깨끗한 seam — deny 구성에서 `file://`·`ssh://`·`git://`가 `transport '<x>' not allowed`로 거부되고, 죽은 로컬 포트 `https://127.0.0.1:<closed>`가 `not allowed`를 **포함하지 않는** 연결/TLS 오류로 실패(=게이트 통과). (B) HTTPS fixture + 주입 정책으로 종단 clone 성공.
  - **remote 정책(§9.1, D10):** `ProductionRemotePolicy`가 loopback·비443·비allowlist·userinfo/query/fragment를 **거부**. 리다이렉트·상속 env 무력화·훅/submodule 비활성.
  - **경계 회귀:** `src/**` 프로덕션 코드가 `test/fixtures/*`(HTTPS fixture·`LoopbackTestRemotePolicy`)를 import 하지 않음을 정적으로 단언.
  - identity 있으면 author·committer 정확, 없으면 커밋·export 실패(부분 산출 없음).
  - **export 형식별(§6.3, D11):** bundle·format-patch 두 형식 모두 왕복 성공, `exportFormat`/`exportRef`가 형식·파일명 정확 반영, UI가 형식별 절차 렌더.
  - **reviewId(§14.2):** 동일 초안 2회 review → **서로 다른 reviewId**(비결정성), baseSha/fingerprint 분리 저장·역산 불가, one-time 재사용 거부, 만료 거부+clone 파기, 재시작 후 전부 재검토 요구+시작 스윕, CSPRNG 부재 시 발행 비활성.
  - 예외·재시작에서 clone·레지스트리 함께 회수, outbox 권한 `0700/0600`.
  - **base 검사**: `merge-base --is-ancestor`가 전진 remote는 조상, force-push는 비조상 판정.
  - **웹 응답:** confirm 응답에 remote URL·절대 경로·tmpfs/clone 경로·비밀이 없음(두 형식 모두), `PublishReview.tsx`가 파일명·`exportFormat`별 사람 push 절차만 렌더.

- [x] **Step 5: 검증 후 커밋**
  - `pnpm test src/server && pnpm lint && pnpm build`.
  - 커밋: `♻️ refactor(workbench): 임시 clone 발행과 outbox export로 전환 (NOR-148)`

---

### Task 2 — 설정·config 검증 전환 (NOR-148)

선행: T1.

**Files:** `src/server/config.ts` + `config.test.ts`, `.env.example`.

- [x] **Step 1: 새 설정 검증 실패 테스트**
  - `PUBLIC_BLOG_ROOT` 미요구, `PUBLIC_BLOG_REMOTE` **HTTPS 전용 정확 검증**(스킴 https만, userinfo/query/fragment/비443 포트 거부, host allowlist·`<owner>/<repo>` 경로 완전 일치, ssh/git/file 거부), `PUBLIC_BLOG_BRANCH`(기본 `main`), 발행 작업 tmpfs 경로·outbox 경로 존재/쓰기가능/② 안(outbox)·상호 비겹침. 오프라인에서도 부팅 성공(네트워크 강제 안 함).
  - **identity 필수:** `PUBLISH_GIT_AUTHOR_NAME`·`PUBLISH_GIT_AUTHOR_EMAIL` 미설정/빈 값·이메일 형식 오류 시 거부.
  - **outbox check-ignore:** outbox가 ② 안이면 `git check-ignore`로 무시 확인, 미무시면 부팅 거부. **앱은 `.gitignore`를 수정하지 않음**(테스트가 `.gitignore` 불변 단언). outbox 권한이 `0700`보다 느슨하면 거부/조임.
  - `WORKSPACE_ROOT`·`APP_TIME_ZONE`·루트 겹침 금지 회귀 유지. health가 remote URL·경로·비밀 미노출 유지.

- [x] **Step 2: config 로더 구현**
  - `ServerConfig`에 `publicBlogRemote/publicBlogBranch/publishWorkBase/publishOutboxRoot/publishAuthorName/publishAuthorEmail` 추가, `publicBlogRoot` 제거. `.env.example`에서 `PUBLIC_BLOG_ROOT` 제거하고 신규 키(`PUBLIC_BLOG_REMOTE`·`PUBLIC_BLOG_BRANCH`·`PUBLISH_GIT_AUTHOR_NAME`·`PUBLISH_GIT_AUTHOR_EMAIL`·`IMAGE_DIGEST`) 예시 추가.

- [x] **Step 3: 검증 후 커밋**
  - `pnpm test src/server/config.test.ts && pnpm build`.
  - 커밋: `✨ feat(workbench): 임시 발행용 remote·tmpfs·outbox 설정 검증 (NOR-148)`

---

### Task 3 — 컨테이너·Compose·배포 문서 (NOR-148)

선행: T1, T2. **실제 CI/GHCR·호스트 적용은 외부 단계(사용자 승인).**

**Files:** `docker-compose.yml`, `.env.example`, `docs/operations/tailnet-workbench.md`, (선택) `docs/operations/deploy-ghcr.md` 신규. `Dockerfile`은 CI 빌드용으로 유지.

- [x] **Step 1: Compose 형상 전환**
  - `build:` 제거, `image: ghcr.io/gze1206/personal-workbench@sha256:<digest>`(또는 `${IMAGE_DIGEST}`) digest 고정. `PUBLIC_BLOG_ROOT` mount·env 제거. 쓰기 가능 `tmpfs`(noexec,nosuid,nodev,크기 상한) 추가. read-only root·cap_drop·no-new-privileges·host network·health 유지. `docker compose config --quiet` 통과.

- [x] **Step 2: 운영 문서 갱신**
  - `tailnet-workbench.md`: 상시 public clone 전제 제거, 임시 clone·outbox·아웃바운드 443·remote write 자격 없음 반영. 백업 대상에서 ③ 상시 clone 제외(대신 outbox 미push 산출물 언급). GHCR digest 갱신·롤백 절차(`docs/operations/deploy-ghcr.md` 또는 동일 문서 절)로 추가.

- [x] **Step 3: 검증 후 커밋**
  - `docker compose config --quiet`, 문서 링크·frontmatter 정합.
  - 커밋: `🔒 docs(workbench): GHCR digest 배포와 임시 발행 런타임 형상 (NOR-148)`

---

### Task 4 — 마이그레이션 runbook·drain·최종 검증 (NOR-148)

선행: T1~T3.

**Files:** `docs/operations/tailnet-workbench.md`(마이그레이션 절), 최종 회귀.

- [x] **Step 1: drain·전환·사람 push runbook 문서화**
  - 은퇴 전 기존 상시 clone의 `content/*` 로컬 브랜치·미커밋 발행 파일 열거·배수(push 또는 bundle) 절차. 확인 후에만 ③ mount·host clone 제거. 롤백 경로.
  - **사람 push 절차(§6.4, exportFormat별 분기, 스펙과 동일):** `git fetch origin` → **base 정합성 검사** `git merge-base --is-ancestor <baseSha> origin/<branch>`(비조상이면 재검토/재발행) → 형식별 적용: `bundle`이면 `git bundle verify <exportRef>`+`git fetch <exportRef> content/<slug>:content/<slug>`, `format-patch`이면 `git switch -c content/<slug> <baseSha>`+`git am <exportRef>` → 내용 재확인 후 push. base 검사 뒤에 형식 분기가 온다.
  - 신규 필수 env(`PUBLISH_GIT_AUTHOR_NAME/EMAIL`)와 ② `.gitignore`에 outbox 경로 선반영(앱은 수정 안 함) 안내.

- [x] **Step 2: 전체 회귀·경계 확인**
  - `pnpm test && pnpm lint && pnpm format:check && pnpm build && pnpm e2e`.
  - review가 실제 main tip 대비 diff, confirm이 outbox 산출물 생성, remote 무변경(push 없음), 실패 시 ② 원본 무영향, 컨테이너가 ② mount+tmpfs만으로 health ready.

- [x] **Step 3: 검증 후 커밋**
  - 커밋: `📝 docs(workbench): 임시 발행 전환 마이그레이션 runbook (NOR-148)`

---

## 최종 검증

- [x] miniPC 영속 프로젝트 트리가 ②(개인 콘텐츠) 하나로 줄었다(③ 상시 clone·앱 소스 없음).
- [ ] 앱이 GHCR digest 고정 이미지로 실행되고, 갱신은 digest 교체·롤백으로 결정적이다. _(외부 단계 — 호스트/CI 적용 전)_
- [x] 발행 review가 실제 공개 블로그 main tip 대비 정확한 diff를 보이고, confirm이 outbox export(bundle 우선/patch 폴백)를 만들며, 앱은 push 하지 않는다.
- [x] 컨테이너에 remote write 자격 증명이 없고, clone은 HTTPS 전용·상속 env 무력화·리다이렉트 차단으로 수행되며, 임시 clone은 세션 종료·크래시 후에도 파기·회수된다.
- [x] 발행 커밋은 명시 identity로만 만들어지고, identity 미설정 시 커밋·export가 실패한다(자동 `사용자@호스트` 추론 없음).
- [x] confirm 응답이 형식 중립 산출물 참조(`outboxRef`/`exportRef`/`exportFormat`, 파일명만, 서버 경로·remote URL·비밀 없음)를 반환하고, `src/web/PublishReview.tsx`가 `exportFormat`별 사람 push 절차(bundle verify/fetch vs `git am`)를 안내하며, 앱이 ②의 `.gitignore`를 수정하지 않고 outbox가 `git check-ignore`로 무시됨이 확인된다.
- [x] bundle·format-patch 두 export 형식이 모두 왕복 테스트로 커버되고 경로/remote 누출이 없다.
- [x] reviewId가 CSPRNG `randomBytes(32)`로 매번 다르게 발급되고(결정적 SHA 아님), baseSha·fingerprint는 레지스트리에 분리 저장되며, one-time·만료·재시작 테스트가 통과한다.
- [x] 프로토콜 게이트가 격리된 로컬 HTTPS fixture + 주입 `LoopbackTestRemotePolicy`로 종단 검증되고(외부 GitHub 불필요, 프로덕션 URL 검증 미약화), `file`/`ssh`/`git`은 `transport not allowed`로 거부됨이 seam으로 확인되며, `ProductionRemotePolicy`가 loopback·비443·비allowlist를 거부하고 `src/**`가 테스트 픽스처를 import 하지 않음이 확인된다.
- [x] `pnpm test && pnpm lint && pnpm format:check && pnpm build && pnpm e2e` 통과.
- [ ] 외부 선결 조건(CI/GHCR, remote URL, identity 값, 앱 밖 전체 clone, drain, tmpfs 크기, outbox 위치)이 스펙 §13에 기록되고 사용자에게 보고되었다. _(외부 단계 — 호스트/CI 적용 전)_
