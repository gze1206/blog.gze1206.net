# CMS 원격 작성과 안전한 발행

> 상태: 외부 인증·배포·실기기 승인은 아직 완료하지 않았다. 이 문서는 그 작업을 재현할 운영 절차이며,
> 배포 완료 증거가 아니다.

Keystatic은 GitHub 저장소를 콘텐츠 원본으로 사용한다. 공개 블로그는 정적으로 prerender하고, 편집 UI와
`/api/keystatic/*`만 Cloudflare Worker에서 실행한다. 따라서 작성자는 검토 가능한 콘텐츠 브랜치에서
작업하고, 공개는 검토 뒤 `v4` 병합으로만 이뤄진다.

## 사전 조건

- 소유자 GitHub 계정만 접근하도록 Cloudflare Access를 `/keystatic*`, `/api/keystatic*` 앞에 설정한다.
- GitHub App은 `gze1206/blog.gze1206.net` 단일 저장소에만 설치하고 Contents 읽기/쓰기 권한만 부여한다.
  설치 범위에서 **All repositories를 선택하지 않는다**. OAuth callback은 Worker의
  `/keystatic/api/github/oauth/callback` 경로로 제한한다.
- `.env.example`의 네 값은 이름만 공유하는 템플릿이다. 실제 값은 저장소·커밋·이슈·문서에 넣지 않고,
  Cloudflare Worker의 암호화된 비밀값/환경 변수에만 등록한다.
- 콘텐츠 브랜치의 Cloudflare preview가 준비돼 있어야 한다. preview가 없거나 인증이 실패하면 저장하거나
  공개하지 말고 원인을 해결한다.

## 작성에서 미리보기까지

1. `v4` 최신 상태에서 `content/<짧은-슬러그>` 브랜치를 만든다. 아직 공개하지 않을 글은 반드시
   `draft: true`로 시작한다.
2. Access 인증 뒤 해당 브랜치의 `/keystatic`을 열고 GitHub 인증을 완료한다. 관리자 화면은 인증이
   실패하거나 환경 변수가 없을 때 콘텐츠를 저장하면 안 된다.
3. 글은 `posts` 컬렉션에서 작성한다. 제목·설명·슬러그·카테고리·태그·발행일·수정일을 채우고, 시리즈와
   시리즈 순서는 둘 다 채우거나 둘 다 비운다.
4. 본문에는 필요할 때만 북마크, GitHub 카드, 콜아웃 블럭을 넣는다. 이미지는 편집기에서 올려
   `public/uploads/`와 `/uploads/` 공개 경로 규칙을 따른다. 이미지 대체 텍스트와 저작권/사용 권한은
   발행 전에 확인한다.
5. 저장 후 GitHub 브랜치의 변경 파일을 확인한다. 생성된 `.mdoc`과 업로드 파일 이외의 예상 밖 변경,
   비밀값, 인증 정보가 있으면 커밋하지 않는다.
6. 해당 브랜치의 Cloudflare preview에서 글, 세 커스텀 블럭, 이미지, 링크, 라이트/다크 모드와 모바일
   화면을 확인한다. `draft: true` 글은 `v4` 공개 빌드·RSS·사이트맵·검색 결과에 포함되면 안 된다.

## 검토와 발행

1. 콘텐츠 브랜치에서 변경을 검토하고 프로젝트 검증을 통과시킨다. 최소한 `pnpm lint`,
   `pnpm format:check`, `pnpm build`를 실행한다.
2. preview가 정상이고 검토가 끝난 뒤에만 PR을 `v4`로 연다. 초안은 `draft: true`인 상태로 병합해도
   공개 목록에 나타나지 않는다.
3. 발행할 글은 검토 브랜치에서 `draft: false`로 바꾸고, 다시 preview와 빌드를 확인한 뒤 `v4`에
   병합한다. `v4`가 배포 대상이라는 확인 없이 `master`에 직접 병합하지 않는다.
4. 공개 배포가 끝난 뒤에만 실제 공개 페이지, RSS, 사이트맵, 검색 색인을 확인하고 그 결과를
   `docs/release-readiness.md`와 NOR-20 Linear 댓글에 기록한다. URL·응답·기기 정보는 실제 검증 후에만
   기록하며 토큰·클라이언트 비밀값·쿠키는 어떤 경우에도 기록하지 않는다.

## 현재 보류된 승인 경로

- Cloudflare Access와 GitHub App의 실제 구성
- Worker 환경 변수/비밀값 등록과 배포
- 휴대기기 인증, 이미지 업로드, branch preview 렌더의 실기기 확인
- `draft` 제외와 발행 뒤 RSS·사이트맵·검색 색인의 공개 환경 확인

위 항목의 실제 증거가 남기 전까지 NOR-20은 완료가 아니다. 세부 구현 및 검증 기준은
[NOR-20 명세](../spec/NOR-20-keystatic-web-editor.md), 전체 외부 전환 순서는
[릴리스 전환 체크리스트](../release-readiness.md)를 따른다.
