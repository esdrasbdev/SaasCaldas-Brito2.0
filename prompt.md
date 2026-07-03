# PROMPT.md — Rodada de Correções (Checklist consistente com o estado atual)




## Contexto

Analise integralmente o repositório antes de realizar qualquer alteração.

**Repositório:**
https://github.com/esdrasbdev/SaasCaldas-Brito2.0.git

**Stack:** Vanilla JS ES Modules (frontend) + Node.js/Express (backend) + Supabase (PostgreSQL + Auth), tudo servido pela mesma Vercel Function (`api/index.js` expõe `backend/index.js`). Padrão MVC por módulo, RBAC (ADMIN, ADVOGADO/ADVOGADA, SECRETARIA, ESTAGIARIO/ESTAGIARIA).

É extremamente importante **não criar regressões**, **não alterar regras de negócio existentes** e **seguir exatamente o padrão arquitetural já utilizado no projeto** (sem frameworks de UI, ícones Font Awesome 6, variáveis/comentários CSS em português, nomes de classes em português, sem emojis).

Antes de modificar qualquer arquivo:
- compreenda o fluxo completo da funcionalidade;
- identifique todos os pontos onde a funcionalidade é utilizada;
- procure funções já existentes que possam ser reutilizadas;
- mantenha o padrão de nomenclatura do projeto.

---

# PROBLEMA 01 — Compactar a Folha de Procuração em página única

## Objetivo

