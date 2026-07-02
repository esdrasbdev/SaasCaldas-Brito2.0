# PROMPT.md — SaasCaldas-Brito 2.0 (Rodada 2)

> Execute as tarefas abaixo, na ordem apresentada, diretamente no repositório
> `esdrasbdev/SaasCaldas-Brito2.0`. Este arquivo **substitui** o `prompt.md`
> anterior (já executado — a Parte 4 dele, sobre múltiplos responsáveis em
> audiências/perícias/atendimentos/processos, já está implementada em
> `frontend/js/responsaveis-select.js` e nos 4 módulos). Esta rodada:
> (1) corrige o bug real que impede o cadastro da usuária Rayssa Lima como
> ESTAGIARIA, (2) refaz a estética do seletor de responsáveis (hoje feito só
> com `style=""` inline, sem seguir o design system do projeto), e (3) leva
> o mesmo padrão de múltiplos responsáveis, já usado em audiências/perícias/
> atendimentos/processos, para o módulo de **Clientes** — que hoje só aceita
> 1 responsável e não lista estagiários.
>
> Padrão do projeto (mantido): MVC no frontend, escrita direta ao Supabase
> via `supabase-js` no client (RLS autenticado); o backend Express só cobre
> `/api/usuarios` (admin) e alguns `GET` com cache. Não criar rotas Express
> novas para os CRUDs de clientes/audiências/etc. — eles já são feitos via
> `supabase.from(...)` no frontend. Convenções obrigatórias: sem emojis em
> UI, nomenclatura em português coerente com o domínio já existente, CSS
> usando as variáveis já definidas em `frontend/css/style.css` (nunca cores
> hex soltas em `style=""`), `showToast`, `confirmarExclusao`, disable de
> inputs em modo view.

---

## Contexto (diagnóstico já feito)

### 1. Usuária Rayssa Lima como ESTAGIARIA

- `backend/seed.js` **já tem** `rayssalima0507@gmail.com` na lista, mas com
  `role: 'ESTAGIARIO'` (masculino) — inconsistente com o pedido
  (`ESTAGIARIA`) e com o padrão já usado para outra usuária mulher do mesmo
  array (`Amanda Francinni` → `ESTAGIARIA`).
- **Isso não é a causa raiz do problema.** `backend/index.js` tem o seed
  **desligado do boot** (`// Seed REMOVIDO do startup...`, linha ~58), ou
  seja, editar `seed.js` e fazer deploy **não cria ninguém** em produção.
  O caminho real de criação de usuário é o painel `/admin.html` → botão
  "Novo Usuário", que chama `POST /api/usuarios`
  (`backend/routes/usuarios.js`).
- Analisando `POST /api/usuarios`: ele primeiro cria a conta no Supabase
  Auth (`supabaseAdmin.auth.admin.createUser`) e **só depois** insere a
  linha em `public.usuarios`. Se qualquer tentativa anterior (seed manual
  rodado localmente, ou uma tentativa pelo painel que falhou no meio do
  caminho) já criou a conta no Auth mas não a linha pública correspondente,
  toda nova tentativa de criar `rayssalima0507@gmail.com` vai falhar em
  `createUser` com erro do tipo "already been registered" — e a rota atual
  **não trata esse caso**, apenas retorna o erro cru, sem nenhuma forma de
  recuperação pela UI. Esse é o cenário mais provável para "não consigo
  cadastrar a Rayssa": conta órfã no Auth sem linha em `usuarios`.
- Bug secundário no mesmo endpoint: o insert em `usuarios` grava `email`
  sem `.toLowerCase()`, enquanto a coluna é `unique` e o `seed.js` sempre
  compara/grava em minúsculas — uma diferença de caixa entre tentativas
  pode gerar comportamento inconsistente.
- Não há hoje nenhuma ferramenta para diagnosticar esse tipo de
  inconsistência (Auth × tabela pública) — `backend/list-users.js` está
  **quebrado** (`require('./supabase')` retorna `{ supabasePublic,
  supabaseAdmin, getAdminClient }`, um objeto, não um client; o script
  chama `supabase.from(...)` diretamente e vai lançar `TypeError`).

### 2. Estética do seletor de responsáveis

- `frontend/js/responsaveis-select.js` (usado em audiências, perícias,
  atendimentos e processos) renderiza tudo com `style=""` inline, cores
  hex soltas (`#eef2ff`, `#c7d2fe`, `#f0f0f0`, `#999`) que **não seguem**
  as variáveis do design system (`--dourado`, `--azul-medio`,
  `--cinza-borda` etc. definidas em `frontend/css/style.css`), e por isso
  destoam visualmente do resto do sistema e quebram no modo escuro
  (`data-theme="dark"` já suportado pelo projeto).
- O dropdown de busca usa `position:relative` (inline, duplicado em 4
  arquivos HTML) em vez de `position:absolute` sobre um wrapper
  `position:relative` — isso faz o dropdown **empurrar o formulário para
  baixo** ao abrir, em vez de flutuar por cima, o que é exatamente o
  motivo de parecer "difícil de usar".
