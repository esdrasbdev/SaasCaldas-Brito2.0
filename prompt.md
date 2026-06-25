# PROMPT-DOCUMENTOS-FIX

## Contexto

Sistema: SaasCaldas-Brito 2.0 (frontend Vanilla JS ES Modules + Supabase + Vercel)

## Problemas identificados

### Problema 1 — Erro 401 "Invalid API key" ao abrir a tela de Clientes

**Causa raiz:** O arquivo `frontend/js/env.js` contém a `SUPABASE_ANON_KEY` hardcoded como fallback. Em algum momento essa chave ficou dessincronizada da que está configurada nas variáveis de ambiente do Vercel. O Supabase recusa a chave do `env.js` com 401 ao tentar fazer refresh de token.

O arquivo `frontend/js/supabase.js` já busca as chaves corretas via `/api/env`, mas o `env.js` hardcoded é carregado via `<script>` nas páginas HTML **antes** do ES Module, e define `window._env`, que pode contaminar a inicialização se algum código ainda ler `window._env` diretamente.

**Solução:** Limpar o `env.js` hardcoded e garantir que `initSupabase()` seja sempre a única fonte de verdade.

### Problema 2 — Template `declaracao-residencia` não está implementado

O card "Declaração de Residência" aparece na UI (linha 416 de `clientes.js`), mas o objeto `templates` dentro de `abrirTemplateDocumento` não tem a chave `'declaracao-residencia'` implementada — cai no fallback de "Modelo não configurado".

### Problema 3 — Template `termo-renuncia` não existe

O usuário precisa de um "Termo de Renúncia". Esse documento não está nem no array `modelos` nem nos templates.

### Problema 4 — Campo `rg` não lido no `dadosCliente`

O HTML de `clientes.html` tem o campo `<input id="cliente-rg">` e os templates usam `d.rg`, mas dentro de `renderizarDocumentosJuridicos` o objeto `dadosCliente` nunca lê esse campo via `getVal('cliente-rg')`. Resultado: RG aparece vazio em todos os documentos gerados.

Além disso, o campo `rg` não existe na tabela `clientes` no Supabase. É necessário adicionar a coluna no banco E persistir/ler no cadastro.

---

## Arquivos a modificar

- `frontend/js/env.js`
- `frontend/js/clientes.js`
- `frontend/clientes.html` *(verificar se campo rg já existe; se não, adicionar)*
- Supabase SQL Editor *(adicionar coluna `rg` na tabela `clientes`)*

---

## Correções

### 1. `frontend/js/env.js` — Remover chave hardcoded

Substituir o conteúdo COMPLETO do arquivo por:

```js
// Variáveis de ambiente são carregadas via /api/env pelo supabase.js
// Este arquivo existe apenas para compatibilidade e não deve conter chaves hardcoded.
window._env = window._env || {};
```

**Motivo:** A chave hardcoded causa conflito e falha 401 quando fica desatualizada. O `supabase.js` já faz fetch em `/api/env` que lê as variáveis reais do Vercel.

---

### 2. Supabase SQL Editor — Adicionar coluna `rg` na tabela `clientes`

Rodar no SQL Editor do Supabase:

```sql
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS rg text;
```

---

### 3. `frontend/js/clientes.js` — Ler campo `rg` no `dadosCliente`

Localizar o bloco `dadosCliente` dentro de `renderizarDocumentosJuridicos` (por volta da linha 380):

```js
const dadosCliente = {
  nomeCompleto: getVal('cliente-nome'),
  cpf: getVal('cliente-documento'),
  // ... outros campos
  estadoCivil: getVal('cliente-estado-civil'),
```

Adicionar a linha do `rg` logo após `cpf`:

```js
const dadosCliente = {
  nomeCompleto: getVal('cliente-nome'),
  cpf: getVal('cliente-documento'),
  rg: getVal('cliente-rg'),          // << ADICIONAR ESTA LINHA
  estadoCivil: getVal('cliente-estado-civil'),
  profissao: getVal('cliente-profissao'),
  endereco: [getVal('cliente-endereco'), getVal('cliente-numero'), getVal('cliente-bairro')]
    .filter(Boolean)
    .join(', '),
  telefone: getVal('cliente-telefone'),
  email: getVal('cliente-email'),
  cidade: getVal('cliente-cidade'),
  estado: getVal('cliente-estado'),
  cep: getVal('cliente-cep')
};
```

