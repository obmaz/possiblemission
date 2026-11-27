/**
 * The only file to edit when adding a mini-game: list its folder name here.
 *
 * Each `games/<id>/` folder is self-contained and must provide:
 * - `manifest.js` default export: lobby metadata + `modeLabel(modeId)` (see js/shell/registry.js)
 * - `index.js`    `export function mount(container, ctx)` -> `{ unmount(), idle? }`; `unmount` removes
 *                 listeners and timers (the host empties the stage); `idle: true` marks a chooser screen
 * - `style.css`   styles scoped under `.game-<id>` plus its lobby card artwork
 * - `index.html`  standalone play page for this game alone (`js/standalone.js`)
 */
export const GAME_IDS = [
  'spot-difference',
  'dobble',
  'flash-anzan',
  'memory-match',
  'hide-seek',
  'color-trap',
  'pixel-reveal',
  'flash-count',
];

/** Old game ids that still resolve (shared links / bookmarks created before a folder rename). */
export const LEGACY_GAME_IDS = {
  'despair-fortress': 'hide-seek',
};