- Os itens do dropdown são `<div>`s simples com nome + role em texto cru,
  sem avatar, sem hover state, sem distinção visual por papel (ADMIN vs.
  Advogado vs. Estagiário).
- O mesmo bloco de `style=""` está copiado e colado em `audiencias.html`,
  `pericias.html`, `atendimentos.html` e `processos.html` — qualquer ajuste
  visual precisa ser feito em 4 lugares hoje. Vamos centralizar em CSS.

### 3. Clientes: múltiplos responsáveis + estagiários

- `frontend/clientes.html` usa um `<select id="cliente-advogado">` de
  seleção única (não múltipla).
- `frontend/js/clientes.js`, método `carregarAdvogados()` (linha ~1059),
  popula esse select filtrando **apenas** `['ADMIN', 'ADVOGADO',
  'ADVOGADA']` — estagiários (`ESTAGIARIO`/`ESTAGIARIA`) nunca aparecem,
  exatamente como reportado.
- O cliente salva só `advogado_id` (1 FK), sem tabela de junção — ao
  contrário de audiências/perícias/atendimentos/processos, que já têm
  `responsaveis_audiencia`, `responsaveis_pericia`,
  `responsaveis_atendimento` e `responsaveis_processo` (ver
  `sql/create_responsaveis_multiplos.sql`). Vamos criar
  `responsaveis_cliente` seguindo exatamente o mesmo padrão e reaproveitar
  o componente `criarSeletorResponsaveis` (já corrigido esteticamente na
  Parte 2 deste prompt) em vez de criar algo novo.
- **Importante**: a lista de clientes usada no modal de visualizar/editar
  vem do cache local `ClienteController.dadosLocais`, preenchido por
  `ClienteModel.listarTodos()` — **não** por `ClienteModel.buscarPorId()`
  (que existe no arquivo mas não é chamado em nenhum lugar). Portanto o
  `.select()` com o join da tabela de junção precisa ser adicionado em
  `listarTodos()` (é o que realmente alimenta a tela); ajustar
  `buscarPorId()` também, por consistência, mas sem depender dele.
- **Assunção** (mesma da rodada anterior): `SECRETARIA` fica fora da lista
  de responsáveis selecionáveis — não foi pedida em nenhuma das duas
  rodadas.
- **Assunção**: o campo de responsáveis em Clientes continua **opcional**
  (como o `advogado_id` já era), só passa a aceitar múltiplos e incluir
  estagiários. Diferente de audiências/perícias/atendimentos/processos,
  não vou tornar obrigatório, pois isso mudaria uma regra de negócio não
  pedida. Se Esdras quiser tornar obrigatório depois, é só adicionar a
  mesma validação de "selecione ao menos um" usada nos outros módulos.

---

## Parte 1 — Banco de dados: tabela de junção para Clientes

Criar `sql/create_responsaveis_cliente.sql` (rodar no Supabase SQL Editor
→ Project → SQL Editor → New query):

```sql
-- Permite múltiplos responsáveis por cliente, no mesmo padrão de
-- responsaveis_audiencia / responsaveis_pericia / responsaveis_atendimento
-- / responsaveis_processo (ver sql/create_responsaveis_multiplos.sql).

create table if not exists responsaveis_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  criado_em timestamptz default now(),
  unique (cliente_id, usuario_id)
);

alter table responsaveis_cliente enable row level security;

create policy "leitura_autenticados" on responsaveis_cliente
  for select using (auth.role() = 'authenticated');

create policy "escrita_autenticados" on responsaveis_cliente
  for all using (auth.role() = 'authenticated');

create index if not exists idx_resp_cliente_cliente_id
  on responsaveis_cliente(cliente_id);
```

**Importante**: manter a coluna legada `clientes.advogado_id`. Ao salvar,
continue preenchendo com o **primeiro** responsável selecionado, pelo
mesmo motivo já documentado na rodada anterior (compatibilidade/consistência
de dados — nenhum código de backend depende de `advogado_id` para
clientes, foi conferido).

---

## Parte 2 — Estética do componente `responsaveis-select.js` (afeta os 5 módulos)

### 2.1 CSS novo em `frontend/css/style.css`

Adicionar ao final do arquivo (nova seção), reaproveitando as variáveis já
existentes no `:root`:

