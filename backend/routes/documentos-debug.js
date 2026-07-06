/*
 * Debug de Blob (Vercel) para diagnosticar upload
 */

const express = require('express');
const router = express.Router();

// Não exige autenticação para diagnosticar falhas de runtime em produção.
// (Quando estiver ok, podemos re-ativar auth, mas primeiro queremos parar o 500.)

// IMPORT Opcional para não quebrar runtime caso não exista
let del = null;
let put = null;
let blobImportError = null;
try {
  ({ del, put } = require('@vercel/blob'));
} catch (e) {
  blobImportError = e;
}

let supabaseAdmin = null;
let getAdminClient = null;
try {
  const sup = require('../supabase');
  supabaseAdmin = sup?.supabaseAdmin || null;
  getAdminClient = sup?.getAdminClient;
} catch (e) {
  // se supabase.js falhar por falta de env, o endpoint ainda deve responder o estado do blob
}

function safeMessage(err) {
  if (!err) return null;
  return err?.message || String(err);
}

// GET /api/documentos/debug-blob
router.get('/debug-blob', async (req, res) => {
  const result = {
    ok: true,
    runtime: {
      node: process.version,
      vercelEnv: {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV
      }
    },
    blob: {
      moduleResolved: !!put,
      putType: typeof put,
      delType: typeof del,
      env: {
        BLOB_READ_WRITE_TOKEN_PRESENT: !!process.env.BLOB_READ_WRITE_TOKEN,
        BLOB_READ_WRITE_TOKEN_LENGTH: process.env.BLOB_READ_WRITE_TOKEN
          ? String(process.env.BLOB_READ_WRITE_TOKEN).length
          : 0
      },
      importError: blobImportError ? safeMessage(blobImportError) : null
    },
    supabase: {
      supabaseAdmin_present: !!supabaseAdmin,
      supabaseAdmin_info: supabaseAdmin ? 'service-role client exists' : null,
      getAdminClient_isSupabaseAdmin: !!getAdminClient
    },
    auth: {
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      userRole: req.user?.role || null
    }
  };

  if (put && process.env.BLOB_READ_WRITE_TOKEN) {
    result.blob.test = {
      attempted: true,
      note: 'put existe e BLOB_READ_WRITE_TOKEN está presente no runtime.'
    };
  } else {
    result.blob.test = {
      attempted: false,
      note: 'put não disponível ou token BLOB_READ_WRITE_TOKEN ausente.'
    };
  }

  return res.json(result);
});

module.exports = router;

