# PROMPT.md — SaasCaldas-Brito 2.0: Correção de Bugs e Melhorias de UX/Responsividade

Repositório: `https://github.com/esdrasbdev/SaasCaldas-Brito2.0.git`

Este arquivo foi gerado a partir da análise direta do código-fonte do repositório (não são suposições). Cada tarefa abaixo indica o(s) arquivo(s) exatos, a causa raiz identificada e o resultado esperado. Execute as tarefas na ordem apresentada, pois a Tarefa 1 é um bug de produção (bloqueante) e as demais são independentes entre si.

Não usar bibliotecas novas. Manter o padrão de código já existente no projeto (comentários em pt-BR, nomenclatura de variáveis em português, sem emojis em código, CSS via variáveis já definidas em `:root` do `style.css`).

---

## TAREFA 1 — Corrigir erro "Erro ao carregar usuários: Unexpected token 'r', "require('d"... is not valid JSON"

### Causa raiz (confirmada por análise de código)

O `vercel.json` define:

```json
"rewrites": [
  { "source": "/api/(.*)", "destination": "/backend/index.js" },
  { "source": "/(.*)",     "destination": "/frontend/$1" }
]
```

O arquivo `backend/index.js` é um servidor Express tradicional (`require('dotenv').config(); ... module.exports = app;`) e **não está localizado dentro da pasta `/api`**. Na Vercel, apenas arquivos dentro de `/api` são automaticamente reconhecidos e compilados como Serverless Functions. Como não existe nenhum `vercel.json > functions` ou `builds` apontando `backend/index.js` para o runtime `@vercel/node`, a Vercel não o executa como função: ele é servido como arquivo estático.

Isso explica exatamente o erro relatado: ao acessar qualquer rota tipo `/api/usuarios`, `/api/clientes`, `/api/processos`, etc., a resposta recebida pelo frontend é o **conteúdo bruto (texto-fonte)** do arquivo `backend/index.js`, cuja primeira linha é literalmente:

```js
require('dotenv').config();
```

Quando `admin.js` (linha ~211, função `AdminController.carregar`) tenta fazer `await res.json()` nesse texto, o parser JSON falha em `require('d...`, gerando exatamente a mensagem de erro relatada.

Isso também explica por que `/api/env` funciona normalmente: `api/env.js` está dentro da pasta `/api`, então a Vercel o reconhece automaticamente como função, e o roteamento por sistema de arquivos tem prioridade sobre o rewrite — por isso só as rotas do Express (`/api/usuarios`, `/api/clientes`, `/api/processos`, `/api/audiencias`, `/api/pericias`, `/api/atendimentos`, `/api/documentos`, `/api/alertas`) são afetadas, nunca `/api/env`.

Em ambiente local (`localhost:3001`, backend rodando via `node backend/index.js`) o bug não ocorre, pois lá o Express real está no ar — por isso o problema só aparece em produção (Vercel).

### O que fazer

1. Criar o arquivo `api/index.js` (na raiz da pasta `/api`, mesmo nível de `api/env.js`) com o seguinte conteúdo:

   ```js
   // Serverless Function da Vercel — expõe o app Express do backend
   // como uma função reconhecida pelo sistema de arquivos da Vercel.
   // Não remover: sem este arquivo, /api/(.*) cai no rewrite abaixo
   // e a Vercel serve backend/index.js como texto estático (bug original).
   const app = require('../backend/index.js');

   module.exports = app;
   ```

2. Atualizar `vercel.json`, alterando apenas o `destination` do primeiro rewrite de `/backend/index.js` para `/api/index.js`:

   ```json
   {
     "version": 2,
     "name": "juridico-caldas-brito",
     "rewrites": [
       { "source": "/api/(.*)", "destination": "/api/index.js" },
       { "source": "/(.*)",     "destination": "/frontend/$1" }
     ],
     "crons": [
       { "path": "/api/publicacoes/sincronizar", "schedule": "0 3 * * *" },
       { "path": "/api/alertas/cron",            "schedule": "0 7 * * *" }
     ]
   }
   ```

