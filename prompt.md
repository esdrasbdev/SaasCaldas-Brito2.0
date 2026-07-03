# PROMPT.md — `@vercel/blob` não está disponível no runtime da Vercel (causa raiz do 500 no upload)

## Contexto

Analise integralmente antes de alterar.

**Repositório:**
https://github.com/esdrasbdev/SaasCaldas-Brito2.0.git

Este prompt resolve a causa raiz definitiva do erro 500 em `POST /api/documentos/blob-upload`, confirmada pelos logs da Vercel:

```
Execution Duration: 20ms
External APIs: No outgoing requests
```

Execução extremamente curta e nenhuma chamada externa feita = a function nunca chegou a chamar o Vercel Blob. Isso só acontece no seguinte trecho de `backend/routes/documentos.js`:

```js
if (!put) {
  return res.status(500).json({
    error: 'Serviço de armazenamento de arquivos indisponível no momento.'
  });
}
```

`put` está `null` porque, no topo do arquivo, o `require('@vercel/blob')` está falhando e caindo no `catch`:
```js
let del = null;
let put = null;
try {
  ({ del, put } = require('@vercel/blob'));
} catch (e) {
  console.error('[documentos] Pacote @vercel/blob não encontrado no runtime:', e?.message || e);
}
```

## Causa raiz confirmada

- `.gitignore` do projeto ignora `node_modules/` e `backend/node_modules/`.
- **Porém `backend/node_modules/` está parcialmente versionado no git** (milhares de arquivos, incluindo `@supabase/supabase-js` inteiro) — commitados **antes** dessa regra do `.gitignore` existir. O `.gitignore` só impede adicionar arquivos *novos* às próximas alterações; não remove o que já estava rastreado.
- `@vercel/blob` foi adicionado ao `backend/package.json` **depois** que o `.gitignore` já bloqueava `node_modules/`, então **nunca foi commitado** — ele existe apenas em `package.json`, não em `backend/node_modules/` versionado.
- Como a Vercel, nesse projeto (sem `package.json` na raiz, sem "Install Command" customizado configurado), está efetivamente publicando o `backend/node_modules/` que está no próprio repositório em vez de rodar um `npm install` limpo a partir do `package.json`, o `@vercel/blob` nunca chega ao ambiente de produção — daí o `require()` falhar e `put`/`del` ficarem `null` sempre.

## Objetivo

Garantir que `@vercel/blob` (e qualquer dependência futura declarada em `package.json`) seja de fato instalado e disponibilizado no ambiente de produção da Vercel, resolvendo o problema pela raiz — não só para `@vercel/blob`, mas para evitar que isso se repita com a próxima dependência nova que for adicionada ao projeto.

## Diagnóstico obrigatório antes de aplicar a correção

1. Confirmar, no painel do projeto na Vercel, em **Settings → General → Build & Development Settings**, qual é o **Install Command** configurado (padrão do framework detectado, ou customizado). Se não houver `package.json` na raiz do projeto, é bem provável que a Vercel não esteja rodando nenhum install automaticamente para as functions, e por isso o projeto depende do `node_modules` já commitado.
2. Confirmar isso rodando localmente `git log --follow -- backend/node_modules/@supabase` (ou qualquer subpasta de `backend/node_modules` rastreada) para ver a data do commit original que trouxe esses arquivos, comparando com a data em que `@vercel/blob` foi adicionado ao `package.json` — só para registrar o histórico, não é bloqueante para a correção.

## Implementação esperada (escolher a Opção A — mais robusta e alinhada com boas práticas; a B é um remendo rápido)

### Opção A (recomendada): parar de versionar `node_modules` e deixar a Vercel instalar de verdade

1. **Remover `backend/node_modules/` do controle de versão** (sem apagar do disco local, só do git):
   ```bash
   git rm -r --cached backend/node_modules
   git rm -r --cached frontend/node_modules 2>/dev/null || true
   git rm -r --cached node_modules 2>/dev/null || true
   ```
   O `.gitignore` já cobre esses caminhos, então depois desse `rm --cached` eles não vão mais aparecer como pendentes.

