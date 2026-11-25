/**
 * Placeholder stub for Spot the Difference (Programmer B).
 * Implements the exact mount(container, ctx) -> { unmount() } contract.
 */
export function mount(container, ctx) {
  const root = document.createElement('div');
  root.className = 'game-root game-spot game-stub';
  root.innerHTML = `
    <div class="game-stub__card">
      <p class="game-stub__eyebrow">SPOT THE GLITCH // MODULE STANDBY</p>
      <h2 class="game-stub__title">틀린그림찾기 모듈 준비 중</h2>
      <p class="game-stub__desc">시드 <strong>#${ctx.seed}</strong> · 모드 <code>${ctx.mode}</code></p>
      <div class="game-stub__actions">
        <button type="button" class="btn-neon-ghost" data-stub-exit>로비로 돌아가기</button>
      </div>
    </div>
  `;
  container.appendChild(root);

  const exitBtn = root.querySelector('[data-stub-exit]');
  const onExit = () => {
    ctx.audio.playClick();
    ctx.exitToHub();
  };
  exitBtn?.addEventListener('click', onExit);
  ctx.updateHud({ timer: '--:--', score: 0, progress: 'STANDBY', progressRatio: 0 });

  return {
    unmount() {
      exitBtn?.removeEventListener('click', onExit);
      container.innerHTML = '';
    },
  };
}
