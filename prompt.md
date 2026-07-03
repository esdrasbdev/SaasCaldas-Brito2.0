# PROMPT.md — Corrigir erro 500 em GET /api/documentos (import errado do client Supabase)

## Contexto

Analise integralmente o arquivo antes de alterar.

**Repositório:**
https://github.com/esdrasbdev/SaasCaldas-Brito2.0.git

**Stack:** Vanilla JS ES Modules (frontend) + Node.js/Express (backend) + Supabase (PostgreSQL + Auth), servido pela mesma Vercel Function (`api/index.js` expõe `backend/index.js`).

É extremamente importante **não criar regressões** e **seguir exatamente o padrão já usado nas outras rotas do projeto**.

---

# PROBLEMA — `backend/routes/documentos.js` importa o módulo Supabase errado, causando 500 em todas as operações de documentos

## Sintoma

No console do navegador, ao abrir a ficha de um cliente:

```
Failed to load resource: the server responded with a status of 500 ()
clientes.js:448 Error: Falha ao buscar documentos
    at Object.listarDocumentos (clientes.js:99:24)
    at async Object.renderizarDocumentosCliente (clientes.js:400:20)
    at async Object.renderizarSessaoDocumentos (clientes.js:325:5)
```

A requisição que falha é `GET /api/documentos?cliente_id=...`.

## Causa raiz (confirmada no código)

Em `backend/routes/documentos.js`, o import está assim:

```js
const supabase = require('../supabase');
```

Só que `backend/supabase.js` **não exporta** um client `supabase` direto — ele exporta um objeto:

```js
module.exports = {
  supabasePublic,
  supabaseAdmin,
  getAdminClient: () => supabaseAdmin || supabasePublic
};
```

Ou seja, `documentos.js` está tratando `{ supabasePublic, supabaseAdmin, getAdminClient }` como se fosse o client do Supabase. Todas as chamadas `supabase.from(...)` e `supabase.storage...` nesse arquivo falham (`supabase.from is not a function` / `supabase.storage is undefined`), caindo no `catch` de cada rota e retornando `res.status(500)`.

Todas as outras rotas do projeto já importam corretamente, por exemplo `backend/routes/clientes.js`:

```js
const { supabasePublic } = require('../supabase');
```

## Objetivo

Corrigir o import em `backend/routes/documentos.js` para usar `supabasePublic` (mesmo padrão do restante do projeto), sem alterar nenhuma lógica de negócio.

## Implementação esperada

### 1) Corrigir o import no topo do arquivo

Trocar:
```js
const supabase = require('../supabase');
```
Por:
```js
const { supabasePublic } = require('../supabase');
```

### 2) Substituir todas as ocorrências de `supabase.` por `supabasePublic.` no restante do arquivo

Localizar **todas** as chamadas ao client (buscar por `supabase\.` no arquivo) e trocar para `supabasePublic.`, incluindo (sem se limitar a):

- `GET /` — `supabase.from('documentos').select('*, clientes(nome), processos(numero_cnj), usuarios(nome)')`
- `POST /blob-upload` — `supabase.from('documentos').insert(...)`
- `POST /upload` (fallback base64/Storage) — `supabase.storage.from(...).upload(...)`, `supabase.storage.from(...).getPublicUrl(...)`, `supabase.from('documentos').insert(...)`
- `DELETE /:id` — `supabase.from('documentos').select('url')...`, `supabase.storage.from('documentos').remove([fileName])`, `supabase.from('documentos').delete().eq('id', id)`

**Não** deixar nenhuma referência solta a `supabase.` (sem o `Public`) no arquivo — confirmar com uma busca final antes de considerar concluído.

### 3) Não alterar

- Nenhuma outra lógica de negócio, validação, RBAC ou nome de tabela/coluna.
- O middleware `auth` aplicado via `router.use(auth)`.
- A lógica de fallback do `del`/`@vercel/blob` já existente (apenas garantir que continua funcionando após a correção do import).

## Método de validação (obrigatório)

1. Rodar `grep -n "supabase\." backend/routes/documentos.js` e confirmar que **todas** as ocorrências agora são `supabasePublic.` (nenhuma sobrou como `supabase.` puro).
2. Testar manualmente, com um cliente já salvo:
   - `GET /api/documentos?cliente_id=<id>` deve retornar `200` com array (vazio ou com documentos), não mais `500`.
   - Abrir a ficha do cliente no frontend e confirmar que a seção "Documentos do Cliente" carrega sem erro no console.
   - Fazer upload de um arquivo de teste e confirmar que ele aparece na lista.
   - Excluir o arquivo de teste e confirmar que some da lista e do Storage/Blob.
3. Confirmar que nenhuma outra rota (`clientes.js`, `processos.js`, etc.) foi tocada.

## Critérios de aceitação

- `GET /api/documentos?cliente_id=...` responde `200`, nunca mais `500` por causa desse bug.
- Upload, listagem, download e exclusão de documentos do cliente funcionam de ponta a ponta.
- Nenhuma outra rota ou arquivo foi alterado além de `backend/routes/documentos.js`.

---

# Checklist final

- [ ] Import trocado para `const { supabasePublic } = require('../supabase');`.
- [ ] Todas as chamadas `supabase.` substituídas por `supabasePublic.` no arquivo inteiro.
- [ ] `GET /api/documentos?cliente_id=...` testado e retornando 200.
- [ ] Upload/listagem/download/exclusão testados manualmente na ficha do cliente.
- [ ] Nenhum outro arquivo alterado.