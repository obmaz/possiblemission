# POSSIBLE MISSION (가능미션) — 워크샵 미니게임 아케이드

5~100명 규모의 워크샵·팀 빌딩·온보딩 행사에서 **로그인·설치 없이 링크 하나로 바로 즐기는 정적 웹 미니게임 모음**입니다.
빌드 단계 없는 순수 HTML / CSS / ES Modules이며 GitHub Pages로 그대로 배포됩니다.

- **룸 시드 동기화**: 진행자가 시드(예: `MISSION-1`)나 링크(`?seed=…&game=…`)를 공유하면 모두가 같은 문제·카드 배치·숫자 순서로 겨룹니다. 라운드는 `createRng(`${seed}::${gameId}::${mode}`)`로 만들어져 같은 시드에서 100% 재현됩니다.
- **서버 없음**: 기록·닉네임·마지막 난이도는 브라우저(`localStorage`)에만 저장됩니다.
- **16:9 캐비닛**: 900px 이상 화면에서는 모든 게임이 같은 16:9 프레임에서 동일하게 보이고, 작은 화면은 세로 플로우로 바뀝니다.
- **화면 도구**: 게임 화면 상단에 `전체화면 ↔ 축소하기` 버튼과 그 옆 `레이아웃 숨기기` 버튼이 있습니다. 숨기면 공통 상단바가 얇은 띠로 접혀 게임이 더 크게 보입니다. 타이머·점수는 공통 영역이 아니라 **각 미니게임 안에** 있습니다.

---

## 미니게임

| 폴더 | 게임 | 방식 | 한 줄 설명 |
| --- | --- | --- | --- |
| `games/spot-difference` | 틀린그림찾기 | 혼자 | 좌우 그림의 다른 곳을 찾기(카페 20장 조합·캠프, 쉬움 5곳 ~ 어려움 9곳) |
| `games/dobble` | 도블 스피드 매치 | 혼자 | 두 원형 카드에서 딱 하나 겹치는 그림 찾기(카드당 6~17개) |
| `games/flash-anzan` | 플래시 암산 | 혼자 / 다같이 | 번쩍이는 숫자를 머릿속으로 더해 합계 맞히기 |
| `games/memory-match` | 메모리 매치 | 혼자 | 2초 암기 후 같은 짝 찾기(6·8·12쌍) |
| `games/hide-seek` | 숫자 숨바꼭질 | 혼자 | 타일 뒤에 숨은 숫자를 찾아 그 타일의 글자 입력 |
| `games/color-trap` | 컬러 트랩 | 혼자 / 다같이 | 글자의 색깔과 뜻의 함정 피하기 |
| `games/pixel-reveal` | 모자이크 줌아웃 | 혼자 / 다같이 | 서서히 선명해지는 그림의 정체 맞히기(100장) |
| `games/flash-count` | 찰나의 카운팅 | 혼자 / 다같이 | 잠깐 뜬 아이콘의 개수 기억하기 |

---

## 프로젝트 구조

핵심 아이디어: **미니게임 하나 = 폴더 하나.** 게임에 필요한 코드·스타일·이미지·설정이 모두 `games/<id>/` 안에 있고, 메인(셸)은 폴더 목록을 읽어 로비와 실행 화면에 동적으로 연결합니다.

