# POSSIBLE MISSION (`가능미션`) — Agent Handoff & Continuation Guide

작성 시점: 2026-11-25  
현재 브랜치: `main` (단일 브랜치 전략)  
문서 목적: 다음 AI 에이전트(또는 개발자)가 별도 컨텍스트 손실 없이 즉시 이어서 리뷰·디버깅·E2E 검증·고도화를 수행할 수 있도록 게임 개념, 디자인 컨셉, 코드 구조, 현재 완료/미완료 상태 및 구체적 TODO를 기록합니다.

---

## 1. 프로젝트 비전 & 핵심 컨셉

### 1.1 타겟 & 목적
- **대상**: 5~100명이 동시에 참여하는 **회사 워크샵 / 팀 빌딩 / 아이스브레이킹** 이벤트.
- **핵심 가치**: "링크 하나 열면 1초 만에 바로 시작, 60~90초 만에 짜릿하게 끝나는 가볍고 팬시한 아케이드."
- **인프라 제약**: **100% 정적 웹(GitHub Pages, `main` 브랜치 root `/`)**. 백엔드, 데이터베이스, 번들러(Vite/Webpack), 외부 JS 패키지 설치 없음.
- **무서버 동시성(Zero-Backend Sync) 전략**:
  - `js/core/seed.js`의 FNV-1a 해시 + Mulberry32 PRNG(`createRng(seed)`)를 통해 **동일한 룸 시드(예: `MISSION-1`)**를 입력한 5~100명 모두가 완전히 동일한 퍼즐/카드/노드 배치를 받습니다.
  - `?seed=MISSION-1&game=despair-fortress&mode=standard` 형태의 URL 파라미터 동기화와 QR/링크 복사, 그리고 클리어 후 **Slack/카카오톡 붙여넣기용 결과 카드 복사**로 백엔드 없이도 즉석 랭킹 경쟁이 가능합니다.

### 1.2 비주얼 & 사운드 컨셉
- **테마**: **Midnight Neon Party Arcade**
  - 바탕색: `#070914` (Midnight Obsidian) + 글래스모피즘(`rgba(16, 22, 48, 0.72)`, `backdrop-filter: blur(16px)`).
  - 네온 포인트 컬러: Cyan(`#22d3ee`, 숨은그림찾기), Magenta(`#f43f8e`, 틀린그림찾기), Violet(`#a855f7`, 메모리 매치), Crimson(`#ef4444`, 절망요새), Gold(`#fbbf24`, 랭크 S/시드), Emerald(`#34d399`, 성공/연결).
  - 생성형 커스텀 아트워크(`assets/images/*.jpg`)를 각 허브 배너 및 스테이지 배경으로 사용하고, UI/소품/카드/노드는 선명한 벡터 SVG 및 HTML5 Canvas로 결합해 **해상도·히트박스 정확도·심미성**을 모두 확보했습니다.
- **사운드**: `js/core/audio.js`의 순수 Web Audio API 신디사이저(외부 mp3 없이 클릭/플립/매치 콤보 상승음/오답 버저/힌트/알람/클리어 팡파레 합성 + 음소거 저장).

---

## 2. 아키텍처 & 파일 소유권 요약

자세한 계약 명세는 [`DESIGN_SPEC.md`](./DESIGN_SPEC.md)를 단일 진실 공급원(Single Source of Truth)으로 참조하세요.

- **진입점 & 스타일**: `index.html`, `styles/main.css`
- **코어 엔진 (`js/core/`)**:
  - `seed.js`: `hashSeed`, `createRng`, `pickSeeded`, `shuffleSeeded`
  - `audio.js`: Web Audio SFX + mute 상태 저장
  - `storage.js`: `localStorage` 기반 플레이어 닉네임/팀, 게임+모드별 최고 기록, 시드 이력
  - `ui.js`: 토스트, 컨페티, S/A/B/C 랭크 산출, Slack/카톡 결과 포맷터, 모달, QR 매트릭스 생성기
  - `js/app.js`: 로비/게임 뷰 전환, 동적 모듈 로더(`./games/<id>.js`), HUD 제어 및 `ctx` 주입
