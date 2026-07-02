# PROMPT.md — SaasCaldas-Brito 2.0

> Execute as tarefas abaixo, na ordem apresentada, diretamente no repositório
> `esdrasbdev/SaasCaldas-Brito2.0`. O padrão do projeto é MVC no frontend (Model
> na Supabase, View no DOM, Controller ligando os dois) com escrita direta ao
> Supabase via `supabase-js` (RLS autenticado) — o backend Express só é usado
> para operações administrativas (`/api/usuarios`) e alguns `GET` com cache.
> Siga esse padrão: não crie rotas Express novas para os CRUDs de
> audiências/perícias/atendimentos/processos, eles já são feitos via
> `supabase.from(...)` no frontend.
>
> Convenções obrigatórias: sem emojis em UI, nomenclatura em português
> coerente com o domínio já existente (`responsavel`, `usuario_id`, etc.),
> estilo de código idêntico ao dos arquivos vizinhos (Model/View/Controller,
> `showToast`, `confirmarExclusao`, disable de inputs em modo view).

---

## Contexto (diagnóstico já feito)

- `audiencias`, `pericias` e `processos` hoje têm **um único** responsável
  (`advogado_id` ou nenhum campo de responsável no formulário).
- `atendimentos` tem um único responsável (`usuario_id`), escolhido em um
  `<select id="atend-responsavel">` simples.
- Já existe um precedente de relação N:N no projeto:
  `sql/create_participantes_atendimento.sql` (tabela
  `participantes_atendimento`) e sua implementação em
  `frontend/js/agenda.js` (busca com dropdown + tags removíveis,
  `usuariosSelecionados`, `renderizarTagsUsuarios`, etc.). Vamos generalizar
  esse mesmo padrão visual/funcional para os 4 setores pedidos.
- A tabela `usuarios.role` aceita: `ADMIN`, `ADVOGADO`, `ADVOGADA`,
  `ESTAGIARIO`, `ESTAGIARIA`, `SECRETARIA` (ver `sql/schema.sql`). O pedido
  é permitir ADMIN, ADVOGADOS e ESTAGIÁRIOS como responsáveis — isso inclui
  as variações de gênero já usadas no seed (`ADVOGADA`, `ESTAGIARIA`).
  **Assunção**: `SECRETARIA` fica de fora da lista de responsáveis
  selecionáveis, pois não foi mencionada no pedido.
- Login: o erro de credenciais inválidas hoje mostra
  `'❌ E-mail não cadastrado ou senha incorreta. (Verifique no Supabase Auth)'`
  em `frontend/login.html`. É preciso trocar por uma mensagem padrão de
  "credenciais inválidas" sem citar o Supabase.
- Troca de senha de usuário: `PUT /api/usuarios/:id` em
  `backend/routes/usuarios.js` já atualiza a tabela pública e, se
  `novaSenha` for enviada, chama `supabaseAdmin.auth.admin.updateUserById`.
  O frontend (`frontend/js/admin.js`) já expõe o campo "Nova Senha" no modal
  de edição de usuário e envia `novaSenha` no `PUT`. **Está funcional — não
  alterar essa lógica**, apenas validar manualmente ao final (checklist no
  final deste documento).

---

## Parte 1 — Banco de dados (rodar no Supabase SQL Editor)

Criar 4 tabelas de junção seguindo exatamente o padrão de
`participantes_atendimento` (RLS "autenticados"), uma para cada setor.
Criar em um novo arquivo `sql/create_responsaveis_multiplos.sql`:

