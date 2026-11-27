# 코드·용어 컨벤션 (`docs/conventions.md`)

모든 미니게임(`games/<id>/`)은 아래 표준 용어와 코드 패턴을 따릅니다. 새 게임을 추가하거나 기존 게임을 수정할 때 게임마다 같은 개념을 다르게 부르지 않도록 이 문서를 기준으로 삼습니다.

## 1. 핵심 용어 사전 (Glossary)

| 개념 | 표준 키 / 변수명 | 표준 값 / 표기 | 비고 |
| --- | --- | --- | --- |
| 플레이 방식 (데이터) | `play` | `0` (혼자) · `1` (다같이) | `fields`의 첫 번째 항목(`key: 'play'`) |
| 다같이 모드 여부 (코드) | `isParty` | `boolean` (`settings.play === 1`) | CSS 상태 클래스는 `.is-party` |
| 다같이 모드 (UI 라벨) | `혼자 (...)` / `다같이 (...)` | 예: `혼자 (선택지)` · `다같이 (한 화면)` | `setup-screen.js`의 `playSwitch` 사용 |
| 난이도 프리셋 ID | `id` | `'easy'` · `'medium'` · `'hard'` (필수) | 확장 시 `'extreme'`, `'insane'`, `'god'` |
| 난이도 프리셋 라벨 | `label` / `ko` | `'EASY'`/`'쉬움'`, `'MEDIUM'`/`'보통'`, `'HARD'`/`'어려움'` | 기본 프리셋(`*_DEFAULT_PRESET`)은 `'medium'` |
| 모드 ID | `mode` | `'setup'` · `'<preset>'` · `'<preset>-party'` · `'custom-...'` | URL `?mode=` 및 `ctx.rng` 시드에 사용 |
| 마지막 설정 저장 키 | `LAST_MODE_PREF` | `'<camelCase>LastMode'` | `ctx.storage.getPref/setPref` 사용 |
| 룸 시드 | `seed` | 대문자 `[A-Z0-9-_]`, 기본 `'MISSION-1'` | 같은 시드·모드 = 100% 동일 문제 |

## 2. 파일·심볼 네이밍 (`games/<id>/`)

- **`manifest.js`**:
  - `players`: `'solo' | 'both' | 'party'`
  - `defaultMode`: `*_SETUP_MODE` (`'setup'`)
  - `modeLabel`: `settings.js`의 `*ModeLabel` 함수 연결
- **`settings.js`** (틀린그림찾기는 `stages.js`):
  - 상수: `<GAME>_SETUP_MODE = 'setup'`, `<GAME>_FIELDS`, `<GAME>_PRESETS`, `<GAME>_DEFAULT_PRESET = 'medium'`
  - 함수: `createModeCodec` 기반 `match<Game>Preset`, `<game>ModeId`, `parse<Game>Mode`, `<game>ModeLabel`
- **`index.js`**:
  - 진입점: `export function mount(container, ctx)`
  - 설정 화면: `mountSetup(container, ctx)` (`mountSetupScreen` 호출, `{ idle: true }` 반환)
  - 본게임: `mountGame(container, ctx, settings)` (`const isParty = settings.play === 1;`)
  - 종료 보고: `ctx.completeGame({ score, timeMs, cleared, modeLabel, details })`
    - `details`는 최대 4개 칩이며 `{ value: '<이모지> <값><단위>' }` 형식(예: `⏱ 12.3초`, `❌ 오답 0회`).
- **`style.css`**:
  - 루트 요소 클래스: `.game-root.game-<id>` (다같이 모드 활성 시 `.is-party` 추가)
  - 모든 셀렉터는 `.game-<id>` 아래로 스코프하고, `@keyframes`는 게임별 고유 접두사(`ct-`, `db-`, `fa-`, `fc-`, `df-`, `mm-`, `pr-`, `sd-`)를 사용합니다.

## 3. UI·레이아웃 불변 규칙

- **설정 화면**: 반드시 `js/core/setup-screen.js`와 `styles/setup.css`를 사용합니다(독자 난이도/플레이 방식 UI 금지).
- **타이머·점수**: 공통 상단바(`#game-hud`)에 두지 않고 게임 내부 `.pm-timer` / `.pm-score`와 `bindClock` / `bindScore`로 그립니다.
- **상단바·스테이지 너비**: 데스크톱(`>= 900px`)에서 `#game-hud`와 `.game-stage > .game-root`는 `--stage-w`로 같은 너비를 유지합니다.
- **결과 팝업**: `ctx.completeGame()`만 사용하며 `.result-*` 레이아웃과 버튼(`로비`·`난이도 변경`·`재도전`) 패딩·여백을 오버라이드하지 않습니다.
- **시각 효과**: hover/focus 시각 효과를 추가하지 않습니다.