```css
/* ===========================
   SELETOR DE RESPONSÁVEIS (multi-seleção)
   Usado em clientes, audiências, perícias, atendimentos e processos
   =========================== */
.seletor-responsaveis {
  position: relative;
}

.seletor-responsaveis input[type="text"] {
  padding-left: 38px;
}

.seletor-responsaveis::before {
  content: '\f002';
  font-family: 'Font Awesome 6 Free';
  font-weight: 900;
  position: absolute;
  left: 13px;
  top: 12px;
  color: var(--cinza-placeholder);
  font-size: 0.85rem;
  pointer-events: none;
}

.responsaveis-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 40;
  background: var(--branco);
  border: 1px solid var(--cinza-borda);
  border-radius: var(--borda-arredondada-lg);
  box-shadow: var(--sombra-elevada);
  max-height: 240px;
  overflow-y: auto;
  padding: 6px;
}

.responsaveis-dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--borda-arredondada);
  cursor: pointer;
  transition: background 0.15s ease;
}

.responsaveis-dropdown-item:hover,
.responsaveis-dropdown-item:focus-visible {
  background: var(--azul-claro);
}

.responsavel-avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--azul-medio), var(--azul-hover));
}

.responsavel-avatar.avatar-sm { width: 22px; height: 22px; font-size: 0.65rem; }

.responsavel-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }

.responsavel-nome {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--azul-escuro);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge-role {
  display: inline-block;
  width: fit-content;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 1px 8px;
  border-radius: 999px;
  text-transform: uppercase;
}

.badge-role--admin { background: var(--dourado-claro); color: var(--dourado-escuro); }
.badge-role--advogado { background: var(--azul-claro); color: var(--azul-medio); }
.badge-role--estagiario { background: rgba(16, 185, 129, 0.12); color: #047857; }

.responsaveis-dropdown-vazio {
  padding: 22px 12px;
  text-align: center;
  color: var(--cinza-medio);
  font-size: 0.85rem;
}
.responsaveis-dropdown-vazio i { display: block; font-size: 1.3rem; margin-bottom: 6px; opacity: 0.6; }

.responsaveis-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  min-height: 30px;
}

.responsaveis-tags-vazio {
  font-size: 0.82rem;
  color: var(--cinza-placeholder);
  font-style: italic;
  padding-top: 4px;
}

.tag-responsavel {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: var(--azul-claro);
  border: 1px solid var(--cinza-borda);
  color: var(--azul-medio);
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 600;
}

.tag-responsavel .fa-times {
  cursor: pointer;
  font-size: 0.7rem;
  color: var(--cinza-medio);
  transition: color 0.15s ease;
  padding: 2px;
}
.tag-responsavel .fa-times:hover { color: var(--status-prazo-vermelho); }

.seletor-responsaveis.is-disabled { opacity: 0.85; }
.seletor-responsaveis.is-disabled .tag-responsavel .fa-times { display: none; }
```

### 2.2 Reescrever `frontend/js/responsaveis-select.js`

Substituir o arquivo inteiro por (mesma API pública — `init`,
`getSelecionados`, `setSelecionados`, `limpar`, `setDisabled` — nenhum dos
4 módulos que já consomem o componente precisa mudar):

