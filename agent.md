# POSSIBLE MISSION (`agent.md`)

이 문서는 저장소의 **모든 AI 코딩 에이전트와 자동화 도구가 따르는 기본 지침(Single Source of Truth)** 입니다.
각 AI 도구 전용 설정 파일(`GEMINI.md`, `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/project.mdc`)은 이 파일을 import해 공통 규칙을 공유합니다.

## 1. 프로젝트 아키텍처
- **정적 무빌드 웹 앱**: 순수 HTML5 / CSS3 / Vanilla JS ES Modules (`./` 상대 경로, 외부 런타임 의존성 없음).
- **엔트리 & 상태**: `index.html`, `js/app.js`(로비/HUD/공용 모달), `js/core/`(`seed.js`, `audio.js`, `storage.js`, `rules.js`, `ui.js`), `styles/main.css`.
- **미니게임**: `js/games/` 아래 `spot-difference.js`, `dobble.js`, `flash-anzan.js`, `memory-match.js`, `despair-fortress.js`.
- **시드 결정성**: 모든 게임 라운드는 `createRng(\`${seed}::${gameId}::${mode}\`)`에 의해 동일 시드에서 100% 재현되어야 합니다.

## 2. UI·UX 및 코드 규칙
- **디자인 스타일**: 라이트 아케이드 톤 유지, **hover/focus 시각 효과 추가 지양**, 결과 팝업 버튼(`로비`, `난이도 변경`, `재도전`) 동일 크기·가로 한 줄 배치(초소형 모바일 제외).
- **로비/가이드**: 게임 설명은 짧고 명확한 개조식 유지.
- **변형 통합**: 스테이지·난이도·심볼 데이터는 레지스트리 맵(`PHOTO_SET_STAGES`, `DOBBLE_PRESETS` 등)으로 일관되게 관리합니다.

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
