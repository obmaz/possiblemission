/**
 * Mode ids for games with difficulty settings. A mode id is what the URL, the record book and
 * `ctx.mode` carry, so the same link + room seed reproduces the exact same run.
 *
 * - `setup`              the in-game setup screen (no run)
 * - `<preset>`           a preset; `<preset>-party` when the game has a `play` field and play is 1
 * - `custom-<n>-<n>-…`   one integer per field in field order (a field with `scale: 10` stores
 *                        tenths, e.g. 1.5 → 15)
 */

const PARTY_SUFFIX = '-party';
const SETUP_LABEL = '난이도 설정';

/**
 * @param {object} cfg
 * @param {string} [cfg.setupMode='setup']
 * @param {{ key: string, options: number[], scale?: number }[]} cfg.fields  stepper fields (`play` first, if any)
 * @param {object[]} cfg.presets      `{ id, label, ...field values }`
 * @param {(values: object) => string} cfg.customLabel  e.g. "10문제" → label "커스텀 10문제"
 * @param {(values: object) => boolean} [cfg.validate]  extra rule for custom values
 */
export function createModeCodec({ setupMode = 'setup', fields, presets, customLabel, validate = () => true }) {
  const hasPlay = fields.some((f) => f.key === 'play');
  const settingKeys = fields.filter((f) => f.key !== 'play').map((f) => f.key);
  const scaleOf = (field) => field.scale ?? 1;

  /** The preset whose values equal `values` (play is not part of a preset), or null. */
  function matchPreset(values) {
    return presets.find((p) => settingKeys.every((k) => p[k] === values[k])) ?? null;
  }

  function modeId(values) {
    const preset = matchPreset(values);
    if (preset) return hasPlay && values.play === 1 ? `${preset.id}${PARTY_SUFFIX}` : preset.id;
    return `custom-${fields.map((f) => Math.round(values[f.key] * scaleOf(f))).join('-')}`;
  }

  /** Values (plus `presetId`, null for custom) for a mode id, or null for `setup` / anything invalid. */
  function parse(mode) {
    const raw = String(mode ?? '');
    const party = hasPlay && raw.endsWith(PARTY_SUFFIX);
    const preset = presets.find((p) => p.id === (party ? raw.slice(0, -PARTY_SUFFIX.length) : raw));
    if (preset) {
      const values = Object.fromEntries(settingKeys.map((k) => [k, preset[k]]));
      return { ...values, ...(hasPlay && { play: party ? 1 : 0 }), presetId: preset.id };
    }

    if (!/^custom(-\d+)+$/.test(raw)) return null;
    const parts = raw.split('-').slice(1);
    if (parts.length !== fields.length) return null;
    const values = Object.fromEntries(fields.map((f, i) => [f.key, Number(parts[i]) / scaleOf(f)]));
    const valid = fields.every((f) => f.options.includes(values[f.key])) && validate(values);
    return valid ? { ...values, presetId: null } : null;
  }

  /** Short label for the top bar and records, or '' for an invalid id. */
  function label(mode) {
    if (mode === setupMode) return SETUP_LABEL;
    const values = parse(mode);
    if (!values) return '';
    const preset = presets.find((p) => p.id === values.presetId);
    const suffix = hasPlay && values.play === 1 ? ' · 다같이' : '';
    return `${preset ? preset.label : `커스텀 ${customLabel(values)}`}${suffix}`;
  }

  return { matchPreset, modeId, parse, label };
}
