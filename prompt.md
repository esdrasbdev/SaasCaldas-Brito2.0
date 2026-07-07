# PROMPT — SaasCaldas-Brito2.0: Correções (Julho/2026)

Você é um desenvolvedor Full Stack Sênior trabalhando no repositório
`esdrasbdev/SaasCaldas-Brito2.0`. Stack: **Vanilla JS (ES Modules) no
frontend + Node/Express no backend + Supabase (Postgres + Auth) + Vercel
Blob, hospedado como função serverless única na Vercel**
(`api/index.js` → `backend/index.js`). Siga as convenções já existentes:
nomes de variáveis/comentários em português, sem frameworks front-end, sem
emojis, ícones Font Awesome 6 Free, RBAC com os papéis `ADMIN`,
`ADVOGADO`/`ADVOGADA`, `SECRETARIA`, `ESTAGIARIO`/`ESTAGIARIA`.

**Regras gerais: não remova funcionalidades existentes, preserve a
estrutura de arquivos atual e mantenha compatibilidade total com o banco
de dados atual (nenhuma migração é necessária para os itens abaixo).**

Este PROMPT já foi pré-diagnosticado a partir do código real do repositório
(branch principal, commit `d19ca56`). São 3 problemas, cada um com causa
raiz confirmada em código.

---

## 1. BUG — Botão "Ver Processo Ativo" não abre o processo correto

### Arquivo
`frontend/js/dashboard.js` (tabela "Últimos Processos" do dashboard,
função `carregarDashboard`).

### Causa raiz confirmada
```js
tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-ver-processo-ativo');
  if (!btn) return;
  const clienteId = btn.dataset.clienteId || '';
  const processoIdLinha = btn.dataset.processoId;
  ...
}, { once: true });   // <-- BUG 1
```
Existem **dois defeitos combinados**:

1. **`{ once: true }`**: o listener delegado no `<tbody>` é removido
   automaticamente depois do **primeiro clique em qualquer linha**. Ou
   seja: o botão funciona uma única vez por carregamento da página — no
   segundo clique (mesma linha ou outra linha), nada acontece, porque o
   listener já não existe mais.
2. **Lógica de redirecionamento ignora o processo da própria linha**: cada
   linha já carrega o `id` exato do processo exibido
   (`data-processo-id="${p.id}"`), mas o clique **não usa esse id
   diretamente** — em vez disso, dispara uma nova consulta ao Supabase
   filtrando `processos` por `cliente_id` e `status = 'ATIVO'`. Isso faz
   o botão te levar para **outro processo do mesmo cliente** (ou para a
   tela de lista filtrada, se houver mais de um processo ativo), em vez de
   abrir o processo que está de fato naquela linha — que é o "processo
   devido" que o usuário clicou para ver.

### Correção a implementar
Substituir o bloco do botão e do listener por:

```js
tbody.innerHTML = resRecentes.data.map(p => `
  <tr>
    <td>
      <strong>${p.clientes?.nome || 'Sem cliente'}</strong>
      <span class="text-muted">${p.numero_cnj || 'S/N'}</span>
    </td>
    <td><span class="status-badge status-${p.status?.toLowerCase() || 'ativo'}">${p.status || 'ATIVO'}</span></td>
    <td>${new Date(p.criado_em).toLocaleDateString('pt-BR')}</td>
    <td>
      <button class="btn-sm btn-ver-processo-ativo" data-processo-id="${p.id}">
        Ver Processo
      </button>
    </td>
  </tr>
`).join('');
```

E o handler de clique (delegado uma única vez, sem `{ once: true }`, e
navegando direto pelo id da linha clicada):

```js
// Delegação de clique — registrar UMA vez fora do fluxo de re-render,
// usando o próprio tbody como referência estável (innerHTML é
// substituído a cada carregamento, mas o elemento <tbody> não muda).
if (!tbody.dataset.listenerVerProcesso) {
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-ver-processo-ativo');
    if (!btn) return;

    const processoId = btn.dataset.processoId;
    if (!processoId) return;

    // Vai direto para o processo exibido naquela linha —
    // é sempre esse o processo "devido" que o usuário quer ver.
    window.location.href = `processo-detalhe.html?id=${processoId}`;
  });
  tbody.dataset.listenerVerProcesso = 'true';
}
```

