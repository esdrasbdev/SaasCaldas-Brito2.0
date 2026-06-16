# PROMPT — Correções de Bugs e Melhorias de UI/UX
## SaasCaldas-Brito 2.0

Repositório: https://github.com/esdrasbdev/SaasCaldas-Brito2.0.git

Este arquivo contém todas as correções a serem aplicadas pelo agente de IA no repositório. Cada tarefa é independente. Execute-as em ordem.

---

## CONTEXTO GERAL

O sistema é um SaaS jurídico em Vanilla JS ES Modules (frontend) + Node.js/Express (backend) + Supabase (PostgreSQL + Auth). O banco armazena datas como `timestamptz` em UTC.

**Convenções do projeto (não violar):**
- Sem emojis em código ou interfaces
- Ícones exclusivamente via Font Awesome 6 Free (`fa-solid`, `fa-regular`, `fa-brands`)
- Variáveis CSS em português (`--azul-escuro`, `--cinza-borda`, etc.)
- Classes CSS com nomes relacionados ao domínio jurídico
- Sem padrões genéricos de UI gerados por IA (sem cards coloridos aleatórios, sem gradientes desnecessários)
- Comentários em português explicando a intenção, não o que o código faz

---

## TAREFA 1 — Formato de data DD/MM/AAAA em todos os setores

**Problema:** Em alguns módulos a data exibida nas tabelas está em formato ISO ou inconsistente. O padrão correto é `DD/MM/AAAA` em toda a interface.

**Arquivos afetados:**
- `frontend/js/agenda.js`
- `frontend/js/atendimentos.js`
- `frontend/js/audiencias.js`
- `frontend/js/pericias.js`

**O que fazer:** Criar uma função utilitária em `frontend/js/utils.js` chamada `formatarData` e usá-la em todos os módulos:

```js
// Formata data para exibição no padrão brasileiro DD/MM/AAAA
// Recebe Date, string ISO ou string de data qualquer
export function formatarData(dateLike) {
  const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
  if (!d || isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' });
}
```

**Substituições a fazer:**

Em `agenda.js` (renderizarTabela):
```js
// ANTES:
new Date(evt.data).toLocaleDateString('pt-BR')

// DEPOIS:
formatarData(evt.data)
```

Em `atendimentos.js` (renderizar):
```js
// ANTES:
new Date(d.data).toLocaleDateString('pt-BR')

// DEPOIS:
formatarData(d.data)
```

Em `audiencias.js` (renderizarTabela):
```js
// ANTES:
dataObj.toLocaleDateString('pt-BR')

// DEPOIS:
formatarData(dataObj)
```

Em `pericias.js` (carregarPericias):
```js
// ANTES:
new Date(p.data).toLocaleString('pt-BR')

// DEPOIS:
`${formatarData(p.data)} ${formatarHora24h(p.data)}`
```

Adicionar o import de `formatarData` no topo de cada arquivo que precisar.

---

## TAREFA 2 — Hora em formato 24h em toda a interface (sem AM/PM)

**Problema:** O input `type="time"` do HTML já funciona em 24h por padrão nos navegadores. No entanto, a exibição nas tabelas e modais precisa garantir formato 24h sem AM/PM em todos os módulos.

**Solução:** A função `formatarHora24h` já existe em `frontend/js/utils.js`. Garantir que esteja sendo importada e usada em todos os módulos.

**Verificação e ajuste em cada arquivo:**

`audiencias.js` — já usa `Intl.DateTimeFormat` com `hour12: false` mas de forma inline. Refatorar para usar `formatarHora24h` do utils:

```js
// ANTES (linha inline no renderizarTabela):
const horaTxt = dataObj ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(dataObj) : '';

// DEPOIS:
import { showToast, formatarHora24h } from './utils.js';
// ...
const horaTxt = dataObj ? formatarHora24h(dataObj) : '';
```

`pericias.js` — adicionar exibição de hora separada da data:
```js
// ANTES:
new Date(p.data).toLocaleString('pt-BR')

// DEPOIS (usando as duas funções utilitárias):
`${formatarData(p.data)} às ${formatarHora24h(p.data)}`
```

