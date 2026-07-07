# PROMPT — SaasCaldas-Brito2.0: Correções e Novas Funcionalidades

Você é um desenvolvedor Full Stack Sênior trabalhando no repositório
`esdrasbdev/SaasCaldas-Brito2.0`. O projeto é **Vanilla JS (ES Modules) no
frontend + Node/Express no backend + Supabase (Postgres + Auth) + Vercel
Blob + hospedagem na Vercel via função serverless única (`api/index.js` →
`backend/index.js`)**. Siga as convenções já existentes: nomes de
variáveis/comentários em português, sem frameworks front-end, sem emojis,
ícones Font Awesome 6 Free, RBAC com os papéis `ADMIN`, `ADVOGADO`/`ADVOGADA`,
`SECRETARIA`, `ESTAGIARIO`/`ESTAGIARIA`. **Não remova funcionalidades
existentes e mantenha compatibilidade com o banco atual.**

Este PROMPT já foi pré-diagnosticado a partir do código real do repositório
(commit atual da branch principal). Cada seção abaixo descreve **o que já
existe**, **a causa raiz confirmada** (quando aplicável) e **o que
implementar**. Siga a ordem, pois os itens 1 e 2 são bloqueadores de
produção.

---

## 1. CORREÇÃO CRÍTICA — Upload de documentos (`Cannot find module 'busboy'`)

### Diagnóstico confirmado
- `backend/package.json` **já lista `busboy: ^1.6.0`** como dependência, e
  `backend/package-lock.json` (lockfileVersion 3) **já tem a entrada
  resolvida** de `busboy` em `node_modules/busboy`. Ou seja, a dependência
  está corretamente declarada.
- `backend/node_modules` **não está mais versionado no git** (confirmado via
  `git ls-files`) — o problema histórico de node_modules parcialmente
  commitado já foi corrigido.
- `vercel.json` define `"installCommand": "npm install --prefix backend"`,
  o que é a abordagem correta para este layout de repositório.
- Porém, o erro `Cannot find module 'busboy'` só pode acontecer se, no
  momento em que a Vercel empacotou a função serverless
  (`api/index.js` → `backend/index.js` → `backend/routes/documentos.js`),
  o diretório `backend/node_modules/busboy` **não existia no disco de
  build**. Isso indica um dos seguintes problemas reais encontrados no
  repositório:
  1. Existe um **`package-lock.json` órfão na raiz do projeto**
     (`/package-lock.json`) com `"packages": {}` (vazio) e **sem
     `package.json` correspondente na raiz**. Isso é lixo de uma tentativa
     anterior de instalar algo na raiz e pode confundir a detecção de
     projeto/cache de dependências da Vercel (a Vercel decide como
     cachear `node_modules` com base em lockfiles encontrados).
  2. Existe um arquivo **`backend/vercel-blob-2.5.0.tgz`** (180KB)
     commitado no repositório — resquício de uma tentativa manual de
     instalar `@vercel/blob` via tarball local. Ele não é referenciado por
     nenhum `package.json`, mas sua presença é sinal de que o ambiente de
     instalação já ficou inconsistente antes.
  3. O cache de build da Vercel pode estar restaurando um
     `backend/node_modules` **anterior à adição do `busboy`** ao
     `package.json`, pulando a reinstalação real do pacote.

### O que fazer
1. **Remover o `package-lock.json` órfão da raiz** do projeto (ele não tem
   `package.json` correspondente e não deve existir). Se o `.gitignore` da
   raiz precisar ignorar lockfiles residuais no futuro, adicione a regra.
2. **Remover o arquivo `backend/vercel-blob-2.5.0.tgz`** do repositório
   (não é usado por nenhuma configuração e é apenas ruído).
3. **Forçar instalação limpa no build da Vercel**, para eliminar qualquer
   cache stale, alterando `installCommand` em `vercel.json` para:
   ```json
   "installCommand": "rm -rf backend/node_modules && npm install --prefix backend"
   ```
   Isso garante que, independentemente do estado do cache de build, o
   `node_modules` do backend seja reconstruído do zero a partir do
   `package.json`/`package-lock.json` atuais (que já incluem `busboy` e
   `@vercel/blob`).
