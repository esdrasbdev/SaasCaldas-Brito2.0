# PROMPT-FIX-ENV-VERCEL.md

## Contexto do projeto

Sistema: **SaasCaldas-Brito 2.0** — SaaS jurídico para a Advocacia Caldas & Brito  
Stack: Vanilla JS ES Modules (frontend), Node.js/Express (backend), Supabase (banco + auth)  
Deploy: Frontend estático no **Vercel**, backend no **Railway**

---

## Problema relatado

No ambiente de produção (`www.caldasebritoadvocacia.com.br`, hospedado no Vercel), a página de login não funciona. O console exibe os seguintes erros:

```
env.js:1  Failed to load resource: the server responded with a status of 404 ()
supabase.js:39  Supabase: js/env.js não carregado ou chaves ausentes. Fallback para /api/env.
favicon.ico:1  Failed to load resource: the server responded with a status of 404 ()
```

No **localhost**, tudo funciona normalmente. No **Vercel**, falha.

---

## Causa raiz

O arquivo `js/env.js` é um arquivo estático gerado ou versionado que expõe as variáveis de ambiente no cliente. No localhost esse arquivo existe em disco. No Vercel, o build **não gera** esse arquivo, então a requisição retorna 404.

O `supabase.js` possui um fallback para `/api/env`, mas esse endpoint ou não existe no projeto, ou não está sendo servido corretamente pelo Vercel (ausência de `vercel.json` com rewrites, ou a função `/api/env.js` não está implementada).

O problema tem duas causas prováveis — identifique qual se aplica ao repositório:

**Causa A:** `js/env.js` é um arquivo estático com as chaves hardcoded ou gerado localmente, que nunca é commitado/deployado para o Vercel.

**Causa B:** `js/env.js` existe, mas o `supabase.js` tenta carregá-lo via `fetch()` ou `import()` dinâmico, e o Vercel não consegue resolvê-lo como módulo estático por algum problema de roteamento ou MIME type.

---

## O que a IA deve fazer

### 1. Diagnóstico — inspecionar os arquivos relevantes

Leia os seguintes arquivos antes de qualquer alteração:

- `js/env.js` — existe? Contém chaves hardcoded? É gerado por algum script?
- `js/supabase.js` — como carrega o `env.js`? Via `fetch()`, `import`, ou `<script>` no HTML?
- `index.html` (ou qualquer HTML de login) — como `env.js` é referenciado?
- `api/env.js` (ou `api/env/index.js`) — este endpoint existe? O que ele retorna?
- `vercel.json` — existe? Tem `rewrites` ou `routes` configurados?
- `.env` e `.env.example` — quais variáveis são esperadas?

### 2. Solução a implementar

Implemente a **Solução Definitiva** abaixo. Não use gambiarras. Não mantenha o `js/env.js` como arquivo estático com chaves.

---

## Solução Definitiva: endpoint `/api/env` + remoção do `js/env.js` estático

### Passo 1 — Criar (ou corrigir) o endpoint `api/env.js`

Crie o arquivo `api/env.js` na raiz do projeto (função serverless do Vercel):

```js
// api/env.js
// Função serverless Vercel — expõe variáveis de ambiente públicas ao frontend.
// NUNCA exponha SERVICE_ROLE_KEY aqui. Apenas a ANON_KEY é pública por design do Supabase.

export default function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({
      error: 'Variáveis de ambiente SUPABASE_URL e/ou SUPABASE_ANON_KEY não configuradas no Vercel.'
    });
  }

  // Cache de 60 segundos para não bater a função desnecessariamente
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  res.setHeader('Content-Type', 'application/json');

  return res.status(200).json({
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey,
  });
}
```

> **Importante:** se o projeto usa CommonJS no backend Railway mas o Vercel usa ESM, ajuste para `module.exports = function handler(req, res) { ... }`.

---

### Passo 2 — Corrigir o `js/supabase.js` para depender APENAS do `/api/env`

O `supabase.js` deve ter **uma única estratégia** de carregamento de env em produção. Remova a dependência de `js/env.js` como arquivo estático. O novo fluxo:

```js
// js/supabase.js
// Estratégia: sempre busca as variáveis via /api/env (funciona em produção e localhost).
// Em localhost, o Vercel CLI (ou o servidor Express do Railway) serve o mesmo endpoint.

let supabaseClient = null;

async function initSupabase() {
  if (supabaseClient) return supabaseClient;

  let SUPABASE_URL, SUPABASE_ANON_KEY;

  try {
    const response = await fetch('/api/env');
    if (!response.ok) throw new Error(`/api/env retornou ${response.status}`);
    const env = await response.json();
    SUPABASE_URL = env.SUPABASE_URL;
    SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
  } catch (err) {
    console.error('Supabase: falha ao carregar variáveis de ambiente via /api/env.', err);
    throw new Error('Não foi possível inicializar o Supabase. Verifique as variáveis de ambiente.');
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase: SUPABASE_URL ou SUPABASE_ANON_KEY ausentes na resposta de /api/env.');
  }

  // Usa o cliente CDN já importado no HTML, ou importa via ESM conforme o projeto
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

export { initSupabase };
```