`atendimentos.js` — garantir que ao exibir hora na tabela ou modal use `formatarHora24h`.

**Regra geral:** em nenhum lugar do sistema deve aparecer "AM" ou "PM". Qualquer chamada `toLocaleString` ou `toLocaleTimeString` sem `hour12: false` deve ser substituída.

---

## TAREFA 3 — Bug de +3 horas ao salvar/exibir horários

**Causa raiz:** O problema ocorre por confusão entre horário local (BRT = UTC-3) e UTC ao construir objetos `Date` com strings sem timezone explícito.

Quando o código faz:
```js
new Date(`${dataInput}T${horaInput}`).toISOString()
// Exemplo: new Date("2025-06-10T14:00").toISOString()
// → "2025-06-10T17:00:00.000Z"  ← salva 17h no banco (correto em UTC)
```

Mas ao ler de volta:
```js
const dt = new Date(data.data);           // lê "2025-06-10T17:00:00.000Z"
dt.toISOString().slice(11, 16)           // → "17:00" ← mostra 17h em vez de 14h
```

**A solução correta** é: ao SALVAR, usar `${data}T${hora}:00` como string de timezone local (sem conversão UTC). Ao LER, usar `.toLocaleTimeString` com timezone do Ceará ou a função `formatarHora24h` que já usa `Intl.DateTimeFormat` sem `toISOString`.

**Correção do SAVE — em `atendimentos.js`, `audiencias.js` e `pericias.js`:**

```js
// ANTES (causa o bug de +3h):
const dataIso = (dataInput && horaInput) ? new Date(`${dataInput}T${horaInput}`).toISOString() : null;

// DEPOIS (salva o horário local como UTC fake, evitando a conversão):
// Usa o sufixo -03:00 (BRT) para garantir que o banco receba o horário correto
const dataIso = (dataInput && horaInput)
  ? new Date(`${dataInput}T${horaInput}:00-03:00`).toISOString()
  : null;
```

**Correção do LOAD — em todos os módulos que fazem `dt.toISOString().slice(11, 16)`:**

```js
// ANTES (exibe hora em UTC, não em BRT):
document.getElementById('agenda-hora').value = dt.toISOString().slice(11, 16);

// DEPOIS (exibe hora no fuso de Fortaleza/BRT):
document.getElementById('agenda-hora').value = dt.toLocaleTimeString('pt-BR', {
  timeZone: 'America/Fortaleza',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});
```

Aplicar esta mesma correção no LOAD de `atendimentos.js` (linhas 291-292 e 337-338), `audiencias.js` (linhas de `audiencia-hora`) e `pericias.js` (linha de `pericia-hora`).

**Correção do SAVE em `agenda.js`** — usa `new Date(`${dados.data} ${dados.hora}`)` que também sofre o mesmo problema:
```js
// ANTES:
const dataFormatada = `${dados.data} ${dados.hora}`;
const dataObj = new Date(dataFormatada);
// ...
data: dataObj.toISOString(),

// DEPOIS:
const dataObj = new Date(`${dados.data}T${dados.hora}:00-03:00`);
// ...
data: dataObj.toISOString(),
```

---

## TAREFA 4 — Bug do "Assunto" em Atendimentos: divergência de exibição

**Causa raiz:** Atendimentos criados pelo módulo `agenda.js` (campo "Novo Agendamento") salvam o título dentro do campo `anotacoes` como JSON serializado:
```json
{"titulo":"Combinar os informes","extra":"iguatu","obs":null}
```

Mas o módulo `atendimentos.js` lê `d.titulo` diretamente como coluna separada. Como a tabela `atendimentos` no schema original NÃO tem coluna `titulo`, `canal` ou `duracao` (apenas `id, cliente_id, usuario_id, data, anotacoes`), dois cenários coexistem:

1. Registro criado por `atendimentos.js` → `titulo` salvo como coluna inexistente (sem efeito) e o valor aparece em `anotacoes` como texto puro
2. Registro criado por `agenda.js` → `anotacoes` é um JSON `{"titulo":...,"extra":...,"obs":...}`

