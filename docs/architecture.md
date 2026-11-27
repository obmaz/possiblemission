# 아키텍처

정적·무빌드 웹 앱입니다. 앱 셸(`js/`, `styles/`, `index.html`)은 게임을 몰라도 되고, 각 게임(`games/<id>/`)은 폴더 안에서 완결됩니다.

## 1. 로딩 순서

1. `index.html`이 공통 스타일(`tokens → base → lobby → shell → components → setup`)과 `js/app.js`를 불러옵니다.
2. `js/shell/registry.js`가 `games/registry.js`의 `GAME_IDS`를 읽고, 각 폴더의 `manifest.js`(import)와 `style.css`(`<link>` 삽입)를 병렬로 로드합니다. 한 게임이 실패해도 나머지 로비는 뜹니다.
3. `js/shell/lobby.js`가 manifest로 게임 카드를 만듭니다.
4. 카드의 시작하기를 누르면 `js/shell/runner.js`가 `games/<id>/index.js`를 **그때** `import()`해 `mount()`합니다.

`games/<id>/index.html`은 같은 `runner`를 `js/standalone.js`로 단독 실행합니다(로비 없음, 상단바는 전체화면·로비 링크만 남긴 얇은 띠).

## 2. 셸 모듈

| 모듈 | 역할 |
| --- | --- |
| `app.js` | 부트스트랩, `?seed=&game=&mode=` ↔ 주소창, 브라우저 뒤로가기 = 로비 복귀 |
| `shell/registry.js` | 게임 발견·로딩, 모드 검증(`resolveMode`), 옛 id 별칭 |
| `shell/runner.js` | `ctx` 생성, mount/unmount, 3·2·1 카운트다운, 일시정지 커튼, 결과 팝업 |
| `shell/game-view.js` | 공통 상단바와 `레이아웃 숨기기`, 나가기 확인 |
| `shell/lobby.js` | 히어로·프로필/룸 시드 폼·카드 목록 |
| `shell/room.js` | 룸 시드 저장소(변경 구독) |
| `shell/screen-mode.js` | `[data-fullscreen-toggle]` 버튼 전체화면 ↔ 축소하기 (미지원 브라우저에서는 숨김) |
| `shell/sound.js`, `host-modals.js`, `result-modal.js` | 음소거, QR·MC 가이드, 결과 팝업 |

공통 상단바에는 **타이머·점수·진행도가 없습니다.** 그 값은 각 게임의 화면에 있습니다.

## 3. 게임 폴더 계약

```
games/<id>/
  manifest.js   export default { title, accent, tag, players, timeHint, summary,
                                 defaultMode, modeLabel(modeId) → string('' = 잘못된 id), cardArt }
  index.js      export function mount(container, ctx) → { unmount(), idle? }
  style.css     .game-<id> 스코프, @keyframes 접두사, 로비 카드 그림(.game-card__…-art)
  index.html    단독 실행 페이지 (body[data-game="<id>"])
```

- `id`는 폴더 이름이며 URL(`?game=<id>`)과 RNG 시드 문자열에 쓰입니다.
- `idle: true`를 돌려주면 난이도 선택·그림 선택 같은 **선택 화면**으로 취급되어 카운트다운·일시정지·나가기 확인이 없습니다.
- `unmount()`는 이벤트 리스너·타이머·rAF를 정리합니다. 스테이지 비우기는 실행기가 합니다.
- 모드 id는 `settings.js`가 `js/core/mode-codec.js`로 인코딩/파싱합니다. 공유 링크가 같은 문제를 재현하도록 **커스텀 값도 id에 담습니다**(`setup` · `<프리셋>` · `<프리셋>-party` · `custom-<필드 순서대로 정수>`).

### `ctx`