3. **Não alterar** `backend/index.js`. Ele continua funcionando normalmente tanto localmente (`node backend/index.js`, graças ao bloco `if (require.main === module) { app.listen(...) }`) quanto quando importado via `require('../backend/index.js')` pela nova função serverless (nesse caso `require.main !== module`, então `app.listen` não é chamado — o handler da Vercel invoca o `app` do Express diretamente a cada requisição).

4. Confirmar que `backend/node_modules` permanece versionado/instalado (já está, ~30MB no repositório), pois a resolução de módulos do Node (`express`, `cors`, `dotenv`, `@supabase/supabase-js`, `resend`, `node-cron`) parte do diretório de `backend/index.js` e depende de `backend/node_modules` existir no bundle da função.

### Critério de aceite

- Em produção (Vercel), `GET /api/usuarios` deve retornar JSON válido (array de usuários ou objeto de erro JSON), nunca o código-fonte do arquivo.
- A tela Admin (`admin.html`) deve carregar a lista de usuários sem o toast de erro "Erro ao carregar usuários: Unexpected token...".
- Todas as demais rotas do backend (`/api/clientes`, `/api/processos`, `/api/audiencias`, `/api/pericias`, `/api/atendimentos`, `/api/documentos`, `/api/alertas`, `/api/env`) continuam respondendo normalmente, sem alteração de comportamento além da correção do roteamento.

---

## TAREFA 2 — Remover o botão "Limpar" dos campos de busca

### Localização exata

O botão existe, sem funcionalidade relevante além de zerar o campo de texto, nos seguintes arquivos:

- `frontend/pericias.html` — linha do botão `id="pericias-busca-limpar"`
- `frontend/audiencias.html` — linha do botão `id="audiencias-busca-limpar"`
- `frontend/agenda.html` — linha do botão `id="agenda-busca-limpar"`
- `frontend/atendimentos.html` — linha do botão `id="atendimentos-busca-limpar"`

Todos seguem o mesmo padrão de bloco HTML:

```html
<div class="card-section" style="margin-bottom: 16px;">
  <div style="display:flex; gap:12px; align-items:center;">
    <div style="flex: 1; position: relative;">
      <i class="fa-solid fa-magnifying-glass" style="..."></i>
      <input id="..." type="text" placeholder="..." autocomplete="off" style="padding-left: 40px;" />
    </div>
    <button id="..._busca-limpar" class="btn-secondary" type="button" style="white-space:nowrap;">Limpar</button>
  </div>
</div>
```

### O que fazer

1. Em cada um dos 4 arquivos HTML acima, remover a tag `<button id="..._busca-limpar" ...>Limpar</button>`, mantendo apenas o wrapper com o ícone de lupa e o `<input>` de busca.
2. Em `frontend/js/pericias.js`: remover o bloco `const btnLimpar = document.getElementById('pericias-busca-limpar');` e o listener `btnLimpar?.addEventListener('click', ...)` associado (dentro do `DOMContentLoaded`). Não remover a lógica de filtro por texto (`termoBuscaEl?.addEventListener('input', ...)`), que deve continuar funcionando normalmente.
3. Em `frontend/js/agenda.js` e `frontend/js/atendimentos.js`: confirmar que não há referência a `agenda-busca-limpar` / `atendimentos-busca-limpar` (não há, o botão já não estava conectado a nenhum evento nesses dois arquivos) — nenhuma alteração de JS necessária além da remoção do HTML.
4. Em `frontend/audiencias.html` / `frontend/js/audiencias.js`: o botão também não possui listener hoje; apenas remover o HTML (a lógica de busca desse módulo será implementada na Tarefa 4).

### Critério de aceite

- Nenhuma das 4 páginas (Perícias, Audiências, Agenda, Atendimentos) exibe mais o botão "Limpar" ao lado do campo de busca.
- O campo de busca de texto continua funcional em todas elas (digitar filtra a lista; apagar o texto manualmente volta a mostrar tudo).
- Nenhum erro no console por referência a elemento inexistente (`document.getElementById('...-busca-limpar')` retornando `null` e sendo usado com `?.`, então já é seguro, mas remova o código morto).

