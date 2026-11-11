# GHCR 이미지 배포·임시 발행 워크스페이스 스펙 (NOR-148)

- Linear: NOR-148 (Claude 아키텍처 오너십) / 상위 설계: NOR-139, 기반 스펙: NOR-143
- 저장소: `personal-workbench` (private, 이 저장소)
- 상태: 설계 승인 대기(design draft, Codex 설계 리뷰 + 재리뷰 P1 + 최종 독립 재리뷰 P1 + 최종 게이트 교정 반영본). 문서 전용. 런타임 코드·Docker 구현·GHCR·인증키·Tailnet·Cloudflare·miniPC를 변경하지 않는다.
- 작성일: 2026-08-13 (개정: Codex 설계 리뷰 8건 + 재리뷰 P1 3건 + 최종 독립 재리뷰 P1 2건 + 최종 게이트 P1 3건·P2 1건 반영)
- 근거 스펙: [`2026-08-12-personal-workbench-architecture.md`](./2026-08-12-personal-workbench-architecture.md), [`docs/spec/NOR-143-workbench-foundation.md`](./NOR-143-workbench-foundation.md)
- 운영 근거: [`docs/operations/tailnet-workbench.md`](../../operations/workbench/tailnet-workbench.md)

이 문서는 스스로 완결된다. NOR-143~147에서 확정한 세 저장소 경계와 발행 게이트를 전제로, **miniPC의 영속 프로젝트 clone을 최소화**하려는 사용자 결정을 반영해 배포·발행 워크스페이스 모델을 재설계한다. 의미 있는 결정은 §12에 ADR로 기록한다.

---

## 1. 목적과 범위

### 1.1 현재(as-is)

1. **로컬 소스 빌드.** `docker-compose.yml`이 `build: context: .` 로 miniPC(또는 빌드 호스트)에서 앱 소스를 직접 빌드한다. 호스트에 앱 소스 트리가 있어야 한다.
2. **영속 public clone.** `PUBLIC_BLOG_ROOT`가 공개 블로그의 **상시 전체 clone**을 bind mount(`/data/public-blog`)로 물린다. 발행 어댑터(`PublicBlogAdapter`)는 이 상시 워크트리 안에서 `content/<slug>` 브랜치·커밋을 만들고, 사용자가 앱 밖에서 수동 push 할 때까지 그 브랜치가 clone에 남는다.
3. 결과적으로 miniPC에 **두 개의 영속 프로젝트 트리**(앱 소스 + public clone)와 개인 콘텐츠(②)가 공존한다.

### 1.2 목표(to-be)

사용자 결정: **miniPC의 영속 프로젝트 clone을 최소화한다.** 이에 따라 세 가지를 확정한다.

- **(a) GHCR 불변 이미지 배포.** 앱은 CI가 GHCR에 push한 **digest 고정 불변 이미지**를 pull 해서 실행한다. 호스트는 앱 소스를 갖지 않으며 로컬 빌드를 하지 않는다. 호스트 설정을 최소화한다.
- **(b) private workspace(②)만 영속 저작 데이터.** miniPC에 상시 존재하는 프로젝트 데이터는 개인 콘텐츠 저장소(`WORKSPACE_ROOT`) 하나뿐이다.
- **(c) public blog(③)은 임시 발행 워크스페이스.** 상시 clone을 없애고, 발행 세션마다 **임시로 생성했다가 세션 종료 시 파기**한다.

### 1.3 불변 원칙(승계)

NOR-143~147의 원칙을 그대로 지킨다. NOR-148은 이를 약화하지 않는다.

- **명시적 검토·diff·확정을 보존한다.** 발행은 사람이 diff를 보고 확정한 뒤에만 산출물을 만든다.
- **자동 push·자동 배포 없음.** 앱은 어떤 remote에도 push 하지 않고, 배포를 스스로 트리거하지 않는다.
- **실패는 원본을 보존한다.** 어떤 발행 실패도 ②의 개인 원본을 훼손하지 않는다.
- **경계는 물리적으로 강제한다.** 공개/비공개, 코드/콘텐츠 경계는 파일시스템·프로세스로 막는다.
- **파일이 원본.** 앱은 얇은 뷰다.

### 1.4 비범위(이 문서에서 변경하지 않음)

런타임 코드, Docker 구현, GHCR 패키지, 인증키, Tailnet/Tailscale, Cloudflare, miniPC 호스트. `src/**`, `Dockerfile`, `docker-compose.yml`, `.github/workflows/**`를 이 worktree에서 수정하지 않는다. 이 문서는 **설계와 실행 계획**만 담고, 실제 구현은 후속 일감(§10, 계획 문서)에서 수행한다. CI/GHCR 프로비저닝과 remote 값 확정은 §13의 외부 선결 조건이다.

---

## 2. 핵심 결정: 임시 shallow clone vs GitHub API (D1)

③을 임시화하려면 발행 시점에 공개 블로그의 현재 상태를 얻어 정확한 diff를 만들고, 확정 산출물을 남기는 두 경로가 필요하다. 두 후보를 평가하고 **하나의 1차 모델**을 택한다.

### 2.1 후보 A — 임시 shallow clone (선택)

발행 세션마다:

1. `git clone --depth=1 --single-branch --branch <main>` 로 공개 블로그를 **임시 디렉터리(tmpfs)** 에 얕게 clone.
2. 기존 `PublicBlogAdapter` 로직(현재 `.mdoc` 읽기 → 결정적 변환 → 통합 diff → 깨끗한 워크트리 확인 → `content/<slug>` 브랜치·커밋)을 이 임시 clone에서 그대로 수행.
3. 사용자가 diff를 검토하고 확정하면, 커밋을 **이식 가능한 Git 산출물(export: bundle 우선, format-patch 폴백)** 로 만들어 영속 outbox(§6)에 원자적으로 쓴다.
4. 임시 clone을 파기한다. push는 하지 않는다.

특성:

- **공개 저장소는 익명 HTTPS read로 clone 가능** → 런타임 컨테이너에 **어떤 remote 자격 증명도 필요 없다.** (fetch는 익명, push는 앱이 하지 않음.)
- 기존 어댑터 로직·브랜치/커밋 의미론·leak 검사(§9.2)를 거의 그대로 재사용한다. 변경 표면이 작다.
- Git 수준의 **정확한 diff**(실제 main tip 대비)와 결정적 커밋을 얻는다.
- 산출물(bundle은 base를 prerequisite로 기록, format-patch는 매니페스트 `baseSha`로 base를 참조)이므로, 사람이 자기 워크스테이션의 전체 clone에서 base 정합성 검사 후 안전하게 적용·push 한다.

### 2.2 후보 B — GitHub API (기각)

발행 세션마다 REST/GraphQL로 main의 현재 파일을 읽어 in-memory diff를 만들고, 확정 시 Git Data/Contents API로 브랜치·커밋을 만든다.

기각 근거:

- **"자동 push 없음"과 정면 충돌.** API로 커밋·브랜치를 만드는 것은 곧 원격 write(=push)다. push를 피하면 API가 주는 것은 "현재 파일 읽기"뿐이고, 로컬 커밋 개념이 사라져 브랜치/커밋 의미론을 잃는다.
- diff·커밋 로직을 GitHub API 형태로 **재구현**해야 하고, rate limit(비인증 60/h)과 API 스키마 결합이 생긴다.
- private 저장소였다면 read에도 토큰이 필요해 컨테이너에 자격 증명이 유입된다. 공개 저장소라 해도 이득이 없다.
- "파일이 원본, Git은 이력"이라는 §1.3 원칙과 어긋난다.

### 2.3 결정

**1차 모델 = 임시 shallow clone.** GitHub API는 채택하지 않는다(§12 D1). 이 결정으로 컨테이너는 remote 자격 증명이 없고, 기존 발행 게이트를 보존하며, ③을 완전히 임시화한다.

