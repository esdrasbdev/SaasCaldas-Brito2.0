# PROMPT.md — Deixar a Central de "Documentos do Cliente" 100% funcional (upload retornando 500)

## Contexto

Analise integralmente os arquivos envolvidos antes de alterar.

**Repositório:**
https://github.com/esdrasbdev/SaasCaldas-Brito2.0.git

**Stack:** Vanilla JS ES Modules (frontend) + Node.js/Express (backend) + Supabase + Vercel Blob, tudo servido pela mesma Vercel Function (`api/index.js` expõe `backend/index.js`).

**Arquivos envolvidos:**
- `backend/index.js` (configuração global do Express)
- `backend/routes/documentos.js` (rotas de documentos)
- `frontend/js/clientes.js` (seção "Documentos do Cliente" dentro da ficha do cliente)

O objetivo desta rodada é **eliminar de vez o erro 500 no upload** e deixar todo o fluxo (upload, listagem, download, exclusão) robusto e com feedback de erro real para o usuário — não só "parece que funciona quando o arquivo é pequeno".

---

# PROBLEMA — Upload de documento do cliente retorna 500, sem mensagem útil no Network

## Causa raiz confirmada no código

O arquivo é enviado como **base64 dentro de um JSON** (`frontend/js/clientes.js`, listener de `#upload-doc-cliente`, por volta da linha 1281-1317):

```js
body: JSON.stringify({
  nome: file.name,
  tipo: file.type,
  base64: reader.result,
  cliente_id: clienteId
})
```

Só que existe um **descompasso de limites**:

- `backend/index.js` (linha ~27): `app.use(express.json({ limit: '10mb' }));`
- `backend/routes/documentos.js`, rota `/blob-upload`: valida `maximumSizeInBytes = 15 * 1024 * 1024` (15MB) **depois** que o body já foi parseado.

Base64 aumenta o tamanho do arquivo em ~33%. Um arquivo de ~7-8MB já vira um body JSON maior que 10MB — o `body-parser` do Express rejeita a requisição **antes** dela chegar na rota (`PayloadTooLargeError`), então a validação de 15MB dentro de `documentos.js` nunca chega a rodar para arquivos grandes.

Esse erro cai no middleware global de erro (`backend/index.js`, linha ~104-110):
```js
app.use((err, req, res, next) => {
  console.error('❌ Erro Crítico:', err.stack);
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});
```
Ele **sempre** responde com `500` e omite a `message` em produção — por isso o Network mostra só `500`, sem nenhuma pista do motivo real (era na verdade um `413 Payload Too Large`).

Além disso, no frontend, o listener de upload só trata o caminho de sucesso:
```js
if (res.ok) {
  showToast('Arquivo anexado!', 'success');
  ClienteController.atualizarSessaoDocumentos(clienteId);
}
```
Quando `res.ok` é `false` (qualquer erro do backend, incluindo o 500 atual), **nada acontece na tela** — nenhum toast de erro, nenhuma indicação para o usuário do que deu errado. O `catch` só pega erros de rede (ex.: sem internet), não respostas HTTP de erro.

## Objetivo

1. Alinhar os limites de tamanho em toda a cadeia (frontend → Express → validação da rota) para que arquivos até o teto anunciado (15MB) funcionem de ponta a ponta.
2. Fazer o middleware global de erro devolver status e mensagens corretas (sem quebrar segurança em produção).
3. Fazer o frontend mostrar um erro real e útil quando o upload falhar, em vez de falhar silenciosamente.
4. Validar que o `@vercel/blob` (`put`) está de fato disponível em runtime e que `BLOB_READ_WRITE_TOKEN` está acessível — já confirmado conectado no projeto Vercel, mas o código deve falhar com mensagem clara caso algo mude no futuro, em vez de um 500 genérico.

---

## Implementação esperada

### 1) `backend/index.js` — aumentar o limite do body para acomodar o base64