> **Atenção:** adapte a inicialização do cliente Supabase ao padrão já usado no projeto (CDN global `window.supabase`, ou import ESM `@supabase/supabase-js`). Não mude a forma de import, apenas a lógica de carregamento das chaves.

---

### Passo 3 — Remover ou ignorar o `js/env.js` estático

**Opção A (recomendada):** deletar `js/env.js` do repositório e adicioná-lo ao `.gitignore`:
```
# .gitignore
js/env.js
```

**Opção B:** se o `js/env.js` for necessário para desenvolvimento local sem Vercel CLI, mantenha-o apenas localmente e certifique-se que nunca seja commitado. Adicione ao `.gitignore` mesmo assim.

Em nenhum caso `js/env.js` deve conter chaves reais commitadas no repositório.

---

### Passo 4 — Configurar as variáveis no Vercel Dashboard

No painel do Vercel (`vercel.com/dashboard > SaasCaldas-Brito2.0 > Settings > Environment Variables`), confirme que estas variáveis estão definidas para o ambiente **Production**:

| Nome | Valor |
|------|-------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGci...` (chave anon pública) |

**NÃO adicione** `SUPABASE_SERVICE_ROLE_KEY` como variável exposta via `/api/env`. Essa chave deve existir no Vercel apenas para funções serverless que precisam de acesso admin, nunca exposta ao frontend.

---

### Passo 5 — Verificar o `vercel.json`

Se o projeto tiver um `vercel.json`, verifique se ele tem configuração de rewrites que possa estar bloqueando a rota `/api/env`. O mínimo necessário:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

> Se o projeto serve um SPA com roteamento client-side, o rewrite de fallback para `index.html` é obrigatório. A rota `/api/(.*)` deve vir **antes** do fallback.

---

### Passo 6 — Garantir que o localhost também funcione via `/api/env`

Para que o localhost funcione sem depender de `js/env.js`, há duas opções:

**Opção A — Vercel CLI (recomendada):**  
Instalar e usar `vercel dev` em vez de um servidor customizado. O `vercel dev` lê o `.env.local` e serve as funções `/api/` automaticamente.

```bash
npm i -g vercel
vercel dev
```

Criar `.env.local` na raiz:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
```

**Opção B — Servidor Express existente:**  
Se o projeto já tem um `server.js` Express para desenvolvimento local, adicionar a rota:

```js
// server.js (apenas dev local)
app.get('/api/env', (req, res) => {
  res.json({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  });
});
```

E usar `dotenv` para carregar o `.env.local`:
```js
import 'dotenv/config'; // no topo do server.js
```

---

## Checklist de validação após as alterações

Após implementar, verifique:

- [ ] `api/env.js` existe na raiz do projeto
- [ ] `js/supabase.js` não faz mais referência a `js/env.js` como arquivo estático
- [ ] `js/env.js` está no `.gitignore` (ou foi removido)
- [ ] As variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY` estão configuradas no Vercel Dashboard em Production
- [ ] Nenhuma chave sensível (`SERVICE_ROLE_KEY`) está exposta via `/api/env`
- [ ] O `vercel.json` não bloqueia a rota `/api/env`
- [ ] Em produção (`www.caldasebritoadvocacia.com.br`), abrir o DevTools e verificar que `fetch('/api/env')` retorna 200 com o JSON correto
- [ ] O login funciona em produção sem erros no console

---

## Erros esperados e como tratar

| Erro no console | Causa | Ação |
|---|---|---|
| `404 /api/env` | Função serverless não deployada ou `vercel.json` com rewrite errado | Verifique se `api/env.js` existe na raiz e redeploy |
| `500 /api/env` | Variáveis não configuradas no Vercel Dashboard | Adicionar `SUPABASE_URL` e `SUPABASE_ANON_KEY` no painel do Vercel |
| `CORS error /api/env` | Rota bloqueada por header | Adicionar `res.setHeader('Access-Control-Allow-Origin', '*')` temporariamente para debug |
| `Supabase client undefined` | `window.supabase` não carregado antes do `initSupabase()` | Garantir que o script da CDN do Supabase carrega antes do `supabase.js` no HTML |

---

## Arquivos que a IA pode precisar criar ou modificar

| Arquivo | Ação |
|---|---|
| `api/env.js` | Criar (função serverless Vercel) |
| `js/supabase.js` | Modificar lógica de inicialização |
| `vercel.json` | Criar ou ajustar rewrites |
| `.gitignore` | Adicionar `js/env.js` |
| `.env.local` | Criar localmente (não commitar) |
| `server.js` (se existir) | Adicionar rota `/api/env` para dev local |

---

## Observações de arquitetura

- O `SERVICE_ROLE_KEY` **nunca** deve trafegar para o frontend. Caso o backend Railway precise dele, configure-o apenas nas variáveis do Railway, separado das variáveis do Vercel.
- O padrão adotado aqui (endpoint `/api/env` expondo apenas a ANON_KEY) é o padrão correto para projetos Supabase com frontend estático no Vercel.
- Se no futuro for necessário adicionar outras variáveis públicas (ex: URL do backend Railway), faça-o através do mesmo endpoint `/api/env`, nunca via arquivo estático versionado.