---

## 3. 세 저장소 경계 재정의

NOR-143의 세 트리 경계(①앱코드/②콘텐츠/③공개블로그)는 유지하되 ①·③의 **물질화 방식**을 바꾼다.

```text
① personal-workbench (앱 코드+문서)
   → miniPC에 소스로 존재하지 않는다. CI가 빌드한 GHCR 불변 이미지로만 런타임에 존재.
   → 호스트에는 digest 고정 이미지 참조와 Compose 파일만 있으면 된다.

② WORKSPACE_ROOT (개인 콘텐츠, private Git 저장소)
   → miniPC의 유일한 영속 저작 데이터. bind mount. (변경 없음)
   → 추가: 예약된 발행 outbox 경로(§6). 저작 데이터가 아니며 ②의 Git이 추적하지 않는다.

③ 공개 블로그 (blog.gze1206.net)
   → 상시 clone 없음. 발행 세션마다 tmpfs에 임시 shallow clone → 세션 종료 시 파기.
   → 앱은 익명 read로만 접근하고 push 하지 않는다.
```

경계 규칙(승계+강화):

- ②와 ③은 여전히 분리된 Git 트리다. ③은 이제 **영속 상태가 아니다.**
- 앱은 ③을 **발행 경로(`src/content/posts/`)와 승인 자산 스테이징을 제외하면 읽기 전용**으로 다루고, 임시 clone 밖으로 나가지 않는다.
- ①(이미지)에는 공개 배포 비밀·개인 콘텐츠·remote write 자격이 들어가지 않는다(§9, `.dockerignore` 경계 승계).

---

## 4. 발행 세션 생명주기 (임시 clone)

발행은 **하나의 세션**으로 묶는다. 세션은 임시 clone 하나를 소유하고, review→confirm 창을 이 clone 위에서 처리한다.

```text
[세션 시작]  발행 잠금 획득(§7) → 임시 작업 디렉터리 생성(tmpfs, 유일 이름)
   │
   ├─ clone   깨끗한 자식 환경 + HTTPS 전용 설정으로 익명 shallow clone (§9.1)
   │          --depth=1 --single-branch --branch <PUBLIC_BLOG_BRANCH> <REMOTE> <workdir>
   │
   ├─ review  leak 검사 → 결정적 변환 → 통합 diff 생성
   │          → reviewId 발급(CSPRNG randomBytes(32), 불투명) → baseSha·fingerprint는
   │            레지스트리 엔트리에 별도 저장(§7.1) → 세션 레지스트리 등록
   │          이 단계는 어떤 영속 상태도 바꾸지 않는다.
   │
   ├─ confirm confirmPublish:true & reviewId 일치·미소비(one-time) & 세션 유효(lease) 확인
   │          → content/<slug> 브랜치 생성 → .mdoc(+승인 자산)
   │            explicit identity(-c user.name/-c user.email, useConfigOnly)로 단일 커밋(§9.2)
   │          → export(bundle/patch)를 outbox에 원자적으로 기록(§6) → reviewId 소비 표시
   │
   └─ teardown 성공/실패/타임아웃 무관하게 임시 디렉터리 파기 + 레지스트리 항목 제거(§5, §7.1)
[세션 종료]  발행 잠금 해제
```

- **review와 confirm은 같은 세션·같은 clone을 재사용한다.** confirm이 review와 동일한 fetched base tip 위에서 커밋하므로 **앱 세션 내부에서는** diff·base가 바뀌지 않는다. 이 무변경 보장은 **outbox export 시점까지만** 성립한다. export된 산출물과 사람의 최종 push 사이에는 remote `main`이 움직일 수 있으므로, base 정합성은 사람의 push 전 검사로 강제한다(§6.4). 세션은 lease 타임아웃(예: 10분)을 갖고, 만료 시 clone을 파기하고 사용자는 재검토한다.
- 어댑터 공개 **메서드 시그니처**(`listAssets`/`review`/`publish`)와 라우트(`src/server/routes/publish.ts`) 엔드포인트는 유지한다. 다만 `publish` 확정 **응답 형태**가 "영속 로컬 브랜치"에서 "outbox 산출물 참조"로 바뀌므로, 그 응답을 소비하는 웹 계층도 함께 바뀐다: 응답 타입(`src/web/api.ts`)과 확정 결과 렌더(`src/web/PublishReview.tsx`)가 outbox 산출물 참조·사람 push 절차를 보여 주도록 조정한다(§4.1, 계획 T1). 그 밖의 변경은 어댑터의 **프로비저닝(임시 clone)·커밋 identity·산출(export)** 내부로 한정한다.
- `assertRepositoryRoot`·깨끗한 워크트리·`branch --list` 중복 검사는 임시 clone에서 구조적으로 항상 만족하지만 **방어적으로 유지**한다.

### 4.1 confirm 결과 계약 (HTTP/UI)

상시 clone이 없어지므로 확정 결과는 **호스트에 남는 로컬 브랜치가 아니다.** 임시 clone은 확정 직후 파기되고, 유일한 영속 산출물은 outbox의 export(bundle 또는 patch)다. 따라서 `publish` 확정과 `POST /api/publish/confirm` 응답 계약을 다음으로 바꾼다.

- **기존(as-is):** `{ branch, commit, targetPath }` — 상시 clone에 남는 로컬 브랜치를 가리킴.
- **변경(to-be):** `{ outboxRef, exportRef, exportFormat: 'bundle' | 'format-patch', baseSha, branch, commit, targetPath }` — 모두 **outbox 산출물**을 가리킨다. `exportRef`는 실제 export 형식의 산출 파일이며 형식은 `exportFormat`이 알려 준다(bundle이면 `.bundle`, 폴백이면 `.patch`). `branch`/`commit`은 export 안에 담긴 이름·SHA일 뿐 호스트에 체크아웃된 브랜치가 아니다. `targetPath`는 공개 블로그 저장소 상대 경로(`src/content/posts/<slug>.mdoc`)로 서버 콘텐츠 식별자다. (형식 중립 이름 `exportRef`를 쓰는 이유: bundle 전용 필드(`bundleRef`)는 format-patch 폴백과 모순되기 때문이다.)

**안전한 참조 규칙(서버 경로·비밀 미노출).** 응답은 아래를 **절대 포함하지 않는다**: remote URL, 절대 호스트 경로, tmpfs·임시 clone 디렉터리 경로, `WORKSPACE_ROOT`/outbox의 절대 경로, 인증·자격 값, 환경 변수.

- `outboxRef`/`exportRef`는 **outbox 루트 기준 상대 파일명**(예: `<slug>-<utc>.json`, `<slug>-<utc>.bundle` 또는 `<slug>-<utc>.patch`)만 담는다. 서버가 어디에 마운트됐는지 드러내지 않는다. 절대 경로 조립은 사람이 자기 호스트에서 하고, 앱은 파일명·형식만 알려 준다.
- `baseSha`/`commit`/`branch`는 공개 저장소의 Git 식별자로 민감하지 않다.
- 웹(`src/web/api.ts` 응답 타입, `src/web/PublishReview.tsx`)은 "outbox에 `<exportRef>`가 준비됨"과 **`exportFormat`별 사람 outbox push 절차(§6.4)**를 안내만 한다: `bundle`이면 verify→fetch, `format-patch`이면 `git am`. 두 경로 모두 `merge-base --is-ancestor` base 검사 후 push. UI는 서버 절대 경로·remote URL을 렌더하지 않으며, 사람은 outbox 디렉터리(자기 호스트에서 아는 경로)에서 파일명으로 산출물을 찾는다.

---

## 5. 실패 처리와 정리(cleanup)