```sql
-- Cria tabelas de junção para permitir múltiplos responsáveis por registro
-- em audiências, perícias, atendimentos e processos.
-- Rodar no Supabase SQL Editor (Project → SQL Editor → New query)

create table if not exists responsaveis_audiencia (
  id uuid primary key default gen_random_uuid(),
  audiencia_id uuid not null references audiencias(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  criado_em timestamptz default now(),
  unique (audiencia_id, usuario_id)
);

create table if not exists responsaveis_pericia (
  id uuid primary key default gen_random_uuid(),
  pericia_id uuid not null references pericias(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  criado_em timestamptz default now(),
  unique (pericia_id, usuario_id)
);

create table if not exists responsaveis_atendimento (
  id uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references atendimentos(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  criado_em timestamptz default now(),
  unique (atendimento_id, usuario_id)
);

create table if not exists responsaveis_processo (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references processos(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  criado_em timestamptz default now(),
  unique (processo_id, usuario_id)
);

-- RLS compatível com o padrão do projeto (leitura/escrita para autenticados)
do $$
declare
  tabela text;
begin
  foreach tabela in array ARRAY[
    'responsaveis_audiencia', 'responsaveis_pericia',
    'responsaveis_atendimento', 'responsaveis_processo'
  ] loop
    execute 'alter table ' || tabela || ' enable row level security;';
    execute 'create policy "leitura_autenticados" on ' || tabela ||
            ' for select using (auth.role() = ''authenticated'');';
    execute 'create policy "escrita_autenticados" on ' || tabela ||
            ' for all using (auth.role() = ''authenticated'');';
  end loop;
end $$;

-- Índices para consultas por registro pai
create index if not exists idx_resp_audiencia_audiencia_id on responsaveis_audiencia(audiencia_id);
create index if not exists idx_resp_pericia_pericia_id on responsaveis_pericia(pericia_id);
create index if not exists idx_resp_atendimento_atendimento_id on responsaveis_atendimento(atendimento_id);
create index if not exists idx_resp_processo_processo_id on responsaveis_processo(processo_id);
```

**Importante**: manter as colunas legadas (`advogado_id` em `audiencias` e
`processos`, `usuario_id` em `atendimentos` e `pericias`). Não remover —
apenas parar de depender exclusivamente delas. Ao salvar, continue
preenchendo o campo legado com o **primeiro** responsável selecionado, para
não quebrar relatórios/e-mails de alerta existentes
(`backend/services/alertas-job.js`, `backend/services/email.js`) que hoje
fazem `select('*, processos(numero_cnj)')` sem depender de `advogado_id`
para decidir destinatários (eles notificam todos os usuários dos roles
jurídicos, então nada quebra ali — só mantenha o campo preenchido por
consistência de dados).

---

## Parte 2 — Componente reutilizável de multi-seleção de responsáveis

Criar `frontend/js/responsaveis-select.js`, extraindo e generalizando o
padrão já usado em `frontend/js/agenda.js` (busca com dropdown + tags
removíveis). Deve exportar uma factory reutilizável:

```javascript
/*
 * Componente reutilizável de seleção múltipla de responsáveis
 * Usado em audiências, perícias, atendimentos e processos
 * Roles elegíveis: ADMIN, ADVOGADO, ADVOGADA, ESTAGIARIO, ESTAGIARIA
 */
import { supabase } from './supabase.js';

const ROLES_RESPONSAVEL = ['ADMIN', 'ADVOGADO', 'ADVOGADA', 'ESTAGIARIO', 'ESTAGIARIA'];

export function criarSeletorResponsaveis({ inputEl, dropdownEl, tagsEl }) {
  let usuariosDisponiveis = [];
  let selecionados = [];

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
    tagsEl.innerHTML = selecionados.map(u => `
      <span class="tag-responsavel" data-tag-id="${u.id}" style="background:#eef2ff; color:#0b4a6f; padding:6px 10px; border-radius:16px; font-size:0.85rem; display:inline-flex; align-items:center; gap:8px; border:1px solid #c7d2fe;">
        <i class="fa-solid fa-user-tie" style="font-size:0.85rem;"></i>
        <span>${u.nome.split(' ')[0]}</span>
        <i class="fa-solid fa-times" style="cursor:pointer; font-size:0.8rem;" title="Remover"></i>
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
      dropdownEl.innerHTML = '<div style="padding:12px; text-align:center; color:#999; font-size:0.9rem;">Nenhum usuário encontrado</div>';
      return;
    }
    dropdownEl.innerHTML = lista.map(u => `
      <div class="dropdown-responsavel-item" data-id="${u.id}" data-nome="${u.nome}" style="padding:10px 12px; cursor:pointer; border-bottom:1px solid #f0f0f0;">
        <strong>${u.nome}</strong><br><small style="color:#888;">${u.role}</small>
      </div>
    `).join('');

    dropdownEl.querySelectorAll('.dropdown-responsavel-item').forEach(item => {
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
    });
    document.addEventListener('click', (e) => {
      if (e.target !== inputEl && !dropdownEl.contains(e.target)) {
        dropdownEl.style.display = 'none';
      }
    });
  }

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
      tagsEl.querySelectorAll('.fa-times').forEach(el => {
        el.style.display = disabled ? 'none' : 'inline';
      });
    }
  };
}
```

Este componente será importado em `audiencias.js`, `pericias.js`,
`atendimentos.js` e `processos.js`.

---

## Parte 3 — HTML: adicionar campo "Responsáveis" nos 4 formulários

Em cada arquivo de formulário abaixo, adicione um bloco `form-group` novo
(logo após o campo "Cliente"), reaproveitando a estrutura já usada em
`agenda.js`/`agenda.html` para clientes/usuários (input de busca + div de
dropdown + div de tags):

```html
<div class="form-group">
  <label>Responsáveis * (ADMIN, Advogados ou Estagiários)</label>
  <input type="text" id="{PREFIXO}-responsaveis-busca" placeholder="Buscar por nome..." autocomplete="off">
  <div id="{PREFIXO}-responsaveis-dropdown" style="display:none; position:relative; z-index:20; background:#fff; border:1px solid #e2e8f0; border-radius:8px; max-height:220px; overflow-y:auto; box-shadow:0 4px 12px rgba(0,0,0,0.08);"></div>
  <div id="{PREFIXO}-responsaveis-tags" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;"></div>
