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