- **원본 불변.** 발행 경로의 어떤 실패도 ②의 원본을 건드리지 않는다. 임시 clone·outbox 쓰기만이 발행이 만지는 상태다.
- **임시 clone 파기.** 각 세션의 작업 디렉터리는 유일 이름으로 tmpfs 아래 만들고, `try/finally`로 성공·실패·예외·타임아웃 모두에서 재귀 삭제한다. read-only root filesystem이므로 작업 베이스는 쓰기 가능한 tmpfs 마운트(§8)여야 한다.
- **고아 정리.** 프로세스 시작 시와 새 세션 시작 전에 발행 작업 베이스를 스캔해 임계 나이(예: 1시간) 초과 잔여 디렉터리를 제거한다. 컨테이너 재시작으로 finally가 못 돈 경우를 보완한다.
- **부분 산출 방지.** outbox 쓰기는 **같은 디렉터리 임시 파일 → fsync → 원자적 rename**(§7 원자적 저장 규약 승계). 크래시 시 반쯤 쓰인 export(bundle/patch)가 남지 않는다.
- **네트워크 실패.** clone/fetch 실패(오프라인·DNS·TLS·remote 접근 불가)는 세션을 즉시 중단하고 원인·재시도 방법을 반환한다. 저작(②)은 영향받지 않는다.
- **실패 표면.** leak 검사·스키마·변환·clone 실패는 커밋·outbox 산출을 만들지 않고 원인·파일·재시도를 반환한다(NOR-143 §13 승계).

---

## 6. 발행 산출물(outbox)과 사람의 push

임시 clone은 세션 종료 시 사라지므로, **확정된 커밋을 영속화할 곳**이 필요하다. miniPC의 유일한 영속 저장은 ②다.

### 6.1 outbox 위치

- **1차: ② 안의 예약·비추적 디렉터리** `WORKSPACE_ROOT/.workbench/publish-outbox/`.
  - **앱은 ②의 `.gitignore`를 수정하지 않는다.** 사용자 소유 저장소의 파일을 앱이 고쳐 쓰지 않는다(NOR-143 D6, 파일 소유권은 사용자). 대신 앱은 **시작 시 outbox 경로가 ②의 Git에서 실제로 무시되는지 검증**한다: ② 루트에서 `git -C <WORKSPACE_ROOT> check-ignore -q <outbox 상대경로>` 가 무시(exit 0)를 보고하지 못하면 **설정 오류로 부팅을 거부**하고, 사용자가 `.gitignore`에 `/.workbench/`(또는 택한 경로)를 추가하도록 안내한다. 이렇게 발행 산출물이 저작 이력에 섞이는 것을 앱이 아니라 검증으로 막는다.
  - 권한: outbox 디렉터리 `0700`, 산출 파일 `0600`. 앱은 없으면 `0700`으로 생성하고, 더 느슨한 권한이면 거부하거나 조인다.
  - 새 host 설정·새 mount가 필요 없다 → "최소 호스트 설정" 목표에 부합.
- 대안(§12 D2 각주): 별도 소형 bind mount `PUBLISH_OUTBOX_ROOT`. 물리적 분리는 강하지만 host 설정이 하나 늘어난다. 이 경우 check-ignore 검증은 불필요(② 밖). 사용자가 물리 분리를 원하면 전환 가능하도록 경로를 설정값으로 둔다.

### 6.2 산출물 구성

세션당 UTC 타임스탬프+slug로 묶인 산출물 집합:

- **export 산출물(형식 택1, `exportRef`가 가리킴):**
  - `<slug>-<utc>.bundle` — `git bundle create ... <baseSha>..content/<slug>` 결과(**1차 형식**). 사람이 전체 clone에서 `git fetch <bundle> content/<slug>`로 적용.
  - `<slug>-<utc>.patch` — 폴백. `git format-patch --binary --stdout <baseSha>..content/<slug> > <slug>-<utc>.patch`(단일 파일). 사람이 `git am`으로 적용.
  - 둘 중 실제로 만든 하나만 존재하며, `exportFormat`·`exportRef`가 어느 것인지 알려 준다.
- `<slug>-<utc>.diff` — 통합 diff(사람이 앱 밖에서도 눈으로 확인).
- `<slug>-<utc>.mdoc` — 생성된 발행 파일 사본.
- `<slug>-<utc>.json` — 매니페스트: `baseSha`(fetched main tip), `branch`, `targetPath`, `commitMessage`, `exportFormat`(`bundle`|`format-patch`), `exportRef`(export 파일 상대명), `commit`(export 내 커밋 SHA), `author`(발행 커밋 identity = `PUBLISH_GIT_AUTHOR_NAME <PUBLISH_GIT_AUTHOR_EMAIL>`), 자산 목록·`sha256`, 생성 시각(UTC). identity가 미설정이면 커밋·export가 만들어지지 않으므로(§9.2) 매니페스트도 생성되지 않는다.

권한: 디렉터리 `0700`, 파일 `0600`. 경로는 예약 outbox 안으로 검증(symlink/`..`/절대경로 가드, 기존 `assertNoSymlinkAncestors` 재사용).

### 6.3 bundle vs format-patch

- **1차: git bundle.** `git bundle create out.bundle <baseSha>..content/<slug>` 는 base(main tip)와 새 커밋 사이 객체만 담고, base를 prerequisite로 헤더에 기록한다. depth=1 shallow clone에서도 shallow 경계를 넘지 않으므로 생성 가능하다. 소비자(전체 clone)는 base를 이미 가지므로 unbundle 된다. 바이너리 자산도 온전히 포함한다.
- **대체: format-patch.** shallow 환경에서 bundle 생성이 제약되면 `git format-patch --binary --stdout <baseSha>..content/<slug>` 를 `<slug>-<utc>.patch` 단일 파일로 저장하고 `git am`으로 적용한다. shallow에서 항상 신뢰 가능.
- 구현 태스크는 **depth=1 clone이 bundle을 만들고 별도 전체 clone이 소비하는 통합 테스트**로 1차 형식을 확정하고, 실패 시 자동으로 format-patch로 폴백한다(형식·`exportRef`를 매니페스트·응답에 기록). **두 형식 모두 §14가 커버**하며, 소비 절차가 형식별로 다르므로(§6.4) UI·runbook도 형식별로 분기한다.

### 6.4 사람의 최종 push (앱 밖)

앱은 push 하지 않는다. 사람은 **miniPC 밖(신뢰 워크스테이션)의 전체 clone**에서:

1. 최신 remote 상태를 받는다: `git fetch origin`.
2. **base 정합성 검사(필수, TOCTOU 완화).** 매니페스트의 `baseSha`가 현재 `origin/<branch>`의 조상인지 확인한다: `git merge-base --is-ancestor <baseSha> origin/<branch>`.
   - 조상이면(=remote가 base 위로만 전진) 진행한다.
   - 조상이 아니면(=base가 remote 히스토리에서 벗어남·force-push 등) push 하지 말고, `origin/<branch>` 대비 rebase/재검토하거나 앱에서 재발행(re-review)해 새 base로 다시 export 한다.
3. **`exportFormat`별 적용(산출물은 형식이 다르므로 절차도 다르다):**
   - `exportFormat: 'bundle'` → `git bundle verify <exportRef>` 후 `git fetch <exportRef> content/<slug>:content/<slug>` 로 로컬 브랜치 생성.
   - `exportFormat: 'format-patch'` → base에서 브랜치를 만든 뒤 patch 적용: `git switch -c content/<slug> <baseSha>` → `git am <exportRef>`. (base가 origin 조상임은 2단계에서 확인됨.)
4. `.diff`/`.mdoc`로 대상·내용 재확인.
5. 자기 자격 증명으로 remote에 push(또는 PR).

