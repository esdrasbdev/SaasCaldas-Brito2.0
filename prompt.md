# PROMPT — Melhorias SaasCaldas-Brito 2.0
**Data:** Junho de 2025  
**Executor:** Cursor / Windsurf (AI IDE)  
**Repositório:** `SaasCaldas-Brito2.0`  
**Stack:** Vanilla JS ES Modules · Supabase · Vercel · Sem frameworks de UI

---

## Contexto do Projeto

Sistema de gestão jurídica para a Advocacia Caldas & Brito (~1.000 processos ativos).  
Frontend em Vanilla JS puro com ES Modules, sem frameworks (React, Vue etc.).  
Sem emojis. Ícones via Font Awesome 6 Free. CSS com variáveis CSS em português.  
Comentários em português. Código limpo, sem padrões genéricos de IA.

---

## BLOCO 1 — Correção Crítica: Bug de Inicialização no `admin.js`

### Diagnóstico
`admin.js` exporta `AdminController.init()` com chamada síncrona no `DOMContentLoaded`, **sem chamar `await initSupabase()` antes**. O `supabase` exportado de `supabase.js` é um Proxy que lança `Error: Supabase não inicializado. Chame await initSupabase() antes.` se `_client` ainda for `null`.

Isso causa o erro no console:
```
Uncaught (in promise) Error: Supabase não inicializado. Chame await initSupabase() antes.
at Object.get (supabase.js:36:25)
at Object.carregar (admin.js:175:44)
```

### Correção: `frontend/js/admin.js`

**Linha atual (incorreta):**
```js
document.addEventListener('DOMContentLoaded', () => AdminController.init());
```

**Substituir por:**
```js
document.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();
  AdminController.init();
});
```

**Adicionar import no topo do arquivo (se ausente):**
```js
import { supabase, initSupabase } from './supabase.js';
```

### Também corrigir: `frontend/admin.html`
Adicionar `js/env.js` antes dos módulos (já existe nas outras páginas):
```html
<script src="js/env.js"></script>
```
E adicionar `initSupabase` nos scripts de módulo, garantindo a ordem:
```html
<script type="module" src="js/supabase.js"></script>
<script type="module" src="js/auth.js"></script>
<script type="module" src="js/guard.js"></script>
<script type="module" src="js/sidebar.js"></script>
<script type="module" src="js/admin.js"></script>
```

---

## BLOCO 2 — Gerenciamento Completo de Usuários (Admin)

### 2.1 — Campo de Senha ao Criar Usuário

O modal de criação de usuário não solicita senha. O criado vai parar apenas na tabela `usuarios` sem vínculo com o Supabase Auth. Corrigir o fluxo completo.

#### `frontend/js/admin.js` — `AdminView.abrirModal()`
Adicionar campo de senha dentro do `modal-body` do formulário, **visível apenas na criação** (oculto na edição):

```html
<div class="form-group" id="grupo-senha">
  <label for="user-senha">Senha de Acesso *</label>
  <input type="password" id="user-senha" minlength="8" autocomplete="new-password">
  <small style="color: var(--cinza-medio); font-size: 0.78rem;">Mínimo 8 caracteres. O usuário poderá alterar depois.</small>
</div>
```

No método `abrirModal()`:
```js
const grupoSenha = document.getElementById('grupo-senha');
const inputSenha = document.getElementById('user-senha');

if (usuario) {
  // Edição: oculta senha
  if (grupoSenha) grupoSenha.style.display = 'none';
  if (inputSenha) inputSenha.removeAttribute('required');
} else {
  // Criação: exibe e torna obrigatório
  if (grupoSenha) grupoSenha.style.display = 'block';
  if (inputSenha) inputSenha.setAttribute('required', 'required');
}
```

#### `AdminController` — `form.onsubmit` para criação:
Substituir o insert direto por chamada à API do backend:

```js
if (!id) {
  const senha = document.getElementById('user-senha')?.value;
  if (!senha || senha.length < 8) {
    showToast('Senha deve ter no mínimo 8 caracteres.', 'error');
    return;
  }

  // 1. Cria o usuário no Supabase Auth via backend (service role)
  const apiUrl = getApiUrl();
  const resAuth = await fetch(`${apiUrl}/admin/criar-usuario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: dados.email,
      password: senha,
      nome: dados.nome,
      role: dados.role
    })
  });

  const jsonAuth = await resAuth.json();
  if (!resAuth.ok) {
    showToast('Erro ao criar usuário: ' + (jsonAuth.error || jsonAuth.message), 'error');
    return;
  }

  showToast('Usuário criado com sucesso!', 'success');
}
```

### 2.2 — Rota Backend: Criar Usuário com Auth

#### `backend/routes/admin.js` (criar se não existir, ou adicionar à rota existente):

```js
// POST /api/admin/criar-usuario
router.post('/criar-usuario', async (req, res) => {
  const { email, password, nome, role } = req.body;

  if (!email || !password || !nome || !role) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  try {
    // Usa service role para criar usuário no Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) return res.status(400).json({ error: authError.message });

    // Insere na tabela pública
    const { error: dbError } = await supabaseAdmin
      .from('usuarios')
      .insert({ id: authData.user.id, nome, email, role, ativo: true });

    if (dbError) {
      // Rollback: remove do Auth se falhou no DB
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: dbError.message });
    }

    return res.json({ success: true, userId: authData.user.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
```

Registrar em `backend/index.js`:
```js
import adminRoutes from './routes/admin.js';
app.use('/api/admin', adminRoutes);
```

### 2.3 — Troca de Senha pelo Admin (qualquer usuário, incluindo o próprio)

#### `frontend/js/admin.js` — Adicionar botão "Alterar Senha" na tabela:

Na função `renderizarTabela()`, adicionar botão na coluna de ações:
```js
<button class="btn-sm btn-senha" data-id="${u.id}" data-email="${u.email}" title="Alterar Senha">
  <i class="fa-solid fa-key"></i>
</button>
```

Adicionar modal de senha separado no HTML do admin (injetado via `AdminView.init()`):
```html
<div id="modal-senha" class="modal-overlay" style="display: none;">
  <div class="modal-content" style="max-width: 420px;">
    <div class="modal-header">
      <h2>Alterar Senha</h2>
    </div>
    <div class="modal-body">
      <input type="hidden" id="senha-user-id">
      <p id="senha-user-email" style="font-size:0.85rem; color:var(--cinza-medio); margin-bottom:12px;"></p>
      <div class="form-group">
        <label>Nova Senha *</label>
        <input type="password" id="nova-senha" minlength="8" required>
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <label>Confirmar Senha *</label>
        <input type="password" id="confirmar-senha" minlength="8" required>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" id="btn-cancelar-senha">Cancelar</button>
      <button type="button" class="btn btn-primary" id="btn-salvar-senha">Salvar Senha</button>
    </div>
  </div>
</div>
```

No `bindEvents()`, adicionar handler:
```js
// Botão alterar senha
document.getElementById('lista-usuarios-body').addEventListener('click', async (e) => {
  const btnSenha = e.target.closest('.btn-senha');
  if (btnSenha) {
    document.getElementById('senha-user-id').value = btnSenha.dataset.id;
    document.getElementById('senha-user-email').textContent = `Usuário: ${btnSenha.dataset.email}`;
    document.getElementById('nova-senha').value = '';
    document.getElementById('confirmar-senha').value = '';
    document.getElementById('modal-senha').style.display = 'flex';
  }
});

document.getElementById('btn-cancelar-senha').onclick = () => {
  document.getElementById('modal-senha').style.display = 'none';
};

document.getElementById('btn-salvar-senha').onclick = async () => {
  const userId = document.getElementById('senha-user-id').value;
  const nova = document.getElementById('nova-senha').value;
  const confirmar = document.getElementById('confirmar-senha').value;

  if (!nova || nova.length < 8) {
    showToast('A senha deve ter no mínimo 8 caracteres.', 'error');
    return;
  }
  if (nova !== confirmar) {
    showToast('As senhas não conferem.', 'error');
    return;
  }

  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/admin/alterar-senha`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password: nova })
  });

  const json = await res.json();
  if (!res.ok) {
    showToast('Erro: ' + (json.error || json.message), 'error');
  } else {
    showToast('Senha alterada com sucesso!', 'success');
    document.getElementById('modal-senha').style.display = 'none';
  }
};
```

#### `backend/routes/admin.js` — Rota alterar senha:
```js
// POST /api/admin/alterar-senha
router.post('/alterar-senha', async (req, res) => {
  const { userId, password } = req.body;

  if (!userId || !password || password.length < 8) {
    return res.status(400).json({ error: 'userId e senha (mín. 8 chars) são obrigatórios.' });
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
```

### 2.4 — Desabilitar vs Excluir Usuário

O botão de exclusão remove da tabela `usuarios`, mas não do Supabase Auth. Corrigir:

- Remover o botão "Excluir" (`fa-trash`) da tabela de usuários.
- O controle deve ser feito pelo campo **Status (Ativo/Inativo)** na edição.
- Ao setar `ativo: false`, o sistema deve também banir no Auth:

```js
// No onsubmit do form de edição (quando ativo === false):
if (dados.ativo === false) {
  const apiUrl = getApiUrl();
  await fetch(`${apiUrl}/admin/desativar-usuario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: id })
  });
}
```

Rota backend:
```js
// POST /api/admin/desativar-usuario
router.post('/desativar-usuario', async (req, res) => {
  const { userId } = req.body;
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '87600h' }); // 10 anos
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
```

Ao reativar (`ativo: true`), chamar `ban_duration: 'none'` na mesma rota.

---

## BLOCO 3 — Visibilidade dos Modais e Nome Completo do Cliente

### Diagnóstico
O `.modal-header h2` nos modais de Audiências, Perícias, Clientes e Atendimentos exibe nomes truncados ou hardcoded (ex: "Detalhes da Audiência" mesmo com cliente disponível). Em telas menores o overflow é `hidden` sem `title` de acessibilidade.

### Correções em `frontend/css/style.css`

```css
/* Nome completo no header do modal — sem truncamento */
.modal-header h2 {
  white-space: normal;        /* era nowrap ou herdado como nowrap */
  overflow: visible;
  text-overflow: unset;
  word-break: break-word;
  line-height: 1.35;
  font-size: 1.1rem;
}