4. Em `backend/routes/documentos.js`, mover `const Busboy =
   require('busboy');` do meio do handler para o **topo do arquivo**,
   junto dos outros `require`s, dentro de um `try/catch` (no mesmo padrão
   já usado para `@vercel/blob`):
   ```js
   let Busboy = null;
   try {
     Busboy = require('busboy');
   } catch (e) {
     console.error('[documentos] Pacote "busboy" não encontrado no runtime:', e?.message || e);
   }
   ```
   E, dentro da rota `POST /blob-upload`, antes de usar `Busboy`, adicionar
   a mesma verificação defensiva já usada para `put`:
   ```js
   if (!Busboy) {
     return res.status(500).json({
       error: 'Falha no upload: pacote "busboy" indisponível no runtime.',
       hint: 'Rode "npm install --prefix backend" e confirme o deploy antes de tentar novamente.'
     });
   }
   ```
   Isso não corrige a causa raiz (que é de infraestrutura/build), mas
   garante uma mensagem amigável em vez de um 500 genérico caso o problema
   reapareça.
5. Após o deploy, **validar via `GET /api/documentos/debug-blob`** (rota já
   existente em `backend/routes/documentos-debug.js`) que:
   - `blob.moduleResolved` está `true`
   - `blob.tokenPresent` está `true`
   - Adicionar ao mesmo endpoint de debug um campo `busboy.moduleResolved`
     (mesma lógica de `try { require('busboy') } catch`) para facilitar
     diagnóstico futuro sem precisar reproduzir upload real.
6. Confirmar nas variáveis de ambiente do projeto na Vercel (Dashboard →
   Settings → Environment Variables) que `BLOB_READ_WRITE_TOKEN` está
   presente em **Production**, **Preview** e **Development** — o
   `debug-blob` já loga isso, então basta checar a resposta.

### Requisitos funcionais adicionais (mantendo o handler atual)
- **Tipos aceitos**: a lista `allowedContentTypes` em `documentos.js` já
  cobre PDF, DOC, DOCX, XLS/XLSX, JPEG, PNG, GIF e TXT — adicionar
  `image/jpg` como alias defensivo (alguns navegadores enviam esse
  content-type não padrão para `.jpg`).
- **Mensagens amigáveis**: no frontend (`frontend/js/documentos.js`),
  mapear os códigos de erro retornados (`400`, `401`, `413`, `500`) para
  textos em português já usando o sistema de toast existente
  (`showToast` em `utils.js`), evitando exibir `error.message` bruto do
  Supabase/Node ao usuário final.
- **Barra de progresso**: como o upload atual usa `fetch` (não
  `XMLHttpRequest`), trocar a chamada de upload em
  `frontend/js/documentos.js` para `XMLHttpRequest` com
  `xhr.upload.onprogress` para alimentar uma barra de progresso visual
  (reaproveitar o padrão de modal já usado em outras telas do sistema).
- **Confirmação de sucesso**: exibir toast de sucesso e atualizar a lista
  de documentos do cliente sem reload de página, reutilizando o padrão de
  atualização otimista já usado em `clientes.js`.
- **Logs de erro**: no backend, padronizar todos os `catch` de
  `documentos.js` para logar `console.error('[documentos] <contexto>:',
  error)` antes de responder, para facilitar depuração via `vercel logs`.

---

## 2. Botão "Ver Processo Ativo" (dashboard)

### Diagnóstico confirmado (atualizado após confirmação do cliente)
- O botão é o **"Ver" da tabela "Últimos Processos Atualizados"** no
  dashboard (`frontend/index.html`, seção com `<h2>Últimos Processos
  Atualizados</h2>`, renderizada em `frontend/js/dashboard.js` a partir da
  query `resRecentes`). Hoje cada linha tem um link simples:
  ```html
  <a href="processo-detalhe.html?id=${p.id}" class="btn-sm">Ver</a>
  ```
  que sempre abre exatamente o processo daquela linha, **sem considerar**
  se o cliente daquele processo tem outros processos ativos.
- A query atual em `dashboard.js` (`resRecentes`) seleciona
  `id, numero_cnj, status, criado_em, clientes(nome)` — **falta
  `cliente_id`** no `select`, que é necessário para a nova lógica.

### O que implementar
1. Em `frontend/js/dashboard.js`, na query `resRecentes`, incluir
   `cliente_id` no `select`:
   ```js
   supabase.from('processos')
     .select('id, numero_cnj, status, criado_em, cliente_id, clientes(nome)')
     .order('criado_em', { ascending: false })
     .limit(7),
   ```
2. Trocar o link estático de cada linha por um botão com `data-*`
   attributes e texto **"Ver Processo Ativo"**:
   ```html
   <button class="btn-sm btn-ver-processo-ativo" data-cliente-id="${p.cliente_id || ''}" data-processo-id="${p.id}">
     Ver Processo Ativo
   </button>
   ```