이 전체 clone은 miniPC에 두지 않는다(§13 선결 조건). 이렇게 review·확정(앱 안)과 push(앱 밖, 사람)의 경계가 유지되고, base drift는 사람의 push 전 검사로 최종 차단한다. UI·runbook은 응답의 `exportFormat`에 맞춰 위 절차 중 하나만 보여 주며, 두 형식 모두 서버 경로·remote URL을 노출하지 않는다.

---

## 7. 동시성과 세션 레지스트리

- **단일 사용자·단일 라이터** 전제(NOR-143 §7 승계). 발행 세션은 **서비스 전역 발행 잠금**으로 직렬화한다. 동시에 두 임시 clone이 outbox·디스크를 다투지 않는다.
- 각 세션은 유일 이름 작업 디렉터리로 격리되므로 잠금은 주로 outbox 일관성·디스크 사용 상한을 위한 것이다.
- ②로의 outbox 쓰기는 경로별 직렬화(기존 원자적 저장 규약)로 보호한다.

### 7.1 세션 레지스트리 생명주기

review→confirm 사이 상태(임시 clone, base tip)를 잇기 위해 **프로세스 인메모리 세션 레지스트리**를 둔다(영속 DB 없음, NOR-143 D3 승계).

- **키·엔트로피(필수 역량).** `reviewId`는 **CSPRNG로 생성한 256비트 난수 토큰**이다: `crypto.randomBytes(32)`를 hex 또는 base64url로 인코딩한 **불투명 식별자**. 콘텐츠·diff·baseSha에서 파생한 **결정적 SHA는 허용하지 않는다.** 결정적 다이제스트는 (a) 같은 초안을 재검토하면 같은 reviewId가 나와 열거·예측·재사용이 가능해지고, (b) reviewId 자체가 상태(baseSha)를 인코딩해 검증 관심사를 흐린다. 따라서 reviewId는 **오직 무작위 조회 키**이고, 상태는 아래 엔트리에 **분리 저장**한다. CSPRNG는 배포 런타임의 필수 역량이며, 부재 시(예: 안전한 난수원 없음) 발행 기능을 비활성화한다.
- **엔트리 구조(상태는 reviewId와 분리).** `reviewId(무작위) → { cloneDir, baseSha, fingerprint, createdAt, leaseExpiry, consumed }`.
  - `baseSha`는 fetched main tip. `fingerprint`는 review가 계산한 콘텐츠·diff·baseSha·자산 해시(현행 `reviewId()` 함수가 만들던 결정적 다이제스트를 **여기 fingerprint 필드로 이동**). 즉 결정적 해시는 여전히 존재하되 **키가 아니라 엔트리 안의 무결성 값**이다.
  - confirm은 무작위 `reviewId`로 엔트리를 조회한 뒤, **재계산한 fingerprint가 저장된 fingerprint와 일치**하고 clone의 base가 `baseSha`와 같은지 확인한다. 불일치면 stale로 거부한다. 이렇게 base 정합성 검증은 fingerprint 비교로 하고, reviewId는 그 검증과 독립인 무작위 핸들로 남는다.
- **1회성(one-time) 매핑.** confirm이 성공적으로 outbox export를 마치면 해당 엔트리를 **소비(consumed) 처리하고 즉시 제거**한다. 같은 reviewId의 두 번째 confirm은 거부된다(중복 export 방지). reviewId가 무작위·불투명이므로 소비 후 재현·추측이 불가능하다.
- **만료.** `leaseExpiry`(예: 발급 후 10분) 경과 엔트리는 만료다. 만료된 reviewId로의 confirm은 stale로 거부되고 재검토(재-review)를 요구한다. 만료 스윕은 새 세션 시작 시와 주기적 정리에서 수행하며, 만료 엔트리의 `cloneDir`를 파기한다(§5 고아 정리와 동일 경로).
- **재시작 정리.** 프로세스 재시작 시 레지스트리는 비어 있다(인메모리). 시작 시 발행 작업 베이스를 스캔해 이전 프로세스가 남긴 clone 디렉터리를 **모두** 제거하고, 살아남은 reviewId가 없으므로 모든 미완료 confirm은 자연히 재검토를 요구한다. outbox 산출물(영속)은 유지된다.
- **누수 방지.** 레지스트리 항목 제거와 `cloneDir` 파기는 항상 함께 일어난다(성공·만료·예외·재시작). 매핑만 남고 clone이 사라지거나 그 반대가 되지 않는다.

---

## 8. 컨테이너·런타임 형상 변화

기존 NOR-147 hardening을 유지하며 다음만 바꾼다(구현은 후속 일감).

- **이미지 출처.** Compose의 `build:`를 제거하고 `image: ghcr.io/gze1206/personal-workbench@sha256:<digest>` 로 **digest 고정**한다. 호스트는 소스·빌드 도구가 필요 없다.
- **③ mount 제거.** `PUBLIC_BLOG_ROOT` bind mount와 그 host 경로를 없앤다. 남는 쓰기 가능 mount는 ② 하나.
- **tmpfs 추가.** 임시 clone 작업 베이스로 쓰기 가능한 `tmpfs`(예: `/run/publish`, `noexec,nosuid,nodev`, 크기 상한)를 추가한다. read-only root filesystem은 유지.
- **네트워크.** 발행 시 공개 블로그 remote로의 **아웃바운드 HTTPS(443)** 가 필요하다(익명 read). 그 외 인바운드 경계(loopback+Tailscale Serve)는 NOR-147 그대로.
- **Git 런타임 유지.** 이미지에 `git`·`ca-certificates`는 이미 있다(clone/bundle에 필요).
- **health.** `/api/health`는 준비 상태만 보고(비밀·경로 미노출) — 변경 없음. 시작 시 설정 검증만 §11로 갱신.

---

## 9. 보안

### 9.1 임시 clone 하드닝 (remote·프로토콜·리다이렉트·상속 환경)

- **remote write 자격 증명 없음.** 컨테이너에 push 키·토큰을 넣지 않는다. clone은 익명 HTTPS read(공개 저장소).
- **remote URL 정확 검증(HTTPS 전용, 정확한 origin/repo).** `PUBLIC_BLOG_REMOTE`는 부팅 시와 clone 직전 다음을 **모두** 만족해야 하고 하나라도 어기면 거부한다.
  - 스킴은 정확히 `https` (`http`·`ssh`·`git`·`file`·`ftp`·scp 형식 `user@host:path` 금지).
  - **userinfo 금지**(`https://user:pass@host/...`, `https://user@host/...` 거부), **query 금지**(`?...`), **fragment 금지**(`#...`), **포트는 443만 허용**(또는 미지정).
  - host는 **정확한 allowlist**(예: `github.com`)와 대소문자 무시 완전 일치. 서브도메인·유사문자열 부분일치 금지.
  - repo 경로는 **정확한 `<owner>/<repo>(.git)?` 완전 일치**(예: `/gze1206/blog.gze1206.net.git`). 경로 순회·추가 세그먼트 금지.
  - 즉, 검증은 스킴·host·경로를 정규화해 **문자열 완전 일치**로 수행하고, 파싱은 `URL`로 하되 userinfo/query/fragment/포트를 명시적으로 필드 단위로 거부한다.
