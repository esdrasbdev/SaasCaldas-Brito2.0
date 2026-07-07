/*
 * Verificação de dependências críticas em tempo de build.
 * Falha o deploy imediatamente se um pacote essencial não resolver,
 * em vez de deixar o erro aparecer só quando um usuário tenta usar
 * a funcionalidade (ex.: upload de documentos) em produção.
 */
const criticos = ['busboy', '@vercel/blob'];
let falhou = false;

for (const pacote of criticos) {
  try {
    require.resolve(pacote);
    console.log(`[verificar-dependencias] OK: ${pacote}`);
  } catch (e) {
    falhou = true;
    console.error(`[verificar-dependencias] FALHA: ${pacote} não resolvido — ${e.message}`);
  }
}

if (falhou) {
  console.error('[verificar-dependencias] Build abortado: dependência crítica ausente.');
  process.exit(1);
}