3. Adicionar um listener delegado (após `tbody.innerHTML = ...`) que, ao
   clicar em `.btn-ver-processo-ativo`:
   - Se não houver `cliente_id` (processo sem cliente vinculado),
     redireciona direto para `processo-detalhe.html?id=<processo_id>`
     (fallback, mesmo comportamento atual).
   - Caso contrário, consulta
     `supabase.from('processos').select('id').eq('cliente_id', clienteId).eq('status', 'ATIVO')`:
     - **0 resultados**: exibir toast ("Este cliente não possui processo
       ativo.") e não navegar.
     - **1 resultado**: redirecionar direto para
       `processo-detalhe.html?id=<id_do_processo_ativo>` (pode ser
       diferente do `processo-id` da linha, se o processo da linha não for
       o ativo).
     - **2+ resultados**: redirecionar para
       `processos.html?cliente_id=<cliente_id>`.
4. Em `frontend/js/processos.js`, no `ProcessoController.init()` (depois de
   `await this.loadAll()`), ler `cliente_id` da URL:
   ```js
   const clienteIdUrl = new URLSearchParams(window.location.search).get('cliente_id');
   if (clienteIdUrl) {
     const filtrados = this.data.filter(p => p.cliente_id === clienteIdUrl);
     ProcessoView.renderizarTabela(filtrados, AuthAPI.getRole() === 'ADMIN');
     // Opcional: preencher o campo de busca com o nome do cliente para dar contexto visual
     const nomeCliente = filtrados[0]?.clientes?.nome;
     if (nomeCliente) document.getElementById('busca-processo').value = nomeCliente;
   }
   ```
   Isso reaproveita a renderização (`ProcessoView.renderizarTabela`) já
   existente, sem duplicar lógica de filtro — a caixa de busca/status
   normal continua funcionando por cima da lista já filtrada por cliente
   caso o usuário queira refinar mais.

---

## 3. Página exclusiva de Procurações (`/procuracoes`)

### Diagnóstico confirmado
- Hoje, "procuração" é apenas **um dos seis templates de PDF gerados sob
  demanda** em `frontend/js/clientes.js` (chave `'procuracao'`, geração
  via `jsPDF` com `addMisto()`/timbrado). **Não existe tabela, status ou
  histórico de procurações** — cada geração é um documento avulso sem
  rastreamento de vencimento/status.
- Isso significa que este item é uma **funcionalidade nova**, não uma
  reorganização de UI existente.

### O que implementar
1. **Nova tabela** `sql/create_procuracoes.sql`:
   ```sql
   create table if not exists procuracoes (
     id uuid primary key default gen_random_uuid(),
     cliente_id uuid references clientes(id) not null,
     documento_id uuid references documentos(id), -- vínculo com o arquivo (PDF/upload) em Vercel Blob
     status text not null default 'ATIVA' check (status in ('ATIVA','PENDENTE','VENCIDA')),
     data_emissao date not null default current_date,
     data_vencimento date,
     criado_por uuid references usuarios(id),
     criado_em timestamptz default now()
   );
   alter table procuracoes enable row level security;
   create policy "leitura_autenticados" on procuracoes for select using (auth.role() = 'authenticated');
   create policy "escrita_autenticados" on procuracoes for all using (auth.role() = 'authenticated');
   ```
   Reaproveite a tabela `documentos` (já existente) para o arquivo em si
   via `documento_id`, evitando duplicar storage/lógica de upload.
2. **Backend**: novo arquivo `backend/routes/procuracoes.js` com
   `GET /`, `GET /:id`, `POST /`, `PUT /:id` (para status/vencimento) e
   `DELETE /:id`, seguindo exatamente o padrão de
   `backend/routes/documentos.js` (mesmo uso de `supabaseAdmin`,
   `authMiddleware`, tratamento de erro). Registrar em `backend/index.js`:
   ```js
   const procuracoesRouter = require('./routes/procuracoes.js');
   app.use('/api/procuracoes', authMiddleware, procuracoesRouter);
   ```
3. **Frontend**: nova página `frontend/procuracoes.html` +
   `frontend/js/procuracoes.js`, seguindo a arquitetura MVC já usada em
   `clientes.js` (Model/View separados). Funcionalidades:
   - Abas ou filtros para **Ativas / Pendentes / Vencidas / Histórico**
     (status derivado de `data_vencimento` vs. data atual, calculado no
     backend ou no frontend na listagem).
   - Busca por nome do cliente.
   - Botões de **Download**, **Visualizar** (abre o PDF/URL do Blob) e
     **Upload de nova procuração** (reaproveitar o componente de upload já
     corrigido no item 1, adaptado para gravar também na tabela
     `procuracoes`).
4. **Registrar a nova rota** em `frontend/js/sidebar.js` (item de menu
   "Procurações", ícone `fa-solid fa-scroll`) e em `frontend/js/guard.js`
   (`'procuracoes.html': { requiresAuth: true, requiredRole: null }`).
5. **Geração em 1 página**: no template jsPDF de procuração já existente
   (`clientes.js`, bloco `chave === 'procuracao'`), reduzir
   `FONT_SIZE_TEXTO_PROC` levemente (ex.: de 10.5 para 10) e os valores de
   `depois`/`DEPOIS_PODERES_PROC`/`DEPOIS_DATA_PROC` proporcionalmente, e
   adicionar uma verificação pós-render: se `doc.getNumberOfPages() > 1`,
   reduzir programaticamente a margem superior/inferior e regenerar antes
   de salvar, garantindo que o PDF final tenha sempre 1 página. Ao salvar
   o PDF gerado, enviá-lo automaticamente para o novo endpoint de
   procurações (upload + registro na tabela).

---

## 4. Filtro de clientes por responsável

### Diagnóstico confirmado (boa notícia: a base já existe)
- A tabela de junção `responsaveis_cliente` **já existe** (ver
  `sql/create_responsaveis_cliente.sql` e uso em
  `ClienteModel.listarTodos()`/`buscarPorId()` em `frontend/js/clientes.js`,
  que já faz `select('*, responsaveis_cliente(usuario_id, usuarios(nome))')`).
- O componente `frontend/js/responsaveis-select.js` já restringe papéis
  elegíveis a `ROLES_RESPONSAVEL = ['ADMIN','ADVOGADO','ADVOGADA','ESTAGIARIO','ESTAGIARIA']`
  — ou seja, a regra de "somente estes cargos podem ser responsáveis" **já
  está implementada no componente de seleção**. Falta apenas o filtro de
  listagem.

### O que implementar
1. Em `frontend/clientes.html`, adicionar uma barra de filtros acima da
   tabela/lista de clientes, com um botão `[TODOS]` seguido de um botão
   por usuário elegível (reaproveitar a mesma query de usuários elegíveis
   já usada em `responsaveis-select.js`, filtrando `role IN
   ('ADMIN','ADVOGADO','ADVOGADA','ESTAGIARIO','ESTAGIARIA')` e
   `ativo = true`).
2. Em `frontend/js/clientes.js`, adicionar estado local
   `filtroResponsavelId` (null = TODOS). Ao clicar em um botão de
   responsável, filtrar a lista já carregada por
   `cliente.responsaveis_cliente.some(r => r.usuario_id === filtroResponsavelId)`
   (client-side, já que `listarTodos()` traz o relacionamento). Isso evita
   nova chamada de API a cada clique.
3. A busca por texto (lupa) já existente deve operar **sobre o resultado
   já filtrado por responsável**, não sobre a lista completa — ou seja, a
   função de busca deve receber a lista filtrada como entrada, não a lista
   bruta de `ClienteModel.listarTodos()`.
4. **Regra de acesso**: usuários com papéis fora de
   `ROLES_RESPONSAVEL` (por exemplo `SECRETARIA`) não devem:
   - Aparecer como opção no filtro (já resolvido, pois a query de usuários
     elegíveis usa o mesmo filtro de `role`).
   - Receber clientes vinculados — adicionar essa validação também no
     **backend**, em `backend/routes/clientes.js`, no endpoint que grava
     `responsaveis_cliente` (rejeitar com `400` se o `usuario_id` enviado
     não tiver `role` dentro de `ROLES_RESPONSAVEL`), para não depender
     apenas da validação client-side.

---

## 5 e 6. Arquivamento de audiências e perícias

### Diagnóstico confirmado
- As tabelas `audiencias` e `pericias` (ver `sql/schema.sql`) **não têm
  coluna de status/arquivamento** hoje. É necessário adicionar a coluna
  antes de implementar a UI.

### O que implementar
1. Nova migration `sql/add_status_arquivamento.sql`:
   ```sql
   alter table audiencias add column if not exists status text not null default 'ATIVA' check (status in ('ATIVA','ARQUIVADA'));
   alter table pericias add column if not exists status text not null default 'ATIVA' check (status in ('ATIVA','ARQUIVADA'));
   create index if not exists idx_audiencias_status on audiencias(status);
   create index if not exists idx_pericias_status on pericias(status);
   ```
2. **Backend**: em `backend/routes/audiencias.js` e
   `backend/routes/pericias.js`:
   - `GET /` passa a aceitar `?status=ATIVA|ARQUIVADA` (default `ATIVA`,
     para não quebrar telas existentes).
   - Novo endpoint `PATCH /:id/arquivar` e `PATCH /:id/restaurar`, cada um
     fazendo apenas `update({ status: 'ARQUIVADA' | 'ATIVA' })` — **nunca**
     `delete`.
3. **Frontend**: em `frontend/js/audiencias.js` e `frontend/js/pericias.js`,
   no template de linha da tabela (mesmo bloco onde hoje ficam os botões de
   ação), adicionar botão **"Arquivar"** (ícone `fa-solid fa-box-archive`)
   que abre um modal de confirmação (reaproveitar o padrão de modal de
   confirmação já usado em outras telas, ex. exclusão de usuários em
   `admin.js`) e, ao confirmar, chama `PATCH /:id/arquivar` e remove a
   linha da lista atual (já que a listagem padrão só mostra `ATIVA`).

---

## 7. Área de Arquivados (com restauração)

### O que implementar
1. **Menu lateral** (`frontend/js/sidebar.js`): adicionar item "Arquivados"
   (ícone `fa-solid fa-box-archive`) com submenus "Audiências Arquivadas" e
   "Perícias Arquivadas", no mesmo padrão de agrupamento já usado para o
   grupo "ADMINISTRAÇÃO".
2. **Páginas**: `frontend/audiencias-arquivadas.html` e
   `frontend/pericias-arquivadas.html` (ou uma única página
   `arquivados.html` com abas, para reduzir duplicação de HTML/CSS — a
   escolha entre as duas abordagens deve seguir o padrão visual já usado em
   `frontend/audiencias.html`/`pericias.html`, reaproveitando a mesma
   tabela/CSS e trocando apenas a chamada de API para
   `?status=ARQUIVADA`).
3. **JS**: reaproveitar ao máximo `frontend/js/audiencias.js` e
   `frontend/js/pericias.js` (extrair a função de renderização de
   tabela para ser parametrizável por status, em vez de duplicar código),
   trocando apenas o botão de ação de "Arquivar" para **"Restaurar"**
   (chama `PATCH /:id/restaurar`).
4. Adicionar as novas páginas em `frontend/js/guard.js`
   (`requiresAuth: true, requiredRole: null`, a menos que se decida
   restringir arquivamento a `ADMIN`/`ADVOGADO` — **confirme com o
   cliente** se estagiários podem restaurar registros arquivados antes de
   liberar essa permissão).

---

## 8–10. Produção, testes e relatório final

- Após implementar os itens 1–7, testar em ambiente local
  (`npm run dev --prefix backend` + servidor estático do frontend) os
  fluxos completos: upload de cada tipo de arquivo permitido, geração de
  procuração em 1 página, filtro de clientes por cada responsável
  cadastrado, arquivamento/restauração de audiência e perícia.
- Fazer deploy em **Preview** da Vercel antes de promover para produção, e
  validar especificamente o endpoint `GET /api/documentos/debug-blob` para
  confirmar que `busboy` e `@vercel/blob` resolvem corretamente no runtime
  de produção (não apenas local).
- Ao final, produzir um relatório listando: arquivos alterados/criados,
  migrations SQL executadas (e em qual ambiente), e quaisquer decisões que
  exigiram confirmação do cliente (ex.: papel de "arquivar/restaurar" para
  estagiários, escolha entre página única de arquivados com abas vs. duas
  páginas separadas).

---

## Observações finais para o agente de execução

- **Não** apague `backend/routes/documentos-debug.js` — é a ferramenta de
  diagnóstico usada para validar a correção do item 1 em produção.
- **Não** reintroduza `backend/node_modules` no git.
- Sempre que criar uma nova rota de API, registre-a em `backend/index.js`
  com `authMiddleware`, seguindo o padrão das rotas existentes.
- Sempre que criar uma nova página `.html`, registre-a em
  `frontend/js/sidebar.js` **e** `frontend/js/guard.js` — esquecer o guard
  é a causa mais comum de bugs de permissão neste projeto (já ocorreu
  antes com os papéis ESTAGIARIO/ESTAGIARIA em audiências/perícias).