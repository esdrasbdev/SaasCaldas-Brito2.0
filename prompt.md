# PROMPT.md — Rodada de Correções (SaasCaldas-Brito 2.0)

## Contexto

Analise integralmente o repositório antes de realizar qualquer alteração.

**Repositório:**
https://github.com/esdrasbdev/SaasCaldas-Brito2.0.git

**Stack:** Vanilla JS ES Modules (frontend) + Node.js/Express (backend) + Supabase (PostgreSQL + Auth), tudo servido pela mesma Vercel Function (`api/index.js` expõe `backend/index.js`). Padrão MVC por módulo, RBAC (ADMIN, ADVOGADO/ADVOGADA, SECRETARIA, ESTAGIARIO/ESTAGIARIA).

É extremamente importante **não criar regressões**, **não alterar regras de negócio existentes** e **seguir exatamente o padrão arquitetural já utilizado no projeto** (sem frameworks de UI, ícones Font Awesome 6, variáveis/comentários CSS em português, nomes de classes em português, sem emojis, comentários explicando intenção).

Antes de modificar qualquer arquivo:
- compreenda o fluxo completo da funcionalidade;
- identifique todos os pontos onde a funcionalidade é utilizada;
- procure funções já existentes que possam ser reutilizadas (o projeto já tem bastante código "órfão" pronto para ser aproveitado — ver PROBLEMA 01);
- mantenha o padrão de nomenclatura do projeto.

---

# PROBLEMA 01 — Central de "Documentos do Cliente" na ficha de visualização (upload para Vercel Blob)

## Situação real encontrada no código (importante)

Ao analisar `frontend/js/clientes.js`, a seção que existe hoje dentro do modal de cliente é **apenas "Documentos Jurídicos"** (`renderizarDocumentosJuridicos`, linha ~338), que gera e baixa os 6 modelos de PDF (Procuração, Contrato, Declarações, Termos). **Não existe** nenhuma seção de upload/armazenamento de arquivos do cliente (ex.: RG digitalizado, comprovantes, laudos, etc.) — isso é exatamente o que falta construir.

Só que o projeto **já tem metade do encanamento pronto e órfão** (nunca é renderizado no DOM):
- `ClienteModel.listarDocumentos(clienteId)` (linha ~85) — busca `GET /api/documentos?cliente_id=...` — **nunca é chamada em lugar nenhum**.
- Um listener em `document.body.addEventListener('change', ...)` (linha ~1151) escutando `#upload-doc-cliente` — faz upload em base64 para `POST /api/documentos/blob-upload` — mas **esse input nunca existe no HTML**, então o listener nunca dispara.
- Um listener de clique em `.btn-del-doc` (linha ~1191) chamando `DELETE /api/documentos/:id` — também **nunca tem botão correspondente renderizado**.
- `ClienteController.atualizarSessaoDocumentos(clienteId)` (linha ~1212) chama `ClienteView.renderizarSessaoDocumentos`, que hoje só desenha os "Documentos Jurídicos" — **não lista nem exibe os documentos enviados**.

No backend, `backend/routes/documentos.js` já expõe `GET /`, `POST /blob-upload` e `DELETE /:id`. **Porém a rota `/blob-upload` está com uso incorreto do `@vercel/blob`**: ela recebe o arquivo em base64 dentro do JSON (`req.body.base64`) e depois chama `handleUpload({ data: {...}, req })` — essa não é a assinatura real de `handleUpload` do pacote `@vercel/blob/client` (que espera o payload de handshake gerado pela função `upload()` do lado cliente — `body`, `request`, `onBeforeGenerateToken`, `onUploadCompleted` — não um objeto arbitrário `{ arquivo, name, type }`). Isso deve fazer a chamada falhar/lançar erro em produção. Além disso, mandar arquivos como base64 dentro do corpo JSON para uma Vercel Function pode esbarrar no limite de tamanho do corpo da função serverless em arquivos maiores.

## Objetivo