- **주입된 remote 정책 시임(테스트 재현용이되 프로덕션은 강화 유지).** 위 검증과 clone 전송 구성은 `PublicBlogAdapter`가 **생성자 주입**으로 받는 `RemotePolicy` 포트로 캡슐화한다. 포트는 `assertAllowed(remoteUrl)`(위 규칙 적용)과 `cloneConfig(remoteUrl) → { effectiveUrl, gitConfigArgs, extraEnv }`(프로토콜 allow·CA 등)를 제공한다.
  - **프로덕션 진입점(`src/server/index.ts`)만 정책·어댑터를 생성한다.** 현재 어댑터 조립은 `src/server/index.ts`에서 이뤄진다: `loadConfig()` 후 `PublicBlogAdapter`를 생성한다. 여기가 **`ProductionRemotePolicy`(host allowlist=설정값 예 `github.com`, 스킴 https, 포트 443, 위 정확 검증)를 구성해 어댑터에 주입하는 유일한 생산자**다. `src/server/app.ts`는 이미 만들어진 `PublicBlogPublisher`(어댑터)를 매개변수로 받아 라우트에 배선하는 **publisher 주입 경계**일 뿐, 어댑터·정책을 생성하지 않는다(합성 루트가 아니다).
  - **테스트 전용 정책**(`LoopbackTestRemotePolicy`)은 **테스트 코드가 소유**하며 `127.0.0.1:<ephemeral>` + 테스트 CA를 허용한다. 프로덕션 소스(= `src/**`에서 `**/*.test.ts` 제외)는 이를 import 하지 않는다.
  - **프로덕션 구성으로는 느슨한 정책을 켤 수 없다:** 정책 교체는 **런타임 플래그·env가 아니라 어느 코드가 어댑터를 생성하느냐**로 결정되고, 프로덕션 진입점 `src/server/index.ts`는 항상 `ProductionRemotePolicy`를 구성·주입한다. 느슨한 정책은 프로덕션 바이너리의 도달 가능한 그래프에 들어가지 않는다. 따라서 로컬 HTTPS fixture(§14.1-B)로 **전체 어댑터 경로**를 CI에서 재현하면서도 프로덕션 URL 검증을 **약화하지 않는다.**
- **HTTPS만 허용, 그 외 프로토콜 거부(검증됨).** git의 `protocol.allow=never`는 **HTTPS까지 막으므로** 그 자체로는 clone이 실패한다(git 2.53에서 `fatal: transport 'https' not allowed` 확인). 따라서 **deny-all 후 HTTPS만 재허용**한다:
  - `-c protocol.allow=never -c protocol.https.allow=always`
  - 이로써 `file`/`ssh`/`git`/기타 전송은 거부되고 HTTPS만 통과한다. 테스트는 (a) 이 조합으로 HTTPS clone 성공, (b) `file://`·`ssh://` remote가 `transport ... not allowed`로 거부됨을 단언한다(§14).
- **리다이렉트 차단.** `-c http.followRedirects=false`로 HTTP 리다이렉트를 끈다. remote가 다른 origin으로 유도하지 못한다. clone 후 `remote.origin.url`이 설정 remote와 정확히 일치하는지도 재검증한다.
- **상속된 Git 환경 무력화(깨끗한 자식 환경).** clone/bundle/commit은 부모 프로세스 환경을 그대로 물려주지 않고 **최소 화이트리스트 환경**으로 실행한다. 구체적으로 자식에서 다음을 제거·중화한다.
  - `GIT_CONFIG`, `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_SYSTEM`, `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_*`/`GIT_CONFIG_VALUE_*` 제거, 그리고 `GIT_CONFIG_NOSYSTEM=1`·`HOME`을 clone 작업 디렉터리 밖 빈 위치로 지정해 사용자/시스템 gitconfig 주입을 차단.
  - askpass·자격 helper: `GIT_ASKPASS`·`SSH_ASKPASS` 제거, `GIT_TERMINAL_PROMPT=0`, `-c credential.helper=`(비움).
  - 프록시·전송 helper 주입: `GIT_PROXY_COMMAND`·`GIT_SSH`·`GIT_SSH_COMMAND`·`GIT_EXTERNAL_DIFF`·`GIT_PAGER` 제거, `http.proxy`/`https.proxy`/`all_proxy`/`HTTP(S)_PROXY` 등 프록시 환경 제거, `-c core.fsmonitor=false`.
  - 결과적으로 자식 git은 설정 CLI(`-c ...`)와 앱이 명시한 env만 신뢰한다.
- **적대적 저장소 방어.** 임시 clone은 `--no-tags --single-branch --depth=1 --no-recurse-submodules`, 훅 비활성(`-c core.hooksPath=<빈 디렉터리>`)로 수행한다. clone된 트리의 훅·`.git/config`의 원격 코드 실행 경로를 신뢰하지 않는다.
- **경로 안전 승계.** `.mdoc`·자산 write, outbox write 모두 대상 루트 안으로 realpath 검증하고 symlink/`..`/절대경로 탈출을 거부한다(기존 `assertNoSymlinkAncestors`/`assertDescendant` 재사용).
- **leak 검사 유지.** 발행 전 본문·frontmatter에서 `file://`, `workspace/`, `assets/private/`, private 루트, 내부 위키 링크(`[[...]]`), 미해결 자산을 거부한다(NOR-143 §9.2). 승인 자산만 스테이징.
- **tmpfs 격리.** 임시 clone은 `noexec,nosuid,nodev` tmpfs에 둬 실행·권한 상승 표면을 줄인다.

### 9.2 발행 커밋 identity (비밀 아님, 명시 필수)

임시 clone에는 사용자 gitconfig가 없고(§9.1 깨끗한 환경) 자식 환경도 비운다. 이 상태에서 `git commit`은 **실패하지 않고** git이 `사용자이름@호스트이름`으로 identity를 자동 추론해 커밋한다(git 2.53에서 확인: 컨테이너 UID·호스트명이 커밋 committer로 유출). 이는 원치 않는 호스트 정보 노출이므로 **명시적 identity를 강제**한다.

- **비밀 아닌 필수 환경 변수** `PUBLISH_GIT_AUTHOR_NAME`, `PUBLISH_GIT_AUTHOR_EMAIL`을 도입한다(§11). 비밀이 아니며 커밋 메타데이터일 뿐이다.
- 커밋은 **명시 identity + 자동 추론 차단**으로 만든다:
  - `git -c user.useConfigOnly=true -c user.name="$PUBLISH_GIT_AUTHOR_NAME" -c user.email="$PUBLISH_GIT_AUTHOR_EMAIL" commit ...`
  - `user.useConfigOnly=true`는 identity가 없을 때 자동 추론 대신 **커밋을 실패**시킨다(검증: 미설정 시 `Author identity unknown`). author·committer 모두 위 값으로 고정된다(검증됨).
- **미설정 실패 의미론.** 두 변수 중 하나라도 비었으면 confirm은 **커밋 이전에 명확한 오류로 중단**하고, 임시 clone을 파기하며, **outbox 산출물·매니페스트를 만들지 않는다.** 부분 산출이 없다(§5). 테스트는 identity 누락 시 커밋·export가 만들어지지 않고 명시적 오류가 반환됨을 단언한다(§14).
- 매니페스트는 사용한 `author`를 기록한다(§6.2). remote write 자격이 아니므로 컨테이너 자격 증명 정책(§9.1 remote 자격 없음)과 무관하다.

### 9.3 공급망·이미지 위생

- **공급망.** 배포 이미지는 **digest 고정**(부동 태그 금지)으로 재현성·불변성을 보장한다. GHCR 이미지 서명(cosign)·provenance(SLSA) 부착은 CI 후속 과제로 권장(§13).
- **이미지 위생.** ①에 개인 콘텐츠·remote 자격·배포 비밀이 없음을 `.dockerignore` allowlist build로 계속 보증(NOR-147 승계).

---

## 10. 배포·갱신 절차 (deployment update process)

miniPC는 소스를 갖지 않으므로 갱신은 **이미지 digest 교체**로만 이뤄진다.

### 10.1 이미지 빌드·게시 (CI, miniPC 밖)