/* Modal com mais visibilidade — z-index e sombra reforçados */
.modal-overlay {
  z-index: 1000;
  background: rgba(15, 23, 42, 0.65);  /* era 0.5, pouco contrastado */
  backdrop-filter: blur(4px);
}

.modal-content {
  box-shadow: 0 24px 48px -8px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0,0,0,0.06);
  border-radius: 16px;
  max-height: 92vh;
}
```

### Correção em `frontend/js/audiencias.js` — `btnView` handler

Substituir a atribuição hardcoded do header por:
```js
const headerEl = document.querySelector('#form-audiencia .modal-header h2');
if (headerEl) {
  // Usa nome do cliente se disponível, caso contrário o tipo de audiência
  const nomeCliente = clienteNome !== '—' ? clienteNome : null;
  const tipoAud = audiencia.tipo || '';
  const dataFmt = audiencia.data ? new Date(audiencia.data).toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' }) : '';
  headerEl.textContent = nomeCliente
    ? `${nomeCliente} — ${tipoFmt(tipoAud)} ${dataFmt}`
    : `Audiência — ${tipoFmt(tipoAud)} ${dataFmt}`;
  headerEl.title = headerEl.textContent; // acessibilidade: hover mostra completo
}

// Função auxiliar (pode ser no escopo do módulo):
function tipoFmt(tipo) {
  return tipo ? `(${tipo})` : '';
}
```

---

## BLOCO 4 — Corrigir Layout da Tabela de Audiências

### Diagnóstico
No `audiencias.js`, a renderização coloca **Tipo** e **tipoBadge** dentro da célula de "Local", enquanto o `thead` do `audiencias.html` lista as colunas como:  
`Cliente | Data | Local | Tipo | Ações`  
Mas o `tbody` gerado tem apenas **4 colunas**, não 5. O Tipo aparece no local errado e os botões de ação transbordam sem coluna de cabeçalho correta.

### Correção em `frontend/audiencias.html` — cabeçalho da tabela

```html
<thead>
  <tr>
    <th style="width: 140px;">Data / Hora</th>
    <th>Cliente / Processo</th>
    <th>Local</th>
    <th style="width: 110px;">Tipo</th>
    <th style="width: 110px; text-align: right;">Ações</th>
  </tr>
</thead>
```

### Correção em `frontend/js/audiencias.js` — `renderizarTabela()`

Substituir o bloco do `return` do `.map()` por:

```js
return `
  <tr>
    <td style="width:140px; white-space:nowrap;">
      <div style="font-weight:600; color:var(--azul-escuro); font-size:0.9rem;">${dataTxt}</div>
      <div style="font-size:0.8rem; color:var(--cinza-medio);">${horaTxt}</div>
    </td>
    <td>
      <div style="font-weight:600; font-size:0.9rem;">${clienteNome}</div>
      <div style="font-size:0.75rem; color:var(--cinza-medio);">CNJ: ${numeroCnj}</div>
    </td>
    <td>
      <div style="font-size:0.85rem;">${a.local || 'Virtual'}</div>
    </td>
    <td style="width:110px;">
      ${tipoBadge}
    </td>
    <td style="width:110px; text-align:right; vertical-align:middle;">
      <div style="display:flex; gap:6px; justify-content:flex-end; align-items:center;">
        <button class="btn-sm btn-view" data-id="${a.id}" title="Visualizar">
          <i class="fa-solid fa-eye"></i>
        </button>
        <button class="btn-sm btn-edit" data-id="${a.id}" title="Editar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn-sm btn-delete" data-id="${a.id}" style="color:#ef4444;" title="Excluir">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </td>
  </tr>
`;
```

---

## BLOCO 5 — Remover Placeholders dos Modais

Os placeholders nas tags `input` atrapalham o uso (textos ficam sobrepostos ao digitar, e em mobile causam confusão). Remover `placeholder` de todos os `<input>` e `<textarea>` nos seguintes arquivos HTML:

- `frontend/audiencias.html`
- `frontend/pericias.html`
- `frontend/atendimentos.html`
- `frontend/clientes.html`
- `frontend/processos.html`

### Regra de substituição global

**Remover todos os atributos `placeholder="..."` de `<input>` e `<textarea>` dentro de `.modal-body`.**

Referência de busca (regex para o editor):
```
placeholder="[^"]*"
```

Substituir por: *(string vazia — remove o atributo)*

**Exceções — manter placeholder apenas em:**
- Campos de **busca** (`input[id*="busca"]`): eles precisam do placeholder para orientar.
- Nenhuma outra exceção.

---

## BLOCO 6 — Atendimentos: Campo de Responsável

### Diagnóstico
A tabela `atendimentos` tem `usuario_id` que salva o usuário logado. O campo não permite escolher um responsável diferente — útil quando um advogado registra um atendimento que será tratado por outro colega.

### 6.1 — Adicionar campo no HTML: `frontend/atendimentos.html`

Dentro do `modal-body` do `#form-atendimento`, após o select de Cliente, inserir:

```html
<div class="form-group">
  <label>Responsável pelo Atendimento *</label>
  <select id="atend-responsavel" required>
    <option value="">Selecione...</option>
  </select>
</div>
```

### 6.2 — Popular o select em `frontend/js/atendimentos.js`

Adicionar função de carregamento de usuários ativos:

```js
async function carregarResponsaveis() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, role')
    .eq('ativo', true)
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao carregar responsáveis:', error);
    return;
  }

  const select = document.getElementById('atend-responsavel');
  if (!select) return;

  select.innerHTML = '<option value="">Selecione...</option>' +
    (data || []).map(u => `<option value="${u.id}">${u.nome} (${u.role})</option>`).join('');
}
```

Chamar `await carregarResponsaveis()` no `DOMContentLoaded` junto com os outros carregamentos.

### 6.3 — Incluir no payload de salvamento

No `controller.salvar`, dentro do `payload`:

```js
const payload = {
  cliente_id: document.getElementById('atend-cliente').value,
  titulo: document.getElementById('atend-titulo').value,
  data: dataIso,
  canal: document.getElementById('atend-canal').value,
  duracao: document.getElementById('atend-duracao').value,
  anotacoes: document.getElementById('atend-anotacoes').value,
  usuario_id: document.getElementById('atend-responsavel').value || usuarioDB.id
  // Se não selecionar ninguém, cai para o usuário logado como fallback
};
```

### 6.4 — Exibir responsável nas cards de atendimento

Em `view.renderizar()`, no bloco de cada atendimento, adicionar o nome do responsável:

```js
const respNome = view.getRespNome(d);
// Dentro do HTML da card, adicionar:
// <span style="font-size:0.78rem; color:var(--cinza-medio);">
//   <i class="fa-solid fa-user-tie" style="font-size:0.7rem;"></i> ${respNome}
// </span>
```

### 6.5 — Popular o select ao editar/visualizar

No handler de edição, após carregar o atendimento:

```js
const selectResp = document.getElementById('atend-responsavel');
if (selectResp && data.usuario_id) selectResp.value = data.usuario_id;
```

---

## BLOCO 7 — Anexo de Documentos em Clientes (Vercel Blob)

### 7.1 — Configurar Vercel Blob

#### Passo a passo de configuração (executar fora do código):

1. No painel Vercel → aba **Storage** → **Create Store** → tipo **Blob**.
2. Vincular ao projeto `juridico-caldas-brito`.
3. Copiar a variável `BLOB_READ_WRITE_TOKEN` para as **Environment Variables** do projeto no Vercel.
4. Testar localmente com `.env`:
```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxx
```

#### Instalar pacote no backend:
```bash
cd backend && npm install @vercel/blob
```

### 7.2 — Rota de Upload no Backend: `backend/routes/documentos.js`

```js
import { put } from '@vercel/blob';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20 MB

// POST /api/documentos/upload
router.post('/upload', upload.single('arquivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

  const { clienteId, processoId } = req.body;
  const nomeArquivo = req.file.originalname;
  const caminhoBlob = `documentos/${clienteId || 'geral'}/${Date.now()}-${nomeArquivo}`;

  try {
    const blob = await put(caminhoBlob, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype
    });

    // Salvar referência no Supabase
    const { data, error } = await supabaseAdmin.from('documentos').insert({
      nome: nomeArquivo,
      url: blob.url,
      tamanho: req.file.size,
      tipo: req.file.mimetype,
      cliente_id: clienteId || null,
      processo_id: processoId || null,
      upload_por: req.body.usuarioId || null
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ sucesso: true, documento: data, url: blob.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/documentos?clienteId=xxx
router.get('/', async (req, res) => {
  const { clienteId, processoId } = req.query;
  let query = supabaseAdmin.from('documentos').select('*').order('criado_em', { ascending: false });
  if (clienteId) query = query.eq('cliente_id', clienteId);
  if (processoId) query = query.eq('processo_id', processoId);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// DELETE /api/documentos/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { data: doc } = await supabaseAdmin.from('documentos').select('url').eq('id', id).single();

  if (doc?.url) {
    try { await del(doc.url); } catch (_) { /* ignora falha no blob */ }
  }

  const { error } = await supabaseAdmin.from('documentos').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ sucesso: true });
});
```