```javascript
/*
 * Componente reutilizável de seleção múltipla de responsáveis
 * Usado em clientes, audiências, perícias, atendimentos e processos
 * Roles elegíveis: ADMIN, ADVOGADO, ADVOGADA, ESTAGIARIO, ESTAGIARIA
 */
import { supabase } from './supabase.js';

const ROLES_RESPONSAVEL = ['ADMIN', 'ADVOGADO', 'ADVOGADA', 'ESTAGIARIO', 'ESTAGIARIA'];

const BADGE_POR_ROLE = {
  ADMIN: 'badge-role--admin',
  ADVOGADO: 'badge-role--advogado',
  ADVOGADA: 'badge-role--advogado',
  ESTAGIARIO: 'badge-role--estagiario',
  ESTAGIARIA: 'badge-role--estagiario'
};

const LABEL_POR_ROLE = {
  ADMIN: 'Admin',
  ADVOGADO: 'Advogado',
  ADVOGADA: 'Advogada',
  ESTAGIARIO: 'Estagiário',
  ESTAGIARIA: 'Estagiária'
};

function gerarIniciais(nome) {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const primeira = partes[0][0] || '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

export function criarSeletorResponsaveis({ inputEl, dropdownEl, tagsEl }) {
  let usuariosDisponiveis = [];
  let selecionados = [];
  const wrapperEl = inputEl.closest('.seletor-responsaveis');

  async function carregarUsuarios() {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, role')
      .eq('ativo', true)
      .in('role', ROLES_RESPONSAVEL)
      .order('nome', { ascending: true });

    if (error) {
      console.error('Erro ao carregar responsáveis:', error);
      return;
    }
    usuariosDisponiveis = data || [];
  }

  function renderizarTags() {
    if (!selecionados.length) {
      tagsEl.innerHTML = '<span class="responsaveis-tags-vazio">Nenhum responsável selecionado</span>';
      return;
    }

    tagsEl.innerHTML = selecionados.map(u => `
      <span class="tag-responsavel" data-tag-id="${u.id}">
        <span class="responsavel-avatar avatar-sm">${gerarIniciais(u.nome)}</span>
        <span>${(u.nome || '').split(' ')[0]}</span>
        <i class="fa-solid fa-times" title="Remover"></i>
      </span>
    `).join('');

    tagsEl.querySelectorAll('.tag-responsavel').forEach(tag => {
      tag.querySelector('i.fa-times')?.addEventListener('click', () => {
        selecionados = selecionados.filter(u => u.id !== tag.dataset.tagId);
        renderizarTags();
      });
    });
  }

  function renderizarDropdown(lista) {
    if (!lista.length) {
      dropdownEl.innerHTML = `
        <div class="responsaveis-dropdown-vazio">
          <i class="fa-solid fa-user-slash"></i>
          Nenhum usuário encontrado
        </div>`;
      return;
    }

    dropdownEl.innerHTML = lista.map(u => `
      <div class="responsaveis-dropdown-item" data-id="${u.id}" data-nome="${u.nome}">
        <span class="responsavel-avatar">${gerarIniciais(u.nome)}</span>
        <span class="responsavel-info">
          <span class="responsavel-nome">${u.nome}</span>
          <span class="badge-role ${BADGE_POR_ROLE[u.role] || ''}">${LABEL_POR_ROLE[u.role] || u.role}</span>
        </span>
      </div>
    `).join('');

    dropdownEl.querySelectorAll('.responsaveis-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const { id, nome } = item.dataset;
        if (!selecionados.some(u => u.id === id)) {
          selecionados.push({ id, nome });
          renderizarTags();
        }
        inputEl.value = '';
        dropdownEl.style.display = 'none';
      });
    });
  }

  function filtrar(termo) {
    const t = (termo || '').toLowerCase();
    const disponiveis = usuariosDisponiveis.filter(u => !selecionados.some(s => s.id === u.id));
    if (!t) return disponiveis.slice(0, 10);
    return disponiveis.filter(u => u.nome.toLowerCase().includes(t)).slice(0, 20);
  }

  function bindEventos() {
    inputEl.addEventListener('input', (e) => {
      renderizarDropdown(filtrar(e.target.value));
      dropdownEl.style.display = 'block';
    });
    inputEl.addEventListener('focus', () => {
      renderizarDropdown(filtrar(''));
      dropdownEl.style.display = 'block';
      inputEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dropdownEl.style.display = 'none';
        inputEl.blur();
      }
    });
    document.addEventListener('click', (e) => {
      if (e.target !== inputEl && !dropdownEl.contains(e.target)) {
        dropdownEl.style.display = 'none';
      }
    });
  }

  renderizarTags(); // estado inicial: "Nenhum responsável selecionado"

  return {
    async init() {
      await carregarUsuarios();
      bindEventos();
    },
    getSelecionados: () => selecionados,
    setSelecionados(lista) {
      selecionados = lista || [];
      renderizarTags();
    },
    limpar() {
      selecionados = [];
      renderizarTags();
    },
    setDisabled(disabled) {
      inputEl.disabled = disabled;
      wrapperEl?.classList.toggle('is-disabled', disabled);
    }
  };
}
```

### 2.3 Ajustar o HTML dos 4 módulos existentes (só markup, zero mudança de lógica)

Em `frontend/audiencias.html`, `frontend/pericias.html`,
`frontend/atendimentos.html` e `frontend/processos.html`, cada um tem um
bloco assim (prefixo `aud-`, `pericia-`, `atend-` ou `proc-`):

```html
<!-- ANTES (exemplo audiências, mesmo padrão nos outros 3) -->
<div class="form-group">
  <label>Responsáveis * (ADMIN, Advogados ou Estagiários)</label>
  <input type="text" id="aud-responsaveis-busca" placeholder="Buscar por nome..." autocomplete="off">
  <div id="aud-responsaveis-dropdown" style="display:none; position:relative; z-index:20; background:#fff; border:1px solid #e2e8f0; border-radius:8px; max-height:220px; overflow-y:auto; box-shadow:0 4px 12px rgba(0,0,0,0.08);"></div>
  <div id="aud-responsaveis-tags" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;"></div>
</div>
```

Trocar por (envolver os 3 elementos em `.seletor-responsaveis`, remover
todo `style=""` inline, manter os mesmos `id`s):

```html
<!-- DEPOIS -->
<div class="form-group">
  <label>Responsáveis * (ADMIN, Advogados ou Estagiários)</label>
  <div class="seletor-responsaveis">
    <input type="text" id="aud-responsaveis-busca" placeholder="Buscar por nome..." autocomplete="off">
    <div id="aud-responsaveis-dropdown" class="responsaveis-dropdown" style="display:none;"></div>
    <div id="aud-responsaveis-tags" class="responsaveis-tags"></div>
  </div>
</div>
```

Repetir a mesma troca (só o wrapper + remoção do `style=""`, mantendo os
`id`s específicos de cada arquivo) em `pericias.html`
(`pericia-responsaveis-*`), `atendimentos.html` (`atend-responsaveis-*`) e
`processos.html` (`proc-responsaveis-*`). Nenhum arquivo `.js` desses 4
módulos precisa mudar — a API do componente não mudou.

