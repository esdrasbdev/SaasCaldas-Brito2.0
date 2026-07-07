# TODO_EXECUCAO — SaasCaldas-Brito2.0

- [x] 1) Verificar existência de `package-lock.json` na raiz e `backend/vercel-blob-2.5.0.tgz`; remover se existirem.
- [x] 1.1) Removido `backend/vercel-blob-2.5.0.tgz` (se existia).
- [x] 2) Implementar Procurações: `sql/create_procuracoes.sql` + `backend/routes/procuracoes.js` + registrar em `backend/index.js`.
- [x] 3) Implementar Frontend Procurações: `frontend/procuracoes.html` + `frontend/js/procuracoes.js`.
- [x] 4) Menu + Guard: registrar em `frontend/js/sidebar.js` e permissões em `frontend/js/guard.js`.
- [x] 5) Gerar procuração em 1 página e salvar/upload+registro via endpoint.
- [x] 6) Implementar Filtro de clientes por responsável: `frontend/clientes.html` + `frontend/js/clientes.js` + validação em `backend/routes/clientes.js`.
- [x] 7) Implementar botões Arquivar/Restaurar com modal em `frontend/js/audiencias.js` e `frontend/js/pericias.js`.
- [x] 8) Ajustar páginas de arquivados para chamar endpoints `?status=ARQUIVADA` e restaurar via `PATCH`.
- [ ] 9) Testes locais e validações (upload/debug, filtros, arquivados).
- [ ] 10) Atualizar `TODO.md` marcando itens concluídos e gerar relatório final.


