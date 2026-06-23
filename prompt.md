# PROMPT-MODAL-RESPONSIVO.md
# SaasCaldas-Brito 2.0 — Modal de Visualização e Responsividade Mobile Completa

> Stack: Vanilla JS ES Modules · Vercel (frontend) · Railway (Node/Express backend) · Supabase
> Execute cada seção em sequência. Commit atômico por seção.

---

## DIAGNÓSTICO

### Problema 1 — Modal "Visualizar Cliente" corta o nome

**Causa exata (`clientes.js` linha 171):**
```js
this.elementos.tituloModal.textContent = visualizacao ? 'Visualizar Cliente' : ...
```
O título do modal é sempre o genérico `"Visualizar Cliente"` — o nome real do cliente nunca aparece no cabeçalho.

Além disso, no formulário em modo `mode-view`, o campo `#cliente-nome` tem:
- `font-size: 0.75rem` (herdado de `.modal-cliente input`)
- `white-space` não definido → nome longo quebra ou some dentro do input estreito (o grid `.form-grid-main` divide em 4 colunas, cada coluna tem ~22% da largura do modal)
- `text-overflow: ellipsis` não aplicado aos inputs desabilitados

**Mesmo problema nos outros modais de visualização:**
- `audiencias.js` linha 304: título fixo `'Detalhes da Audiência'` — nome do cliente não aparece
- `pericias.js` linha 402: título fixo `'Detalhes da Perícia'`
- `atendimentos.js`: título fixo `'Registrar Interação'` no HTML

---

### Problema 2 — Responsividade mobile completamente ausente

**Diagnóstico crítico:**
A sidebar não tem **nenhuma** lógica mobile. Em telas ≤768px ela empurra o conteúdo para fora da tela ou fica sobreposta sem overlay. Não existe: botão hamburger, overlay de fundo, `position: fixed` para mobile, nem `transform: translateX` para ocultar/revelar.

Pontos específicos encontrados:
- `.sidebar` usa `position: sticky` — em mobile fica ocupando 260px da largura total, deixando apenas ~100px para o conteúdo
- `.main-content` tem `max-width: calc(100% - 280px)` — sem o ajuste mobile funcionar de verdade, pois o sidebar continua ocupando espaço físico
- `@media (max-width: 768px)` no `style.css` ajusta padding e `max-width: 100%` do `.main-content`, mas a sidebar continua em tela
- Tabelas (`.recent-table`) não têm `overflow-x: auto` em container responsivo
- Grids inline com `grid-template-columns: 1fr 1fr 1fr` (em `atendimentos.html`) não colapsam em mobile
- Modais em mobile: `max-height: 90vh` e `width: 95%` estão corretos, mas o modal de clientes tem `height: 95vh` fixo que pode não scrollar corretamente no Safari iOS (problema de `overflow: hidden` no pai)

---

## SEÇÃO 1 — TÍTULO DO MODAL COM NOME DO CLIENTE/REGISTRO

### 1.1 — `frontend/js/clientes.js`

Localizar a função `abrirModal(cliente = null, visualizacao = false)`:

```js
// LINHA 171 - ATUAL:
this.elementos.tituloModal.textContent = visualizacao ? 'Visualizar Cliente' : (cliente ? 'Editar Cliente' : 'Novo Cliente');

// CORRETO - mostra o nome real no modo visualização:
if (visualizacao && cliente?.nome) {
  this.elementos.tituloModal.textContent = cliente.nome;
} else if (cliente) {
  this.elementos.tituloModal.textContent = 'Editar Cliente';
} else {
  this.elementos.tituloModal.textContent = 'Novo Cliente';
}
```

Adicionar também ao `modal-titulo` no HTML suporte a overflow longo:

```js
// Logo após definir o textContent, adicionar (ainda dentro de abrirModal):
const tituloEl = this.elementos.tituloModal;
tituloEl.style.cssText = `
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: calc(100% - 56px);
  display: block;
  title: "${cliente?.nome || ''}";
`;
tituloEl.title = cliente?.nome || ''; // tooltip com nome completo
```