Notas de implementação:
- Renomeei o rótulo do botão para **"Ver Processo"** (mantendo a classe
  `btn-ver-processo-ativo` para não quebrar nenhum outro seletor/estilo
  já existente), porque a linha pode exibir um processo que não está
  `ATIVO` (a query de recentes em `carregarDashboard` não filtra por
  status — ver linhas 55-58) e o texto "Ver Processo Ativo" ficava
  incorreto nesses casos. **Se preferir manter o texto original**, é só
  não alterar a string do botão — a correção de comportamento (itens 1 e
  2 acima) é o que resolve o bug relatado, o texto é só um ajuste de
  clareza opcional.
- Removi a consulta extra a `processos` por `cliente_id`/`ATIVO` porque
  ela não é mais necessária: o id do processo já está disponível na
  própria linha. Isso também deixa o clique instantâneo (sem round-trip
  ao Supabase) e elimina o `showToast(...)` sem `window.` (linha 151 do
  código atual) que podia lançar `ReferenceError` silenciosamente dentro
  do `catch`.
- O guard `if (!tbody.dataset.listenerVerProcesso)` evita registrar
  listeners duplicados caso `carregarDashboard()` seja chamada mais de
  uma vez na mesma sessão (ex.: alguma futura rotina de auto-refresh).
- Se em algum outro lugar do sistema (ex.: relatórios, alertas) o mesmo
  padrão de botão com `{ once: true }` tiver sido copiado, procure por
  `{ once: true }` em `frontend/js/*.js` e avalie caso a caso — nesse
  componente específico ele está incorreto.

---

## 2. UI — Deixar o sistema mais compacto

### Objetivo
Reduzir espaçamentos, paddings e tamanhos de fonte redundantes em
`frontend/css/style.css` e `frontend/css/sidebar.css`, sem remover nenhuma
classe, variável ou breakpoint responsivo existente — apenas ajustar
valores para uma densidade de informação maior (mais conteúdo visível por
tela, menos rolagem), mantendo a paleta e identidade visual (dourado
`#b49350` / azul `#0f172a`) intactas.

### Causa raiz / diagnóstico
O layout já usa variáveis de espaçamento consistentes
(`--espaco-xs/sm/md/lg/xl` em `style.css`, linhas 48-52), mas vários
componentes usam valores **fixos em rem/px acima do necessário**,
divorciados dessas variáveis, o que infla a altura das telas:

| Componente | Valor atual | Local |
|---|---|---|
| `.main-content` padding | `28px 32px` | style.css:167 |
| `h1` margin-bottom | `24px` | style.css:199 |
| `.page-header` margin-bottom | `2rem` | style.css:232 |
| `.welcome-banner` padding / margin-bottom | `2.5rem` / `2.5rem` | style.css:267,270 |
| `.welcome-banner #saudacao` font-size | `2rem` | style.css:304 |
| `.card-section` padding (desktop) | `var(--espaco-lg)` (24px) | style.css:584 |
| `.recent-table th/td` padding | herdado, sem compactação no desktop | style.css:631-651 |
| `.sidebar` width | `260px` | sidebar.css:4 |
| `.main-content` max-width | `calc(100% - 280px)` | style.css:169 (**20px de folga não usada**, pois a sidebar tem 260px) |

### Correção a implementar
Ajustar **apenas os valores abaixo**, mantendo seletores e nomes de
variáveis:

**`frontend/css/style.css`**
```css
:root {
  /* Espaçamentos consistentes — reduzidos para layout mais compacto */
  --espaco-xs: 4px;
  --espaco-sm: 6px;   /* era 8px */
  --espaco-md: 12px;  /* era 16px */
  --espaco-lg: 18px;  /* era 24px */
  --espaco-xl: 24px;  /* era 32px */
}
```
```css
.main-content {
  padding: 20px 24px;              /* era 28px 32px */
  max-width: calc(100% - 260px);   /* era 280px — alinhar com .sidebar (260px) */
}
```
```css
h1 { font-size: 24px; margin-bottom: 16px; }   /* era 28px / 24px */
h2 { font-size: 18px; margin-bottom: 12px; }   /* era 20px / 16px */
```
```css
.page-header {
  padding-bottom: 1rem;      /* era 1.25rem */
  margin-bottom: 1.25rem;    /* era 2rem */
}
```
```css
.welcome-banner {
  padding: 1.75rem;          /* era 2.5rem */
  margin-bottom: 1.5rem;     /* era 2.5rem */
  border-radius: 16px;       /* era 20px */
}
.welcome-banner h1, .welcome-banner #saudacao, #saudacao {
  font-size: 1.6rem;         /* era 2rem */
}
.welcome-banner p { font-size: 1rem; }   /* era 1.1rem */
```
```css
.card-section { padding: var(--espaco-md); }    /* var(--espaco-lg) → var(--espaco-md), já reduzida acima */
.card-section h2 { margin-bottom: var(--espaco-sm); padding-bottom: var(--espaco-sm); }
```
```css
.recent-table th, .recent-table td {
  padding: 10px 12px;   /* compactar também no desktop, não só no breakpoint mobile de 768px */
}
```