Trocar:
```js
app.use(express.json({ limit: '10mb' })); // 10mb para documentos
```
Por um limite que comporte 15MB reais em base64 (15MB × 1.37 ≈ 20.5MB) com folga para o overhead do JSON:
```js
app.use(express.json({ limit: '22mb' })); // 22mb: comporta arquivo de até 15MB em base64 (~+33%) + overhead do JSON
```

Manter `maximumSizeInBytes = 15 * 1024 * 1024` em `documentos.js` como está — ele continua sendo o teto "de negócio" (mensagem amigável ao usuário), enquanto o limite do Express passa a ser só a rede de segurança técnica, sempre maior que o teto de negócio.

### 2) `backend/index.js` — corrigir o middleware global de erro para não mascarar tudo como 500

Trocar:
```js
app.use((err, req, res, next) => {
  console.error('❌ Erro Crítico:', err.stack);
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});
```
Por uma versão que preserva o status real de erros conhecidos (como `PayloadTooLargeError`, que já vem com `err.status`/`err.statusCode` = 413) e devolve uma mensagem amigável mesmo em produção para esse caso específico, sem vazar stack trace:

```js
app.use((err, req, res, next) => {
  console.error('❌ Erro Crítico:', err.stack);

  const status = err.status || err.statusCode || 500;

  if (status === 413 || err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Arquivo excede o tamanho máximo permitido pelo servidor.' });
  }

  res.status(status).json({
    error: status === 500 ? 'Erro interno do servidor' : (err.message || 'Erro na requisição'),
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});
```

Ajustar a mensagem/formato acima se necessário para manter consistência com o padrão de resposta de erro já usado no resto do projeto — o importante é: **não devolver 500 para erros que não são 500**, e **sempre incluir uma mensagem utilizável pelo frontend**, mesmo em produção, quando não houver risco de segurança nisso (como é o caso de "arquivo muito grande").

### 3) `backend/routes/documentos.js` — carregar `put` junto com `del`, com mensagem clara se o módulo faltar

Hoje `del` é importado com fallback seguro no topo do arquivo, mas `put` é importado com `require('@vercel/blob')` **dentro** do handler da rota `/blob-upload`, a cada requisição. Unificar os dois no mesmo bloco do topo:

```js
// IMPORT Opcional para evitar falha do deployment caso o pacote não exista no runtime.
let del = null;
let put = null;
try {
  ({ del, put } = require('@vercel/blob'));
} catch (e) {
  console.error('[documentos] Pacote @vercel/blob não encontrado no runtime:', e.message);
}
```

E na rota `/blob-upload`, antes de tentar usar `put`, validar explicitamente:
```js
if (!put) {
  return res.status(500).json({ error: 'Serviço de armazenamento de arquivos indisponível no momento.' });
}
```
Isso evita depender de `require()` repetido a cada upload e dá uma mensagem clara caso o pacote não esteja disponível, em vez de um erro genérico de "Cannot find module".

### 4) `frontend/js/clientes.js` — tratar erro real no upload (não falhar silenciosamente)

No listener de `#upload-doc-cliente` (linha ~1281-1317), tratar explicitamente o caso `!res.ok`, lendo a mensagem de erro devolvida pelo backend e mostrando via `showToast`:

```js
const res = await fetch(`${getApiUrl()}/documentos/blob-upload`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    nome: file.name,
    tipo: file.type,
    base64: reader.result,
    cliente_id: clienteId
  })
});

const data = await res.json().catch(() => ({}));

if (res.ok) {
  showToast('Arquivo anexado!', 'success');
  ClienteController.atualizarSessaoDocumentos(clienteId);
} else {
  showToast(data.error || 'Erro ao enviar arquivo.', 'error');
}
```

Também resetar o valor do input após o upload (sucesso ou falha), para permitir selecionar o mesmo arquivo de novo em uma nova tentativa:
```js
e.target.value = '';
```

### 5) `frontend/js/clientes.js` — validação de tamanho no cliente (evitar upload fadado a falhar)