---

## TAREFA 3 — Perícias: filtro por tipo (Judicial / Administrativa)

### Contexto já existente no projeto

A tabela `pericias` (ver `sql/schema.sql`, linha ~70) já possui a coluna:

```sql
tipo text check (tipo in ('Administrativa', 'Judicial'))
```

O formulário de cadastro em `frontend/js/pericias.js` (função `ajustarCamposFormulario`) já grava esse campo corretamente. A busca textual atual (`pericias-busca`) já compara `p.tipo` como parte da string livre, mas **não existe um filtro dedicado** — o usuário só encontra por tipo se digitar literalmente "judicial" ou "administrativa" na busca.

### O que fazer

1. Em `frontend/pericias.html`, dentro do bloco `<!-- Busca -->` (após remover o botão "Limpar" na Tarefa 2), adicionar um `<select>` de filtro por tipo, seguindo o mesmo padrão visual já usado em `frontend/processos.html` (`#filtro-status`):

   ```html
   <div class="card-section" style="margin-bottom: 16px;">
     <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
       <div style="flex: 1; min-width: 220px; position: relative;">
         <i class="fa-solid fa-magnifying-glass" style="position:absolute; left: 12px; top: 11px; color: #94a3b8; pointer-events:none;"></i>
         <input id="pericias-busca" type="text" placeholder="Buscar perícias (cliente, tipo, local, perito, data)..." autocomplete="off" style="padding-left: 40px;" />
       </div>
       <select id="pericias-filtro-tipo" style="min-width:180px;">
         <option value="">Todos os tipos</option>
         <option value="Judicial">Judicial</option>
         <option value="Administrativa">Administrativa</option>
       </select>
     </div>
   </div>
   ```

   Observação: `flex-wrap:wrap` é necessário para que o select quebre para a linha abaixo em telas estreitas (ver Tarefa 6).

2. Em `frontend/js/pericias.js`, unificar a lógica de filtragem (hoje duplicada entre `carregarPericias()` e o listener de `input` em `DOMContentLoaded`) para considerar também o tipo selecionado:

   - Extraia a função `filtrar(p)` para um único lugar reutilizável (ex.: função nomeada `filtrarPericias(lista, termoBusca, tipoFiltro)`), evitando manter duas cópias divergentes da mesma lógica.
   - A condição de filtro passa a ser:

     ```js
     function filtrarPericias(lista, termoBusca, tipoFiltro) {
       return lista.filter((p) => {
         if (tipoFiltro && p.tipo !== tipoFiltro) return false;
         if (!termoBusca) return true;

         const cliente = (p.clientes?.nome || '').toLowerCase();
         const tipo = (p.tipo || '').toLowerCase();
         const local = (p.local || '').toLowerCase();
         const perito = (p.perito || '').toLowerCase();
         const dtTxt = p.data ? formatarData(p.data).toLowerCase() : '';

         return [cliente, tipo, local, perito, dtTxt].some((v) => v.includes(termoBusca));
       });
     }
     ```

   - No `DOMContentLoaded`, capture o novo select (`const filtroTipoEl = document.getElementById('pericias-filtro-tipo');`) e adicione um listener de `change` que reaplica o filtro (reutilizando a mesma função de renderização de tabela usada no listener de `input`, para não duplicar o template de linhas).
   - Tanto o listener de `input` do campo de busca quanto o de `change` do select de tipo devem, ao disparar, ler os valores atuais de **ambos** os controles (texto + tipo) e chamar `filtrarPericias`, para que os dois filtros funcionem combinados (ex.: buscar "Cedro" com tipo "Judicial" selecionado).

3. Não é necessário alterar o backend (`backend/routes/pericias.js`) nem o schema do banco — o filtro é aplicado no conjunto de dados já carregado (`window.__listaPericiasCompleta`), assim como a busca textual já funciona hoje.

### Critério de aceite