Construir, dentro da ficha de visualização/edição do cliente, uma seção **"Documentos do Cliente"** (upload, listagem, download e exclusão), separada da seção "Documentos Jurídicos" já existente, com o arquivo físico armazenado no **Vercel Blob**.

## Implementação esperada

### 1) Backend — corrigir `backend/routes/documentos.js`

Duas alternativas válidas (escolher a mais simples e coerente com o restante do projeto, que já envia o arquivo em base64 do frontend para o backend em vez de fazer upload direto cliente→Blob):

- **Opção A (recomendada, menor risco):** trocar o uso de `handleUpload` por `put()` do pacote `@vercel/blob` (`const { put } = require('@vercel/blob')`), que é a função correta para upload feito a partir do servidor:
  ```js
  const blob = await put(nomeArquivoUnico, arquivoBuffer, {
    access: 'public',
    contentType: tipo
  });
  // usar blob.url ao salvar em `documentos`
  ```
- **Opção B:** implementar de fato o fluxo client-to-blob com `upload()` do `@vercel/blob/client` no frontend e `handleUpload` com `onBeforeGenerateToken`/`onUploadCompleted` no backend (mais trabalho, mas evita passar o arquivo pela function).

Adotar a Opção A a menos que arquivos grandes (>4–5MB) sejam um requisito real hoje — validar com o tamanho máximo já definido no código (`maximumSizeInBytes = 15MB`) se compensa migrar para Opção B depois.

Manter:
- validação de `allowedContentTypes` e tamanho máximo já existentes;
- gravação em `documentos` com `nome`, `url`, `tipo`, `cliente_id`, `upload_por`;
- `DELETE /:id` removendo do Blob via `del(url)` antes de apagar a linha (já implementado, só confirmar que continua funcionando após a troca de `handleUpload` por `put`).

Adicionar `@vercel/blob` já está em `backend/package.json` (`^0.26.1`) — apenas confirmar que `BLOB_READ_WRITE_TOKEN` está configurado no painel da Vercel (Project → Storage → Blob). **Não criar o Blob Store via código.**

### 2) Frontend — construir a seção visualmente em `frontend/js/clientes.js`

Dentro de `ClienteView.renderizarSessaoDocumentos(clienteId, visualizacao)` (linha ~304), **adicionar um novo bloco** abaixo (ou acima) do bloco "Documentos Jurídicos" já existente, reaproveitando o padrão visual (`border-top`, ícones Font Awesome, cores via `var(--...)`):

- Título "Documentos do Cliente" com ícone (ex.: `fa-solid fa-paperclip` ou `fa-solid fa-folder-open`).
- Um botão/input de upload (`<input type="file" id="upload-doc-cliente" data-cliente="${clienteId}" hidden>` + botão estilizado que dispara o clique) — **reaproveitar exatamente o id `upload-doc-cliente` e o `data-cliente`** que o listener em `document.body.addEventListener('change', ...)` já espera (linha ~1151), para não duplicar lógica.
- Uma lista dos documentos, obtida via `ClienteModel.listarDocumentos(clienteId)` (já existe, só falta chamar):
  - nome do arquivo, data de envio (`criado_em`), quem enviou (`usuarios.nome`, já vem no `select` do backend);
  - botão "Abrir/Baixar" (`<a href="${url}" target="_blank">`);
  - botão de excluir com classe `btn-del-doc` e `data-id="${id}" data-cliente="${clienteId}"` (reaproveitar o listener da linha ~1191).
- Estado vazio: mensagem simples "Nenhum documento enviado ainda." quando a lista vier vazia.
- Loading: mostrar um estado de carregamento simples enquanto `listarDocumentos` resolve (a função já trata 401 retornando `[]`, então tratar erro de rede separadamente com `showToast`).

### 3) Regras de visibilidade (RBAC/visualização)

- Em modo **somente leitura** (`visualizacao === true`), **ocultar o botão de upload e os botões de excluir**, mantendo apenas a listagem/download — mesmo padrão já usado em outros pontos do modal (ex.: `el.disabled = visualizacao` na linha ~237).
- Quando `clienteId` for `null` (cliente novo, ainda não salvo), manter a mensagem já existente pedindo para salvar os dados básicos primeiro, e não mostrar a seção de upload.