- GitHub Actions가 `personal-workbench` push/tag에서 멀티스테이지 이미지를 빌드하고 `ghcr.io/gze1206/personal-workbench` 에 push 한다.
- 태그 정책: 불변 참조는 **digest**. 사람이 읽는 보조 태그로 `:vX.Y.Z`, `:<git-sha>`를 부착한다. 배포는 항상 digest로 고정한다.
- provenance/서명(권장): OIDC 기반 build provenance, cosign 서명.
- **이 문서 작업 범위 밖**: 실제 workflow 파일 추가·GHCR 패키지 생성은 §13 외부 선결 조건이다(“GitHub packages 변경 금지”).

### 10.2 호스트 갱신

1. 새 digest를 확인한다(CI 산출 로그·`docker buildx imagetools inspect`).
2. `docker-compose.yml`(또는 `.env`의 `IMAGE_DIGEST`)의 digest를 새 값으로 바꾼다.
3. `docker compose pull` → `docker compose up -d`.
4. `curl --fail http://127.0.0.1:3000/api/health` 로 준비 확인 후 트래픽 유지.
5. **롤백** = digest를 이전 값으로 되돌리고 `pull && up -d`. 이미지가 불변이라 결정적으로 되돌아간다.

- 호스트에 필요한 것은 Compose 파일·`.env`(경로/TZ/digest)·② mount·tmpfs·아웃바운드 443 뿐이다. 소스·빌드·③ clone 없음.
- private 이미지면 호스트에 `docker login ghcr.io`(1회, `read:packages` PAT)만 필요하고, 이 자격은 **컨테이너 안이 아니라 호스트 daemon**에 둔다.

---

## 11. 설정 검증 변화

`src/server/config.ts`의 시작 시 검증을 다음으로 갱신(구현은 후속):

- **제거:** `PUBLIC_BLOG_ROOT`(디렉터리 존재·read/write) 요구.
- **추가:** `PUBLIC_BLOG_REMOTE`(공개 블로그 clone URL) — **HTTPS 전용 정확 검증**(§9.1): 스킴 `https`만, userinfo·query·fragment 금지, 포트 443만, host 정확 allowlist, `<owner>/<repo>(.git)?` 경로 완전 일치. `ssh`/`git`/`file`/scp 형식 거부. 시작 시 네트워크 접근을 **강제하지 않는다**(오프라인에도 부팅 가능; 발행 시점에만 필요).
- **추가:** `PUBLIC_BLOG_BRANCH`(기본 `main`).
- **추가(비밀 아님, 필수):** `PUBLISH_GIT_AUTHOR_NAME`, `PUBLISH_GIT_AUTHOR_EMAIL` — 발행 커밋 identity(§9.2). 미설정·빈 값이면 부팅을 거부하거나(권장) 최소한 confirm 시점에 커밋 이전 오류로 중단한다. 이메일은 형식 검증.
- **추가:** 발행 작업 베이스(tmpfs 경로)와 outbox 경로 — 존재·쓰기 가능·② 루트 안(outbox의 경우) 검증, ②·outbox·작업 베이스 상호 겹침 금지. outbox 권한이 `0700`보다 느슨하면 거부하거나 조인다.
- **추가(outbox가 ② 안일 때):** 시작 시 `git -C <WORKSPACE_ROOT> check-ignore -q <outbox 상대경로>`로 outbox가 ②의 Git에서 무시되는지 검증한다. 무시되지 않으면 **부팅 거부**하고 사용자가 `.gitignore`에 추가하도록 안내한다. **앱은 `.gitignore`를 수정하지 않는다**(§6.1).
- **유지:** `WORKSPACE_ROOT` 검증, `APP_TIME_ZONE`(IANA) 검증, 루트 겹침 금지.
- health는 여전히 비밀·경로·remote URL을 노출하지 않는다.

---

## 12. 결정 기록 (ADR 요약)

- **D1 — 임시 shallow clone을 1차 발행 모델로 채택, GitHub API 기각.** 익명 read로 자격 증명 0, 기존 어댑터·게이트 재사용, Git 수준 정확한 diff·결정적 커밋. API는 "no auto push"와 충돌하고 이득이 없다(§2).
- **D2 — 확정 산출물은 ② 예약·비추적 outbox의 Git bundle.** ③이 임시라 커밋을 영속화할 곳이 ②뿐이다. **앱은 ②의 `.gitignore`를 수정하지 않고**, 시작 시 `git check-ignore`로 outbox가 무시되는지 검증해 미무시면 부팅을 거부한다(파일 소유권은 사용자). 디렉터리 `0700`·파일 `0600`. 별도 mount는 옵션. bundle 1차·format-patch 폴백(§6).
- **D3 — 배포는 GHCR digest 고정 불변 이미지.** 부동 태그 금지, 롤백은 digest 되돌리기. 호스트는 소스·빌드가 없다(§8, §10).
- **D4 — ③ 상시 clone 폐지, 세션마다 임시화 후 파기.** miniPC 영속 프로젝트 트리를 ②만 남긴다. 인메모리 세션 레지스트리가 review→confirm을 잇고, 만료·재시작·예외에서 clone과 매핑을 함께 회수(§4, §5, §7.1).
- **D4a — reviewId는 CSPRNG `randomBytes(32)` 불투명 토큰, 상태는 분리 저장.** 결정적 SHA 키를 금지한다(예측·열거·재사용 가능·관심사 혼동). baseSha·fingerprint(무결성 값)는 레지스트리 엔트리에 별도로 두고 confirm이 fingerprint 재계산으로 base 정합성을 검증한다. CSPRNG는 필수 역량이며 부재 시 발행 비활성(§7.1).
- **D5 — 컨테이너에 remote write 자격 증명 없음, 사람이 앱 밖 전체 clone에서 push.** review·확정(앱)과 push(사람)의 경계 유지(§6.4, §9).
- **D6 — 어댑터 공개 인터페이스·발행 게이트·leak 검사 불변.** 변경은 프로비저닝·커밋 identity·export 내부와 confirm 결과 형태로 한정. confirm 응답은 영속 브랜치가 아니라 outbox 산출물 참조를 반환(§4, §4.1).
- **D7 — clone은 HTTPS 전용 + 정확 origin 검증.** `protocol.allow=never`는 HTTPS까지 막으므로 `protocol.allow=never` + `protocol.https.allow=always`로 HTTPS만 허용하고 file/ssh/git을 거부한다. remote는 스킴·host·경로 완전 일치로 고정하고 userinfo/query/fragment/비443 포트를 거부한다. `http.followRedirects=false`와 깨끗한 자식 환경(GIT_CONFIG·askpass·credential·proxy helper 무력화)으로 상속 주입을 차단(§9.1, 검증됨).
- **D8 — 발행 커밋 identity를 비밀 아닌 필수 env로 명시.** 깨끗한 환경의 `git commit`은 실패 대신 `사용자@호스트`를 자동 추론해 호스트 정보를 유출한다. `PUBLISH_GIT_AUTHOR_NAME/EMAIL` + `user.useConfigOnly=true`로 명시 identity를 강제하고, 미설정 시 커밋·export 없이 실패시킨다(§9.2, 검증됨).
- **D9 — TOCTOU 범위 한정과 사람 base 검사.** 무변경 보장은 앱 세션(review→export) 내부로 한정된다. export와 사람 push 사이 remote drift는 push 전 `git merge-base --is-ancestor <baseSha> origin/<branch>` 검사로 사람이 차단한다(§4, §6.4).
- **D10 — remote 정책은 주입 시임, 프로덕션은 강화 유지.** URL allowlist·전송 구성을 `RemotePolicy` 포트로 캡슐화하고 어댑터에 생성자 주입한다. **프로덕션 진입점 `src/server/index.ts`가 `ProductionRemotePolicy`(github.com·443·https)를 구성해 어댑터에 주입하는 유일한 생산자**이며, `src/server/app.ts`는 이미 만들어진 publisher를 받는 주입 경계(합성 루트 아님)다. loopback을 허용하는 `LoopbackTestRemotePolicy`는 **테스트 코드만 소유**한다. 런타임 플래그로 느슨한 정책을 켤 수 없어, 로컬 HTTPS fixture로 전체 어댑터 경로를 CI 재현하면서도 프로덕션 검증을 약화하지 않는다(§9.1, §14.1-B).
- **D11 — 안전 export 참조는 형식 중립 `exportRef`.** bundle 전용 `bundleRef`는 format-patch 폴백과 모순되므로, 응답·매니페스트는 형식 중립 상대 파일명 `exportRef`와 `exportFormat`을 쓴다. UI·runbook은 `exportFormat`별로 분기한다: `bundle`은 verify/fetch, `format-patch`은 `git am`. 두 형식 모두 테스트가 커버하고 경로·remote 누출이 없다(§4.1, §6.2–6.4, §14).