---

## Parte 3 — Clientes: HTML

Em `frontend/clientes.html`, dentro de `.form-grid-main`, remover o bloco:

```html
<div class="form-group">
  <label for="cliente-advogado">Advogado Responsável</label>
  <select id="cliente-advogado">
    <option value="">Selecione...</option>
  </select>
</div>
```

E, logo **depois** de `.form-grid-main` fechar (antes do comentário
`<!-- Linha 2: Contato e Pessoais -->`), adicionar como campo próprio,
fora do grid (mesmo padrão de largura total usado em processos.html):

```html
<div class="form-group">
  <label>Responsáveis (ADMIN, Advogados ou Estagiários)</label>
  <div class="seletor-responsaveis">
    <input type="text" id="cli-responsaveis-busca" placeholder="Buscar por nome..." autocomplete="off">
    <div id="cli-responsaveis-dropdown" class="responsaveis-dropdown" style="display:none;"></div>
    <div id="cli-responsaveis-tags" class="responsaveis-tags"></div>
  </div>
</div>
```

(Sem `*` no label — campo continua opcional, ver assunção na seção de
contexto.)

Também adicionar uma coluna na tabela de listagem. No `ClienteView.init()`
de `frontend/js/clientes.js`, o `<thead>` atual é:

```html
<tr>
  <th>Nome</th>
  <th>Documento</th>
  <th>Contato</th>
  <th style="text-align: right;">Ações</th>
</tr>
```

Adicionar `<th>Responsáveis</th>` antes de `Ações`, e ajustar os dois
`colspan="4"` do mesmo arquivo (linha de "Carregando..." e a mensagem de
lista vazia em `renderizarTabela`) para `colspan="5"`.

---

## Parte 4 — Clientes: JS (`frontend/js/clientes.js`)

### 4.1 Import

No topo do arquivo, junto dos outros imports:

```javascript
import { criarSeletorResponsaveis } from './responsaveis-select.js';
```

### 4.2 `ClienteModel` — incluir o join e criar `sincronizarResponsaveis`

Em `listarTodos()`, trocar:

```javascript
  async listarTodos() {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nome', { ascending: true });
```

Por:

```javascript
  async listarTodos() {
    const { data, error } = await supabase
      .from('clientes')
      .select('*, responsaveis_cliente(usuario_id, usuarios(nome))')
      .order('nome', { ascending: true });
```

**Atenção**: é `listarTodos()` que alimenta `dadosLocais`, usado tanto na
tabela quanto no modal de visualizar/editar — é aqui que o join precisa
estar. Fazer o mesmo ajuste em `buscarPorId()` por consistência (troca o
`.select('*')` por `.select('*, responsaveis_cliente(usuario_id,
usuarios(nome))')`), mesmo que hoje não seja chamado por nenhuma tela.

Adicionar um novo método ao `ClienteModel`, logo depois de `deletar()`:

```javascript
  async sincronizarResponsaveis(clienteId, selecionados) {
    await supabase.from('responsaveis_cliente').delete().eq('cliente_id', clienteId);

    if (!selecionados.length) return;

    const registros = selecionados.map(u => ({
      cliente_id: clienteId,
      usuario_id: u.id
    }));

    const { error } = await supabase.from('responsaveis_cliente').insert(registros);
    if (error) throw error;
  },
```

### 4.3 `ClienteView.renderizarTabela` — exibir responsáveis

Trocar o `<td>` de "Contato" para incluir a nova coluna logo em seguida
(entre Contato e Ações):

```javascript
        <td>
          <div><i class="fa-solid fa-envelope" style="font-size: 0.8em;"></i> ${c.email || '-'}</div>
          <div><i class="fa-solid fa-phone" style="font-size: 0.8em;"></i> ${c.telefone || '-'}</div>
        </td>
        <td>
          ${(c.responsaveis_cliente || []).map(r => r.usuarios?.nome?.split(' ')[0]).filter(Boolean).join(', ') || '—'}
        </td>
```

### 4.4 `ClienteView.abrirModal` — popular/limpar o seletor

Remover o bloco atual do `<select>` legado:

```javascript
      const advogadoSelect = document.getElementById('cliente-advogado');
      if (advogadoSelect) {
        const advId = cliente.advogado_id ?? '';
        advogadoSelect.value = String(advId);
        const hasOption = Array.from(advogadoSelect.options).some(o => String(o.value) === String(advId));
        if (!hasOption) advogadoSelect.value = '';
      }
```

Substituir por (usa o mesmo padrão de audiências/processos — nome do
campo de junção do lado do cliente é `responsaveis_cliente`):

