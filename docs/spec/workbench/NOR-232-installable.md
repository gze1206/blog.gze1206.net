# NOR-232 — 워크벤치를 앱처럼 설치하고 짧은 주소로 열기

- 출처: 사용자 요청(2026-11-21). 결정: Tailnet 경계(ADR 0016)는 그대로 두고 앱처럼 쓴다.

## 현재

- 주소는 `https://<호스트>.<tailnet>.ts.net:8443` 이다. 포트가 붙고 호스트 이름이 드러난다.
- 443 은 공용 edge Caddy(docker-proxy)가 갖는다. Docker 의 NAT 규칙이 이 호스트로 오는 443 을 모두
  Caddy 컨테이너로 돌리므로, 노드 주소의 443 에 Tailscale Serve 를 붙일 수 없다.
- favicon·manifest 가 없어 탭과 Dock 에서 알아보기 어렵다.

## 결정

| 항목      | 결정                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| 설치      | Web App Manifest 와 아이콘(192·512, maskable 512, Apple 180)을 둔다. `start_url`·`scope` 는 `/` 다          |
| 오프라인  | service worker 는 두지 않는다. 작성 도구가 오래된 화면을 보여 주면 글을 덮어쓸 수 있다                      |
| 아이콘    | 블로그 노루 마크를 짙은 타일에 얹어 블로그 탭과 구별한다                                                    |
| 짧은 주소 | Tailscale Services 의 `svc:workbench`(전용 VIP, 443)를 쓴다. 노드 주소가 아니라 Docker NAT 와 겹치지 않는다 |
| 전환      | 새 주소가 동작하는 것을 확인할 때까지 8443 을 남긴다                                                        |

## 수용 기준

- **AC-1** manifest 는 이름·짧은 이름·`start_url`·`scope`·`display: standalone`·테마 색을 갖고, 아이콘 192·512(any)와 512(maskable)를 가리킨다. 가리키는 PNG 는 모두 있고 크기가 선언과 같다.
- **AC-2** `index.html` 은 manifest·SVG 아이콘·180px Apple 아이콘·라이트/다크 `theme-color` 를 연결한다.
- **AC-3** service worker 를 등록하지 않는다.
- **AC-4** 운영 문서에 Tailscale Services 로 옮기는 절차(소유자 작업과 호스트 작업)와 되돌리는 법이 있다.
