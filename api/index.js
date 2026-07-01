// Serverless Function da Vercel — expõe o app Express do backend
// como uma função reconhecida pelo sistema de arquivos da Vercel.
// Não remover: sem este arquivo, /api/(.*) cai no rewrite abaixo
// e a Vercel serve backend/index.js como texto estático (bug original).
const app = require('../backend/index.js');

module.exports = app;