A Procuração deve caber **inteiramente em uma única página A4**, mantendo:
- o timbrado (logo, marca d'água e rodapé do escritório);
- a legibilidade do texto (não pode ficar espremido);
- a justificação de texto já existente;
- **sem afetar nenhum outro modelo** (`contrato-honorarios`, `declaracao-hipossuficiencia`, `declaracao-residencia`, `termo-responsabilidade`, `termo-renuncio`) — esses devem continuar exatamente como estão hoje.

## Escopo de alteração (obrigatório)

- Trabalhar **apenas dentro do bloco** `if (chave === 'procuracao')` em `frontend/js/clientes.js`.
- **Não** alterar as funções genéricas (`addTexto`, `addMisto`, `aplicarTimbrado`, `checarPagina`).

## Abordagens permitidas (escolher a que ficar melhor)

1. **Reduzir espaçamento vertical apenas na procuração**, por exemplo:
   - `depois` dos blocos longos (OUTORGANTE/OUTORGADO/PODERES);
   - reduzir o `depois: 16` antes da assinatura;
   - reduzir levemente espaçamento do título/subtítulo se necessário.

2. **Reduzir levemente tamanho de fonte apenas nos trechos mais longos da procuração**, ex.: `fontSize: 10.5` ao invés de 11, **somente** dentro do bloco do modelo.

Se necessário, criar constantes locais com nomes claros e **utilizadas somente no bloco** (ex.: `const DEPOIS_ASSINATURA_PROC = 9;`).

## Método de validação (obrigatório)

- Garanta que o conteúdo final (incluindo assinatura e rodapé) fica **abaixo** de `PH - MAR_BOTTOM - 12` antes de `addRodapeEscritorio()`.
- Gere a Procuração no navegador (botão “PDF”) e confira visualmente: **tudo em 1 página**.
- Gere também os outros 5 modelos e confirme que **o layout não mudou**.

---

# PROBLEMA 02 — Central de Documentos do Cliente (upload/armazenamento com Vercel Blob)

## Situação atual (ajuste do prompt)

- A ficha de cliente já possui a UI de **Documentos Jurídicos** (PDFs padronizados) e já existe lógica de upload/exclusão no frontend para documentos vinculados ao cliente.
- O prompt original propõe uma migração completa para Vercel Blob e troca do backend.
- O que precisa ser feito agora é garantir que o **armazenamento físico** migre de Supabase Storage para **Vercel Blob**, seguindo o limite de payload das functions serverless.

## Objetivo

Adicionar/ajustar dentro da ficha do cliente uma seção **“Documentos do Cliente”** (upload/listagem/download/exclusão) usando **Vercel Blob**, com permissões consistentes com RBAC já existente.

## Implementação esperada (o que ainda falta fazer)

### 1) Dependência e variável de ambiente

- Adicionar `@vercel/blob` em `backend/package.json`.
- Garantir que existe `BLOB_READ_WRITE_TOKEN` no ambiente da Vercel (criar no painel: Project → Storage → Blob). **Não criar Blob Store via código**.
- Documentar isso no `PROMPT.md`/README.

### 2) Backend — trocar o armazenamento em `backend/routes/documentos.js`

**Obrigatório preferir upload direto do cliente para Blob** (evita limite de payload do serverless).

- Criar rota `POST /api/documentos/blob-upload` usando `handleUpload` do `@vercel/blob/client`.
- Validar `req.user` (authMiddleware já aplicado em `backend/routes/documentos.js`/`/api/documentos`) e `cliente_id` recebido no `clientPayload`.
- Restringir:
  - `allowedContentTypes` (ex.: `application/pdf`, `image/*`, `application/msword`, etc.).
  - `maximumSizeInBytes` (ex.: 15MB).
- Ao concluir upload, persistir na tabela `documentos`:
  - `nome`, `url` (URL retornada pelo Blob), `tipo`, `cliente_id`, `upload_por: req.user.id`.

- Manter `GET /api/documentos?cliente_id=...` para listar.
- Em `DELETE /api/documentos/:id`:
  - usar `del(url)` do `@vercel/blob` com a `url` salva no registro;
  - e só então remover a linha da tabela.

> Se existir rota/endpoint `POST /api/documentos/upload` baseada em Base64, ela pode continuar apenas como “fallback” para arquivos pequenos (se o projeto já usa). O caminho recomendado continua sendo upload client→Blob.

### 3) Frontend — ajustar a seção “Documentos do Cliente”

Em `frontend/js/clientes.js`:

- Garantir que a seção (modal/ficha) use `upload()` do `@vercel/blob/client` apontando para `/api/documentos/blob-upload`.
- Enviar no `clientPayload` o `cliente_id`.
- Enviar header `Authorization` conforme o padrão do projeto (`apiFetch`/`getSession` já usados no arquivo).
- Renderizar lista vinda de `GET /api/documentos?cliente_id=...` com:
  - nome, tipo/tamanho (se disponível no payload), `criado_em`, `usuarios.nome` (quem enviou),
  - links/ações “Abrir/Baixar” via `${url}`,
  - “Excluir” via `DELETE /api/documentos/:id` respeitando RBAC.

- Em modo visualização somente leitura (`visualizacao === true`), ocultar upload e excluir.

## Critérios de aceitação

- Upload funciona para arquivos maiores do que o limite seguro de JSON/Base64.
- Download abre corretamente (URL do Blob).
- Exclusão remove tanto do Blob quanto da linha no banco.
- Nenhuma regressão na UI atual de documentos/cliente.

---

# PROBLEMA 03 — Corrigir definitivamente o erro 400 ao trocar a senha de um usuário

## Situação atual (ajuste do prompt)

- `backend/routes/usuarios.js` **já** possui tentativa primária por `id` e reconciliação por e-mail usando `listUsers()`.
- Ainda assim, o erro 400 persiste para pelo menos um usuário (ex.: `cee869f7-8e31-4c3b-983e-35d459703362`).
- Portanto, o objetivo aqui é **validar a causa real nos logs** e completar o comportamento para os casos que ainda não estão cobertos.

## Objetivo

A troca de senha deve funcionar para **100% dos usuários ativos**, inclusive os que foram cadastrados “antes” do fluxo correto (possível ausência de conta no Auth vinculada ao mesmo id público).

## Implementação esperada

### 1) Diagnóstico com logs reais (obrigatório antes de mudar lógica)

Adicionar logs temporários na rota `PUT /api/usuarios/:id` em `backend/routes/usuarios.js` nos pontos de falha (tentativa por id e reconciliação por e-mail), incluindo:
- `id` (público)
- `authError.message`, `status`, `code`, `name`
- se `pubUser` foi encontrado e qual email
- se `listUsers()` retornou usuário correspondente por email

Reproduzir o fluxo para o usuário citado (ou equivalente no ambiente onde o bug ocorre) e registrar a causa exata.

### 2) Complementar cobertura (somente conforme logs)

Com base no que aparecer nos logs:
- Se o erro for “usuário não encontrado” no Auth em todos os caminhos, implementar self-healing:
  - ao não encontrar no Auth por e-mail, **criar conta no Auth** usando `admin.createUser` (mesmo padrão do `POST /`).
  - então realizar `updateUserById` com o `novaSenha`.

> Atenção: **não** alterar `public.usuarios.id` se existirem FKs referenciando essa chave. Se houver risco de quebra de relacionamentos, manter a linha em `public.usuarios` e apenas garantir que existe conta no Auth para aquele email.

- Se o erro for outro (ex.: política de senha, chaves/permite, estado, ou falha de autenticação do Admin), ajustar especificamente mantendo as mensagens amigáveis.

### 3) Normalização de e-mail (deixar robusto)

Garantir que a comparação de e-mail na reconciliação use normalização:
- `toLowerCase()`
- `trim()`

### 4) Remover código morto

Se houver variáveis como `shouldTryReconcile` que não são usadas, remover ao final para reduzir confusão.

### 5) Plano de testes (obrigatório)

Validar manualmente:
- (a) id público já igual ao Auth id: funciona.
- (b) id diverge, mas email existe no Auth: reconcilia e troca senha.
- (c) não existe conta no Auth para o email: self-healing cria conta e troca senha, sem erro 400.

Em todos os casos:
- toast de sucesso aparece;
- console não deve registrar erro 400 nesse fluxo.

---

# Checklist final (antes de considerar concluído)

- [ ] PROBLEMA 01: Procuração em 1 página A4, sem alterar layout dos outros modelos.
- [ ] PROBLEMA 02: Documentos do Cliente armazenam no Vercel Blob (upload/baixar/excluir).
- [ ] PROBLEMA 03: Troca de senha funciona para usuários com casos antigos; logs confirmam causa real; self-healing aplicado somente se necessário.

