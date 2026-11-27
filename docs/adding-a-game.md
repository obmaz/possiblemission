# 새 미니게임 추가하기

게임 하나는 `games/<id>/` 폴더 하나입니다. 공통 코드(`js/`, `styles/`)는 수정하지 않습니다.

## 체크리스트

1. **폴더 만들기** — `games/<id>/` (kebab-case, URL과 RNG 시드에 쓰이므로 한번 공개하면 바꾸지 않기).
2. **`index.js`** — `export function mount(container, ctx)`.
   - 난이도 선택이 필요하면 `ctx.mode`가 `setup`일 때 `mountSetupScreen(container, ctx, {...})`(`js/core/setup-screen.js`)를 돌려주고, 아니면 본게임을 mount합니다. 선택 화면은 `{ idle: true }`를 돌려줍니다.
   - 시간 제한이 있으면 게임 안에 타이머를 그립니다: `<span class="pm-timer">` / `<span class="pm-score">`와 `bindClock` / `bindScore`(`js/core/clock.js`).
   - 끝나면 `ctx.completeGame({ score, timeMs, cleared, details })`.
   - 일시정지는 `const off = ctx.onPause((paused) => …)`로 받고 `unmount()`에서 `off()`.
   - 랜덤은 모두 `ctx.rng`(또는 `js/core/seed.js`)로 — 같은 시드에서 같은 라운드여야 합니다.
3. **`settings.js`** — 필드·프리셋을 선언하고 `createModeCodec`(`js/core/mode-codec.js`)으로 모드 id 인코딩/파싱/라벨을 얻습니다(잘못된 id의 라벨은 `''`). 소수 필드는 `scale: 10`. 기존 게임의 `settings.js`를 참고하세요.
4. **`manifest.js`** — 로비 카드 정보와 `modeLabel`:

   ```js
   import { SETUP_MODE, modeLabel } from './settings.js';
   export default {
     id: 'my-game', title: '내 게임', accent: 'cyan', tag: '한 단어',
     players: 'solo',               // 'solo' | 'both'(혼자·다같이)
     timeHint: '60초', summary: '한 줄 설명',
     defaultMode: SETUP_MODE, modeLabel,
     cardArt: `<div class="game-card__my-game-art">…</div>`,   // 또는 <img>
   };
   ```
5. **`style.css`** — 모든 선택자를 `.game-my-game` 아래로 스코프하고(`mount`가 만드는 루트에 `game-root game-my-game` 클래스), `@keyframes`에 접두사를 붙입니다. 로비 카드 그림 스타일도 여기에 둡니다. 선택 화면에 색을 입히려면 `--setup-accent`, `--setup-accent-soft`를 루트에 지정합니다.
6. **`index.html`** — 다른 게임 폴더의 `index.html`을 복사하고 `<title>`과 `body[data-game]`만 바꿉니다.
7. **`games/registry.js`** — `GAME_IDS`에 폴더 이름 추가.
8. **검증** — `cd tools/e2e && npm test`. `registry ↔ 폴더 일치`와 `단독 페이지` 검사가 새 폴더를 자동으로 확인합니다. 게임을 끝까지 플레이하는 검사는 `tools/e2e/play.mjs`에 추가합니다.

## 지켜야 할 것

- 게임 코드는 공통 DOM(`#game-hud` 등)을 건드리지 않습니다. 필요한 값은 `ctx`로만 주고받습니다.
- 이미지 등 리소스는 `new URL('./assets/x.jpg', import.meta.url).href`로 참조합니다(루트 페이지·단독 페이지 어디서든 동작).
- 틀린그림찾기에 이미지 스테이지를 추가할 때는 `.agents/skills/spot-difference-stage/SKILL.md`를 따릅니다.