---

## 13. 호환성·마이그레이션과 외부 선결 조건

### 13.1 마이그레이션 절차(as-is → to-be)

1. **미push 브랜치 배수(drain).** 현재 영속 public clone에 남은 `content/*` 로컬 브랜치·미커밋 발행 파일을 잃지 않도록, 은퇴 전에 열거해 각각을 사람이 push 하거나 bundle로 내보낸다. (호스트 1회 작업.)
2. **이미지 전환.** Compose `build:` → `image: ...@sha256:<digest>`. `.env`에 `IMAGE_DIGEST`·`PUBLIC_BLOG_REMOTE`·`PUBLIC_BLOG_BRANCH`·`PUBLISH_GIT_AUTHOR_NAME`·`PUBLISH_GIT_AUTHOR_EMAIL` 추가, `PUBLIC_BLOG_ROOT` 제거. tmpfs·outbox 설정 추가. outbox가 ② 안이면 사용자가 ②의 `.gitignore`에 outbox 경로를 미리 추가(앱은 수정하지 않음, §6.1).
3. **③ mount·host clone 제거.** drain 확인 후 상시 public clone 디렉터리를 제거한다.
4. **설정 검증 전환**(§11).
5. **검증.** GHCR 이미지 실행 → health ready → 발행 review가 실제 main tip 대비 diff를 보이고 → confirm이 outbox 산출물을 만들고 → remote가 바뀌지 않았음을 확인.

- 어댑터 메서드 시그니처·라우트 엔드포인트·발행 UX 흐름이 유지되므로 사용자 절차(초안→검토→확정)는 그대로다. 달라지는 것은 확정 결과가 "상시 clone의 브랜치"에서 "outbox의 export(bundle/patch)"로 바뀌는 점뿐이며(확정 응답 형태도 그에 맞춰 조정), 최종 push가 앱 밖 전체 clone에서 이뤄진다는 점은 동일하다.
- 한 모델만 유지한다(임시 clone). 전환 후 영속-clone 경로 코드는 제거한다.

### 13.2 외부 선결 조건(이 worktree에서 미해결)

이 문서 작업은 문서 전용이며 아래는 사용자/외부 단계다. 코디네이터에 보고한다.

1. **GHCR 패키지 가시성·자격.** 이미지 private/public 결정. private면 호스트 `docker login ghcr.io`(`read:packages` PAT). — 사용자 결정·작업.
2. **CI 워크플로 부재.** `.github/workflows`가 없다. GHCR로 빌드·push하는 CI는 이 스펙이 정의만 하고 **구현은 후속**(GitHub packages/actions 변경 금지 준수).
3. **공개 블로그 remote 값 확정.** `PUBLIC_BLOG_REMOTE`의 정확한 URL(예: `https://github.com/gze1206/blog.gze1206.net.git`)과 기본 브랜치명. — 사용자 확인 필요.
4. **앱 밖 전체 clone.** 최종 push용 신뢰 워크스테이션의 공개 블로그 전체 clone 유지(miniPC 아님). — 사용자 확인.
5. **미push 브랜치 drain.** 은퇴 전 기존 영속 clone의 `content/*` 배수. — 호스트 1회 작업.
6. **tmpfs 크기.** 공개 블로그 저장소 크기에 맞춘 발행 작업 tmpfs 상한. — 호스트 설정값.
7. **outbox 위치 확정.** ② 예약 비추적 경로(1차) vs 별도 mount. 본 스펙은 1차를 택했으나 물리 분리 선호 시 확인 필요.

---

## 14. 테스트 전략

TDD(NOR-143 §11 승계). 발행 경로 재설계에 맞춰 다음을 추가·조정한다.

- **순수 도메인 단위(Vitest):** 결정적 변환·leak 검사·slug/series 규칙은 불변, 회귀로 유지.
- **remote URL 검증 단위(Vitest):** `https` 허용; `ssh://`·`git@github.com:o/r.git`(scp)·`http://`·`file://` 거부; userinfo(`https://u@h/…`, `https://u:p@h/…`)·query(`?…`)·fragment(`#…`)·비443 포트 거부; host allowlist 완전 일치(서브도메인·부분일치 거부); `<owner>/<repo>(.git)?` 경로 완전 일치·경로 순회 거부.
- **프로토콜 게이트 검증(§14.1).** **`file://` bare repo로는 HTTPS 성공을 검증할 수 없다**(deny 구성에서 `file`은 `transport 'file' not allowed`로 거부됨, 검증됨). 두 방법을 정의한다:
  - **(A) 깨끗한 seam(외부 불필요, 기본):** 구성 `-c protocol.allow=never -c protocol.https.allow=always`에서 (i) `file://`·`ssh://`·`git://` remote는 오류 메시지에 **`transport '<x>' not allowed`** 를 포함하고, (ii) 죽은 로컬 포트로의 `https://127.0.0.1:<closed>/x.git`는 **`not allowed`를 포함하지 않는 연결/TLS 오류**로 실패함(=프로토콜 게이트 통과, 검증됨)을 단언. 이로써 "HTTPS가 게이트를 통과함"과 "file/ssh/git이 게이트에서 거부됨"을 서버 없이 구분한다.
  - **(B) 격리된 로컬 HTTPS Git fixture(종단 clone 성공, 주입 정책으로):** CI 재현 가능·GitHub 불필요. 테스트가 자체 서명 CA/서버 인증서를 생성하고, `git http-backend`(smart HTTP)를 감싼 **로컬 HTTPS 서버**(Node `https` + CGI, 또는 stunnel로 감싼 http-backend)를 `127.0.0.1:<임의포트>`에 띄운다.
    - **주입 정책으로 allowlist 문제 해결:** `https://127.0.0.1:<port>`는 프로덕션 allowlist(host `github.com`, 포트 443)를 통과하지 못한다. 그래서 fixture 테스트는 프로덕션 정책을 쓰지 않고 **테스트 소유의 `LoopbackTestRemotePolicy`를 어댑터에 주입**한다(§9.1 시임). 이 정책은 loopback host·임의 포트·test CA를 허용하고 `-c http.sslCAInfo=<testCA>`(sslVerify 켬)를 clone 구성에 넣는다. 프로토콜 게이트(`protocol.allow=never` + `https.allow=always`)·리다이렉트 차단·깨끗한 env·identity는 **프로덕션과 동일**하게 유지된다. 즉 URL allowlist만 테스트 정책으로 교체하고 나머지 하드닝은 실제 경로를 그대로 탄다.
    - **프로덕션 검증은 별도 단위 테스트**(위 "remote URL 검증 단위")가 `ProductionRemotePolicy`로 loopback·비443·비allowlist를 거부함을 단언한다. fixture 테스트가 프로덕션 검증을 우회하는 것이 아니라, 두 정책이 각자의 테스트에서 검증된다.
    - 자식 git이 `https://127.0.0.1:<port>/repo.git`을 clone → 전체 어댑터 경로(clone→브랜치→identity 커밋→export)를 수행 → 브랜치·커밋·내용 일치를 단언한다. 모두 localhost, 외부 네트워크 없음.
  - **테스트 소유권(정확):** `LoopbackTestRemotePolicy` 팩토리와 HTTPS fixture 구동 코드는 **테스트 전용 파일**이 소유한다 — `test/fixtures/loopbackRemotePolicy.ts`, `test/fixtures/httpsGitServer.ts`. 이들을 사용하는 어댑터 통합 테스트는 `src/server/adapters/publicBlog.test.ts`가 소유한다.
  - **fixture import 경계(정확):** 이 저장소는 테스트를 소스와 **같은 트리에 `*.test.ts`로 배치**한다(예 `src/server/adapters/publicBlog.test.ts`). 따라서 "프로덕션 소스"는 **`src/**` 에서 `**/*.test.ts` 를 제외한 파일**로 정의한다. 경계 회귀는 **`**/*.test.ts` 를 제외한 `src/**`** 어디에서도 `test/fixtures/*`·테스트 정책을 import 하지 않음을 정적으로 단언한다(테스트 파일은 당연히 import 하므로 대상에서 뺀다). 정책·어댑터 생산자인 `src/server/index.ts`, publisher 주입 경계 `src/server/app.ts`, `src/server/config.ts`, `src/server/adapters/publicBlog.ts` 등 비테스트 소스가 픽스처를 참조하지 않음이 핵심이다. (대안으로 테스트를 `src` 밖으로 재배치하면 경계가 디렉터리로 단순해진다.)