## Critérios de aceitação

- Ao abrir a visualização de um cliente já salvo, aparece a seção "Documentos do Cliente" com upload funcional.
- Upload salva o arquivo no Vercel Blob (confirmar a URL retornada aponta para o domínio `*.public.blob.vercel-storage.com` ou equivalente) e a linha aparece imediatamente na lista sem precisar recarregar a página.
- Download abre o arquivo pela URL do Blob.
- Exclusão remove o arquivo do Blob e a linha do banco, e some da lista.
- Em modo visualização (somente leitura), upload/exclusão ficam ocultos; em edição/criação, aparecem normalmente.
- Nenhuma regressão na seção "Documentos Jurídicos" já existente.

---

# PROBLEMA 02 — Verificar se a criação de usuários está 100% funcional

## Situação real encontrada no código

`backend/routes/usuarios.js` já tem uma rota `POST /` bem completa: cria no Supabase Auth, reconcilia se o e-mail já existir no Auth mas não na tabela pública, insere em `public.usuarios` e reverte a criação no Auth se a inserção no banco falhar. Isso indica que a funcionalidade **provavelmente já está correta no backend**, mas é preciso validar a ponta a ponta (frontend `admin.html`/`admin.js` → rota → tabela → login do novo usuário) porque o pedido do cliente é gerar contas para uso real.

## Objetivo

Confirmar (e corrigir se necessário) que um ADMIN consegue, pela tela `admin.html`, cadastrar um novo usuário funcional — capaz de logar imediatamente com a senha definida.

## Roteiro de verificação (obrigatório antes de qualquer alteração)

1. **Frontend (`frontend/admin.html` + `frontend/js/admin.js`):**
   - Conferir se o formulário de criação envia exatamente `{ nome, email, role, senha }` para `POST /api/usuarios`, com o header `Authorization: Bearer <token>` do ADMIN logado.
   - Conferir se a lista de `role` no `<select>` do formulário está sincronizada com os valores aceitos pelo backend e usados em `sidebar.js`/`guard.js` (`ADMIN`, `ADVOGADO`, `ADVOGADA`, `SECRETARIA`, `ESTAGIARIO`, `ESTAGIARIA`) — evitar strings divergentes (ex.: acentuação, maiúsculas/minúsculas).
   - Após o `POST` responder `ok: true`, a lista de usuários deve ser recarregada (a rota `GET /` usa cache de 2 min em `backend/cache.js` — confirmar que `cache.invalidate('usuarios_list')`, já presente no `POST`, realmente reflete o novo usuário na tela sem precisar esperar o cache expirar).

2. **Backend:** reproduzir manualmente os três cenários já cobertos pelo código:
   - (a) e-mail novo → cria no Auth e na tabela pública;
   - (b) e-mail já existente no Auth mas ausente na tabela pública → reconcilia;
   - (c) e-mail já existente em ambos → deve retornar erro amigável (hoje, se `linhaExistente` existir, o código atualiza `nome/role/ativo` e retorna sucesso com `reconciliado: true` — confirmar que esse comportamento é o desejado pelo negócio, ou se deveria bloquear e avisar "e-mail já cadastrado" para evitar sobrescrever um usuário existente por engano).

3. **Login real:** com o usuário recém-criado, tentar logar em `login.html` e confirmar que:
   - o `role` retornado corresponde ao cadastrado;
   - `sidebar.js`/`guard.js` liberam exatamente os módulos esperados para aquele `role` (isso já teve correções recentes para ESTAGIARIO/ESTAGIARIA em `sidebar.js`/`guard.js` — confirmar que não regrediu).

## Critérios de aceitação

- Criar um usuário pela tela admin funciona sem erro em todos os cenários acima.
- O usuário criado loga imediatamente com a senha definida.
- Permissões de menu/rotas batem com o `role` escolhido.
- Nenhuma regressão nas permissões já corrigidas de ESTAGIARIO/ESTAGIARIA.

