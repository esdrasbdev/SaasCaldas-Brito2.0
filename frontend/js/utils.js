/*
 * Utilitários Compartilhados - TASK 4+6 Completo
 * Loading/Error/Debounce padronizado para todos módulos
 */

 // Exibe notificação flutuante (Toast)
export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease-in reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// 🔄 LOADING STATE (Task 4) - Use em TODOS botões submit/salvar
export function setLoading(btnEl, isLoading, originalText = null) {
  if (!btnEl) return;
  
  if (isLoading) {
    if (!btnEl.dataset.originalText) {
      btnEl.dataset.originalText = btnEl.innerHTML;
    }
    btnEl.disabled = true;
    btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aguarde...';
  } else {
    btnEl.disabled = false;
    btnEl.innerHTML = btnEl.dataset.originalText || 'Salvar';
    delete btnEl.dataset.originalText;
  }
}

// ❌ ERRO PADRONIZADO (Task 4)
export function mostrarErro(msg, retryFn = null) {
  showToast(msg, 'error');
  if (retryFn) {
    setTimeout(retryFn, 3000);
  }
}

// ⚡ DEBOUNCE para busca/filtros (Task 6)
export function debounce(fn, delay = 400) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Estado global para evitar race conditions
export const loadingState = { activeRequests: 0 };

// ----------------------------
// Confirmação premium (Promise<boolean>)
// ----------------------------
export function confirmarExclusao({
  title = 'Excluir registro?',
  message = 'Tem certeza que deseja excluir? Esta ação não pode ser desfeita.',
  confirmText = 'Sim, excluir',
  cancelText = 'Cancelar',
  danger = true
} = {}) {
  const overlayId = 'confirm-delete-overlay';
  const existing = document.getElementById(overlayId);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = overlayId;
  overlay.className = 'modal-overlay';

  // Modal usa o mesmo design premium já existente.
  overlay.innerHTML = `
    <div class="modal-content" style="max-width: 520px; padding: 0;">
      <div class="modal-header" style="display:flex; gap:12px; align-items:flex-start;">
        <div style="width: 36px; height: 36px; border-radius: 12px; display:flex; align-items:center; justify-content:center; background: ${danger ? '#fee2e2' : 'rgba(37,99,235,0.08)'};">
          <i class="fa-solid ${danger ? 'fa-triangle-exclamation' : 'fa-circle-info'}" style="color: ${danger ? '#ef4444' : 'var(--azul-medio)'};"></i>
        </div>
        <div>
          <h2 style="margin:0; font-size:1.1rem;">${title}</h2>
          <p style="margin:8px 0 0; color: var(--cinza-medio); line-height:1.5;">${message}</p>
        </div>
      </div>
      <div class="modal-footer" style="justify-content: space-between;">
        <button type="button" class="btn btn-secondary" id="${overlayId}-cancel">${cancelText}</button>
        <button type="button" class="btn btn-primary" id="${overlayId}-confirm" style="background: ${danger ? '#ef4444' : 'var(--azul-medio)'};">
          ${confirmText}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  return new Promise((resolve) => {
    const btnCancel = overlay.querySelector(`#${overlayId}-cancel`);
    const btnConfirm = overlay.querySelector(`#${overlayId}-confirm`);

    const close = (value) => {
      overlay.remove();
      resolve(value);
    };

    // Bloqueia fechamentos acidentais.
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        // Fundo clicado = cancelar
        close(false);
      }
    });

    btnCancel?.addEventListener('click', () => close(false));
    btnConfirm?.addEventListener('click', () => close(true));

    const onKeyDown = (e) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };

    document.addEventListener('keydown', onKeyDown, { once: true });
  });
}

// Formata data para exibição no padrão brasileiro DD/MM/AAAA
// Recebe Date, string ISO ou string de data qualquer
export function formatarData(dateLike) {
  const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
  if (!d || isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' });
}

// Formata hora sempre em 24h (sem AM/PM)

// Recebe Date ou string ISO
export function formatarHora24h(dateLike) {
  const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
  if (!d || isNaN(d.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return formatter.format(d);
}