- **게임 모듈 계약**: 모든 게임은 `export function mount(container, ctx)`를 내보내고 `{ unmount() }`를 반환해야 합니다.
  - 게임 CSS는 반드시 `.game-hidden`, `.game-spot`, `.game-memory`, `.game-fortress` 하위에 스코핑하고 `@keyframes` 접두사(`ho-`, `sd-`, `mm-`, `df-`)를 지킵니다.
  - 모든 경로는 GitHub Pages 서브패스(`https://<user>.github.io/<repo>/`) 호환을 위해 **반드시 `./` 상대 경로**만 사용합니다.

---

## 3. 4대 미니게임 개념 및 현재 구현/검독 상태

| 게임 | 파일 | 현재 상태 | 핵심 게임 개념 & 메카닉 |
| :--- | :--- | :--- | :--- |
| **코어 아케이드 허브** | `index.html`, `styles/main.css`, `js/app.js`, `js/core/*` | **완료 (3인 검독 3차 통과 & 커밋됨)** | 로비 히어로 배너, 닉네임/팀 설정, 룸 시드 & QR/링크 공유, MC 가이드 모달, 로컬 명예의 전당, 공통 상단 HUD, 결과 모달 & 컨페티 |
| **1. 숨은그림찾기** (`hidden-object`) | `js/games/hidden-object.js`, `styles/game-hidden.css` | **초기 구현 + R1 수정 완료 (R2 검독 대기/필요)** | 2개 스테이지(`hidden-workshop.jpg` 오피스, `hidden-space.jpg` 궤도 천문대), 18종 커스텀 SVG 소품 & 스테이지당 20개 앵커 포인트, 시드 기반 7개(`normal`)/10개(`hard`) 배치, 돋보기 2.0x 루페, 1.6x 줌/팬, 2회 힌트, 오답 +3초 페널티 |
| **2. 틀린그림찾기** (`spot-difference`) | `js/games/spot-difference.js`, `styles/game-spot.css` | **초기 구현 완료 (검독 R1 미실시)** | 2개 스테이지(`spot-cafe.jpg` 디저트 카페, `spot-camp.jpg` 캠핑장), 좌/우 동기화 듀얼 `<canvas>`(1200x896), 스테이지당 10개 결정론적 시각 변형 후보 중 시드별 6개/8개 활성화, 한쪽 터치 시 양쪽 동시 링 표시, 2회 힌트 |
| **3. 네온 메모리 매치** (`memory-match`) | `js/games/memory-match.js`, `styles/game-memory.css` | **초기 구현 + R1 수정 완료 (R2 검독 대기/필요)** | `4x3`(6쌍), `4x4`(8쌍), `6x4`(12쌍) 덱, 12종 커스텀 벡터 아케이드 아이콘, 시작 시 2초 프리뷰 플래시, 3D 카드 플립, 연속 매칭 콤보 배율(`x1, x2, x3...`), 650ms 미스매치 락 |
| **4. 절망요새 숨바꼭질** (`despair-fortress`) | `js/games/despair-fortress.js`, `styles/game-fortress.css` | **초기 구현 + R1 검독 완료 (R1 수정 미완성 — 아래 상세 이슈 참조)** | 후지큐 하이랜드 절망요새 모티브! `fortress-bg.jpg` 배경 위 3개 보안 섹터 진행. **알파벳-숫자 쌍 노드**가 화면에 떠다니다가 카운트다운 후 **숫자가 깜빡이며 사라지고 알파벳만 남음** → 터미널이 **목표 숫자 3개**를 순서대로 제시하면 알파벳 노드를 클릭하거나 키보드/키패드로 해당 알파벳 3개를 입력해 돌파 |

---

## 4. 다음 에이전트가 바로 해야 할 일 (우선순위 TODO)