</div>
```

Aplicar em:

1. **`frontend/audiencias.html`** — dentro de `#form-audiencia`, prefixo `aud`.
2. **`frontend/pericias.html`** — dentro de `#form-pericia`, prefixo `pericia`.
3. **`frontend/atendimentos.html`** — **substituir** o atual
   `<select id="atend-responsavel" required>` (campo único) pelo bloco
   acima, prefixo `atend`.
4. **`frontend/processos.html`** — dentro de `#form-processo` (modal de
   editar/criar), prefixo `proc`.
5. **`frontend/processo-novo.html`** — **substituir** o atual
   `<select id="advogado-id">` (que só lista role `ADVOGADO`, ignorando
   ADMIN/ESTAGIARIO) pelo bloco acima, prefixo `proc-novo`.

---

## Parte 4 — JS: ligar o componente em cada Controller

Para cada módulo, seguir o mesmo roteiro:

### 4.1 `frontend/js/audiencias.js`

- Importar `criarSeletorResponsaveis` e instanciar com os elementos
  `aud-responsaveis-busca` / `aud-responsaveis-dropdown` / `aud-responsaveis-tags`.
- Chamar `.init()` dentro de `AudienciaController.init()`.
- `AudienciaModel.criar` e `.atualizar`: depois de inserir/atualizar a
  audiência (você já tem o `id`), sincronizar `responsaveis_audiencia`:
  - Em edição: `delete().eq('audiencia_id', id)` e reinserir a lista atual.
  - Em criação: inserir a lista completa vinculada ao novo `id`.
  - Manter `advogado_id` no payload da audiência como o `id` do primeiro
    responsável selecionado (fallback para o usuário logado se a lista
    vier vazia — mas o campo agora é obrigatório, então isso só é
    fallback de segurança).
- No `GET`/listagem (`listarTodas`), incluir
  `responsaveis_audiencia(usuario_id, usuarios(nome))` no `select` (ou uma
  segunda consulta agrupada, como já é feito em `agenda.js` para
  `participantes_atendimento`) e exibir os nomes dos responsáveis na coluna
  correspondente da tabela (pode reaproveitar a coluna "Local" atual
  adicionando uma nova coluna "Responsáveis", ou mostrar como badges
  abaixo do cliente — decida pelo espaço disponível na tabela, mas os
  nomes precisam aparecer na listagem).
- Ao abrir em modo "visualizar" ou "editar", buscar os responsáveis da
  audiência e chamar `seletor.setSelecionados(...)`; em modo view, chamar
  `seletor.setDisabled(true)`.
