# TODO — Rodada de Correções (SaasCaldas-Brito 2.0)

## PROBLEMA 01 — Documentos do Cliente (Vercel Blob)
- [x] Backend: corrigir `backend/routes/documentos.js` (trocar `handleUpload(...)` por `put()` em `/blob-upload`).

- [x] Backend: manter validação e salvar `url`/metadados em `documentos`.


- [x] Frontend: em `frontend/js/clientes.js`, renderizar nova seção “Documentos do Cliente” na ficha do cliente.
- [x] Frontend: criar/estilizar `#upload-doc-cliente` e botão para disparar clique (respeitar `visualizacao`).
- [x] Frontend: listar via `ClienteModel.listarDocumentos(clienteId)` e renderizar download + exclusão com `.btn-del-doc`.
- [x] Frontend: ocultar upload/exclusão quando `visualizacao === true`.
- [x] Garantir que quando `clienteId` é `null`, mantém mensagem/fluxo atual.


## PROBLEMA 02 — Usuários 100% funcionais
- [ ] Validar ponta a ponta (admin.html/admin.js → POST /api/usuarios → login.html → RBAC).
- [ ] Se houver falha, corrigir pontualmente.

## PROBLEMA 03 — Procuração em 1 página
- [ ] Diagnosticar no bloco `if (chave === 'procuracao')` e ajustar apenas dentro dele.

## PROBLEMA 04 — Item 2.5 (BPC) com cor/tamanho correto
- [ ] Diagnosticar causa no bloco `contrato-honorarios` e corrigir sem exceções manuais de estilo.

## PROBLEMA 05 — Lentidão no carregamento
- [ ] Melhorar cache do `/api/env` no front (TTL curto).
- [ ] Documentar limitações de cache do backend (cold start).
- [ ] Preparar índices adicionais em `sql/indices.sql`.