---

# PROBLEMA 03 — Procuração ainda saindo em duas páginas

## Situação real encontrada no código

O bloco `if (chave === 'procuracao')` em `frontend/js/clientes.js` (linha ~774) **já recebeu uma rodada de compactação** (constantes `DEPOIS_PODERES_PROC`, `DEPOIS_DATA_PROC`, `FONT_SIZE_TEXTO_PROC = 10.5`). Mesmo assim, o cliente relata que o documento ainda sai em duas folhas para pelo menos alguns clientes — provavelmente quando os campos variáveis são mais longos (nome completo grande, endereço extenso, mais de um outorgante, etc.), o texto do bloco `OUTORGANTE(S)`/`OUTORGADO(S)`/`PODERES` ultrapassa o espaço disponível.

## Objetivo

Garantir que a Procuração caiba **inteiramente em uma única página A4** mesmo em casos de texto mais longo (nome/endereço extensos), mantendo:
- o timbrado (logo, marca d'água e rodapé do escritório);
- a legibilidade do texto (não pode ficar espremido a ponto de prejudicar leitura);
- a justificação de texto já existente;
- **sem afetar nenhum outro modelo** (`contrato-honorarios`, `declaracao-hipossuficiencia`, `declaracao-residencia`, `termo-responsabilidade`, `termo-renuncio`).

## Escopo de alteração (obrigatório)

- Trabalhar **apenas dentro do bloco** `if (chave === 'procuracao')` (linhas ~774–826).
- **Não** alterar as funções genéricas (`addTexto`, `addMisto`, `aplicarTimbrado`, `checarPagina`, `LINHA_H`, margens).

## O que investigar e ajustar

1. Testar a geração com um cliente de **nome completo longo + endereço completo (rua, número, bairro, cidade, estado, CEP)** — esse é o cenário mais provável de estourar a página, já que o parágrafo `OUTORGANTE(S)` (linha ~778) concatena nome + estado civil + profissão + RG + CPF + endereço inteiro em um único parágrafo.
2. Reduzir levemente o espaçamento (`depois`) entre os blocos `OUTORGANTE(S)` e `OUTORGADO(S)` (hoje `depois: 6` em ambos, linha ~785 e ~799) — ex.: `depois: 4`, se ainda ficar legível.
3. Se necessário, aplicar `FONT_SIZE_TEXTO_PROC` (hoje só usado no bloco `PODERES`) também aos parágrafos `OUTORGANTE(S)` e `OUTORGADO(S)` — hoje eles usam o tamanho padrão de `addMisto` (11), enquanto `PODERES` já usa 10.5.
4. Como último recurso, reduzir minimamente a margem/`LINHA_H` **só dentro deste bloco**, se a função `addMisto`/`addTexto` permitir overrides pontuais sem alterar o padrão global.

Se necessário, criar constantes locais adicionais com nomes claros (ex.: `const FONT_SIZE_OUTORGA_PROC = 10.5;`), **usadas somente dentro do bloco `procuracao`**.

## Método de validação (obrigatório)

- Garantir que o conteúdo final (incluindo assinatura e rodapé) fica **abaixo** de `PH - MAR_BOTTOM - 12` antes de `addRodapeEscritorio()`.
- Testar com pelo menos 3 cenários: (a) nome e endereço curtos, (b) nome e endereço médios, (c) nome e endereço mais longos possíveis dentro do razoável — confirmar 1 página nos três casos.
- Gerar também os outros 5 modelos e confirmar que **o layout não mudou**.

---

# PROBLEMA 04 — "2.5. Benefício Assistencial (BPC)" saindo menor e com cor diferente no Contrato de Honorários

## Situação real encontrada no código

No bloco `else if (chave === 'contrato-honorarios')` (linha ~828), a cláusula 2 é renderizada assim (linha ~858–867):

```js
{
  num: '2. HONORÁRIOS – FASE ADMINISTRATIVA',
  subitens: [
    '2.1. Benefícios Previdenciários Permanentes:\n...',
    '2.2. Benefícios Temporários com DCB (como auxílio-doença):\n...',
    '2.3. Auxílio-Acidente:\n...',
    '2.4. Benefícios sem DCB:\n...',
    '2.5. Benefício Assistencial (BPC):\n...'
  ]
}
```

E todos os `subitens` de todas as cláusulas são renderizados pelo mesmo laço genérico (linha ~904–913), chamando `addTexto(linha, { indent: 6, depois: ... })` — **sem nenhum override explícito de `fontSize` ou `cor`** nesse trecho, então em teoria todos os subitens (incluindo o 2.5) deveriam sair no tamanho/cor padrão (`fontSize: 11`, `cor: [30,30,30]`, definidos nos defaults de `addTexto`, linha ~588–598).

Ou seja: **o código-fonte atual não mostra, de forma explícita, por que só o item 2.5 sairia diferente** — não há um segundo local no arquivo definindo essa cláusula com estilo distinto. Isso sugere que o comportamento relatado pode vir de:
- um efeito colateral do `jsPDF` (ex.: quebra de página ocorrendo exatamente no meio do item 2.5, fazendo `checarPagina()` disparar `aplicarTimbrado()` em um estado de fonte não totalmente resetado); ou
- um PDF gerado por uma versão anterior do código (cache do navegador/arquivo baixado antes da última correção), que não reflete mais o `clientes.js` atual.

## Objetivo

O texto "2.5. Benefício Assistencial (BPC)" (e seu conteúdo) deve sair **exatamente no mesmo tamanho de fonte e cor do corpo do documento** — igual aos demais subitens (2.1 a 2.4).

## Passos obrigatórios (diagnosticar antes de alterar)

1. Gerar o PDF do Contrato de Honorários **a partir do código atual do repositório** (não usar um PDF antigo já baixado) e conferir visualmente se o problema realmente persiste no código-fonte atual.
2. Se persistir, verificar especificamente:
   - se o item 2.5 cai perto do limite de `checarPagina()` (linha ~579) e força uma quebra de página no meio do subitem — nesse caso, confirmar que `aplicarTimbrado()` não deixa `pdf.setFontSize`/`pdf.setTextColor` em um estado diferente do esperado antes de continuar o texto (a função `addTexto` já reaplica `fontSize`/`cor` a cada chamada, então isso não deveria acontecer, mas validar mesmo assim);
   - se existe algum caractere especial em "Benefício" (acentuação) causando fallback de fonte no jsPDF/Helvetica que pareça visualmente "mais claro" — testar substituindo temporariamente por "Beneficio" (sem acento) só para isolar a causa, e reverter depois.
3. Após identificar a causa real, corrigir **apenas o necessário** para igualar o item 2.5 ao restante — evitando adicionar exceções manuais de estilo específicas para esse item (a lógica deve continuar genérica para todos os subitens).

## Critérios de aceitação

- Os 5 subitens da cláusula 2 (2.1 a 2.5) saem com o mesmo tamanho de fonte e cor no PDF gerado.
- Nenhuma alteração de estilo nas demais cláusulas (1, 3, 4, 5, 6, 7) ou nos outros 5 modelos de documento.

---

# PROBLEMA 05 — Lentidão no carregamento de algumas páginas

## Situação real encontrada no código

Alguns pontos concretos no código atual que impactam diretamente o tempo de carregamento:

1. **`frontend/js/supabase.js`** — `initSupabase()` faz um `fetch('/api/env')` **em toda página, a cada carregamento**, para só então inicializar o client do Supabase. Isso adiciona um round-trip de rede obrigatório antes de qualquer autenticação ou consulta poder começar — nada é feito em paralelo com esse fetch.
2. **`frontend/js/guard.js`** — `pageGuard()` chama `requireAuth({ timeoutMs: 6000 })` (linha ~46) e só libera o conteúdo da página (`showPageContent()`) depois que a sessão é restaurada — ou seja, o usuário pode ficar até 6 segundos vendo a tela de carregamento em casos de rede lenta ou instância "fria" do Supabase.
3. **`backend/cache.js`** — o cache é **em memória, por instância do processo Node**. Como o backend roda como Vercel Function (serverless), instâncias podem ser recicladas/trocadas entre requisições ("cold start"), fazendo o cache "resetar" com frequência e perder efetividade justamente nos momentos de pico, quando mais ajudaria.
4. **Índices do banco** (`sql/indices.sql`) já cobrem `audiencias`, `pericias`, `processos`, `atendimentos`, `publicacoes` — mas não há índice explícito para `documentos.cliente_id`, usado na nova seção do PROBLEMA 01, nem para `usuarios.email` (usado em buscas de reconciliação no PROBLEMA 02).

## Objetivo

Reduzir a percepção de lentidão no carregamento das páginas, sem reescrever a arquitetura do projeto.

## Implementação esperada

### 1) Reduzir o round-trip inicial de configuração

- Avaliar cachear a resposta de `/api/env` no `localStorage`/`sessionStorage` do navegador (com um TTL curto, ex.: 1h) para evitar buscar `SUPABASE_URL`/`SUPABASE_ANON_KEY` do zero em toda navegação entre páginas da mesma sessão — mantendo um fallback para buscar de novo se os dados não estiverem no cache local.

### 2) Paralelizar o que for possível no carregamento

- Verificar se o `fetch('/api/env')` em `initSupabase()` pode iniciar **em paralelo** com a checagem de sessão local do Supabase (`persistSession: true` já guarda a sessão no `localStorage` do navegador; não é necessário esperar `/api/env` para começar a ler isso).

### 3) Índices adicionais

Adicionar em `sql/indices.sql` (não executar automaticamente — apenas preparar o script para o usuário rodar no Supabase):
```sql
create index if not exists idx_documentos_cliente_id on documentos(cliente_id);
create index if not exists idx_usuarios_email on usuarios(email);
```

### 4) Cache do backend

- Documentar explicitamente (comentário no `backend/cache.js`) que o cache em memória **não é garantido entre invocações da function na Vercel** (cold starts) — isso não é um bug para corrigir agora, mas deixar claro para não gerar falsa expectativa de performance. Se o tempo permitir, avaliar aumentar o TTL de listas que mudam pouco (ex.: `usuarios_list`, hoje 2min) para reduzir consultas repetidas.

### 5) Não fazer

- Não trocar a stack (ex.: não migrar para SSR, não adicionar bundlers/frameworks) — o pedido é otimizar dentro do que já existe.
- Não alterar o comportamento de autenticação/RBAC ao mexer em `guard.js`/`supabase.js`.

## Critérios de aceitação

- Tempo até o conteúdo aparecer (`showPageContent()`) reduz de forma perceptível ao navegar entre páginas já logadas (sessão válida em cache).
- Nenhuma regressão em autenticação, RBAC ou nas queries já existentes.
- Índices novos aplicados sem erro no schema atual.

---

# Checklist final (antes de considerar concluído)

- [ ] PROBLEMA 01: Seção "Documentos do Cliente" criada na ficha do cliente, upload/listagem/download/exclusão funcionando via Vercel Blob, `handleUpload` incorreto substituído por `put()` (ou fluxo client-to-blob correto).
- [ ] PROBLEMA 02: Fluxo de criação de usuário validado ponta a ponta (admin → backend → login do novo usuário), com roles sincronizados entre frontend e backend.
- [ ] PROBLEMA 03: Procuração sai em 1 página A4 mesmo com nome/endereço longos, sem alterar layout dos outros 5 modelos.
- [ ] PROBLEMA 04: Causa raiz do item "2.5. Benefício Assistencial (BPC)" diagnosticada e corrigida, sem exceções manuais de estilo e sem afetar as demais cláusulas.
- [ ] PROBLEMA 05: Melhorias de carregamento aplicadas (cache de `/api/env`, paralelização, índices novos), sem regressão em auth/RBAC.