Adicionar import de `del` no topo:
```js
import { put, del } from '@vercel/blob';
```

### 7.3 — Seção de Documentos na Página de Clientes

Em `frontend/clientes.html`, dentro do modal ou como seção abaixo da lista de clientes, adicionar painel de documentos por cliente:

```html
<!-- Seção de documentos por cliente (abaixo da tabela de clientes) -->
<div id="painel-documentos" class="card-section" style="display:none;">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
    <h2 id="docs-cliente-titulo">Documentos</h2>
    <button id="btn-fechar-docs" class="btn-secondary">
      <i class="fa-solid fa-xmark"></i> Fechar
    </button>
  </div>

  <!-- Upload -->
  <div style="margin-bottom:16px;">
    <label
      id="label-upload-doc"
      class="btn-primary"
      style="cursor:pointer; display:inline-flex; align-items:center; gap:8px;"
    >
      <i class="fa-solid fa-file-arrow-up"></i> Anexar Documento
      <input type="file" id="input-arquivo" style="display:none;" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt">
    </label>
    <span id="upload-status" style="font-size:0.82rem; color:var(--cinza-medio); margin-left:12px;"></span>
  </div>

  <!-- Lista de documentos -->
  <div id="lista-docs" class="table-responsive">
    <table class="recent-table">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Tipo</th>
          <th>Tamanho</th>
          <th>Data</th>
          <th style="text-align:right;">Ações</th>
        </tr>
      </thead>
      <tbody id="docs-tbody">
        <tr><td colspan="5" class="text-center">Nenhum documento.</td></tr>
      </tbody>
    </table>
  </div>
</div>
```

### 7.4 — Lógica em `frontend/js/clientes.js`

Adicionar botão de documentos na linha de cada cliente da tabela (coluna de ações):

```js
<button class="btn-sm btn-docs" data-id="${c.id}" data-nome="${c.nome}" title="Documentos">
  <i class="fa-solid fa-paperclip"></i>
</button>
```

Adicionar as funções de controle de documentos no módulo:

```js
let clienteAtivoDocs = null;
const apiUrl = getApiUrl();

async function abrirDocumentos(clienteId, clienteNome) {
  clienteAtivoDocs = clienteId;
  document.getElementById('docs-cliente-titulo').textContent = `Documentos — ${clienteNome}`;
  document.getElementById('painel-documentos').style.display = 'block';
  document.getElementById('painel-documentos').scrollIntoView({ behavior: 'smooth' });
  await carregarDocumentos(clienteId);
}

async function carregarDocumentos(clienteId) {
  const res = await fetch(`${apiUrl}/documentos?clienteId=${clienteId}`);
  const docs = await res.json();
  const tbody = document.getElementById('docs-tbody');

  if (!docs.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">Nenhum documento anexado.</td></tr>`;
    return;
  }

  tbody.innerHTML = docs.map(d => {
    const tamanhoKB = d.tamanho ? Math.round(d.tamanho / 1024) + ' KB' : '—';
    const data = new Date(d.criado_em).toLocaleDateString('pt-BR');
    return `
      <tr>
        <td><a href="${d.url}" target="_blank" rel="noreferrer" style="color:var(--azul-primario);">${d.nome}</a></td>
        <td>${d.tipo || '—'}</td>
        <td>${tamanhoKB}</td>
        <td>${data}</td>
        <td style="text-align:right;">
          <a href="${d.url}" target="_blank" class="btn-sm" title="Baixar"><i class="fa-solid fa-download"></i></a>
          <button class="btn-sm btn-del-doc" data-id="${d.id}" style="color:#ef4444;" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

// Upload de arquivo
document.getElementById('input-arquivo').addEventListener('change', async (e) => {
  if (!clienteAtivoDocs) return;
  const files = Array.from(e.target.files);
  const statusEl = document.getElementById('upload-status');
  const { data: { user } } = await supabase.auth.getUser();
  const { data: uData } = await supabase.from('usuarios').select('id').eq('email', user.email).single();

  for (const file of files) {
    statusEl.textContent = `Enviando ${file.name}...`;
    const form = new FormData();
    form.append('arquivo', file);
    form.append('clienteId', clienteAtivoDocs);
    form.append('usuarioId', uData?.id || '');

    const res = await fetch(`${apiUrl}/documentos/upload`, { method: 'POST', body: form });
    if (!res.ok) {
      const err = await res.json();
      statusEl.textContent = `Erro: ${err.error}`;
    }
  }

  statusEl.textContent = 'Enviado com sucesso!';
  setTimeout(() => { statusEl.textContent = ''; }, 3000);
  await carregarDocumentos(clienteAtivoDocs);
  e.target.value = '';
});

// Fechar painel
document.getElementById('btn-fechar-docs').onclick = () => {
  document.getElementById('painel-documentos').style.display = 'none';
  clienteAtivoDocs = null;
};

// Excluir documento (delegação de evento)
document.getElementById('docs-tbody').addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-del-doc');
  if (!btn) return;
  if (!confirm('Excluir este documento? A ação não pode ser desfeita.')) return;

  const res = await fetch(`${apiUrl}/documentos/${btn.dataset.id}`, { method: 'DELETE' });
  if (res.ok) {
    await carregarDocumentos(clienteAtivoDocs);
  }
});
```

Adicionar handler para o botão `.btn-docs` na delegação de eventos da tabela de clientes.

---

## BLOCO 8 — Acesso Rápido: Mais Botões no Dashboard

### `frontend/index.html` — Substituir a div `.quick-actions`:

```html
<div class="quick-actions">
  <a href="clientes.html" class="action-card" id="ac-novo-cliente">
    <i class="fa-solid fa-user-plus"></i>
    <span>Novo Cliente</span>
  </a>
  <a href="processos.html" class="action-card" id="ac-novo-processo">
    <i class="fa-solid fa-scale-balanced"></i>
    <span>Novo Processo</span>
  </a>
  <button class="action-card" id="ac-nova-audiencia">
    <i class="fa-solid fa-gavel"></i>
    <span>Nova Audiência</span>
  </button>
  <button class="action-card" id="ac-nova-pericia">
    <i class="fa-solid fa-stethoscope"></i>
    <span>Nova Perícia</span>
  </button>
  <button class="action-card" id="ac-novo-atendimento">
    <i class="fa-solid fa-headset"></i>
    <span>Atendimento</span>
  </button>
  <a href="agenda.html" class="action-card" id="ac-agenda">
    <i class="fa-solid fa-calendar-plus"></i>
    <span>Agenda</span>
  </a>
</div>
```

### `frontend/js/dashboard.js` — Handlers para botões de criação rápida

Adicionar após o carregamento do dashboard:

```js
// Acesso rápido — redirecionamentos com âncora de abertura de modal
const atalhos = {
  'ac-nova-audiencia':   'audiencias.html?novo=1',
  'ac-nova-pericia':     'pericias.html?novo=1',
  'ac-novo-atendimento': 'atendimentos.html?novo=1'
};

Object.entries(atalhos).forEach(([id, url]) => {
  const el = document.getElementById(id);
  if (el) el.onclick = () => { window.location.href = url; };
});
```

### Nas páginas destino (`audiencias.js`, `pericias.js`, `atendimentos.js`) — Abrir modal automaticamente

No final do `DOMContentLoaded` de cada módulo, adicionar:

```js
// Abre modal automaticamente se vier com ?novo=1
if (new URLSearchParams(window.location.search).get('novo') === '1') {
  // Ex: audiências
  document.getElementById('btn-nova-audiencia')?.click();
  // Para pericias: document.getElementById('btn-nova-pericia')?.click();
  // Para atendimentos: document.getElementById('btn-novo-atendimento')?.click();
}
```

---

## BLOCO 9 — Tela Inicial: Melhorias de Velocidade e Usabilidade

### 9.1 — `frontend/index.html` — Adicionar barra de busca global rápida

Inserir no topo do `.main-content`, antes do `.welcome-banner`:

```html
<div class="busca-global-container">
  <div class="busca-global-inner">
    <i class="fa-solid fa-magnifying-glass"></i>
    <input
      type="text"
      id="busca-global"
      autocomplete="off"
      placeholder="Buscar cliente, processo ou CNJ..."
    >
    <div id="busca-resultados" class="busca-dropdown" style="display:none;"></div>
  </div>
</div>
```

CSS para adicionar em `style.css`:
```css
.busca-global-container {
  margin-bottom: 20px;
}

.busca-global-inner {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--branco);
  border: 1.5px solid var(--cinza-borda);
  border-radius: 10px;
  padding: 0 16px;
  gap: 10px;
  transition: border-color 0.2s;
}

.busca-global-inner:focus-within {
  border-color: var(--azul-primario);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.busca-global-inner i {
  color: var(--cinza-medio);
  font-size: 0.9rem;
  flex-shrink: 0;
}

.busca-global-inner input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.95rem;
  padding: 12px 0;
  color: var(--cinza-escuro);
}

.busca-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: var(--branco);
  border: 1px solid var(--cinza-borda);
  border-radius: 10px;
  box-shadow: 0 8px 24px -4px rgba(0,0,0,0.12);
  z-index: 500;
  max-height: 320px;
  overflow-y: auto;
}

.busca-item {
  padding: 10px 16px;
  border-bottom: 1px solid var(--cinza-borda);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.88rem;
  transition: background 0.15s;
}

.busca-item:last-child { border-bottom: none; }
.busca-item:hover { background: var(--cinza-fundo); }
.busca-item i { color: var(--azul-primario); width: 16px; text-align: center; }
```

### 9.2 — `frontend/js/dashboard.js` — Lógica da busca global

```js
// Busca global com debounce
const inputBusca = document.getElementById('busca-global');
const divResultados = document.getElementById('busca-resultados');
let buscaTimer;

if (inputBusca) {
  inputBusca.addEventListener('input', () => {
    clearTimeout(buscaTimer);
    const termo = inputBusca.value.trim();

    if (termo.length < 2) {
      divResultados.style.display = 'none';
      return;
    }

    buscaTimer = setTimeout(async () => {
      const [resClientes, resProcessos] = await Promise.all([
        supabase.from('clientes').select('id, nome, telefone').ilike('nome', `%${termo}%`).limit(5),
        supabase.from('processos').select('id, numero_cnj, clientes(nome)').ilike('numero_cnj', `%${termo}%`).limit(5)
      ]);

      const clientes = (resClientes.data || []).map(c => ({
        tipo: 'cliente',
        id: c.id,
        label: c.nome,
        sub: c.telefone || '',
        url: `clientes.html`
      }));

      const processos = (resProcessos.data || []).map(p => ({
        tipo: 'processo',
        id: p.id,
        label: p.numero_cnj || 'S/N',
        sub: p.clientes?.nome || '',
        url: `processo-detalhe.html?id=${p.id}`
      }));

      const todos = [...clientes, ...processos];

      if (!todos.length) {
        divResultados.innerHTML = `<div class="busca-item" style="color:var(--cinza-medio);">Nenhum resultado encontrado.</div>`;
      } else {
        divResultados.innerHTML = todos.map(r => `
          <a href="${r.url}" class="busca-item" style="text-decoration:none; color:inherit;">
            <i class="fa-solid ${r.tipo === 'cliente' ? 'fa-user' : 'fa-scale-balanced'}"></i>
            <div>
              <div style="font-weight:600;">${r.label}</div>
              <div style="color:var(--cinza-medio); font-size:0.78rem;">${r.sub}</div>
            </div>
          </a>
        `).join('');
      }

      divResultados.style.display = 'block';
    }, 300);
  });

  // Fechar dropdown ao clicar fora
  document.addEventListener('click', (e) => {
    if (!inputBusca.contains(e.target) && !divResultados.contains(e.target)) {
      divResultados.style.display = 'none';
    }
  });
}
```

---

## BLOCO 10 — Animação de Boas-Vindas

### `frontend/css/style.css` — Substituir / enriquecer `.welcome-banner`

```css
/* ===========================
   WELCOME BANNER — Animação Premium
   =========================== */
.welcome-banner {
  background: linear-gradient(125deg, #1d4ed8 0%, #1e3a8a 50%, #312e81 100%);
  padding: 2.5rem 2.5rem;
  border-radius: 20px;
  color: white;
  margin-bottom: 2.5rem;
  position: relative;
  overflow: hidden;
  box-shadow:
    0 10px 40px -10px rgba(30, 58, 138, 0.5),
    0 0 0 1px rgba(255,255,255,0.05) inset;
  animation: banner-entrada 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes banner-entrada {
  0% {
    opacity: 0;
    transform: translateY(24px) scale(0.98);
    filter: blur(2px);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

/* Linha de luz animada que atravessa o banner */
.welcome-banner::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.08) 50%,
    transparent 100%
  );
  animation: shine-pass 2.8s ease-in-out 0.8s both;
  pointer-events: none;
}

@keyframes shine-pass {
  0%   { left: -80%; opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { left: 120%; opacity: 0; }
}

/* Bolha decorativa fundo direito */
.welcome-banner::after {
  content: '';
  position: absolute;
  top: -60px;
  right: -60px;
  width: 280px;
  height: 280px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.35) 0%, transparent 70%);
  border-radius: 50%;
  animation: pulso-bolha 4s ease-in-out infinite alternate;
  pointer-events: none;
}

@keyframes pulso-bolha {
  from { transform: scale(1) rotate(0deg); opacity: 0.6; }
  to   { transform: scale(1.15) rotate(15deg); opacity: 1; }
}

/* Texto do banner — entrada escalonada */
.welcome-banner h1,
.welcome-banner #saudacao {
  color: #ffffff !important;
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  position: relative;
  z-index: 1;
  animation: texto-entrada 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both;
}

.welcome-banner p {
  color: rgba(255, 255, 255, 0.82);
  font-size: 1rem;
  margin: 0;
  position: relative;
  z-index: 1;
  animation: texto-entrada 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.28s both;
}

@keyframes texto-entrada {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Partículas flutuantes (elementos filhos adicionados via JS) */
.welcome-particle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  animation: flotar linear infinite;
  pointer-events: none;
  z-index: 0;
}

@keyframes flotar {
  0%   { transform: translateY(0) rotate(0deg); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 0.6; }
  100% { transform: translateY(-80px) rotate(180deg); opacity: 0; }
}
```

### `frontend/js/dashboard.js` — Injetar partículas no banner

Adicionar ao final do `carregarDashboard()` (ou numa função separada chamada no `DOMContentLoaded`):

```js
function animarBanner() {
  const banner = document.querySelector('.welcome-banner');
  if (!banner) return;

  // Criar 8 partículas com posições, tamanhos e durações variadas
  const config = [
    { size: 6,  left: 8,   bottom: 10, dur: 5.2 },
    { size: 10, left: 18,  bottom: 5,  dur: 7.1 },
    { size: 4,  left: 35,  bottom: 20, dur: 4.8 },
    { size: 8,  left: 50,  bottom: 8,  dur: 6.3 },
    { size: 12, left: 62,  bottom: 15, dur: 8.0 },
    { size: 5,  left: 75,  bottom: 5,  dur: 5.5 },
    { size: 9,  left: 85,  bottom: 12, dur: 7.4 },
    { size: 7,  left: 92,  bottom: 3,  dur: 6.0 },
  ];

  config.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'welcome-particle';
    el.style.cssText = `
      width: ${p.size}px;
      height: ${p.size}px;
      left: ${p.left}%;
      bottom: ${p.bottom}%;
      animation-duration: ${p.dur}s;
      animation-delay: ${(i * 0.4).toFixed(1)}s;
    `;
    banner.appendChild(el);
  });
}

// Chamar na inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();
  animarBanner();
  carregarDashboard();
});
```

---

## Checklist de Arquivos Modificados

| Arquivo | Blocos |
|---|---|
| `frontend/js/admin.js` | 1, 2.1, 2.3, 2.4 |
| `frontend/admin.html` | 1 |
| `backend/routes/admin.js` | 2.2, 2.3, 2.4 |
| `backend/index.js` | 2.2 |
| `frontend/css/style.css` | 3, 8, 9.1, 10 |
| `frontend/js/audiencias.js` | 3, 4 |
| `frontend/audiencias.html` | 4, 5 |
| `frontend/pericias.html` | 5 |
| `frontend/atendimentos.html` | 5, 6.1 |
| `frontend/js/atendimentos.js` | 6.2–6.5, 8 |
| `frontend/clientes.html` | 5, 7.3 |
| `frontend/js/clientes.js` | 7.4 |
| `backend/routes/documentos.js` | 7.2 |
| `frontend/index.html` | 8 |
| `frontend/js/dashboard.js` | 8, 9.2, 10 |
| `frontend/js/pericias.js` | 5, 8 |
| `backend/package.json` | 7.1 (`@vercel/blob`) |

---

## Checklist de Validação

- [ ] Acessar `admin.html` → Não aparecer erro de Supabase não inicializado no console
- [ ] Criar usuário com senha → Usuário aparece no Supabase Auth e na tabela `usuarios`
- [ ] Admin alterar senha de qualquer usuário → Login funciona com nova senha
- [ ] Desativar usuário → Usuário bloqueado no Auth (não consegue logar)
- [ ] Tabela de Audiências: colunas corretas (`Data/Hora | Cliente | Local | Tipo | Ações`), botões alinhados à direita
- [ ] Modal de Audiência: nome do cliente visível por completo no header, sem truncamento
- [ ] Modais de Perícias, Audiências, Atendimentos e Clientes: sem `placeholder` nos campos internos
- [ ] Modal de Atendimentos: campo de responsável listando todos usuários ativos
- [ ] Dashboard: 6 botões de acesso rápido funcionando, botões de criação rápida abrindo modal na página destino
- [ ] Busca global: digitar nome/CNJ retorna resultados com link direto
- [ ] Painel de documentos em Clientes: upload via Vercel Blob, download e exclusão funcionando
- [ ] Banner de boas-vindas: animação de entrada + partículas flutuantes + shine pass visíveis

---

## Notas Importantes

1. **Vercel Blob exige `BLOB_READ_WRITE_TOKEN`** nas Environment Variables do projeto Vercel. Sem isso, o upload falhará com 403.
2. **A rota `/api/admin/*` deve usar o `supabaseAdmin`** (service role key), não o client anon. Confirmar que `backend/supabase.js` exporta um client de serviço.
3. **A animação das partículas usa `position: absolute`** — o `.welcome-banner` já tem `position: relative; overflow: hidden`, então as partículas ficarão contidas.
4. **Não usar `placeholder` como substituto de label.** As labels já existem; o placeholder era redundante e confuso.
5. **Teste localmente antes de deploy**: `vercel dev` resolve o `/api/env` e as rotas de backend sem configuração extra.