- **환경 하드닝 단위/통합:** clone/commit 자식 환경에 `GIT_CONFIG`·`GIT_CONFIG_GLOBAL/SYSTEM`·`GIT_ASKPASS`·`SSH_ASKPASS`·`GIT_PROXY_COMMAND`·`http.proxy` 등을 주입해도 무시됨(`GIT_CONFIG_NOSYSTEM=1`, 화이트리스트 env). `http.followRedirects=false` 적용 확인.
- **커밋 identity 단위/통합:**
  - identity env가 있으면 author·committer가 정확히 그 값으로 커밋됨.
  - identity env가 없으면(`user.useConfigOnly=true`) 커밋이 **실패**하고 **outbox 산출물·매니페스트가 만들어지지 않으며** 명시적 오류가 반환됨. 자동 `사용자@호스트` 추론이 발생하지 않음.
  - 매니페스트에 사용한 `author`가 기록됨.
- **어댑터 통합(Vitest, (B) HTTPS fixture + 주입 `LoopbackTestRemotePolicy`, `src/server/adapters/publicBlog.test.ts` 소유):**
  - fixture를 remote 삼아 프로덕션 하드닝 구성(프로토콜 게이트·리다이렉트 차단·깨끗한 env·identity 동일, allowlist만 테스트 정책)으로 `--depth=1` 임시 clone → 브랜치·명시 identity 커밋.
  - **두 export 형식 모두 커버(§6.3):**
    - `bundle`: export → **별도 전체 clone에서 `git bundle verify` 후 `git fetch <exportRef> content/<slug>` 성공**·내용·자산 일치.
    - `format-patch`(폴백 강제): export → **별도 전체 clone에서 `git switch -c content/<slug> <baseSha>` 후 `git am <exportRef>` 성공**·내용·자산 일치. 매니페스트·응답의 `exportFormat`/`exportRef`가 형식과 파일명을 정확히 반영.
  - **base 검사:** 매니페스트 `baseSha`가 remote가 전진한 뒤에도 `git merge-base --is-ancestor`로 조상 판정되며, base가 벗어난(force-push 재현) 경우 비조상으로 판정됨을 단언.
  - 실패·예외·타임아웃·재시작에서 임시 디렉터리가 파기되고 세션 레지스트리 항목이 제거됨. 고아 정리가 임계 나이 잔여를 제거.
  - outbox 쓰기가 원자적이고, 디렉터리 `0700`·파일 `0600`.
  - 깨끗한 워크트리·중복 브랜치 방어 검사 유지.
  - **경계 회귀:** **`**/*.test.ts` 를 제외한 `src/**`**(=프로덕션 소스)가 `test/fixtures/*`·테스트 정책을 import 하지 않음을 단언(정적 grep/의존 검사; `*.test.ts`는 대상 제외).
- **reviewId·세션 레지스트리 단위/통합(§14.2):**
  - **무작위성:** **동일한 초안·자산·base로 두 번 review하면 서로 다른 reviewId**가 나온다(=결정적 SHA가 아님). reviewId는 `randomBytes(32)` 길이·문자셋을 만족.
  - **분리 저장:** baseSha·fingerprint는 레지스트리 엔트리에 있고, reviewId에서 파생·역산되지 않는다. confirm은 재계산 fingerprint가 저장값과 일치할 때만 진행.
  - **one-time:** confirm 성공 후 같은 reviewId의 두 번째 confirm이 거부됨(엔트리 소비·제거).
  - **expiry:** `leaseExpiry` 경과 reviewId confirm이 stale로 거부되고, 만료 스윕이 해당 `cloneDir`를 파기.
  - **restart:** 프로세스 재시작 후 레지스트리가 비어 어떤 reviewId도 confirm되지 않으며(재검토 요구), 시작 스윕이 이전 clone 디렉터리를 모두 제거.
  - CSPRNG 부재 시 발행 비활성(역량 게이트) 단언.
- **config 검증 테스트:** outbox가 ②에서 `git check-ignore`로 무시되지 않으면 부팅 거부. **앱이 `.gitignore`를 수정하지 않음**(테스트가 `.gitignore` 내용 불변을 단언). identity env 누락 시 부팅/confirm 거부.
- **보안 테스트:** 비allowlist host clone 거부, remote URL 불일치·리다이렉트 거부, symlink/`..` 대상 거부, 훅/submodule 비활성.
- **API·웹 통합(얇게):** 라우트 입력 검증·오류 형태 불변. **confirm 응답이 outbox 산출물 참조**(`outboxRef`/`exportRef`/`exportFormat`/`baseSha`/`branch`/`commit`/`targetPath`)를 반환하고 영속 로컬 브랜치를 가리키지 않음. 응답에 remote URL·절대 경로·tmpfs/clone 경로·비밀이 **없음**을 두 형식(`bundle`·`format-patch`) 모두에서 단언(`src/web/api.ts` 타입·`src/server/routes/publish.ts`). `src/web/PublishReview.tsx`가 `exportFormat`에 맞는 사람 push 절차(bundle verify/fetch vs `git am`, §6.4)와 산출물 파일명만 렌더하고 서버 절대 경로·remote URL을 렌더하지 않음을 단언.
- **E2e(최소):** review가 실제 main tip 대비 diff를 보이고, confirm이 outbox 산출물을 만들며, **remote가 바뀌지 않았음**(push 없음)과 확정 전 무변경을 단언. 발행 실패 시 ② 원본 무영향.
- **배포 검증:** Compose가 digest 고정 이미지로 구성되고, ② mount+tmpfs만으로 실행되며 health ready. drain 절차 문서 예시가 실행 가능.
- CI 게이트(승계): `pnpm test && pnpm lint && pnpm format:check && pnpm build && pnpm e2e`.

---

## 15. 오류 처리

원본 파일은 실패 시에도 보존한다(NOR-143 §13 승계). clone/fetch 실패, leak 검사·스키마·변환 실패, 경로 탈출, export(bundle/patch) 실패는 **변경을 중단**하고 원인·파일·재시도 방법을 반환한다. 임시 clone은 항상 파기되고, outbox 쓰기는 원자적이라 부분 산출이 남지 않는다. 발행 실패가 ②·③(둘 다)와 사람의 push 상태를 오염시키지 않는다.