- A página de Perícias exibe um seletor "Todos os tipos / Judicial / Administrativa" ao lado do campo de busca.
- Selecionar "Judicial" mostra apenas perícias com `tipo === 'Judicial'`; selecionar "Administrativa" mostra apenas as demais; "Todos os tipos" volta a exibir tudo.
- O filtro por tipo funciona em conjunto com a busca textual já existente (ambos aplicados simultaneamente).
- Nenhuma duplicação de template HTML da tabela entre as duas funções de renderização (o ideal é que exista apenas uma função de renderização de linhas, chamada nos dois fluxos).

---

## TAREFA 4 — Audiências: filtro por tipo de audiência

### Contexto já existente no projeto

O formulário de audiência (`frontend/audiencias.html`) já possui o campo:

```html
<select id="audiencia-tipo">
  <option value="Conciliação">Conciliação</option>
  <option value="Instrução">Instrução</option>
  <option value="Una">Una</option>
  <option value="Julgamento">Julgamento</option>
</select>
```

E a tabela `audiencias` já possui a coluna `tipo text` (sem `check`, mas em uso pelos valores acima).

**Importante**: diferente de Perícias, o campo de busca `#audiencias-busca` já existe no HTML, mas **não há nenhuma lógica de filtragem implementada em `frontend/js/audiencias.js`** — nem por texto, nem por tipo. `AudienciaController.carregarDados()` apenas chama `AudienciaModel.listarTodas()` e renderiza a lista completa, ignorando o input de busca. Portanto esta tarefa precisa implementar a busca textual (que hoje é decorativa) **e** adicionar o filtro por tipo.

### O que fazer

1. Em `frontend/audiencias.html`, no bloco `<!-- Busca -->` (após remover o botão "Limpar" na Tarefa 2), adicionar o select de tipo com as mesmas opções já usadas no formulário de cadastro:

   ```html
   <div class="card-section" style="margin-bottom: 16px;">
     <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
       <div style="flex: 1; min-width: 220px; position: relative;">
         <i class="fa-solid fa-magnifying-glass" style="position:absolute; left: 12px; top: 11px; color: #94a3b8; pointer-events:none;"></i>
         <input id="audiencias-busca" type="text" placeholder="Buscar audiências (cliente, tipo, local, data)..." autocomplete="off" style="padding-left: 40px;" />
       </div>
       <select id="audiencias-filtro-tipo" style="min-width:180px;">
         <option value="">Todos os tipos</option>
         <option value="Conciliação">Conciliação</option>
         <option value="Instrução">Instrução</option>
         <option value="Una">Una</option>
         <option value="Julgamento">Julgamento</option>
       </select>
     </div>
   </div>
   ```

2. Em `frontend/js/audiencias.js`, implementar a filtragem que hoje não existe:

   - Após `AudienciaModel.listarTodas()` retornar os dados em `carregarDados()`, armazene a lista completa (padrão já usado em `pericias.js`): `window.__listaAudienciasCompleta = dados;`.
   - Crie uma função `filtrarAudiencias(lista, termoBusca, tipoFiltro)` análoga à de Perícias:

     ```js
     function filtrarAudiencias(lista, termoBusca, tipoFiltro) {
       return lista.filter((a) => {
         if (tipoFiltro && a.tipo !== tipoFiltro) return false;
         if (!termoBusca) return true;

         const cliente = (a.processos?.clientes?.nome || a.clientes?.nome || '').toLowerCase();
         const numeroCnj = (a.processos?.numero_cnj || '').toLowerCase();
         const tipo = (a.tipo || '').toLowerCase();
         const local = (a.local || '').toLowerCase();
         const dataObj = a.data ? new Date(a.data) : null;
         const dtTxt = dataObj ? formatarData(dataObj).toLowerCase() : '';

         return [cliente, numeroCnj, tipo, local, dtTxt].some((v) => v.includes(termoBusca));
       });
     }
     ```

   - No `AudienciaController.carregarDados()`, após obter `dados` e salvá-los em `window.__listaAudienciasCompleta`, aplique o filtro atual (lendo os valores correntes dos dois controles) antes de chamar `AudienciaView.renderizarTabela(...)`.
   - Em `bindEvents()`, adicione os listeners:

     ```js
     const buscaEl = document.getElementById('audiencias-busca');
     const filtroTipoEl = document.getElementById('audiencias-filtro-tipo');

     const aplicarFiltros = () => {
       const termo = (buscaEl?.value || '').trim().toLowerCase();
       const tipo = filtroTipoEl?.value || '';
       const base = window.__listaAudienciasCompleta || [];
       AudienciaView.renderizarTabela(filtrarAudiencias(base, termo, tipo));
     };

     buscaEl?.addEventListener('input', aplicarFiltros);
     filtroTipoEl?.addEventListener('change', aplicarFiltros);
     ```