```javascript
      const responsaveisSelecionados = (cliente.responsaveis_cliente || []).map(r => ({
        id: r.usuario_id,
        nome: r.usuarios?.nome || ''
      }));
      ClienteController.seletorResp?.setSelecionados(responsaveisSelecionados);
      ClienteController.seletorResp?.setDisabled(visualizacao);
```

(`ClienteView` referenciar `ClienteController` diretamente já é um padrão
existente neste mesmo arquivo — ver `ClienteController.atualizarSessaoDocumentos`
sendo chamado de dentro de listeners declarados no controller; aqui é o
mesmo tipo de referência cruzada, segura porque só é executada depois do
módulo inteiro já estar carregado.)

No branch `else` (cliente novo) do mesmo método, que hoje é:

```javascript
    } else {
      document.getElementById('cliente-inss-cpf').value = '';
      this.renderizarSessaoDocumentos(null, false);
    }
```

Adicionar a limpeza do seletor:

```javascript
    } else {
      document.getElementById('cliente-inss-cpf').value = '';
      this.renderizarSessaoDocumentos(null, false);
      ClienteController.seletorResp?.limpar();
      ClienteController.seletorResp?.setDisabled(false);
    }
```

### 4.5 `ClienteController` — instanciar o seletor, remover `carregarAdvogados`

Trocar:

```javascript
  async init() {
    ClienteView.init();
    this.bindEvents();
    await this.carregarAdvogados();
    await this.carregarDados();
  },

  async carregarAdvogados() {
    const select = document.getElementById('cliente-advogado');
    if (!select) return;

    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome')
      .in('role', ['ADMIN', 'ADVOGADO', 'ADVOGADA'])
      .eq('ativo', true)
      .order('nome');

    if (error) {
      return;
    }

    select.innerHTML = '<option value="">Selecione...</option>' +
      data.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
  },
```

Por:

```javascript
  seletorResp: null,

  async init() {
    ClienteView.init();
    this.bindEvents();

    this.seletorResp = criarSeletorResponsaveis({
      inputEl: document.getElementById('cli-responsaveis-busca'),
      dropdownEl: document.getElementById('cli-responsaveis-dropdown'),
      tagsEl: document.getElementById('cli-responsaveis-tags')
    });
    await this.seletorResp.init();

    await this.carregarDados();
  },
```

### 4.6 `ClienteController.salvarCliente` — usar o seletor e sincronizar

Trocar a linha do payload:

```javascript
      advogado_id: getVal('cliente-advogado'),
```

Por (primeiro responsável selecionado vira o `advogado_id` legado, mesmo
padrão dos outros 4 módulos):

```javascript
      advogado_id: selecionados[0]?.id || null,
```

E no início do método, logo após pegar o `id`, capturar a seleção atual:

```javascript
  async salvarCliente() {
    const id = document.getElementById('cliente-id').value;
    const selecionados = this.seletorResp?.getSelecionados() || [];
```

Por fim, no bloco de salvamento, capturar o registro salvo (criado ou
atualizado) para sincronizar a tabela de junção depois. Trocar:

```javascript
    try {
      if (id) {
        const { usuario_id, ...dadosAtualizacao } = payload;
        await ClienteModel.atualizar(id, dadosAtualizacao);
      } else {
        try {
          await ClienteModel.criar(payload);
        } catch (err) {
          const isColumnMissing = err.code === '42703';
          const isFKViolation = err.code === '23503';

          if (isColumnMissing || isFKViolation || (err.message && err.message.includes('inss_senha'))) {
            const { usuario_id, inss_senha, ...dadosReduzidos } = payload;
            await ClienteModel.criar(dadosReduzidos);
          } else {
            throw err;
          }
        }
      }

      ClienteView.fecharModal();
      showToast('Cliente salvo com sucesso!', 'success');
      await this.carregarDados();
    } catch (error) {
```

Por:

```javascript
    try {
      let registroSalvo;

      if (id) {
        const { usuario_id, ...dadosAtualizacao } = payload;
        registroSalvo = await ClienteModel.atualizar(id, dadosAtualizacao);
      } else {
        try {
          registroSalvo = await ClienteModel.criar(payload);
        } catch (err) {
          const isColumnMissing = err.code === '42703';
          const isFKViolation = err.code === '23503';

          if (isColumnMissing || isFKViolation || (err.message && err.message.includes('inss_senha'))) {
            const { usuario_id, inss_senha, ...dadosReduzidos } = payload;
            registroSalvo = await ClienteModel.criar(dadosReduzidos);
          } else {
            throw err;
          }
        }
      }

      const clienteIdFinal = id || registroSalvo?.id;
      if (clienteIdFinal) {
        await ClienteModel.sincronizarResponsaveis(clienteIdFinal, selecionados);
      }

      ClienteView.fecharModal();
      showToast('Cliente salvo com sucesso!', 'success');
      await this.carregarDados();
    } catch (error) {
```

(O restante do `catch` permanece igual — não alterar.)

---

## Parte 5 — Correção do cadastro da Rayssa Lima (ESTAGIARIA)