**`frontend/css/sidebar.css`**
```css
.sidebar-nav { padding: 8px 10px; }        /* era 10px 12px */
.sidebar-nav a, .sidebar-nav .sidebar-item { padding: 7px 10px; }  /* era 9px 12px — ajustar seletor real do link/item */
.sidebar-header { padding: 12px 20px; }    /* era 16px 20px */
.sidebar-footer { padding: 12px; }         /* era 16px */
```

### Cuidados ao aplicar
- **Não** alterar `--borda-arredondada`, cores, sombras ou breakpoints
  `@media` já existentes — o pedido é de densidade, não de redesenho.
- Depois de aplicar, revisar visualmente (ou via captura de tela) as
  telas de `index.html` (dashboard), `processos.html`, `clientes.html` e
  `agenda.html`, pois todas herdam `.main-content`, `.page-header` e
  `.card-section` do `style.css` global — a mudança é automática em todo
  o sistema, mas vale confirmar que nenhum conteúdo ficou espremido
  (especialmente KPIs com números grandes e a tabela de audiências).
- Os breakpoints mobile (`@media (max-width: 768px)`, a partir da linha
  ~1042 de `style.css`) já são compactos e **não precisam de alteração**;
  esta correção afeta principalmente a experiência desktop/tablet, que
  hoje tem espaçamento excessivo comparado ao mobile.

---

## 3. BUG CRÍTICO — Upload de documentos: `Falha no upload: pacote "busboy" indisponível no runtime`

### Estado atual (o que já foi corrigido antes e permanece válido)
Confirmado no código atual que **já existem** as mitigações da rodada de
diagnóstico anterior:
- `backend/package.json` lista `busboy: ^1.6.0`.
- `backend/package-lock.json` tem a entrada resolvida completa de
  `node_modules/busboy` (versão, `resolved`, `integrity`) — o lockfile
  **não** está desatualizado.
- `vercel.json` já usa
  `"installCommand": "rm -rf backend/node_modules && npm install --prefix backend"`.
- `backend/routes/documentos.js` já importa `busboy` no topo do arquivo
  com `try/catch` e responde 500 com mensagem amigável caso falhe.
- `backend/routes/documentos-debug.js` já expõe
  `GET /api/documentos/debug-blob` com `blob.busboy.moduleResolved`.
- Não há mais `package-lock.json` órfão na raiz nem `.tgz` commitado.

**Ou seja: a causa raiz de código já foi eliminada.** Se o erro
`"busboy" indisponível no runtime` ainda está acontecendo em produção
hoje, o problema **não está mais no repositório** — está em uma das
duas frentes abaixo, que precisam ser verificadas fora do código:

### 3.1 — Verificação obrigatória nas configurações do projeto na Vercel (fora do repositório)
Isso **não é editável via código**, mas é a causa mais provável de o
erro persistir mesmo com o `vercel.json` correto:
1. No painel da Vercel → **Project Settings → Build and Deployment →
   Install Command**: se houver um comando customizado **sobrescrito
   manualmente** aqui (toggle "Override" ativado), ele **tem prioridade
   sobre o `installCommand` do `vercel.json`** e pode estar rodando um
   `npm install` antigo/incompleto (ex.: na raiz do projeto, sem o
   `--prefix backend`). Desative o override para o `vercel.json` valer,
   ou copie exatamente o comando do `vercel.json` para esse campo.
2. **Project Settings → General → Root Directory**: confirme que está
   vazio/raiz do repositório (não "frontend" nem "backend"). Se estiver
   diferente da raiz, o `vercel.json` do repositório é ignorado.