### 1.2 — `frontend/js/audiencias.js`

Localizar o bloco `if (btnView)` (~linha 272):

```js
// ATUAL (linha ~304):
const headerEl = document.querySelector('#form-audiencia .modal-header h2');
if (headerEl) headerEl.textContent = 'Detalhes da Audiência';

// CORRETO:
const clienteNome = audiencia.clientes?.nome || audiencia.processos?.clientes?.nome || null;
const headerEl = document.querySelector('#form-audiencia .modal-header h2');
if (headerEl) {
  headerEl.textContent = clienteNome ? clienteNome : 'Detalhes da Audiência';
  headerEl.title = clienteNome || '';
}
```

### 1.3 — `frontend/js/pericias.js`

Localizar o bloco `if (isView)` (~linha 397):

```js
// ATUAL (linha ~402):
document.querySelector('.modal-header h2').textContent = isView ? 'Detalhes da Perícia' : 'Editar Perícia';

// CORRETO:
// Buscar nome do cliente selecionado no select
const clienteSelectEl = document.getElementById('cliente-select');
const clienteNome = clienteSelectEl?.options[clienteSelectEl.selectedIndex]?.text;
const headerH2 = document.querySelector('.modal-header h2');
if (headerH2) {
  headerH2.textContent = isView && clienteNome && clienteNome !== 'Selecione...'
    ? clienteNome
    : (isView ? 'Detalhes da Perícia' : 'Editar Perícia');
  headerH2.title = clienteNome || '';
}
```

### 1.4 — `frontend/js/atendimentos.js`

Localizar o bloco de abertura do modal em modo visualização e adicionar o nome do cliente ao título.

```js
// Ao preencher os campos do registro em modo view, adicionar:
const clienteSelectEl = document.getElementById('atend-cliente');
const clienteNome = clienteSelectEl?.options[clienteSelectEl.selectedIndex]?.text;
const headerH2 = document.querySelector('#modal-atendimento .modal-header h2');
if (headerH2 && isView) {
  headerH2.textContent = clienteNome && clienteNome !== 'Selecione o cliente...'
    ? clienteNome
    : 'Detalhes do Atendimento';
  headerH2.title = clienteNome || '';
}
```

### 1.5 — CSS: `frontend/css/style.css` — modal-header com título truncável

Adicionar ao bloco `.modal-header`:

```css
/* SUBSTITUIR: */
.modal-header {
  padding: 24px;
  border-bottom: 1px solid var(--cinza-borda);
}
.modal-header h2 { margin: 0; font-size: 1.25rem; color: var(--azul-escuro); }

/* POR: */
.modal-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--cinza-borda);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 60px;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--azul-escuro);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0; /* necessário para ellipsis funcionar em flex */
}
```

---

## SEÇÃO 2 — SIDEBAR MOBILE: HAMBURGER + OVERLAY + SLIDE

Esta é a maior lacuna de responsividade. A sidebar precisa de comportamento drawer em telas ≤768px.

### 2.1 — `frontend/css/sidebar.css` — adicionar ao final do arquivo

```css
/* ============================
   RESPONSIVIDADE MOBILE SIDEBAR
   ============================ */

/* Botão hamburger — oculto em desktop */
.btn-hamburger {
  display: none;
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 9000;
  background: var(--branco);
  border: 1px solid var(--cinza-borda);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  color: var(--azul-escuro);
  font-size: 1.1rem;
  transition: background 0.2s;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
}

.btn-hamburger:hover {
  background: var(--azul-claro);
  color: var(--azul-medio);
}

/* Overlay escuro atrás da sidebar aberta */
.sidebar-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  z-index: 8000;
  backdrop-filter: blur(2px);
  animation: fadeIn 0.2s ease;
}

.sidebar-overlay.ativo {
  display: block;
}

/* Comportamento mobile */
@media (max-width: 768px) {
  .btn-hamburger {
    display: flex;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100%;
    z-index: 8500;
    transform: translateX(-100%);
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: none;
  }

  .sidebar.aberta {
    transform: translateX(0);
    box-shadow: 4px 0 24px rgba(0,0,0,0.18);
  }
}
```