- Validar no submit: se `seletor.getSelecionados()` estiver vazio, mostrar
  toast de erro e impedir o envio.

### 4.2 `frontend/js/pericias.js`

Mesmo roteiro, usando `responsaveis_pericia` e prefixo `pericia`. A tabela
`pericias` não tem coluna `advogado_id`, apenas `usuario_id` — mantenha
`usuario_id` preenchido com o primeiro responsável selecionado, igual ao
comportamento atual (hoje é preenchido com o usuário logado).

### 4.3 `frontend/js/atendimentos.js`

- Remover o método `carregarResponsaveis()` atual (que populava o
  `<select>` único) e substituir pelo componente `responsaveis_atendimento`.
- No `controller.salvar`, sincronizar a tabela de junção da mesma forma.
- Manter `usuario_id` no payload do atendimento como o primeiro
  responsável selecionado (hoje o fallback é `usuarioDB.id`, o usuário
  logado — mantenha esse fallback apenas se a lista vier vazia, mas isso
  não deve acontecer já que o campo passa a ser obrigatório).
- Ajustar `view.getRespNome(d)` para aceitar múltiplos nomes (juntar com
  vírgula, ex.: `"Ana, Bruno"`), buscando de `responsaveis_atendimento`.

### 4.4 `frontend/js/processos.js`

- Adicionar o componente com `responsaveis_processo`.
- `ProcessoModel.criar`/`.atualizar`: sincronizar a tabela de junção após
  ter o `id` do processo. Como `criar()` hoje usa `.insert([processo])`
  sem `.select()`, ajuste para `.insert([processo]).select().single()` de
  forma a obter o `id` recém-criado antes de gravar os responsáveis.
- Manter `advogado_id` preenchido com o primeiro responsável.
- Exibir os responsáveis na tabela de processos (nova coluna ou dentro da
  célula "Processo/Cliente" como badges pequenos).

### 4.5 `frontend/processo-novo.html`

- Trocar a lógica de carregamento `supabase.from('usuarios').select('id, nome').eq('role', 'ADVOGADO')`
  pelo componente `criarSeletorResponsaveis` (roles ADMIN, ADVOGADO,
  ADVOGADA, ESTAGIARIO, ESTAGIARIA).
- No submit, gravar o processo, obter o `id` retornado e inserir os
  registros em `responsaveis_processo`; manter `advogado_id` com o
  primeiro responsável.

---

## Parte 5 — Login: mensagem de credenciais inválidas

Arquivo: `frontend/login.html`.

Trocar o bloco atual (por volta da linha 218-227):

```javascript
} catch (error) {
  console.error(error);

  if (error.message && (error.message.includes('Invalid API key') || error.code === 401)) {
    errorMsg.textContent = '⚠️ Erro de Sistema: A chave do Supabase em js/env.js é inválida.';
  } else if (error.message === 'Invalid login credentials') {
    errorMsg.textContent = '❌ E-mail não cadastrado ou senha incorreta. (Verifique no Supabase Auth)';
  } else {
    errorMsg.textContent = 'Acesso negado: Verifique suas credenciais.';
  }

  errorMsg.style.display = 'block';
  btn.disabled = false;
  btn.innerHTML = originalBtnContent;
}
```

Por:

```javascript
} catch (error) {
  console.error(error);

  if (error.message && (error.message.includes('Invalid API key') || error.code === 401)) {
    errorMsg.textContent = 'Erro de sistema: chave de configuração inválida. Contate o administrador.';
  } else {
    errorMsg.textContent = 'Credenciais inválidas. Verifique seu e-mail e senha e tente novamente.';
  }

  errorMsg.style.display = 'block';
  btn.disabled = false;
  btn.innerHTML = originalBtnContent;
}
```

Isso cobre tanto `Invalid login credentials` quanto `Usuário não encontrado
no registro interno.` e `Usuário inativo...` sob a mesma mensagem genérica
de credenciais inválidas — **exceto** o caso de usuário inativo, que deve
continuar informando claramente que a conta está bloqueada (adicione um
`else if` específico antes do `else` genérico):