**Correção em `atendimentos.js` — função `renderizar` e handler `handleClick`:**

Criar uma função auxiliar para extrair título de forma segura:
```js
// Extrai o título do atendimento de forma segura.
// Suporta dois formatos: campo direto ou JSON serializado dentro de anotacoes (criado pela agenda)
function extrairTitulo(d) {
  // Tenta usar o campo titulo diretamente (caso exista na tabela)
  if (d.titulo && !d.titulo.startsWith('{')) return d.titulo;

  // Tenta parsear anotacoes como JSON (registros criados pela agenda)
  if (d.anotacoes) {
    try {
      const parsed = JSON.parse(d.anotacoes);
      if (parsed && parsed.titulo) return parsed.titulo;
    } catch (e) {
      // anotacoes é texto puro — retorna diretamente
    }
  }

  return 'Sem assunto';
}

// Extrai anotações/obs de forma segura (sem vazar o JSON bruto)
function extrairAnotacoes(d) {
  if (d.anotacoes) {
    try {
      const parsed = JSON.parse(d.anotacoes);
      // Se é JSON da agenda, retorna obs ou extra como anotação
      if (parsed && typeof parsed === 'object') {
        return parsed.obs || parsed.extra || '-';
      }
    } catch (e) {
      return d.anotacoes; // texto puro
    }
  }
  return d.anotacoes || '-';
}
```

Substituir nos locais onde `d.titulo` e `d.anotacoes` são usados:
```js
// ANTES:
const titulo = d.titulo || 'Sem assunto';
const anot = d.anotacoes || '-';

// DEPOIS:
const titulo = extrairTitulo(d);
const anot = extrairAnotacoes(d);
```

---

## TAREFA 5 — Exibição de Atendimentos: diferença entre ADMIN e demais roles

**Problema:** Usuários com roles `ADVOGADO`, `ATENDENTE`, `SECRETARIA` veem uma tabela completamente diferente (sem colunas de ações, ou formatação quebrada) em relação ao que o ADMIN vê.

**Causa:** A lógica `canEdit` oculta a coluna de ações inteira quando o role não é ADMIN/ADVOGADO, mas o `<th>` correspondente ainda pode estar presente (ou ausente), quebrando o `colspan` da tabela.

**Correção em `atendimentos.js` — função `renderizar`:**

1. Garantir que a coluna de ações no `<thead>` seja renderizada condicionalmente da mesma forma que o `<td>` no corpo:

```js
renderizar(dados) {
  const role = AuthAPI.getRole();
  const canEdit = ['ADMIN', 'ADVOGADO', 'ADVOGADA'].includes(role);
  const canView = true; // Todos podem visualizar

  // ...

  this.container.innerHTML = `
    <div class="card-section">
      <div class="table-responsive">
        <table class="recent-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Canal</th>
              <th>Cliente</th>
              <th>Assunto</th>
              <th>Responsável</th>
              <th style="text-align:right">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