### 2.2 — `frontend/js/sidebar.js` — injetar hamburger e overlay no DOM

Localizar a função que constrói a sidebar (onde está o `this.sidebar.innerHTML = ...`).

**Após o bloco que gera o HTML da sidebar** (logo depois do `this.sidebar.innerHTML = ...`), adicionar:

```js
// Injeta botão hamburger e overlay se não existirem
if (!document.getElementById('btn-hamburger')) {
  const hamburger = document.createElement('button');
  hamburger.id = 'btn-hamburger';
  hamburger.className = 'btn-hamburger';
  hamburger.setAttribute('aria-label', 'Abrir menu');
  hamburger.innerHTML = '<i class="fa-solid fa-bars"></i>';
  document.body.appendChild(hamburger);

  const overlay = document.createElement('div');
  overlay.id = 'sidebar-overlay';
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  const sidebar = this.sidebar;

  // Abre sidebar
  hamburger.addEventListener('click', () => {
    sidebar.classList.add('aberta');
    overlay.classList.add('ativo');
    hamburger.setAttribute('aria-label', 'Fechar menu');
  });

  // Fecha ao clicar no overlay
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('aberta');
    overlay.classList.remove('ativo');
    hamburger.setAttribute('aria-label', 'Abrir menu');
  });

  // Fecha ao clicar em um link da nav (navegação)
  sidebar.addEventListener('click', (e) => {
    if (e.target.closest('.nav-item') && window.innerWidth <= 768) {
      sidebar.classList.remove('aberta');
      overlay.classList.remove('ativo');
    }
  });
}
```

---

## SEÇÃO 3 — RESPONSIVIDADE: MAIN CONTENT EM MOBILE

### 3.1 — `frontend/css/style.css` — ajustar `.main-content` para mobile

```css
/* SUBSTITUIR o bloco @media (max-width: 768px) existente que tem .main-content: */

@media (max-width: 768px) {
  .main-content {
    padding: 16px;
    padding-top: 64px; /* espaço para o botão hamburger fixo */
    max-width: 100%;
    margin-left: 0;   /* garante que não haja deslocamento residual */
  }

  h1 { font-size: 1.25rem; }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .page-header button {
    width: 100%;
    justify-content: center;
  }
}
```

---

## SEÇÃO 4 — RESPONSIVIDADE: TABELAS COM SCROLL HORIZONTAL

Todas as tabelas (`.recent-table`) precisam de um wrapper com `overflow-x: auto`.

### 4.1 — Verificar e adicionar `.table-responsive` em todos os HTMLs

Confirmar que todos os arquivos abaixo têm `<div class="table-responsive">` envolvendo `<table class="recent-table">`:

- `clientes.html` — gerado via JS em `ClienteView.renderTabela()` → adicionar wrapper no JS
- `audiencias.html` — **já tem** `<div class="table-responsive">`
- `pericias.html` — **já tem** `<div class="table-responsive">`
- `processos.html` — verificar
- `atendimentos.html` — não usa tabela, usa cards — ok

**Em `clientes.js`**, localizar onde o HTML da tabela é gerado (função `renderTabela` ou similar) e garantir que o `<table>` esteja dentro de `<div class="table-responsive">`:

```js
// ATUAL (aproximado):
return `<table class="recent-table">...</table>`;

// CORRETO:
return `<div class="table-responsive"><table class="recent-table">...</table></div>`;
```

### 4.2 — `frontend/css/style.css` — adicionar classe `.table-responsive`

```css
/* Adicionar após o bloco de .recent-table */
.table-responsive {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch; /* iOS momentum scroll */
  border-radius: 8px;
}

@media (max-width: 768px) {
  .recent-table {
    min-width: 560px; /* evita colapso das colunas */
    font-size: 0.8rem;
  }

  .recent-table td,
  .recent-table th {
    padding: 8px 10px;
  }

  /* Ocultar colunas menos essenciais em telas muito pequenas */
  .recent-table .col-secundaria {
    display: none;
  }
}
```

