/**
 * Shared UI helpers: grading, toasts, confetti, clipboard copy, invite URL and the modal.
 */

/**
 * Arcade rank for a finished run: a failed run is always C; cleared runs rank by score.
 * @param {number} score
 * @param {{ cleared?: boolean }} [opts]
 * @returns {'S'|'A'|'B'|'C'}
 */
export function calculateGrade(score, { cleared = true } = {}) {
  const pts = Math.max(0, Number(score) || 0);
  if (!cleared || pts < 3000) return 'C';
  if (pts >= 6800) return 'S';
  if (pts >= 5000) return 'A';
  return 'B';
}

/**
 * Displays a floating neon toast notification in #toast-root.
 * @param {string} message
 * @param {'info'|'success'|'warn'|'error'} [type='info']
 * @param {number} [durationMs=2400]
 */
export function showToast(message, type = 'info', durationMs = 2400) {
  const root = document.getElementById('toast-root');
  if (!root) return;

  while (root.children.length >= 4) {
    root.firstElementChild?.remove();
  }

  const toast = document.createElement('div');
  toast.className = `arcade-toast arcade-toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = String(message ?? '');
  root.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });

  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 260);
  }, Math.max(800, durationMs));
}

let confettiRafId = 0;

/**
 * Fires GPU-friendly particle confetti on #confetti-canvas (auto-stops after 3.5s).
 * Respects prefers-reduced-motion; spawns 90 particles desktop / 45 mobile.
 * @param {'S'|'A'|'B'|'C'} [tier='S']
 */
export function launchConfetti(tier = 'S') {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (confettiRafId) {
    cancelAnimationFrame(confettiRafId);
    confettiRafId = 0;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const palettes = {
    S: ['#fbbf24', '#22d3ee', '#f43f8e', '#ffffff', '#a855f7'],
    A: ['#22d3ee', '#34d399', '#a855f7', '#f8fafc'],
    B: ['#34d399', '#22d3ee', '#fbbf24'],
    C: ['#f43f8e', '#a855f7', '#22d3ee'],
  };
  const colors = palettes[tier] || palettes.S;
  const count = w < 640 ? 45 : 90;

  const particles = Array.from({ length: count }, (_, i) => {
    const fromLeft = i % 2 === 0;
    const originX = fromLeft ? w * 0.22 : w * 0.78;
    const originY = h * 0.58;
    const angle = (fromLeft ? -Math.PI * 0.35 : -Math.PI * 0.65) + (Math.random() - 0.5) * 0.75;
    const speed = 6 + Math.random() * 10;
    return {
      x: originX + (Math.random() - 0.5) * 40,
      y: originY + (Math.random() - 0.5) * 30,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: 6 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.24,
      color: colors[i % colors.length],
      shape: i % 3 === 0 ? 'circle' : 'rect',
    };
  });

  const start = performance.now();
  const duration = 3500;

  const frame = (now) => {
    const elapsed = now - start;
    if (elapsed >= duration) {
      ctx.clearRect(0, 0, w, h);
      confettiRafId = 0;
      return;
    }

    ctx.clearRect(0, 0, w, h);
    const fade = elapsed > duration - 700 ? Math.max(0, (duration - elapsed) / 700) : 1;

    for (const p of particles) {
      p.vy += 0.28;
      p.vx *= 0.992;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vRot;

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
      }
      ctx.restore();
    }

    confettiRafId = requestAnimationFrame(frame);
  };

  confettiRafId = requestAnimationFrame(frame);
}

/**
 * Copies text via navigator.clipboard with textarea execCommand fallback for WebViews.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  const value = String(text ?? '');
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to execCommand fallback
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return Boolean(ok);
  } catch {
    return false;
  }
}

/** Absolute invite URL for a room seed, keeping the current path (GitHub Pages subpath safe). */
export function buildShareUrl(seed) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('seed', seed);
  return url.toString();
}

let activeModalCloseCb = null;
let activeEscHandler = null;
let previousFocusedEl = null;

/**
 * Opens a shared accessible modal inside #modal-root.
 * Closes on ESC key or backdrop click unless { lockBackdrop: true }.
 */
export function openModal({
  title = '',
  subtitle = '',
  contentEl,
  className = '',
  onClose = null,
  lockBackdrop = false,
  // false → no ✕, no Esc, no backdrop close: the content's own buttons are the only way out
  dismissible = true,
}) {
  const root = document.getElementById('modal-root');
  if (!root) return;

  closeModal(true);
  previousFocusedEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeModalCloseCb = typeof onClose === 'function' ? onClose : null;

  root.innerHTML = '';
  root.hidden = false;

  const backdrop = document.createElement('div');
  backdrop.className = 'arcade-modal-backdrop';

  const dialog = document.createElement('div');
  dialog.className = `arcade-modal ${className}`.trim();
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  if (title) dialog.setAttribute('aria-label', title);

  const header = document.createElement('div');
  header.className = 'arcade-modal__header';

  const titles = document.createElement('div');
  titles.className = 'arcade-modal__titles';
  if (subtitle) {
    const subEl = document.createElement('p');
    subEl.className = 'arcade-modal__subtitle';
    subEl.textContent = subtitle;
    titles.appendChild(subEl);
  }
  if (title) {
    const titleEl = document.createElement('h2');
    titleEl.className = 'arcade-modal__title';
    titleEl.textContent = title;
    titles.appendChild(titleEl);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'arcade-modal__close';
  closeBtn.setAttribute('aria-label', '닫기');
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => closeModal());

  header.append(titles);
  if (dismissible) header.append(closeBtn);
  dialog.appendChild(header);

  const body = document.createElement('div');
  body.className = 'arcade-modal__body';
  if (contentEl instanceof HTMLElement) {
    body.appendChild(contentEl);
  } else if (typeof contentEl === 'string') {
    body.innerHTML = contentEl;
  }
  dialog.appendChild(body);

  backdrop.appendChild(dialog);
  root.appendChild(backdrop);

  if (!lockBackdrop && dismissible) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
  }

  activeEscHandler = (e) => {
    if (e.key === 'Escape' && dismissible) {
      closeModal();
    }
  };
  window.addEventListener('keydown', activeEscHandler);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    closeBtn.focus({ preventScroll: true });
  });
}

/**
 * Closes the currently open modal in #modal-root.
 * @param {boolean} [silent=false]
 */
export function closeModal(silent = false) {
  const root = document.getElementById('modal-root');
  if (activeEscHandler) {
    window.removeEventListener('keydown', activeEscHandler);
    activeEscHandler = null;
  }
  const cb = activeModalCloseCb;
  activeModalCloseCb = null;

  if (root) {
    root.hidden = true;
    root.innerHTML = '';
  }

  if (!silent && cb) {
    cb();
  }
  if (!silent && previousFocusedEl && previousFocusedEl.isConnected) {
    previousFocusedEl.focus({ preventScroll: true });
  }
  previousFocusedEl = null;
}
