/**
 * Shared difficulty/setup screen: solo-party switch (optional), preset cards, stepper fields,
 * a summary line and a start button. Each game passes its own presets/fields and mode-id codec;
 * the screen remembers the last choice per device and relaunches the game via `ctx.switchMode`.
 */

const PLAY_MODES = [
  { id: 0, label: '혼자 (선택지)', desc: '버튼이나 키보드로 직접 정답 선택' },
  { id: 1, label: '다같이 (한 화면)', desc: '한 화면을 보며 먼저 외치는 사람 승리' },
];

const formatValue = (field, value) =>
  field.valueLabels ? field.valueLabels[field.options.indexOf(value)] : `${value}${field.unit}`;

/**
 * @param {HTMLElement} container
 * @param {object} ctx  game context
 * @param {object} cfg
 * @param {string} cfg.gameId          folder id; the root gets `game-<gameId>`
 * @param {string} cfg.title
 * @param {string} cfg.intro           HTML for the one-line intro (use <b> for highlights)
 * @param {object[]} cfg.fields        `{ key, label, unit, options, valueLabels? }`
 * @param {object[]} cfg.presets       `{ id, label, ko, ...field values }`
 * @param {string} cfg.defaultPreset   preset id used until the player has a saved choice
 * @param {(p: object) => string} cfg.presetMeta  text under a preset name
 * @param {(values: object) => string} cfg.describe  summary shown below the fields
 * @param {(mode: string) => object | null} cfg.parseMode
 * @param {(values: object) => string} cfg.modeId
 * @param {(values: object) => object | null} cfg.matchPreset
 * @param {string} cfg.prefKey         storage key for the last chosen mode
 * @param {boolean | { label?: string, desc?: string }} [cfg.playSwitch]  show the solo/party switch;
 *        an object overrides the solo label/description
 * @param {(values: object) => object} [cfg.normalize]  fix up values after every change
 * @param {(field: object, step: number, values: object) => boolean} [cfg.canStep]  extra veto per step
 * @param {(field: object, values: object) => string | null} [cfg.disabledText]  text when a field is inactive
 */
export function mountSetupScreen(container, ctx, cfg) {
  const { fields, presets } = cfg;
  const stepperFields = cfg.playSwitch ? fields.filter((f) => f.key !== 'play') : fields;
  const normalize = cfg.normalize || ((v) => v);

  const last = cfg.parseMode(ctx.storage.getPref(cfg.prefKey, ''));
  const source = last || { play: 0, ...presets.find((p) => p.id === cfg.defaultPreset) };
  let values = Object.fromEntries(fields.map((f) => [f.key, source[f.key]]));

  const solo = typeof cfg.playSwitch === 'object' ? cfg.playSwitch : {};
  const playSwitchHtml = cfg.playSwitch
    ? `<div class="setup-playmode" role="radiogroup" aria-label="플레이 방식">
        ${PLAY_MODES.map((m) => {
          const label = (m.id === 0 && solo.label) || m.label;
          const desc = (m.id === 0 && solo.desc) || m.desc;
          return `<button type="button" class="setup-playmode__btn" role="radio" data-playmode="${m.id}">
            <span class="setup-playmode__title">${label}</span>
            <span class="setup-playmode__desc">${desc}</span>
          </button>`;
        }).join('')}
      </div>`
    : '';

  const root = document.createElement('div');
  root.className = `game-root game-${cfg.gameId} setup`;
  root.innerHTML = `
    <div class="setup__head">
      <h2 class="setup__title">${cfg.title}</h2>
      <p class="setup__sub">${cfg.intro}</p>
    </div>
    ${playSwitchHtml}
    <div class="setup__body">
      <div class="setup-presets" role="radiogroup" aria-label="난이도 프리셋">
        ${presets
          .map(
            (p) => `
          <button type="button" class="setup-preset setup-preset--${p.id}" role="radio" data-preset="${p.id}">
            <span class="setup-preset__name">${p.label}</span>
            <span class="setup-preset__ko">${p.ko}</span>
            <span class="setup-preset__meta">${cfg.presetMeta(p)}</span>
          </button>`
          )
          .join('')}
      </div>
      <div class="setup-fields">
        ${stepperFields
          .map(
            (f) => `
          <div class="setup-field" data-field="${f.key}">
            <span class="setup-field__label">${f.label}</span>
            <div class="setup-stepper">
              <button type="button" class="setup-stepper__btn" data-step="-1" aria-label="${f.label} 줄이기">−</button>
              <output class="setup-stepper__value" data-value></output>
              <button type="button" class="setup-stepper__btn" data-step="1" aria-label="${f.label} 늘리기">+</button>
            </div>
          </div>`
          )
          .join('')}
        <p class="setup-summary" data-summary></p>
      </div>
    </div>
    <button type="button" class="setup__start" data-start>시작하기 <span aria-hidden="true">→</span></button>
  `;
  container.appendChild(root);

  const setChecked = (btn, on) => {
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-checked', String(on));
  };

  function render() {
    const match = cfg.matchPreset(values);
    root.querySelectorAll('[data-playmode]').forEach((btn) => setChecked(btn, Number(btn.dataset.playmode) === values.play));
    root.querySelectorAll('[data-preset]').forEach((btn) => setChecked(btn, match?.id === btn.dataset.preset));
    for (const f of stepperFields) {
      const row = root.querySelector(`[data-field="${f.key}"]`);
      const idx = f.options.indexOf(values[f.key]);
      const inactive = cfg.disabledText?.(f, values) ?? null;
      row.classList.toggle('is-disabled', inactive !== null);
      row.querySelector('[data-value]').textContent = inactive ?? formatValue(f, values[f.key]);
      row.querySelector('[data-step="-1"]').disabled = inactive !== null || idx <= 0 || cfg.canStep?.(f, -1, values) === false;
      row.querySelector('[data-step="1"]').disabled =
        inactive !== null || idx >= f.options.length - 1 || cfg.canStep?.(f, 1, values) === false;
    }
    root.querySelector('[data-summary]').textContent = `${match ? `${match.label} · ` : '커스텀 · '}${cfg.describe(values)}`;
  }

  const update = (next) => {
    values = normalize({ ...values, ...next });
    ctx.audio.playClick();
    render();
  };

  const onClick = (e) => {
    const playBtn = e.target.closest('[data-playmode]');
    const presetBtn = e.target.closest('[data-preset]');
    const stepBtn = e.target.closest('[data-step]');
    if (playBtn) {
      update({ play: Number(playBtn.dataset.playmode) });
    } else if (presetBtn) {
      const preset = presets.find((p) => p.id === presetBtn.dataset.preset);
      update(Object.fromEntries(fields.filter((f) => f.key in preset).map((f) => [f.key, preset[f.key]])));
    } else if (stepBtn) {
      const field = fields.find((f) => f.key === stepBtn.closest('[data-field]').dataset.field);
      const idx = field.options.indexOf(values[field.key]) + Number(stepBtn.dataset.step);
      if (idx >= 0 && idx < field.options.length) update({ [field.key]: field.options[idx] });
    } else if (e.target.closest('[data-start]')) {
      ctx.audio.playClick();
      const mode = cfg.modeId(values);
      ctx.storage.setPref(cfg.prefKey, mode);
      ctx.switchMode(mode);
    }
  };

  root.addEventListener('click', onClick);
  render();
  root.querySelector('[data-start]').focus({ preventScroll: true });

  return {
    idle: true,
    unmount() {
      root.removeEventListener('click', onClick);
    },
  };
}