3. Manter `AudienciaView.renderizarTabela` como única função de renderização (já é — apenas garanta que ela é reaproveitada pelos novos filtros, sem duplicar template).

### Critério de aceite

- O campo de busca de Audiências, que hoje não filtra nada, passa a filtrar por cliente, CNJ, tipo, local e data.
- O novo seletor "Todos os tipos / Conciliação / Instrução / Una / Julgamento" filtra a lista corretamente e funciona em conjunto com a busca textual.
- Trocar de página e voltar (ou recarregar dados após criar/editar/excluir uma audiência) não deve quebrar o filtro ativo — ao chamar `carregarDados()` novamente (ex.: após salvar), os filtros correntes nos dois controles devem continuar sendo respeitados na nova renderização.

---

## TAREFA 5 — Login: aumentar e refinar o logo/watermark

### Localização

- Marcação SVG do watermark: `frontend/login.html`, dentro de `<div class="login-watermark"><svg viewBox="0 0 600 600">...</svg></div>`.
- Estilo: `frontend/css/login-split.css`, seletor `.login-watermark` (linha ~93) e `.login-watermark svg` (linha ~103).

### Estado atual

```css
.login-watermark {
  position: absolute;
  top: 30px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  pointer-events: none;
  opacity: 1;
}
```

O SVG interno usa um círculo com `opacity:0.35`, um traço decorativo com `opacity:0.22` e dois textos ("CALDAS & BRITO" / "Advocacia") com opacidades muito baixas (`0.18` e `0.14`), o que faz o brasão ficar discreto e pequeno dentro do painel esquerdo do login (`.login-panel-left`, que tem `padding: 64px 56px`).

### O que fazer

1. Aumentar o tamanho do watermark de forma proporcional ao painel, sem cortar as bordas nem sobrepor o texto institucional (`.login-left-content`, ancorado no rodapé do painel). Sugestão de ajuste em `.login-watermark`:

   ```css
   .login-watermark {
     position: absolute;
     top: 50%;
     left: 50%;
     transform: translate(-50%, -50%);
     width: 780px;
     max-width: 92%;
     pointer-events: none;
     opacity: 1;
   }
   ```

   Ajuste os valores de `top`/`transform` conforme necessário para centralizar verticalmente o brasão na área livre do painel esquerdo (entre o topo e o início de `.login-left-content`), evitando colisão com a citação (`.login-quote`) e o rodapé institucional.

2. Tornar o SVG mais "estético", sem fugir da paleta dourada já definida (`#b49350` / `#d4af37` / `#f5edd8`) usada no restante do sistema:
   - Aumentar levemente as opacidades do círculo e do traço decorativo (ex.: círculo de `0.35` para algo entre `0.4` e `0.5`; traço de `0.22` para `0.28`–`0.32`), para que o brasão fique perceptível sem competir com o conteúdo em primeiro plano.
   - Adicionar um segundo círculo concêntrico mais fino (ex.: `r="260"`, `stroke-width="1.5"`, opacidade baixa) para dar sensação de brasão/selo, em vez de um único traço solto.
   - Ajustar o `font-size` dos textos "CALDAS & BRITO" e "Advocacia" proporcionalmente ao novo `viewBox`/tamanho (mantendo a hierarquia visual: título maior e mais peso, subtítulo menor).
   - Manter `stroke`/`fill` sempre referenciando o gradiente `url(#goldGrad)` já definido, para preservar consistência visual com o resto do design system.