| 필드 | 설명 |
| --- | --- |
| `seed`, `mode`, `player`, `rng` | 룸 시드 · 현재 모드 id · `{ nickname, team }` · `createRng(`${seed}::${gameId}::${mode}`)` |
| `onPause(fn)` | `fn(paused: boolean)`. 일시정지 버튼·탭 이탈·시작 카운트다운(게임은 mount 직후 `paused=true`를 받고 `Go!`에서 `false`를 받음). 해제 함수 반환 |
| `completeGame({ score, timeMs, cleared, modeLabel?, details? })` | 결과 팝업, 최고 기록 갱신, 컨페티/효과음. `details`는 `{ value }` 칩 최대 4개 |
| `switchMode(mode)` | 같은 게임을 다른 모드로 다시 시작(선택 화면 → 본게임) |
| `exitToHub()` | 로비로 |
| `audio`, `ui`, `storage` | `core/audio.js`, `core/ui.js`(토스트 등), `core/storage.js`(`getPref/setPref`) |

게임이 사용하는 시간은 게임 자신의 시계(`requestAnimationFrame` 누적, 일시정지 중 정지)여야 합니다. 프레임 간격은 120ms로 잘라 탭 복귀 때 시간이 한꺼번에 줄지 않게 합니다.

## 4. 공통 코드(`js/core`)

| 모듈 | 내용 |
| --- | --- |
| `seed.js` | `createRng`(FNV-1a 해시 + Mulberry32), `shuffleSeeded`, `pickSeeded`, `pickDispersed` |
| `clock.js` | `bindClock(el)` / `bindScore(el)`: 값이 바뀔 때만 DOM을 쓰는 타이머·점수 갱신 함수 생성(`.pm-timer[data-state]`, `.pm-score` 스타일은 `styles/components.css`) |
| `mode-codec.js` | 설정형 게임의 모드 id 코덱(`matchPreset`·`modeId`·`parse`·`label`). 게임은 필드·프리셋만 선언 |
| `setup-screen.js` | 프리셋 카드 + 스테퍼 + (선택) 혼자/다같이 스위치 + 시작 버튼. 게임이 프리셋·필드·모드 코덱을 넘김. `styles/setup.css`와 한 쌍 |
| `rules.js` | 공정성 상수: 오답 후 입력 잠금 `WRONG_INPUT_COOLDOWN_MS`, 터치 여유 `TOUCH_HIT_SLOP` |
| `storage.js` | 프로필, 최고 기록, 시드 이력, 음소거, 게임별 선호값(메모리 폴백 포함) |
| `ui.js`, `qr.js`, `audio.js`, `dom.js` | 토스트·컨페티·모달, QR 인코더, 효과음 합성, `escapeHtml` |

## 5. 스타일

`styles/`는 `tokens`(CSS 변수) → `base`(리셋·버튼) → `lobby` → `shell`(게임 화면 틀) → `components`(모달·결과·토스트·타이머/점수) → `setup`(난이도 선택) 순서입니다. 게임 스타일은 폴더 안 `style.css`이며 `.game-<id>` 아래로만 작성합니다.

- 라이트 아케이드 톤. hover/focus 시각 효과는 추가하지 않습니다.
- 결과 팝업 버튼(`로비`·`난이도 변경`·`재도전`)은 같은 크기, 가로 한 줄(초소형 모바일 제외).
- `--hud-height`는 `.game-view`에서 정의되고(`레이아웃 숨기기` 시 36px) 16:9 프레임 계산과 카운트다운·일시정지 오버레이가 사용합니다.

## 6. 검증

`tools/e2e/`(Playwright):

- `verify-spot-sets.mjs` — 틀린그림찾기 이미지 풀의 영역 비중복·쌍별 차이 수·픽셀 일치/가시성.
- `play.mjs` — 모든 게임을 같은 시드 생성기로 끝까지 플레이, 상단바에 타이머/점수가 없고 게임이 자기 것을 가졌는지, 전체화면 버튼 배선, 레이아웃 숨기기/복원, 레지스트리 ↔ 폴더 일치, 각 폴더의 단독 페이지, 콘솔 에러 0.
