## TODO.md — Implementação das Correções (Rodada 3)

### Passo A — PROBLEMA 01: Procuração em 1 página A4
- [x] Ajustar somente no bloco `if (chave === 'procuracao')` em `frontend/js/clientes.js`
- [ ] Garantir que conteúdo final fique abaixo de `PH - MAR_BOTTOM - 12` antes de `addRodapeEscritorio()`
- [ ] Validar gerando PDF da Procuração (1 página A4)
- [ ] Validar que os outros 5 modelos não mudaram

### Observações
- Não mexer em `addTexto`, `addMisto`, `aplicarTimbrado`, `checarPagina`.


### Passo B — PROBLEMA 02: Documentos do Cliente com Vercel Blob

- [x] Adicionar dependência `@vercel/blob` em `backend/package.json`
- [x] Criar rota `POST /api/documentos/blob-upload` em `backend/routes/documentos.js`

- [ ] Persistir `nome`, `url`, `tipo`, `cliente_id`, `upload_por`
- [ ] Atualizar `DELETE /api/documentos/:id` para usar `del(url)` do Blob
- [ ] Atualizar `frontend/js/clientes.js` para usar `upload()` do Blob e listar/excluir corretamente
- [ ] Garantir modo visualização (somente leitura) sem upload/exclusão



### Passo C — PROBLEMA 03: Corrigir erro 400 ao trocar senha
- [x] Adicionar logs temporários na rota `PUT /api/usuarios/:id` em `backend/routes/usuarios.js`
- [ ] Reproduzir e registrar causa nos logs
- [x] Aplicar self-healing (cria conta no Auth quando email não existir) e normalizar email
- [x] Remover código morto (não usada variável `shouldTryReconcile` no fluxo atual)
- [ ] Validar manualmente os 3 cenários de troca de senha