---

### 4. `frontend/js/clientes.js` — Adicionar `termo-renuncia` ao array `modelos`

Localizar o array `modelos` (por volta da linha 396). Adicionar o item logo após `declaracao-hipossuficiencia`:

```js
{
  chave: 'declaracao-hipossuficiencia',
  icone: 'fa-solid fa-scale-unbalanced',
  titulo: 'Declaração de Hipossuficiência',
  desc: 'Declaração para fins de gratuidade de justiça.'
},
// << ADICIONAR A PARTIR DAQUI
{
  chave: 'termo-renuncia',
  icone: 'fa-solid fa-file-circle-xmark',
  titulo: 'Termo de Renúncia',
  desc: 'Renúncia formal de direito ou benefício pelo cliente.'
},
// << ATÉ AQUI
{
  chave: 'declaracao-residencia',
  icone: 'fa-solid fa-house',
  titulo: 'Declaração de Residência',
  desc: 'Comprovante de endereço do cliente.'
},
```

---

### 5. `frontend/js/clientes.js` — Implementar templates `declaracao-residencia` e `termo-renuncia`

Localizar o objeto `templates` dentro da função `abrirTemplateDocumento`. Após o bloco `'peticao-inicial': { ... }` e antes do fechamento `};` do objeto `templates`, adicionar os dois templates:

```js
      'declaracao-residencia': {
        titulo: 'DECLARAÇÃO DE RESIDÊNCIA',
        conteudo: (d) => `
          <h2 style="text-align:center; margin: 0 0 18px 0;">DECLARAÇÃO DE RESIDÊNCIA</h2>

          <p style="font-size: 0.95rem; line-height:1.6;">
            Eu, <strong>${escapeHtml(d.nomeCompleto)}</strong>, CPF <strong>${escapeHtml(d.cpf)}</strong>${d.rg ? `, RG <strong>${escapeHtml(d.rg)}</strong>` : ''},
            estado civil <strong>${escapeHtml(d.estadoCivil)}</strong>, profissão <strong>${escapeHtml(d.profissao)}</strong>,
            declaro, para os devidos fins de direito e sob as penas da lei, que sou residente e domiciliado(a)
            no seguinte endereço:
          </p>

          <p style="font-size: 0.95rem; line-height:1.6; background: #f8fafc; border-left: 3px solid #2563eb; padding: 10px 14px; border-radius: 4px;">
            <strong>${escapeHtml(d.endereco)}</strong>${d.cep ? ` — CEP <strong>${escapeHtml(d.cep)}</strong>` : ''}<br>
            Cidade: <strong>${escapeHtml(d.cidade)}</strong> / Estado: <strong>${escapeHtml(d.estado)}</strong>
          </p>

          <p style="font-size: 0.95rem; line-height:1.6;">
            Declaro ainda que as informações acima são verdadeiras e assumo total responsabilidade pela veracidade dos dados prestados.
          </p>

          <p style="font-size: 0.95rem; line-height:1.6;">
            Local: <strong>${escapeHtml(d.cidade)} / ${escapeHtml(d.estado)}</strong>.
            Data: _____/_____/_____.
          </p>

          <br>
          <p style="font-size: 0.95rem; line-height: 2.5; text-align: center;">
            _____________________________________________<br>
            <strong>${escapeHtml(d.nomeCompleto)}</strong><br>
            CPF: ${escapeHtml(d.cpf)}
          </p>

          <p style="font-size:0.85rem; color:#555; margin-top: 30px;">
            (Modelo gerado automaticamente com base nos dados cadastrados.)
          </p>
        `
      },

      'termo-renuncia': {
        titulo: 'TERMO DE RENÚNCIA',
        conteudo: (d) => `
          <h2 style="text-align:center; margin: 0 0 18px 0;">TERMO DE RENÚNCIA</h2>

          <p style="font-size: 0.95rem; line-height:1.6;">
            Eu, <strong>${escapeHtml(d.nomeCompleto)}</strong>, CPF <strong>${escapeHtml(d.cpf)}</strong>${d.rg ? `, RG <strong>${escapeHtml(d.rg)}</strong>` : ''},
            estado civil <strong>${escapeHtml(d.estadoCivil)}</strong>, profissão <strong>${escapeHtml(d.profissao)}</strong>,
            residente e domiciliado(a) em <strong>${escapeHtml(d.endereco)}</strong>${d.cep ? `, CEP <strong>${escapeHtml(d.cep)}</strong>` : ''},
            cidade de <strong>${escapeHtml(d.cidade)}</strong> / <strong>${escapeHtml(d.estado)}</strong>,
            telefone <strong>${escapeHtml(d.telefone)}</strong>, e-mail <strong>${escapeHtml(d.email)}</strong>,
          </p>

          <p style="font-size: 0.95rem; line-height:1.6;">
            DECLARO, de forma livre, voluntária e consciente, que renuncio ao direito/benefício de:
          </p>

          <p style="font-size: 0.95rem; line-height:1.6; background: #f8fafc; border-left: 3px solid #2563eb; padding: 10px 14px; border-radius: 4px;">
            ___________________________________________________________<br>
            (descrever o direito ou benefício objeto da renúncia)
          </p>

          <p style="font-size: 0.95rem; line-height:1.6; margin-top: 12px;">
            Declaro estar ciente de que esta renúncia é irrevogável para os fins a que se destina, salvo disposição legal em contrário, e que fui devidamente orientado(a) pelo escritório de advocacia quanto aos efeitos jurídicos desta decisão.
          </p>

          <p style="font-size: 0.95rem; line-height:1.6;">
            Local: <strong>${escapeHtml(d.cidade)} / ${escapeHtml(d.estado)}</strong>.
            Data: _____/_____/_____.
          </p>

          <br>
          <div style="display:flex; justify-content:space-between; margin-top: 40px;">
            <div style="text-align:center; width: 45%;">
              <div style="border-top: 1px solid #111; padding-top: 6px;">
                <strong>${escapeHtml(d.nomeCompleto)}</strong><br>
                <span style="font-size:0.85rem;">CPF: ${escapeHtml(d.cpf)}</span><br>
                <span style="font-size:0.85rem;">Renunciante</span>
              </div>
            </div>
            <div style="text-align:center; width: 45%;">
              <div style="border-top: 1px solid #111; padding-top: 6px;">
                <strong>Advogado(a) Responsável</strong><br>
                <span style="font-size:0.85rem;">OAB: _______________</span><br>
                <span style="font-size:0.85rem;">Testemunha</span>
              </div>
            </div>
          </div>

          <p style="font-size:0.85rem; color:#555; margin-top: 30px;">
            (Modelo gerado automaticamente com base nos dados cadastrados.)
          </p>
        `
      },
```