---

## SEÇÃO 5 — RESPONSIVIDADE: GRIDS INLINE NOS MODAIS

Existem grids definidos com `style` inline nos HTMLs que não colapsam em mobile. Converter todos para classes CSS.

### 5.1 — `frontend/js/audiencias.js` — grid Local/Tipo

```js
// Localizar no HTML do modal de audiências (audiencias.html linha ~55):
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">

// SUBSTITUIR por classe:
<div class="form-row">
```

### 5.2 — `frontend/js/pericias.js` — grid Local/Perito

```js
// Localizar no HTML do modal de perícias:
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">

// SUBSTITUIR por:
<div class="form-row">
```

### 5.3 — `frontend/js/atendimentos.js` / `atendimentos.html` — grid 3 colunas

```html
<!-- ATUAL (atendimentos.html ~linha 56): -->
<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 16px;">

<!-- SUBSTITUIR por: -->
<div class="form-row-3">
```

Adicionar ao `style.css`:

```css
/* Grid 3 colunas colapsável */
.form-row-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}

@media (max-width: 640px) {
  .form-row-3 {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}
```

---

## SEÇÃO 6 — RESPONSIVIDADE: MODAIS EM MOBILE (iOS/Android)

### 6.1 — `frontend/css/style.css` — ajustar modais para mobile

```css
/* Adicionar após o bloco .modal-content existente */
@media (max-width: 768px) {
  .modal-overlay {
    align-items: flex-end;     /* drawer vindo de baixo em mobile */
    padding: 0;
  }

  .modal-content {
    width: 100%;
    max-width: 100%;
    max-height: 92vh;
    border-radius: 20px 20px 0 0;  /* arredondado só no topo */
    padding: 0;
    animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Alça visual de arraste (estética mobile) */
  .modal-content::before {
    content: '';
    display: block;
    width: 36px;
    height: 4px;
    background: var(--cinza-claro);
    border-radius: 2px;
    margin: 10px auto 0;
    flex-shrink: 0;
  }

  .modal-body {
    padding: 16px;
    -webkit-overflow-scrolling: touch;
  }

  .modal-header {
    padding: 12px 16px 12px;
    border-radius: 20px 20px 0 0;
  }

  .modal-footer {
    padding: 12px 16px;
    border-radius: 0;
  }

  /* Botões de ação em mobile ocupam toda a largura */
  .modal-footer .btn-primary,
  .modal-footer .btn-secondary {
    flex: 1;
  }
}

/* Animação slide-up para mobile */
@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

### 6.2 — Corrigir Safari iOS: overflow em modal com filho scroll

O Safari iOS tem bug conhecido onde `overflow-y: auto` em `.modal-content` não funciona se o elemento pai tiver `overflow: hidden`. Verificar e corrigir:

```css
/* Adicionar ao .modal-overlay */
.modal-overlay {
  /* ... existente ... */
  overflow-y: auto; /* necessário para iOS */
  -webkit-overflow-scrolling: touch;
}

/* Garantir que modal-content não barre o scroll em iOS */
.modal-content {
  /* ... existente ... */
  overflow: hidden; /* REMOVER se presente — usar no modal-body */
}

.modal-body {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain; /* evita scroll vazando para o body */
}
```

---

## SEÇÃO 7 — RESPONSIVIDADE: PAGE HEADER E KPI GRID EM MOBILE

### 7.1 — `frontend/css/style.css`

```css
/* Adicionar ao bloco @media (max-width: 768px): */