### 5.1 `backend/seed.js` — consistência de gênero no role

Trocar:

```javascript
    { nome: 'Rayssa Lima', email: 'rayssalima0507@gmail.com', pass: 'estagio123', role: 'ESTAGIARIO' },
```

Por:

```javascript
    { nome: 'Rayssa Lima', email: 'rayssalima0507@gmail.com', pass: 'estagia123', role: 'ESTAGIARIA' },
```

(Senha alinhada ao padrão já usado para a outra estagiária do array,
`Amanda Francinni` → `estagia123`/`ESTAGIARIA`. Se Rayssa já tiver
logado alguma vez com `estagio123`, avise-a da troca — ou mantenha
`estagio123` e ajuste só o `role`, como preferir.)

Isso é só consistência — **não é a correção que resolve o problema**,
porque o seed não roda em produção (ver Parte 5.2 e diagnóstico). Mantê-lo
correto evita confusão caso alguém rode `node backend/seed.js` localmente.

### 5.2 `backend/routes/usuarios.js` — reconciliar conta órfã no Auth

Este é o fix que resolve a causa raiz. Substituir a rota `POST /` inteira:

```javascript
// POST / — criar usuário (cria no Auth + insere na tabela pública)
router.post('/', soAdmin, async (req, res) => {
  const { nome, email, role, senha } = req.body;

  if (!nome || !email || !role || !senha) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, email, role, senha.' });
  }

  const emailNormalizado = email.toLowerCase();

  try {
    let userId;
    let criadoAgoraNoAuth = false;

    // 1) Criar no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailNormalizado,
      password: senha,
      email_confirm: true
    });

    if (authError) {
      const jaExiste = authError.message && (
        authError.message.toLowerCase().includes('already been registered') ||
        authError.message.toLowerCase().includes('already registered') ||
        authError.code === 'email_exists'
      );

      if (!jaExiste) {
        throw new Error('Erro ao criar conta Auth: ' + authError.message);
      }

      // 1b) Reconciliação: a conta já existe no Auth (ex.: tentativa
      // anterior que falhou entre a criação do Auth e o insert na tabela
      // pública). Localiza a conta existente e reaproveita o id, em vez
      // de travar o cadastro sem explicação.
      const { data: listagem, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw new Error('Erro ao localizar conta existente: ' + listError.message);

      const existente = listagem.users.find(u => u.email?.toLowerCase() === emailNormalizado);
      if (!existente) {
        throw new Error('Conta já registrada no Auth, mas não foi possível localizá-la para reconciliar. Verifique manualmente no painel do Supabase.');
      }

      userId = existente.id;

      // Garante que a senha informada agora passe a valer.
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: senha,
        email_confirm: true
      });
    } else {
      userId = authData.user.id;
      criadoAgoraNoAuth = true;
    }

    // 2) Já existe linha correspondente na tabela pública?
    const { data: linhaExistente } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('email', emailNormalizado)
      .maybeSingle();

    if (linhaExistente) {
      const { error: updError } = await supabaseAdmin
        .from('usuarios')
        .update({ nome, role, ativo: true })
        .eq('email', emailNormalizado);
      if (updError) throw new Error('Erro ao atualizar cadastro existente: ' + updError.message);

      cache.del('usuarios_list');
      return res.json({ ok: true, id: linhaExistente.id, reconciliado: true });
    }

    // 3) Inserir na tabela pública de usuários
    const { error: dbError } = await supabaseAdmin.from('usuarios').insert({
      id: userId,
      nome,
      email: emailNormalizado,
      role,
      ativo: true
    });

    if (dbError) {
      // Só reverte o Auth se fomos nós que acabamos de criar a conta
      // agora — se veio de reconciliação, a conta é de um fluxo anterior
      // e não deve ser apagada por uma falha de insert.
      if (criadoAgoraNoAuth) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }
      throw new Error('Erro ao inserir na tabela usuarios: ' + dbError.message);
    }

    cache.del('usuarios_list');
    res.json({ ok: true, id: userId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

### 5.3 Novo script de diagnóstico: `backend/diagnosticar-usuario.js`

Criar este arquivo (script local, roda com `node backend/diagnosticar-usuario.js
<email>` usando as variáveis do `backend/.env` — não afeta produção):

```javascript
/*
 * Script de diagnóstico: verifica o estado de um usuário nas duas camadas
 * (Supabase Auth e tabela pública 'usuarios') e aponta inconsistências.
 * Uso: node backend/diagnosticar-usuario.js email@exemplo.com
 */
const { getAdminClient } = require('./supabase.js');

