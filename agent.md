# POSSIBLE MISSION (`agent.md`)

이 문서는 저장소의 **모든 AI 코딩 에이전트와 자동화 도구가 따르는 기본 지침(Single Source of Truth)** 입니다.
각 AI 도구 전용 설정 파일(`GEMINI.md`, `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/project.mdc`)은 이 파일을 import해 공통 규칙을 공유합니다.

## 1. 프로젝트 아키텍처
- **정적 무빌드 웹 앱**: 순수 HTML5 / CSS3 / Vanilla JS ES Modules (`./` 상대 경로, 외부 런타임 의존성 없음).
- **미니게임 = 폴더 하나**: `games/<id>/`에 `manifest.js`(로비 카드 정보), `index.js`(`mount(container, ctx)`), `settings.js`(프리셋·모드 id), `style.css`(`.game-<id>` 스코프), `index.html`(단독 실행), `assets/`가 모두 들어 있습니다. 게임 목록은 `games/registry.js`의 `GAME_IDS`가 유일한 등록 지점이며, 셸이 폴더를 읽어 동적으로 연결합니다. 공통 코드(`js/`, `styles/`)에는 게임 이름을 하드코딩하지 않습니다.
- **셸**: `index.html`, `js/app.js`(부트스트랩·URL/히스토리), `js/shell/`(로비·실행기·공통 상단바), `js/core/`(`seed.js`, `clock.js`, `setup-screen.js`, `audio.js`, `storage.js`, `rules.js`, `ui.js`, `qr.js`), `styles/`(`tokens` → `base` → `lobby` → `shell` → `components` → `setup`).
- **시드 결정성**: 모든 게임 라운드는 `createRng(\`${seed}::${gameId}::${mode}\`)`(= `ctx.rng`)에 의해 동일 시드에서 100% 재현되어야 합니다. 모드 id는 `js/core/mode-codec.js`로 인코딩하며 커스텀 값까지 id에 담습니다.
- 자세한 계약과 게임 추가 절차: [`docs/architecture.md`](./docs/architecture.md), [`docs/adding-a-game.md`](./docs/adding-a-game.md).

## 2. UI·UX 및 코드 규칙
- **디자인 스타일**: 라이트 아케이드 톤 유지, **hover/focus 시각 효과 추가 지양**, 결과 팝업 버튼(`로비`, `난이도 변경`, `재도전`) 동일 크기·가로 한 줄 배치(초소형 모바일 제외).
- **공통 레이아웃**: 상단바에는 나가기·일시정지·`전체화면 ↔ 축소하기`·`레이아웃 숨기기`(바로 옆)·⋯ 메뉴만 둡니다. **타이머·점수·진행도는 공통 영역에 두지 않고 각 미니게임이 자기 화면에 그립니다**(`js/core/clock.js`의 `bindClock`/`bindScore`).
- **게임 ↔ 셸**: 게임은 `ctx`(`onPause`, `completeGame`, `switchMode` …)로만 셸과 통신하고 공통 DOM을 직접 만지지 않습니다. 리소스는 `new URL('./…', import.meta.url)`로 참조합니다.
- **중복 금지**: 난이도 선택 화면은 `js/core/setup-screen.js`를 사용합니다. 스테이지·난이도·심볼 데이터는 레지스트리 맵(`PHOTO_SET_STAGES`, `DOBBLE_PRESETS` 등)으로 일관되게 관리합니다.
- **로비/가이드**: 게임 설명은 짧고 명확한 개조식 유지.
- **코드 정리**: 죽은 코드·미사용 export/CSS·변경 이력성 주석을 남기지 않습니다. 주석은 "왜"가 필요한 곳에만 씁니다.

## 3. 틀린그림찾기 생성형 스테이지 규칙 (필수)
- 새로운 틀린그림찾기 이미지 스테이지를 만들거나 이미지 풀을 확장할 때는 반드시 [`.agents/skills/spot-difference-stage/SKILL.md`](./.agents/skills/spot-difference-stage/SKILL.md) 절차를 따릅니다.
- **이미지 생성 모델 미지원 시 작업 금지**:
  - 현재 실행 중인 AI 에이전트에 **이미지 생성·편집 모델(또는 전용 서브에이전트/도구)** 이 없으면 작업을 시작하지 마세요.
  - SVG/Canvas 도형 그리기, CSS 변형, 기존 이미지 재활용, placeholder 이미지로 임의 대체하지 말고 사용자에게 **"이미지 생성 모델이 없어 진행할 수 없다"** 고 즉시 안내하고 중단합니다.
- **완료 전 상호 비교 검토 필수**: 제작 후 반드시 `npm run verify:spot --prefix tools/e2e`로 영역 비중복·전수 쌍 차이 갯수·이미지 간 픽셀 일치/가시성을 검증해야 합니다.

## 4. 검증 명령
```bash
# 틀린그림찾기 데이터·이미지 전수 비교 검증
npm run verify:spot --prefix tools/e2e

# 전체 Playwright E2E 회귀 테스트 (verify:spot 포함)
npm test --prefix tools/e2e
```
(Windows 환경에서 Chrome 경로 지정이 필요하면 `CHROMIUM_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'`를 설정합니다.)