```javascript
} else if (error.message && error.message.includes('inativo')) {
  errorMsg.textContent = 'Usuário inativo. Contate o administrador.';
} else {
  errorMsg.textContent = 'Credenciais inválidas. Verifique seu e-mail e senha e tente novamente.';
}
```

Nenhuma menção a "Supabase Auth" deve restar visível ao usuário final em
nenhuma mensagem de erro desta tela.

---

## Parte 6 — Novos usuários ESTAGIÁRIO

Arquivo: `backend/seed.js`.

`raul_limasilveira@hotmail.com` **já existe** no array `users` (role
`ESTAGIARIO`, senha `estagio123`) — não duplicar, apenas confirmar que
permanece como está.

Adicionar `rayssalima0507@gmail.com` à lista, com o mesmo padrão dos
demais estagiários (senha `estagio123`, role `ESTAGIARIO`):

```javascript
{ nome: 'Rayssa Lima', email: 'rayssalima0507@gmail.com', pass: 'estagio123', role: 'ESTAGIARIO' },
```

Insira essa linha logo após a linha do `Raul Lima` no array `users`, para
manter os estagiários agrupados. Depois de editar, rode o seed manualmente
(ele foi removido do startup automático — ver comentário em
`backend/index.js` linha 58-59):

```bash
node backend/seed.js
```

ou exponha temporariamente uma chamada `require('./seed.js')()` em um
script `node -e` a partir da raiz de `backend/`, usando as variáveis de
ambiente do Supabase configuradas localmente (`SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`).

---

## Parte 7 — Troca de senha de usuário (checklist de verificação, sem alterar código)

O fluxo já está implementado corretamente:

- `frontend/js/admin.js`: modal de edição mostra o campo "Nova Senha"
  (opcional em edição, obrigatório em criação) e envia `novaSenha` no
  `PUT /api/usuarios/:id`.
- `backend/routes/usuarios.js`: rota `PUT /:id` valida `novaSenha.length >= 6`
  e chama `supabaseAdmin.auth.admin.updateUserById(id, { password: novaSenha })`.

Validar manualmente após o deploy:

1. Login como ADMIN em `/admin.html`.
2. Editar um usuário existente, preencher "Nova Senha" com 6+ caracteres,
   salvar.
3. Deslogar e tentar logar com esse usuário usando a nova senha — deve
   funcionar.
4. Confirmar que deixar "Nova Senha" em branco na edição **não** altera a
   senha atual (o campo é opcional e o backend só chama
   `updateUserById` quando `novaSenha` é truthy).

Se todos os passos acima passarem, **não alterar nada nesse fluxo**.

---

## Ordem de execução recomendada

1. Rodar a migration SQL da Parte 1 no Supabase.
2. Criar `frontend/js/responsaveis-select.js` (Parte 2).
3. Atualizar os 5 arquivos HTML (Parte 3).
4. Atualizar `audiencias.js`, `pericias.js`, `atendimentos.js`,
   `processos.js` e `processo-novo.html` (Parte 4).
5. Corrigir `frontend/login.html` (Parte 5).
6. Editar `backend/seed.js` e rodar o seed (Parte 6).
7. Validar troca de senha (Parte 7) sem alterar código.

## Critérios de aceite

- [ ] É possível selecionar 2+ responsáveis (dentre ADMIN, ADVOGADO,
      ADVOGADA, ESTAGIARIO, ESTAGIARIA) ao criar/editar uma audiência,
      perícia, atendimento ou processo.
- [ ] Os responsáveis selecionados aparecem persistidos após reload da
      página (recarregados das tabelas `responsaveis_*`).
- [ ] A listagem de cada setor exibe os nomes de todos os responsáveis,
      não apenas um.
- [ ] Usuários com role `SECRETARIA` não aparecem na busca de
      responsáveis.
- [ ] Login com senha errada mostra "Credenciais inválidas. Verifique seu
      e-mail e senha e tente novamente." sem qualquer menção a Supabase.
- [ ] `rayssalima0507@gmail.com` e `raul_limasilveira@hotmail.com` logam
      com sucesso usando a senha `estagio123` e possuem role `ESTAGIARIO`.
- [ ] Troca de senha de usuário via `/admin.html` continua funcionando
      sem alterações de código.