---

### 6. `frontend/js/clientes.js` — Persistir e carregar campo `rg` no cadastro

#### 6a. No método `salvarCliente`, adicionar `rg` ao payload:

Localizar o objeto `payload` (por volta da linha 971). Adicionar `rg` logo após `inss_senha`:

```js
const payload = {
  nome: getVal('cliente-nome'),
  tipo: document.getElementById('cliente-tipo').value,
  documento: getVal('cliente-documento'),
  email: getVal('cliente-email'),
  telefone: getVal('cliente-telefone'),
  inss_senha: getVal('cliente-inss-senha'),
  rg: getVal('cliente-rg'),     // << ADICIONAR ESTA LINHA

  // Endereço
  cep: getVal('cliente-cep'),
  // ... restante igual
```

#### 6b. No método `abrirModal`, carregar `rg` do objeto cliente:

Localizar o bloco `if (cliente) {` onde os campos do form são populados (por volta da linha 245). Adicionar após a linha que carrega `documento`:

```js
document.getElementById('cliente-documento').value = cliente.documento || '';
document.getElementById('cliente-rg').value = cliente.rg || '';  // << ADICIONAR ESTA LINHA
```

---

## Checklist de validação

- [ ] `frontend/js/env.js` não contém mais chaves hardcoded
- [ ] Coluna `rg` adicionada na tabela `clientes` no Supabase (SQL rodado)
- [ ] Botão "Gerar", "Visualizar" e "Baixar PDF" de **Declaração de Hipossuficiência** abre a janela com os dados do cliente preenchidos (incluindo RG)
- [ ] Botão dos mesmos tipos para **Declaração de Residência** exibe o endereço completo no bloco destacado
- [ ] Botão **Termo de Renúncia** aparece nos cards e gera o documento com dois campos de assinatura
- [ ] O erro 401 `Invalid API key` parou de aparecer no console ao carregar `clientes.html`
- [ ] Campo RG no formulário é salvo ao criar/editar cliente e recarregado ao abrir o modal