3. Depois de corrigir 1 e 2, force um **redeploy sem cache** ("Redeploy"
   com a opção "Use existing Build Cache" **desmarcada**) para garantir
   que nenhum `node_modules` antigo seja reaproveitado.
4. Após o deploy, chamar `GET /api/documentos/debug-blob` e confirmar
   `blob.busboy.moduleResolved: true` antes de testar upload real.

### 3.2 — Correção de código: falhar de forma visível no build, não só em runtime
Hoje, se `busboy` não resolver, o sistema só avisa o usuário **quando ele
tenta subir um documento** (500 silencioso em produção, sem aparecer nos
logs de build). Para um bug de infraestrutura como este, é melhor **falhar
o build/deploy imediatamente** se uma dependência crítica não instalar,
em vez de descobrir isso só quando um cliente tenta anexar uma petição.

Adicionar um script de verificação pós-instalação:

**Criar `backend/scripts/verificar-dependencias-criticas.js`:**
```js
/*
 * Verificação de dependências críticas em tempo de build.
 * Falha o deploy imediatamente se um pacote essencial não resolver,
 * em vez de deixar o erro aparecer só quando um usuário tenta usar
 * a funcionalidade (ex.: upload de documentos) em produção.
 */
const criticos = ['busboy', '@vercel/blob'];
let falhou = false;

for (const pacote of criticos) {
  try {
    require.resolve(pacote);
    console.log(`[verificar-dependencias] OK: ${pacote}`);
  } catch (e) {
    falhou = true;
    console.error(`[verificar-dependencias] FALHA: ${pacote} não resolvido — ${e.message}`);
  }
}

if (falhou) {
  console.error('[verificar-dependencias] Build abortado: dependência crítica ausente.');
  process.exit(1);
}
```

**Em `backend/package.json`, adicionar o script `postinstall`:**
```json
"scripts": {
  "start": "node index.js",
  "dev": "node --watch index.js",
  "postinstall": "node scripts/verificar-dependencias-criticas.js"
}
```

Assim, se o problema de cache/instalação voltar a ocorrer, o **deploy
falha explicitamente nos logs da Vercel** com a mensagem
`FALHA: busboy não resolvido`, em vez de ir para produção silenciosamente
e só quebrar quando um usuário anexar um documento.

### 3.3 — Recomendação estrutural (opcional, eliminar a dependência do problema pela raiz)
A causa de fundo de toda essa instabilidade é fazer **parsing manual de
multipart/form-data dentro da função serverless** (via `busboy`) só para
depois repassar o arquivo ao Vercel Blob. O próprio Vercel Blob oferece
um fluxo de **upload direto do navegador para o Blob Storage**
(`@vercel/blob/client`, `handleUpload`), que:
- Elimina a necessidade de `busboy`/parsing multipart no backend por
  completo (o arquivo nunca passa pela função serverless).
- Remove o limite de payload da função serverless (hoje contornado com
  `express.json({ limit: '60mb' })`, que é uma solução frágil).
- É o padrão oficialmente recomendado pela Vercel para upload de
  arquivos com Blob.

Isso é uma refatoração maior (mudar `POST /api/documentos/blob-upload`
para gerar um token de upload assinado, e o frontend em
`frontend/js/*.js` responsável pelo formulário de documentos para usar
`upload()` do pacote `@vercel/blob/client` direto do navegador). **Não é
obrigatório para resolver o erro atual** (os itens 3.1 e 3.2 já resolvem),
mas é a recomendação de arquitetura mais robusta caso o problema volte a
se repetir no futuro. Implementar apenas se houver tempo/orçamento para
testar esse fluxo de ponta a ponta antes de ir para produção.

---

## Ordem de execução sugerida
1. Item 3.1 (verificação de configurações na Vercel) — **é o que
   provavelmente já resolve o upload**, sem precisar de mais nenhuma
   alteração de código.
2. Item 3.2 (script de verificação em build) — rede de segurança barata.
3. Item 1 (botão "Ver Processo Ativo") — bug de frontend, independente.
4. Item 2 (compactação de CSS) — ajuste visual, sem risco para dados ou
   lógica de negócio.
5. Item 3.3 — só se houver tempo, como melhoria futura.