3. Não alterar `.login-panel-left` nem `.login-brand-sash` — o objetivo é só o watermark.
4. Validar visualmente em pelo menos duas larguras de tela desktop (ex.: 1440px e 1024px, breakpoint em que `.login-panel-left` ainda está visível, já que abaixo de `920px` esse painel é ocultado por `@media (max-width: 920px) { .login-panel-left { display: none; } }` — isso não deve ser alterado, pois está fora do escopo desta tarefa).

### Critério de aceite

- O brasão/watermark do login ocupa visivelmente mais espaço no painel esquerdo, sem ultrapassar os limites do painel nem sobrepor a citação ou o rodapé institucional.
- O visual resultante mantém a paleta dourada e a legibilidade do texto em primeiro plano (citação e rodapé institucional continuam claramente legíveis sobre o watermark).
- Nenhuma mudança de comportamento fora do painel esquerdo do login.

---

## TAREFA 6 — Responsividade mobile em todo o site

### Contexto

O projeto já possui uma base de responsividade em `frontend/css/style.css` (breakpoints em `1200px`, `992px`, `768px`, `640px`, `480px`, `400px`) e em `frontend/css/sidebar.css` (menu hambúrguer e overlay em `768px`), além de `frontend/css/login-split.css` (breakpoints em `920px` e `400px`). Esta tarefa é sobre **fechar as lacunas** que ainda quebram em telas estreitas (a partir de ~375px de largura), e não sobre reescrever o que já funciona.

### Pontos confirmados que precisam de correção

1. **Barras de busca com filtro (Tarefas 3 e 4)**: os blocos adicionados usam `display:flex; flex-wrap:wrap;` inline — confirme que, abaixo de `480px`, o `<select>` de filtro (`pericias-filtro-tipo`, `audiencias-filtro-tipo`) ocupa `width: 100%` quando quebra de linha, em vez de ficar com largura mínima fixa (`min-width:180px`) que pode não caber. Adicione em `frontend/css/style.css`, dentro do bloco `@media (max-width: 480px)` já existente (linha ~1147):

   ```css
   @media (max-width: 480px) {
     .btn-close-modal { font-size: 1.75rem; padding: 0.75rem; }
     .section-title { font-size: 0.9rem; }

     /* Barras de busca com filtro (Perícias, Audiências, Agenda, Atendimentos) */
     .card-section > div[style*="display:flex"][style*="flex-wrap"] > select {
       width: 100%;
       min-width: 0;
     }
   }
   ```

   Alternativa preferível (mais alinhada ao padrão do projeto de não depender de seletores de atributo `style*=`): extraia o wrapper das barras de busca para uma classe reutilizável (ex.: `.busca-filtros-row`) em `pericias.html`, `audiencias.html`, `agenda.html` e `atendimentos.html`, substituindo o `style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;"` inline por `class="busca-filtros-row"`, e definir em `style.css`:

   ```css
   .busca-filtros-row {
     display: flex;
     gap: 12px;
     align-items: center;
     flex-wrap: wrap;
   }

   @media (max-width: 480px) {
     .busca-filtros-row > select,
     .busca-filtros-row > input {
       width: 100%;
     }
   }
   ```

   Se optar pela classe reutilizável, aplique-a também nos wrappers de busca de `agenda.html` e `atendimentos.html` (que hoje usam o mesmo padrão inline), para manter consistência.

2. **`frontend/processos.html` — `.filtros-section`**: não existe nenhuma regra CSS para a classe `.filtros-section` (confirmado: `grep` em `style.css` não retorna nenhuma ocorrência). O `<select id="filtro-status">` e o `<input id="busca-processos">` dependem do comportamento padrão do navegador para elementos `inline-block`, o que pode gerar quebra de layout ou estouro horizontal em telas estreitas. Adicionar em `frontend/css/style.css`:

   ```css
   .filtros-section {
     display: flex;
     gap: 12px;
     align-items: center;
     flex-wrap: wrap;
     margin-bottom: 16px;
   }

   .filtros-section #busca-processos {
     flex: 1;
     min-width: 200px;
   }

   @media (max-width: 480px) {
     .filtros-section #filtro-status,
     .filtros-section #busca-processos {
       width: 100%;
     }
   }
   ```

