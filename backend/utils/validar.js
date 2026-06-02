/*
 * Validações Backend - Sem dependências externas
 * Uso: if (!validarCPF(req.body.documento)) return res.status(400).json({erro: 'CPF inválido'})
 */

function validarCPF(cpf) {
  if (!cpf || typeof cpf !== 'string') return false;
  cpf = cpf.replace(/[^\d]/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  let soma = 0, resto;
  for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;

  return true;
}

function validarOAB(oab) {
  if (!oab || typeof oab !== 'string') return false;
  const regex = /^(\d{1,6})\/([A-Z]{2})$/;
  return regex.test(oab);
}

function validarDataISO(data) {
  return data && !isNaN(Date.parse(data));
}

function sanitizarString(str, maxLen = 500) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().substring(0, maxLen);
}

module.exports = {
  validarCPF,
  validarOAB,
  validarDataISO,
  sanitizarString
};

