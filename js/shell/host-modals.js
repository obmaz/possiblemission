/** Facilitator popups opened from the lobby: the invite QR and the MC guide. */
import * as audio from '../core/audio.js';
import * as ui from '../core/ui.js';
import { escapeHtml } from '../core/dom.js';

export function openQrModal(seed) {
  const shareUrl = ui.buildShareUrl({ seed });
  const wrap = document.createElement('div');
  wrap.className = 'qr-card';
  wrap.innerHTML = `
    <p class="qr-card__lead">
      참가자 스마트폰 카메라로 아래 QR을 스캔하면<br />
      룸 시드 <strong>#${escapeHtml(seed)}</strong> 상태로 즉시 입장합니다!
    </p>
    <div class="qr-frame"><canvas id="qr-invite-canvas" aria-label="룸 시드 초대 QR 코드"></canvas></div>
    <div class="qr-url-box">${escapeHtml(shareUrl)}</div>
    <button type="button" class="btn-neon-primary qr-card__copy" data-copy>🔗 초대 링크 복사하기</button>
  `;

  ui.openModal({ title: `시드 #${seed} 초대 QR`, subtitle: 'INSTANT WORKSHOP JOIN', contentEl: wrap });

  const canvas = wrap.querySelector('canvas');
  try {
    ui.renderQrCode(canvas, shareUrl, { size: 220, fg: '#070914', bg: '#ffffff' });
  } catch {
    canvas.replaceWith(document.createTextNode('URL이 너무 길어 QR을 생성할 수 없습니다.'));
  }

  wrap.querySelector('[data-copy]').addEventListener('click', async () => {
    audio.playClick();
    const ok = await ui.copyToClipboard(shareUrl);
    ui.showToast(ok ? '초대 링크를 복사했습니다!' : '복사에 실패했습니다.', ok ? 'success' : 'warn');
  });
}

const MC_STEPS = [
  {
    title: "모든 참가자에게 동일한 '룸 시드' 공유 (5~100명 동시)",
    desc: '상단 <strong>설정 아이콘 → QR 코드</strong>를 회의실 프로젝터에 띄우거나 팝업 내 <strong>초대 링크 복사</strong>로 공유하세요. 같은 시드(예: <code>ROUND-1</code>)에서는 100명 모두 <strong>100% 동일한 문제 배치</strong>가 출제됩니다.',
  },
  {
    title: 'MC의 "3, 2, 1, 출격!" 카운트다운에 맞춰 동시 플레이',
    desc: '참가자들은 닉네임과 팀명을 입력한 뒤 지정된 게임의 <strong>시작하기</strong>를 누르고, 게임 안에서 같은 난이도를 고릅니다. 탭 전환 시 공정 플레이 커튼이 작동해 반칙을 방지합니다.',
  },
  {
    title: '결과 화면의 점수로 순위 발표!',
    desc: '게임이 끝나면 각자 화면에 <strong>점수</strong>가 크게 표시됩니다. MC가 점수를 확인해 순위를 발표하세요.',
  },
];

export function openMcGuideModal() {
  const wrap = document.createElement('div');
  wrap.className = 'mc-steps';
  wrap.innerHTML = MC_STEPS.map(
    (step, i) => `
    <div class="mc-step">
      <div class="mc-step__num">${i + 1}</div>
      <div>
        <div class="mc-step__title">${step.title}</div>
        <div class="mc-step__desc">${step.desc}</div>
      </div>
    </div>`
  ).join('');

  ui.openModal({ title: 'MC 워크샵 진행 가이드', subtitle: 'ZERO-BACKEND 100-PLAYER SYNC', contentEl: wrap });
}