3. **Auditoria geral obrigatória**: apesar da base de responsividade já existir, faça uma verificação manual (redimensionando a janela do navegador ou usando o modo de dispositivo móvel do DevTools, em pelo menos 3 larguras: 375px, 414px e 768px) em **todas** as páginas do `frontend/`: `index.html`, `login.html`, `clientes.html`, `processos.html`, `processo-novo.html`, `processo-detalhe.html`, `audiencias.html`, `pericias.html`, `agenda.html`, `atendimentos.html`, `documentos.html`, `admin.html`. Para cada página, confirme especificamente:
   - Nenhum elemento causa scroll horizontal na página (`overflow-x` do `body`/`main-content` deve permanecer `hidden`, e nenhum filho deve ultrapassar `100%` de largura).
   - Tabelas dentro de `.table-responsive` permanecem roláveis horizontalmente sem quebrar o layout da página.
   - Todos os modais (`.modal-overlay` / `.modal-content`) abrem como "drawer" de baixo para cima em mobile (comportamento já definido em `style.css`, `@media (max-width: 768px)`) e todos os campos internos ficam utilizáveis (sem inputs cortados nas bordas).
   - Botões de ação em linha nas tabelas (`.btn-sm`) permanecem clicáveis com área de toque adequada (já ajustado em `@media (max-width: 640px)`, apenas confirmar que se aplica também às tabelas de Perícias e Audiências após as Tarefas 3 e 4).
   - O menu lateral (`sidebar.js` + `sidebar.css`) abre/fecha corretamente via botão hambúrguer em todas as páginas, sem sobrepor conteúdo de forma que impeça a leitura.
4. Caso alguma página apresente um problema específico não coberto pelas regras genéricas de `style.css` (por exemplo, grids fixos em `px` em vez de `fr`/`%`, ou `white-space: nowrap` forçando largura mínima em telas estreitas), corrija localmente nesse arquivo, seguindo o padrão de breakpoints já estabelecido (`768px` para tablet/mobile geral, `480px`/`400px` para telas muito pequenas), em vez de criar um sistema de breakpoints paralelo.

### Critério de aceite

- Em nenhuma página do sistema (autenticadas e login) há scroll horizontal indesejado em larguras de 375px, 414px e 768px.
- Os novos elementos das Tarefas 2, 3 e 4 (barras de busca sem botão "Limpar", com os selects de filtro) se comportam corretamente em mobile: em telas estreitas, campo de busca e select empilham verticalmente e ocupam 100% da largura disponível.
- `processos.html` (`.filtros-section`) exibe filtro e busca de forma organizada e sem quebra de layout em mobile.
- Nenhuma regressão visual nas larguras desktop já validadas (aplicar apenas dentro dos blocos `@media`, nunca fora deles).

---

## Resumo de arquivos afetados

| Arquivo | Tarefa(s) |
|---|---|
| `vercel.json` | 1 |
| `api/index.js` (novo) | 1 |
| `frontend/pericias.html` | 2, 3, 6 |
| `frontend/audiencias.html` | 2, 4, 6 |
| `frontend/agenda.html` | 2, 6 |
| `frontend/atendimentos.html` | 2, 6 |
| `frontend/js/pericias.js` | 2, 3 |
| `frontend/js/audiencias.js` | 4 |
| `frontend/login.html` | 5 |
| `frontend/css/login-split.css` | 5 |
| `frontend/css/style.css` | 3, 6 |
| `frontend/processos.html` | 6 (referência, sem alteração de HTML) |

## Fora de escopo (não alterar)

- Estrutura de autenticação (`backend/middleware/auth.js`, `frontend/js/auth.js`, `frontend/js/guard.js`).
- Schema do banco de dados (`sql/schema.sql`) — as colunas necessárias (`pericias.tipo`, `audiencias.tipo`) já existem.
- Qualquer lógica de e-mail/alertas (`backend/services/alertas-job.js`, `backend/routes/alertas*.js`).
- Comportamento do painel esquerdo do login em telas < 920px (permanece oculto, conforme já definido).