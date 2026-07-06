# PROMPT — Corrigir upload de Documentos do Cliente (500) + Vercel Blob + ícone quebrado no seletor de responsáveis

Repositório: `SaasCaldas-Brito2.0`

Este prompt foi escrito após analisar o código-fonte real do projeto (`backend/index.js`, `backend/routes/documentos.js`, `backend/routes/documentos-debug.js`, `backend/middleware/auth.js`, `backend/supabase.js`, `frontend/js/clientes.js`, `frontend/css/style.css`, `package.json` e fluxo completo de upload).

## IMPORTANTE

O projeto **NÃO utiliza Supabase Storage**.

Toda a persistência de arquivos deve ocorrer **exclusivamente através do Vercel Blob**.

A tabela `documentos` do Supabase serve apenas para armazenar os metadados do arquivo (nome, URL, tamanho, cliente, usuário etc.).

Portanto:

* remover qualquer fallback para Supabase Storage;
* remover dependências de bucket `documentos`;
* concentrar toda a correção no funcionamento correto do `@vercel/blob`.

Existem **4 problemas**.

---

# BUG 1 — Remover completamente o fallback para Supabase Storage

Arquivo:

```
backend/routes/documentos.js
```

Hoje existe uma lógica semelhante a:

```js
try {
    // upload para Vercel Blob
}
catch {
    // fallback para Supabase Storage
}
```

Esse fallback está incorreto por dois motivos:

* não existe bucket de Storage sendo utilizado pelo projeto;
* o frontend nunca deveria depender do Storage do Supabase.

A consequência é que qualquer erro do Blob produz mensagens como:

> Falha no upload: @vercel/blob indisponível e fallback no Supabase também falhou.

Esse fluxo deve desaparecer completamente.

### Ação

Eliminar toda lógica relacionada a:

```js
storage.from(...)
storage.upload(...)
storage.remove(...)
bucket documentos
fallback
```

O fluxo correto passa a ser:

```
Recebe arquivo
↓

Upload exclusivamente para Vercel Blob

↓

Obtém URL retornada pelo Blob

↓

Insere registro na tabela documentos

↓

Retorna sucesso
```

Se o upload do Blob falhar:

* retornar erro imediatamente;
* não tentar nenhum fallback.

Exemplo:

```js
try {

    const blob = await put(...);

    ...

}
catch (err) {

    return res.status(500).json({
        error: err.message
    });

}
```

---

# BUG 2 — Inserções na tabela documentos devem usar supabaseAdmin

O projeto possui RLS habilitado.

Como o backend já executa:

```
authMiddleware
```

antes dessas rotas, o correto é utilizar o client administrativo para persistir metadados.

Em `documentos.js`, substituir:

```js
supabasePublic
```

por

```js
supabaseAdmin
```

nas operações da tabela:

* INSERT
* SELECT
* DELETE
* UPDATE (caso exista)

O objetivo é evitar problemas de RLS durante a gravação dos metadados.

**Importante**

Isso **não significa voltar a utilizar Supabase Storage**.

O `supabaseAdmin` deve ser usado **somente para a tabela `documentos`**.

Nenhum upload deve acontecer pelo Supabase.

---

# BUG 3 — Garantir funcionamento do @vercel/blob em produção

O frontend chama exclusivamente:

```
POST /api/documentos/blob-upload
```

Foi confirmado que:

```
/api/documentos/upload
```

não é utilizado por nenhum arquivo JavaScript.

É código morto.

## Ação 1

Remover completamente:

```
router.post('/upload')
```

caso ele ainda exista.

Todo upload deve passar apenas por:

```
blob-upload
```

---

## Ação 2

Revisar toda inicialização do Blob.

Verificar:

* importação do pacote;
* resolução do módulo;
* leitura da variável de ambiente.

Conferir especialmente:

```js
const { put } = require('@vercel/blob');
```

ou equivalente.

Não utilizar importações condicionais desnecessárias.

---

## Ação 3

Revisar todo o backend procurando referências a:

```
BLOB_READ_WRITE_TOKEN

@vercel/blob

put(...)

del(...)

head(...)
```

Garantir que:

* nenhuma variável antiga esteja sendo usada;
* nenhuma referência ao Storage do Supabase permaneça.

---

## Ação 4

Atualizar a rota de diagnóstico

```
/api/documentos/debug-blob
```

Ela deve informar claramente:

```json
{
    "moduleResolved": true,
    "tokenPresent": true,
    "environment": "production",
    "error": null
}
```

Caso exista erro, retornar a mensagem completa.

---

## Ação 5

Se:

```
moduleResolved = false
```

o problema é build/cache.

Se:

```
tokenPresent = false
```

o problema é variável de ambiente.

A rota deve deixar isso evidente.

---

# BUG 4 — texto "f002" aparece acima da busca de responsáveis

Arquivo:

```
frontend/css/style.css
```

Hoje existe:

```css
content: '\\f002';
```

Corrigir para:

```css
content: '\f002';
```

Essa é a única ocorrência desse erro no projeto.

---

# Limpeza de código

Como o projeto utiliza apenas Vercel Blob, remover tudo que não faz mais sentido.

Excluir:

* comentários sobre fallback;
* comentários sobre bucket;
* comentários sobre Supabase Storage;
* imports inutilizados;
* funções mortas;
* código não referenciado.

Também verificar se existe algo semelhante a:

```js
uploadSupabase()

uploadStorage()

fallbackUpload()
```

Caso exista, remover.

---

# Fluxo final esperado

O upload deverá seguir exatamente este fluxo:

```
Frontend

↓

POST /api/documentos/blob-upload

↓

@vercel/blob

↓

arquivo salvo

↓

URL retornada pelo Blob

↓

supabaseAdmin

↓

INSERT na tabela documentos

↓

200 OK
```

Não deve existir nenhum caminho alternativo.

---

# Ordem recomendada

1. Remover completamente o fallback para Supabase Storage.
2. Remover qualquer código morto relacionado ao endpoint `/upload`.
3. Garantir que apenas `/blob-upload` permaneça.
4. Ajustar todas as operações da tabela `documentos` para `supabaseAdmin`.
5. Revisar todas as referências ao `@vercel/blob`.
6. Melhorar `/debug-blob`.
7. Corrigir `content: '\f002'`.
8. Limpar imports e funções mortas.
9. Commit.
10. Deploy na Vercel **sem utilizar Build Cache**.

---

# Resultado esperado

Após as alterações:

* ✅ Upload funcionando exclusivamente via Vercel Blob.
* ✅ Nenhuma dependência de Supabase Storage.
* ✅ Inserções na tabela `documentos` funcionando via `supabaseAdmin`.
* ✅ `/api/documentos/debug-blob` identificando corretamente problemas de módulo ou variável de ambiente.
* ✅ Endpoint `/upload` removido (caso exista).
* ✅ Código morto eliminado.
* ✅ Ícone de lupa exibido corretamente, sem o texto `"f002"`.

---

## Convenções do projeto

Preservar:

* JavaScript puro (CommonJS/Node.js conforme o projeto atual);
* comentários em português;
* Font Awesome 6 Free;
* RBAC existente;
* arquitetura:

```
Frontend
        ↓
Express
        ↓
Vercel Blob (arquivos)
        ↓
Supabase (Postgres/Auth apenas para dados)
```

**Não reintroduzir Supabase Storage em nenhuma parte do fluxo.**