async function diagnosticar(email) {
  if (!email) {
    console.error('Uso: node backend/diagnosticar-usuario.js email@exemplo.com');
    process.exit(1);
  }

  const supabase = getAdminClient();
  const emailNormalizado = email.toLowerCase();

  const { data: listagem, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Erro ao listar usuários do Auth (verifique SUPABASE_SERVICE_ROLE_KEY no backend/.env):', listError.message);
    process.exit(1);
  }

  const authUser = listagem.users.find(u => u.email?.toLowerCase() === emailNormalizado);

  const { data: dbUser, error: dbError } = await supabase
    .from('usuarios')
    .select('id, nome, email, role, ativo')
    .eq('email', emailNormalizado)
    .maybeSingle();

  if (dbError) {
    console.error('Erro ao consultar tabela usuarios:', dbError.message);
  }

  console.log(`--- Diagnóstico: ${email} ---`);
  console.log('Existe no Supabase Auth:', authUser ? `SIM (id: ${authUser.id})` : 'NÃO');
  console.log('Existe na tabela usuarios:', dbUser ? `SIM (role: ${dbUser.role}, ativo: ${dbUser.ativo})` : 'NÃO');

  if (authUser && !dbUser) {
    console.log('\nSituação: conta órfã — existe no Auth mas não na tabela pública.');
    console.log('Solução: crie o usuário novamente pelo painel /admin.html com o mesmo');
    console.log('e-mail. A rota POST /api/usuarios agora reconcilia esse caso automaticamente.');
  } else if (!authUser && dbUser) {
    console.log('\nSituação: existe na tabela pública mas não no Auth — o login vai falhar.');
  } else if (authUser && dbUser && authUser.id !== dbUser.id) {
    console.log('\nSituação: IDs divergentes entre Auth e tabela pública — isso quebra o login.');
  } else if (authUser && dbUser) {
    console.log('\nSituação: consistente nas duas camadas.');
  } else {
    console.log('\nSituação: não existe em nenhuma das duas camadas. Pode criar normalmente.');
  }

  process.exit(0);
}

diagnosticar(process.argv[2]);
```

### 5.4 Runbook para (re)cadastrar a Rayssa (fazer depois do deploy da Parte 5.2)

1. `cd backend && node diagnosticar-usuario.js rayssalima0507@gmail.com`
   e ver o que o script reporta.
2. Se aparecer "conta órfã": ir em `/admin.html` (logado como ADMIN) →
   "Novo Usuário" → preencher nome `Rayssa Lima`, e-mail
   `rayssalima0507@gmail.com`, permissão `ESTAGIÁRIA`, senha nova → Salvar.
   Com o fix da Parte 5.2, isso agora reconcilia a conta órfã em vez de
   travar com "e-mail já cadastrado".
3. Se aparecer "não existe em nenhuma das duas camadas": mesmo passo 2,
   fluxo normal de criação.
4. Rodar o diagnóstico de novo para confirmar `SIM`/`SIM` com o mesmo id
   nas duas camadas.
5. Testar login com o e-mail e a senha definida no passo 2.

---

## Ordem de execução recomendada

1. Rodar a migration SQL da Parte 1 no Supabase.
2. CSS da Parte 2.1 em `frontend/css/style.css`.
3. Reescrever `frontend/js/responsaveis-select.js` (Parte 2.2).
4. Ajustar o HTML dos 4 módulos existentes (Parte 2.3).
5. HTML de Clientes (Parte 3).
6. JS de Clientes (Parte 4).
7. `backend/seed.js` (Parte 5.1) e `backend/routes/usuarios.js` (Parte 5.2).
8. Deploy do backend.
9. Criar `backend/diagnosticar-usuario.js` (Parte 5.3) e seguir o runbook
   (Parte 5.4) para a Rayssa.

## Critérios de aceite

- [ ] Em Clientes, é possível selecionar 2+ responsáveis dentre ADMIN,
      ADVOGADO, ADVOGADA, ESTAGIARIO e ESTAGIARIA (estagiários aparecem na
      busca, o que hoje não acontece).
- [ ] Os responsáveis de um cliente persistem após reload (recarregados de
      `responsaveis_cliente`) e aparecem na coluna "Responsáveis" da
      listagem.
- [ ] O seletor de responsáveis (em Clientes, audiências, perícias,
      atendimentos e processos) abre um dropdown flutuante (não empurra o
      formulário), com avatar + nome + badge de papel coloridos conforme o
      design system do projeto, sem nenhum `style=""` de cor hardcoded.
- [ ] O mesmo componente funciona igual nos 4 módulos que já usavam
      `criarSeletorResponsaveis` — nenhuma regressão funcional, só visual.
- [ ] `node backend/diagnosticar-usuario.js rayssalima0507@gmail.com`
      reporta a situação real da conta (órfã, inexistente ou consistente).
- [ ] Criar/reconciliar `rayssalima0507@gmail.com` pelo painel
      `/admin.html` funciona mesmo se já existir uma conta órfã no Auth, e
      ela loga com sucesso como `ESTAGIARIA`.
- [ ] Criar um usuário novo do zero (e-mail nunca usado antes) continua
      funcionando normalmente pelo painel (sem regressão no fluxo feliz).