```
possiblemission/
├─ index.html              앱 셸 엔트리 (로비 + 게임 화면 + 모달 레이어)
├─ games/                  ── 미니게임 (폴더 단위로 자기완결)
│  ├─ registry.js          게임 폴더 id 목록 (게임 추가 시 수정하는 유일한 파일)
│  └─ <id>/
│     ├─ manifest.js       로비 카드 정보(제목·태그·인원·시간·카드 그림) + modeLabel()
│     ├─ index.js          mount(container, ctx) → { unmount(), idle? }
│     ├─ settings.js       난이도 필드·프리셋 선언 + 모드 id 코덱 (manifest와 게임이 공유; 틀린그림찾기는 stages.js)
│     ├─ style.css         .game-<id> 아래로 스코프된 스타일 + 로비 카드 그림
│     ├─ index.html        이 게임만 단독 실행하는 페이지
│     └─ assets/, symbols.js …  게임 전용 리소스
├─ js/
│  ├─ app.js               부트스트랩 · URL/히스토리 동기화
│  ├─ standalone.js        게임 단독 페이지 엔트리
│  ├─ shell/               앱 셸 (로비·실행기·상단바·모달)
│  │  ├─ registry.js       games/registry.js를 읽어 manifest·style.css 로드, index.js는 실행 시 지연 import
│  │  ├─ runner.js         ctx 생성, mount/unmount, 3·2·1 카운트다운, 일시정지, 결과 팝업
│  │  ├─ game-view.js      공통 상단바(나가기·일시정지·전체화면·레이아웃 숨기기·⋯ 메뉴)
│  │  ├─ lobby.js          히어로·닉네임/룸 시드 폼·게임 카드 목록
│  │  └─ room.js, fullscreen.js, sound.js, host-modals.js, result-modal.js
│  └─ core/                게임이 공유하는 라이브러리 (UI 없음/최소)
│     ├─ seed.js           FNV-1a + Mulberry32 시드 RNG, 셔플/분산 선택
│     ├─ clock.js          타이머·점수 표시 갱신 도우미(DOM은 각 게임이 소유)
│     ├─ mode-codec.js     프리셋/커스텀/다같이 모드 id 인코딩·파싱·라벨
│     ├─ setup-screen.js   난이도 선택 화면 공통 컴포넌트
│     ├─ audio.js, storage.js, ui.js(토스트·컨페티·모달), qr.js, rules.js, dom.js
├─ styles/                 공통 스타일: tokens → base → lobby → shell → components → setup
├─ assets/hero-arcade.jpg  로비 배너
├─ tools/e2e/              Playwright 검증 (verify-spot-sets.mjs, play.mjs)
├─ docs/                   아키텍처·게임 추가 가이드
└─ .agents/skills/spot-difference-stage/   틀린그림찾기 스테이지 제작 스킬
```

### 셸과 게임의 계약

게임은 `mount(container, ctx)`를 내보내고 `{ unmount() }`를 돌려줍니다. 셸이 주는 `ctx`는 아래와 같습니다. (자세한 내용은 [docs/architecture.md](./docs/architecture.md))

| `ctx` | 설명 |
| --- | --- |
| `seed`, `mode`, `rng` | 룸 시드, 모드 id, `createRng(seed::gameId::mode)` |
| `player` | 닉네임·팀 |
| `onPause(fn)` | 일시정지/재개 구독(탭 이탈·카운트다운 포함), 해제 함수 반환 |
| `completeGame({ score, timeMs, cleared, details })` | 결과 팝업·최고 기록 갱신 |
| `switchMode(mode)` / `exitToHub()` | 같은 게임을 다른 모드로 다시 시작 / 로비로 |
| `audio`, `ui`, `storage` | 효과음, 토스트·컨페티, 기기 저장소 |

---

## 실행

ES Modules를 쓰므로 정적 서버가 필요합니다.

```bash
python3 -m http.server 8080
# 전체 아케이드:  http://127.0.0.1:8080/
# 한 게임만:      http://127.0.0.1:8080/games/dobble/index.html?seed=ROUND-1&mode=easy
# 딥링크:         http://127.0.0.1:8080/?seed=ROUND-1&game=dobble&mode=easy
```

## 테스트

```bash
cd tools/e2e && npm install
npm run verify:spot      # 틀린그림찾기 이미지·영역·쌍별 차이 전수 검증
npm test                 # verify:spot + 전체 플레이 E2E (모든 게임 완주, 공통 화면 도구, 레지스트리, 단독 페이지)
```

설치된 Chromium을 쓰려면 `CHROMIUM_PATH`를 지정합니다.

## 배포

`main` 브랜치 루트(`/`)를 GitHub Pages로 서빙합니다(`.nojekyll` 포함). 모든 경로는 상대 경로이므로 서브패스(`https://<user>.github.io/<repo>/`)에서도 동작합니다.

## 개발 규칙

- 새 게임·스타일은 폴더 안에서 끝낸다. 공통 코드(`js/`, `styles/`)에는 게임 이름이 나오지 않는다.
- 게임 CSS는 `.game-<id>` 아래로 스코프하고 `@keyframes`에 게임 접두사를 붙인다. hover/focus 시각 효과는 추가하지 않는다.
- 타이머·점수·진행 표시는 각 게임이 자기 화면에 그린다(`js/core/clock.js` 사용 가능).
- 틀린그림찾기 새 이미지 스테이지는 [스킬 문서](./.agents/skills/spot-difference-stage/SKILL.md)의 절차와 `npm run verify:spot` 통과가 필수다.
- AI 코딩 에이전트 공통 지침은 [agent.md](./agent.md)에 있다.
