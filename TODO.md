# TODO - Fix Erro Admin /api/usuarios (JSON inesperado)

- [ ] Diagnosticar origem do 500 em `GET /api/usuarios` (authMiddleware / routing / rewrite do Vercel)
- [x] Identificar que `frontend/js/admin.js` faz `res.json()` e falha quando o backend retorna texto iniciando com “A”
- [ ] Aplicar fallback robusto no `frontend/js/admin.js` para tratar resposta não-JSON (usar `res.text()` quando content-type não for JSON)
- [ ] Garantir que `backend` sempre responda JSON para erros inesperados nas rotas de `usuarios`
- [ ] Validar localmente: abrir `admin.html` e confirmar que o toast mostra o erro real em vez de “Unexpected token 'A'”