/* KPIs empilham em 2 colunas em tablet, 1 em mobile pequeno */
@media (max-width: 768px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .kpi-card {
    padding: 14px;
    border-radius: 14px;
  }

  .kpi-icon {
    width: 40px;
    height: 40px;
    font-size: 1.1rem;
  }

  .kpi-value {
    font-size: 1.4rem;
  }

  .dashboard-content-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

@media (max-width: 400px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## SEÇÃO 8 — RESPONSIVIDADE: BOTÕES DE AÇÃO NAS TABELAS EM MOBILE

Os botões `.btn-sm` (view/edit/delete) ficam apertados em mobile.

### 8.1 — `frontend/css/style.css`

```css
/* Adicionar */
@media (max-width: 640px) {
  .btn-sm {
    padding: 6px 8px;
    font-size: 0.8rem;
    min-width: 30px;
    min-height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  /* Garante touch target mínimo de 44px recomendado pela Apple/Google */
  .btn-sm i {
    font-size: 0.9rem;
  }
}
```

---

## SEÇÃO 9 — BUSCA NA SIDEBAR EM MOBILE

Em mobile, a busca da sidebar (`.sidebar-search`) deve ser visível e funcional mesmo com a sidebar como drawer.

Nenhuma mudança necessária no HTML — já está dentro da `.sidebar`. Garantir apenas que o input tenha `font-size: 16px` em mobile para **evitar zoom automático no iOS**:

### 9.1 — `frontend/css/style.css`

```css
/* Adicionar */
@media (max-width: 768px) {
  .sidebar-search input,
  input[type="text"],
  input[type="email"],
  input[type="date"],
  input[type="time"],
  select,
  textarea {
    font-size: 16px; /* CRÍTICO: evita zoom automático no iOS ao focar */
  }
}
```

---

## SEÇÃO 10 — DARK MODE: SIDEBAR OVERLAY E HAMBURGER

```css
/* Adicionar ao bloco de dark-mode no style.css ou sidebar.css */
body.dark-mode .btn-hamburger {
  background: #1e293b;
  border-color: #334155;
  color: #f1f5f9;
}

body.dark-mode .btn-hamburger:hover {
  background: #273549;
  color: #93c5fd;
}

body.dark-mode .sidebar-overlay {
  background: rgba(0, 0, 0, 0.7);
}
```

---

## ORDEM DE EXECUÇÃO

| Prioridade | Seção | Impacto |
|-----------|-------|---------|
| 1 | Seção 1 | Título com nome real no modal de visualização |
| 2 | Seção 2 | Sidebar mobile drawer — bloqueante em mobile |
| 3 | Seção 3 | Main content padding com espaço pro hamburger |
| 4 | Seção 6 | Modais como drawer em mobile (iOS/Android) |
| 5 | Seção 4 | Tabelas com scroll horizontal |
| 6 | Seção 5 | Grids inline → classes colapsáveis |
| 7 | Seção 7 | KPI grid responsivo |
| 8 | Seção 8 | Botões touch-friendly |
| 9 | Seção 9 | iOS zoom fix nos inputs |
| 10 | Seção 10 | Dark mode nos novos elementos |

---

## ARQUIVOS MODIFICADOS

| Arquivo | O que muda |
|---------|-----------|
| `frontend/js/clientes.js` | Título modal = nome real do cliente |
| `frontend/js/audiencias.js` | Título modal = nome do cliente da audiência |
| `frontend/js/pericias.js` | Título modal = nome do cliente da perícia |
| `frontend/js/atendimentos.js` | Título modal = nome do cliente do atendimento |
| `frontend/js/sidebar.js` | Injetar hamburger + overlay + lógica toggle |
| `frontend/css/style.css` | Mobile: padding, modais drawer, tabelas scroll, KPI grid, touch targets, iOS zoom fix |
| `frontend/css/sidebar.css` | Hamburger, overlay, sidebar fixed+translate em mobile, dark mode |
| `frontend/audiencias.html` | Grid inline → classe `.form-row` |
| `frontend/pericias.html` | Grid inline → classe `.form-row` |
| `frontend/atendimentos.html` | Grid inline → classe `.form-row-3` |

---

## CONVENÇÕES DO PROJETO

- Sem emojis em código
- Ícones: Font Awesome 6 Free (`fa-solid`, `fa-regular`)
- Comentários CSS em português
- Commits atômicos: `fix: titulo modal exibe nome cliente`, `feat: sidebar mobile drawer`, `style: modais responsivos mobile`
- Sem `console.log` em produção
- Sem classes genéricas tipo `ai-card`