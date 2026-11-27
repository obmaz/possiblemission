/**
 * Entry screen for 틀린그림찾기 using the shared setup-screen component.
 * Supports solo (side-by-side) and party (memorize 1 image, then find on the changed image),
 * EASY / MEDIUM / HARD presets, picture selection, and custom steppers.
 */
import { mountSetupScreen } from '../../js/core/setup-screen.js';
import {
  SPOT_DEFAULT_PRESET,
  SPOT_DIFFICULTIES,
  SPOT_FIELDS,
  matchSpotPreset,
  parseSpotMode,
  spotModeId,
} from './stages.js';

const LAST_MODE_PREF = 'spotDiffLastMode';
const STAGE_LABELS = ['랜덤 (시드)', '카페', '캠프'];

function describe(v) {
  const stage = STAGE_LABELS[v.stageIdx] || '랜덤';
  if (v.play === 1) {
    return `${stage} · 다같이 · 외우기 ${v.memorizeSec}초 · 차이 ${v.count}곳 · 제한 ${v.timeSec}초`;
  }
  return `${stage} · 혼자 · 차이 ${v.count}곳 · 제한 ${v.timeSec}초`;
}

export function mountPicker(container, ctx) {
  return mountSetupScreen(container, ctx, {
    gameId: 'spot-difference',
    title: '틀린그림찾기 · 난이도',
    intro: '같은 룸 시드라면 모두에게 <b>같은 그림과 차이점</b>이 나옵니다. 다같이 모드에서는 원래 그림을 외운 뒤 바뀐 그림에서 찾습니다.',
    fields: SPOT_FIELDS,
    presets: SPOT_DIFFICULTIES,
    defaultPreset: SPOT_DEFAULT_PRESET,
    presetMeta: (p) => `차이 ${p.count}곳 · ${p.timeSec}초`,
    describe,
    parseMode: parseSpotMode,
    modeId: spotModeId,
    matchPreset: matchSpotPreset,
    prefKey: LAST_MODE_PREF,
    playSwitch: {
      label: '혼자 (좌우 비교)',
      desc: '두 그림을 나란히 보며 다른 곳 찾기',
      partyLabel: '다같이 (기억해서 찾기)',
      partyDesc: '기본 1분 외운 뒤 바뀐 그림 1장에서 찾기',
    },
    disabledText: (field, values) => (field.key === 'memorizeSec' && values.play === 0 ? '다같이 전용' : null),
  });
}