2. **Criar um `package.json` na raiz do projeto** (hoje não existe) para que a Vercel identifique corretamente onde estão as dependências do backend usado por `api/index.js`. Duas formas possíveis, usar a que exigir menos mudança estrutural:
   - **A1 (mais simples):** mover/duplicar as dependências de `backend/package.json` para um `package.json` na raiz (ou apontar via `workspaces`/instalação nas duas pastas), garantindo que a Vercel rode `npm install` na raiz do projeto antes do build das functions.
   - **A2:** configurar em `vercel.json` a opção `installCommand` explícita, por exemplo:
     ```json
     {
       "installCommand": "npm install --prefix backend"
     }
     ```
     Mantendo o restante do `vercel.json` (rewrites, crons) como já está.

3. **Confirmar que `backend/package-lock.json` está atualizado e commitado**, incluindo `@vercel/blob`:
   ```bash
   cd backend
   npm install
   ```
   Isso deve adicionar `@vercel/blob` ao lockfile (hoje ausente dele, apesar de estar em `package.json`). Commitar o `package-lock.json` atualizado.

4. Fazer um novo deploy e confirmar, pelos logs de build da Vercel, que o passo de instalação (`npm install` ou equivalente) realmente roda e instala `@vercel/blob`.

### Opção B (remendo rápido, só se não for possível mexer na configuração de build agora)

Commitar manualmente a pasta `backend/node_modules/@vercel/blob` (e suas dependências transitivas) no git, **forçando** com `git add -f`, já que o `.gitignore` bloqueia:
```bash
git add -f backend/node_modules/@vercel/blob
git commit -m "fix: adiciona @vercel/blob ao repositorio (dependencia ausente no deploy)"
```
Isso resolve o sintoma imediato, mas **não resolve o problema de fundo** (qualquer dependência nova adicionada no futuro vai sofrer do mesmo bug, silenciosamente, até alguém notar em produção). Usar a Opção B apenas como correção emergencial e planejar migrar para a Opção A depois.

## Não fazer

- Não remover `@supabase/supabase-js` nem qualquer outra dependência já commitada em `backend/node_modules` sem antes garantir (pela Opção A) que a Vercel vai instalar tudo corretamente a partir do `package.json` — remover sem essa garantia quebraria toda a aplicação, não só o upload.
- Não alterar a lógica de negócio de `documentos.js`, `clientes.js` ou qualquer outra rota — o problema é 100% de infraestrutura/build, não de código de aplicação.

## Método de validação (obrigatório)

1. Após o deploy, verificar nos **logs de build** da Vercel que a instalação de dependências rodou e incluiu `@vercel/blob` (procurar pelo nome do pacote no log de `npm install`).
2. Testar upload de um arquivo pequeno (ex.: 50KB) na ficha do cliente e confirmar que:
   - a resposta é `200`, não `500`;
   - nos logs da function, agora aparece pelo menos uma chamada em **External APIs** (a chamada real ao Vercel Blob), diferente do "No outgoing requests" atual;
   - o arquivo aparece na lista de "Documentos do Cliente" imediatamente.
3. Testar download e exclusão do documento recém-enviado.
4. Confirmar que nenhuma outra funcionalidade do sistema (login, clientes, processos, etc.) quebrou após a mudança na forma de instalar dependências.

## Critérios de aceitação

- `require('@vercel/blob')` resolve com sucesso em produção; `put` e `del` deixam de ser `null`.
- Upload de documento do cliente funciona de ponta a ponta (200, arquivo salvo no Blob, registro salvo no Supabase, aparece na lista).
- O processo de instalação de dependências da Vercel fica confiável para qualquer pacote novo adicionado no futuro (Opção A), evitando que esse tipo de bug se repita silenciosamente.
- Nenhuma regressão em nenhuma outra rota ou página do sistema.

---

# Checklist final

- [ ] Diagnóstico confirmado: `Install Command` da Vercel checado, ausência de `package.json` na raiz confirmada.
- [ ] `backend/node_modules` removido do controle de versão (`git rm -r --cached`) — Opção A.
- [ ] `package.json`/`installCommand` configurado para a Vercel instalar as dependências do backend corretamente — Opção A.
- [ ] `backend/package-lock.json` atualizado com `@vercel/blob` e commitado.
- [ ] Novo deploy feito e log de build confirmando instalação de `@vercel/blob`.
- [ ] Upload de documento testado end-to-end (200, arquivo no Blob, aparece na lista).
- [ ] Nenhuma outra funcionalidade do sistema quebrada após a mudança.