```

2. Na renderização das rows, sempre mostrar a coluna de ações, mas controlar o que aparece dentro dela por role:

```js
// TODOS veem a coluna de ações (evita colspan quebrado)
// A diferença está no conteúdo: ADMIN/ADVOGADO veem editar/excluir; demais veem só visualizar
`<td style="text-align: right;">
  <div style="display:flex; gap:8px; justify-content:flex-end; align-items:center;">
    <button class="btn-sm btn-view" data-id="${d.id}" title="Visualizar">
      <i class="fa-solid fa-eye"></i>
    </button>
    ${canEdit ? `
      <button class="btn-sm btn-edit" data-id="${d.id}" title="Editar">
        <i class="fa-solid fa-pen"></i>
      </button>
      <button class="btn-sm btn-delete" data-id="${d.id}" style="color: #ef4444;" title="Excluir">
        <i class="fa-solid fa-trash"></i>
      </button>
    ` : ''}
  </div>
</td>`
```

3. O botão "Registrar Atendimento" no topo deve ser ocultado para roles sem permissão de edição:

```js
// Em controller.init(), após carregar dados:
const btnNovo = document.getElementById('btn-novo-atendimento');
if (btnNovo && !canEdit) btnNovo.style.display = 'none';
```

---

## TAREFA 6 — Perícias em Audiências: exibição compacta

**Problema:** Na tabela de audiências (`audiencias.html`), a seção de perícias (se exibida) e as próprias linhas da tabela de audiências estão com espaçamento excessivo e não compactas.

**Correção em `audiencias.js` — função `renderizarTabela`:**

Ajustar o HTML das rows para layout mais denso:

```js
tbody.innerHTML = lista.map(a => {
  const dataObj = a.data ? new Date(a.data) : null;
  const dataTxt = dataObj ? formatarData(dataObj) : '-';
  const horaTxt = dataObj ? formatarHora24h(dataObj) : '';

  const clienteNome = a.processos?.clientes?.nome || a.clientes?.nome || '—';
  const numeroCnj   = a.processos?.numero_cnj || 'S/N';

  // Badge de tipo compacto
  const tipoBadge = a.tipo
    ? `<span class="status-badge" style="background:#e0f2fe; color:#0284c7; font-size:0.7rem; padding:2px 8px;">${a.tipo}</span>`
    : '';

  return `
    <tr>
      <td style="width:110px; white-space:nowrap;">
        <div style="font-weight:600; color:var(--azul-escuro); font-size:0.9rem;">${dataTxt}</div>
        <div style="font-size:0.8rem; color:var(--cinza-medio);">${horaTxt}</div>
      </td>
      <td>
        <div style="font-weight:600; font-size:0.9rem;">${clienteNome}</div>
        <div style="font-size:0.75rem; color:var(--cinza-medio);">CNJ: ${numeroCnj}</div>
      </td>
      <td>
        <div style="font-size:0.85rem;">${a.local || 'Virtual'}</div>
        ${tipoBadge}
      </td>
      <td style="text-align:right; width:90px;">
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
}).join('');
```

Adicionar imports necessários no topo de `audiencias.js`:
```js
import { showToast, formatarHora24h, formatarData } from './utils.js';
```

**Correção em `pericias.js` — exibição compacta:**

Refatorar a linha de cada perícia para ser mais densa e informativa:

```js
listaPericias.innerHTML = data.map(p => {
  const dataTxt = p.data ? formatarData(p.data) : '-';
  const horaTxt = p.data ? formatarHora24h(p.data) : '';

  const tipoCor = p.tipo === 'Judicial' ? 'background:#fef3c7; color:#92400e;' : 'background:#e0f2fe; color:#0284c7;';

  return `
    <tr>
      <td>
        <div style="font-weight:600; font-size:0.9rem;">${p.clientes?.nome || '-'}</div>
        <span class="status-badge" style="${tipoCor} font-size:0.7rem; padding:2px 8px;">${p.tipo || 'N/A'}</span>
      </td>
      <td style="white-space:nowrap;">
        <div style="font-size:0.9rem; font-weight:600;">${dataTxt}</div>
        <div style="font-size:0.8rem; color:var(--cinza-medio);">${horaTxt}</div>
        ${p.tipo === 'Judicial' && (p.tribunal || p.vara)
          ? `<div style="font-size:0.75rem; color:var(--cinza-medio); margin-top:2px;">${[p.tribunal, p.vara].filter(Boolean).join(' — ')}</div>`
          : ''
        }
      </td>
      <td style="font-size:0.85rem;">${p.local || '-'}</td>
      <td style="font-size:0.85rem;">${p.perito || 'Não informado'}</td>
      <td style="text-align:right; width:90px;">
        <div style="display:flex; gap:6px; justify-content:flex-end; align-items:center;">
          <button class="btn-sm btn-view" data-id="${p.id}" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
          <button class="btn-sm btn-edit" data-id="${p.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
          ${isAdmin ? `<button class="btn-sm btn-delete" data-id="${p.id}" title="Excluir" style="color:#ef4444;"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div>
      </td>
    </tr>
  `;
}).join('');
```

Adicionar o import no topo de `pericias.js`:
```js
import { showToast, formatarHora24h, formatarData } from './utils.js';
```

---

## TAREFA 7 — Melhorias gerais de UI/UX

### 7a. Reduzir padding das células da tabela em telas menores

Em `frontend/css/style.css`, adicionar regra para tabelas mais compactas:

```css
/* Tabelas compactas: reduz padding interno sem perder legibilidade */
.recent-table td {
  padding: 10px 14px; /* Era 14px 16px */
}

.recent-table th {
  padding: 10px 14px; /* Consistência com td */
}
```

### 7b. Melhorar visual do badge de tipo na tabela de perícias e audiências

```css
/* Badge de tipo de evento jurídico: compacto e alinhado */
.badge-tipo-judicial {
  background: #fef3c7;
  color: #92400e;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
  display: inline-block;
  white-space: nowrap;
}

.badge-tipo-administrativo {
  background: #e0f2fe;
  color: #0284c7;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
  display: inline-block;
  white-space: nowrap;
}
```

### 7c. Modal de formulário: consistência de grid em pericias.html e audiencias.html

Adicionar a classe `form-row` ao par data/hora em `pericias.html` e `audiencias.html` para garantir layout lado a lado consistente:

```html
<!-- Padrão correto para Data + Hora lado a lado -->
<div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px;">
  <div class="form-group">
    <label>Data *</label>
    <input type="date" id="pericia-data" required>
  </div>
  <div class="form-group">
    <label>Hora *</label>
    <input type="time" id="pericia-hora" required>
  </div>
</div>
```

### 7d. Empty state padronizado

Em todos os módulos com tabelas (audiencias, pericias, atendimentos, agenda), garantir que o empty state siga o mesmo padrão visual:

```js
// Padrão de empty state para todas as tabelas
function emptyStateHTML(colspanCount, mensagem) {
  return `
    <tr>
      <td colspan="${colspanCount}" style="padding:0;">
        <div style="min-height:180px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--cinza-medio); gap:10px;">
          <i class="fa-regular fa-folder-open" style="font-size:2rem; opacity:0.4;"></i>
          <span style="font-size:0.9rem;">${mensagem}</span>
        </div>
      </td>
    </tr>
  `;
}
```

Usar esta função em todos os `if (data.length === 0)` dos módulos.

---

## RESUMO DOS ARQUIVOS A MODIFICAR

| Arquivo | Tarefas |
|---|---|
| `frontend/js/utils.js` | Tarefa 1 — adicionar `formatarData` |
| `frontend/js/agenda.js` | Tarefas 1, 2, 3 — data/hora/timezone |
| `frontend/js/atendimentos.js` | Tarefas 1, 2, 3, 4, 5 — data, assunto, roles |
| `frontend/js/audiencias.js` | Tarefas 1, 2, 3, 6 — data, hora, layout compacto |
| `frontend/js/pericias.js` | Tarefas 1, 2, 3, 6 — data, hora, layout compacto |
| `frontend/css/style.css` | Tarefa 7a, 7b — padding tabelas, badges |
| `frontend/pericias.html` | Tarefa 7c — grid data/hora |
| `frontend/audiencias.html` | Tarefa 7c — grid data/hora |

---

## CHECKLIST DE VALIDAÇÃO APÓS APLICAR

- [ ] Data exibida como DD/MM/AAAA em agenda, atendimentos, audiências e perícias
- [ ] Hora exibida em formato 24h (ex: 14:30, não 2:30 PM) em todas as tabelas
- [ ] Salvar um atendimento às 14h e confirmar que é exibido como 14h (não 17h)
- [ ] Em atendimentos, registros criados pela agenda exibem o título corretamente (não o JSON bruto)
- [ ] Usuário ADVOGADO/ATENDENTE/SECRETARIA vê a tabela de atendimentos com a mesma estrutura do ADMIN (apenas sem botões editar/excluir)
- [ ] Tabela de audiências exibida de forma compacta
- [ ] Tabela de perícias exibida de forma compacta com hora separada da data
- [ ] Empty states com ícone padronizado em todos os módulos