Antes de iniciar o `FileReader`, validar o tamanho do arquivo contra o mesmo teto de negócio usado no backend (15MB), mostrando erro imediato sem gastar tempo/dados do usuário:

```js
const MAX_TAMANHO_DOCUMENTO = 15 * 1024 * 1024; // 15MB — deve bater com maximumSizeInBytes em documentos.js

if (file.size > MAX_TAMANHO_DOCUMENTO) {
  showToast('Arquivo excede o tamanho máximo permitido (15MB).', 'error');
  e.target.value = '';
  return;
}
```

Inserir essa checagem logo após `if (!file || !clienteId) return;`, antes de criar o `FileReader`.

## Não fazer

- Não alterar a lógica de negócio de RBAC, autenticação ou nomes de tabelas/colunas.
- Não alterar o fluxo de `/upload` (fallback Supabase Storage) nem `DELETE /:id`, exceto se algum ajuste de limite de body também os afetar — nesse caso, só ajustar o necessário para manter consistência.
- Não reduzir o teto de negócio de 15MB sem confirmar com o usuário — apenas alinhar os limites técnicos para que os 15MB anunciados realmente funcionem.

## Método de validação (obrigatório)

1. Confirmar `BLOB_READ_WRITE_TOKEN` presente no projeto Vercel (Settings → Environment Variables) e o Blob Store conectado (Storage → Connect) — já reportado como conectado, apenas reconfirmar após o deploy.
2. Testar upload de:
   - um arquivo pequeno (ex.: 50KB) — deve funcionar como já funcionava;
   - um arquivo médio (ex.: 5-8MB, o cenário que hoje quebra) — deve funcionar após a correção;
   - um arquivo no limite (perto de 15MB) — deve funcionar;
   - um arquivo acima de 15MB — deve ser bloqueado **no frontend**, com toast de erro claro, sem sequer chamar a API.
3. Testar upload de cada tipo permitido (`pdf`, `jpeg`, `png`, `gif`, `doc`, `docx`, `xls`, `xlsx`, `txt`) e um tipo não permitido (deve dar erro 400 com mensagem clara).
4. Forçar um erro proposital (ex.: comentar temporariamente o `put` para simular módulo ausente) e confirmar que a resposta é uma mensagem clara (não um 500 mudo) — depois reverter.
5. Confirmar que a lista de documentos do cliente atualiza imediatamente após um upload com sucesso, sem precisar recarregar a página.
6. Confirmar que download e exclusão continuam funcionando normalmente após todas as mudanças.

## Critérios de aceitação

- Upload de arquivos até 15MB funciona de ponta a ponta, sem 500.
- Arquivos acima de 15MB são bloqueados no frontend antes mesmo de tentar o upload, com mensagem clara.
- Qualquer erro de upload (tipo inválido, arquivo grande, falha no Blob, etc.) aparece como toast de erro legível para o usuário — nunca falha silenciosamente.
- O middleware global de erro não devolve mais `500` para erros que na verdade são `413`/`400`/outros.
- Nenhuma regressão em `GET /api/documentos`, `POST /api/documentos/upload` (fallback), `DELETE /api/documentos/:id`, ou em qualquer outra rota do backend.

---

# Checklist final

- [ ] `backend/index.js`: limite do `express.json` aumentado para acomodar base64 de até 15MB reais.
- [ ] `backend/index.js`: middleware global de erro preserva status reais (ex.: 413) e devolve mensagem útil.
- [ ] `backend/routes/documentos.js`: `put` carregado junto com `del` no topo, com fallback claro se o módulo faltar.
- [ ] `frontend/js/clientes.js`: erro de upload (`!res.ok`) tratado com toast real, input resetado após tentativa.
- [ ] `frontend/js/clientes.js`: validação de tamanho (15MB) no cliente antes de iniciar o upload.
- [ ] Testado com arquivos pequenos, médios (5-8MB), no limite (~15MB) e acima do limite.
- [ ] Testado com todos os tipos de arquivo permitidos e um tipo não permitido.
- [ ] Download e exclusão de documentos continuam funcionando normalmente.