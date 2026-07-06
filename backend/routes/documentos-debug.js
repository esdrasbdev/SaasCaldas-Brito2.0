/*
 * Debug de Blob (Vercel) para diagnosticar upload
 */

const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const { supabaseAdmin, getAdminClient } = require('../supabase');

// IMPORT Opcional para não quebrar runtime caso não exista
let del = null;
let put = null;
let blobImportError = null;
try {
  ({ del, put } = require('@vercel/blob'));
} catch (e) {
  blobImportError = e;
}

function safeMessage(err) {
  if (!err) return null;
  return err?.message || String(err);
}

// Não exige autenticação para diagnosticar falhas de runtime em produção.
router.get('/debug-blob', async (req, res) => {
  const result = {
    ok: true,
    runtime: {
      node: process.version,
      vercelEnv: {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
      },
    },
    blob: {
      moduleResolved: !!put,
      putType: typeof put,
      delType: typeof del,
      env: {
        BLOB_READ_WRITE_TOKEN_PRESENT: !!process.env.BLOB_READ_WRITE_TOKEN,
        BLOB_READ_WRITE_TOKEN_LENGTH: process.env.BLOB_READ_WRITE_TOKEN ? String(process.env.BLOB_READ_WRITE_TOKEN).length : 0,
      },
      importError: blobImportError ? safeMessage(blobImportError) : null,
    },
    supabase: {
      supabaseAdmin_present: !!supabaseAdmin,
      supabaseAdmin_info: supabaseAdmin ? 'service-role client exists' : null,
      getAdminClient_isSupabaseAdmin: !!getAdminClient,
    },
    auth: {
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      userRole: req.user?.role || null,
    },
    test: {
      attempted: false,
      note: 'Este endpoint não faz upload real para não consumir recursos/armazenamento.'
    }
  };

  // Valida rapidamente se o put existe e se o token existe
  if (put && process.env.BLOB_READ_WRITE_TOKEN) {
    result.test.attempted = true;
    result.test.note = 'put existe e BLOB_READ_WRITE_TOKEN está presente no runtime.';
  }

  return res.json(result);
});

module.exports = router;