### P0. `despair-fortress` (절망요새 숨바꼭질) R1 리뷰 결함 수정 (가장 먼저!)
이전 R1 3인 검독자(`PD`, `디자이너`, `시니어 QA`)가 다음 구조적 결함을 발견했고, Fix Pass가 중단되었습니다. `js/games/despair-fortress.js` 및 `styles/game-fortress.css`를 열어 아래 항목을 확인·수정하세요:
1. **Canvas 리사이즈 동기화**: `window.resize`만 의존하지 말고 `ResizeObserver`를 arena 컨테이너에 붙여 키패드 토글이나 모바일 뷰포트 변화 시 캔버스 내부 좌표와 실제 렌더 박스 크기가 어긋나지 않도록 수정.
2. **모바일 레이아웃 겹침 및 뷰포트 클리핑**: `styles/game-fortress.css`에서 `.df-telemetry`(`top: 10px`)와 상단 배너가 390px 모바일 폭에서 겹치는 문제, 긴 알림 텍스트 넘침, 세로 높이 초과로 키패드가 잘리는 현상 수정(모바일에서는 flex/flow 배치 또는 여백 확보).
3. **노드 충돌 속도 0 고정 버그 및 디코이/타이머 엣지 케이스**:
   - 탄성 충돌 계산 시 속도 벡터가 `(0, 0)`으로 떨어졌을 때 최소 속도 보정 fallback이 누락되어 노드가 영구 정지할 수 있는 문제 해결.
   - 디코이 점멸 대상 필터링에서 실제 정답 타겟 노드가 제외되도록 보장(정답 노드에 경고 링이 뜨는 문제 방지).
   - 패배/종료 직후 잔여 타이머·알람 콜백이 중복 실행되지 않도록 상태 가드 철저히 적용.

### P1. `spot-difference` (틀린그림찾기) 전체 검독 및 좌표/시각 차이 실측
1. `js/games/spot-difference.js`가 1,820줄 규모로 초안 구현되어 있으나 아직 리뷰 라운드를 거치지 않았습니다.
2. 실제 로컬 서버 + 헤드리스 브라우저(Chrome/Playwright)로 `spot-cafe.jpg`, `spot-camp.jpg` 위 Modified 캔버스 렌더링을 스크린샷으로 찍어 **10개 x 2스테이지 = 20개 차이점이 육안으로 명확히 구분되는지, 배경과 어색하지 않은지, 터치 히트박스가 정확한지** 검증하세요.
3. 모바일(390px)에서 원본/수정본 두 캔버스 비교 UX(세로 스택 + 빠른 전환 탭 또는 스와이프)가 스크롤 피로 없이 매끄러운지 점검하세요.

### P2. `hidden-object` & `memory-match` R2 최종 검독 통과
- 두 게임 모두 R1 이슈 수정이 완료되었으나 R2 재검독 중 중단되었습니다.
- 각각 실제 브라우저에서 플레이테스트하여 R1 수정사항(숨은그림찾기 발견 시 `(0,0)` 순간이동 애니메이션 버그 수정 여부, 메모리 매치 390px 탑바 오버플로우 및 터치 타겟 크기 수정 여부)이 완전히 해결되었는지 확인하세요.

### P3. 통합 E2E 브라우저 테스트 (Desktop 1280px + Mobile 390px)
- 로컬 HTTP 서버(`python3 -m http.server 8080`) 띄운 뒤 Playwright 또는 Chrome DevTools로:
  1. 로비 로드 시 Console Error / Page Error / 404 리소스 **0건** 확인.
  2. 룸 시드(`MISSION-1`) 적용 → URL 쿼리 반영 → 4개 게임 각각 진입 → 실제 플레이 및 클리어(또는 테스트 헬퍼로 완료 플로우 확인) → 결과 모달 S/A/B/C 랭크 및 **Slack/카톡 결과 복사** 동작 확인.
  3. 게임 중 `로비로` 복귀 시 타이머·RAF·`keydown` 리스너 누수 없음 확인.

### P4. 마무리 커밋 & 푸시
- 각 게임 검독 통과 후 `main` 브랜치에 정리 커밋 후 `git push origin main` 실행.
- 실제 `https://obmaz.github.io/possiblemission/` 배포 페이지에서도 동일하게 동작하는지 최종 확인.
