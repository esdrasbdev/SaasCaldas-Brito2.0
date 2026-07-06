/*
 * Rotas de Documentos (Backend)
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { supabaseAdmin } = require('../supabase');






// IMPORT Opcional para evitar falha do deployment caso o pacote não exista no runtime.
let del = null;
let put = null;
try {
  ({ del, put } = require('@vercel/blob'));
} catch (e) {
  console.error('[documentos] Pacote @vercel/blob não encontrado no runtime:', e?.message || e);
}

router.use(auth);


// GET /api/documentos
router.get('/', async (req, res) => {
  try {

    const { cliente_id } = req.query;


    // Constrói a query base
    let query = supabaseAdmin
      .from('documentos')
      .select('*, clientes(nome), processos(numero_cnj), usuarios(nome)');


    // Se houver cliente_id, filtra os documentos específicos
    if (cliente_id) {
      query = query.eq('cliente_id', cliente_id);
    }



    const { data, error } = await query.order('criado_em', { ascending: false });


    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/documentos/blob-upload
// (rota existe apenas como POST; handler para evitar 401 confuso)
router.get('/blob-upload', (req, res) => {
  res.status(405).json({ error: 'Use POST /api/documentos/blob-upload (Authorization obrigatório).' });
});

// POST /api/documentos/blob-upload
// Upload direto do cliente -> Vercel Blob (evita limites de payload serverless)
router.post('/blob-upload', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const Busboy = require('busboy');

    // Espera multipart/form-data com:
    // - file (campo 'file')
    // - cliente_id
    // - nome (opcional)
    // - tipo (opcional)
    const { cliente_id, nome: nomeForm, tipo: tipoForm } = req.body || {};

    // req.body pode não vir dependendo do runtime; então coletamos também via multipart
    if (!cliente_id) {
      // seguimos e validamos após coletar os campos do multipart
    }

    const maxFileSizeBytes = 15 * 1024 * 1024; // 15MB

    const { fields, file } = await new Promise((resolve, reject) => {
      // busboy streams multipart e evita estourar body parser
      const bb = Busboy({ headers: req.headers, limits: { fileSize: maxFileSizeBytes } });

      const fieldsLocal = {};
      let fileLocal = null;


      bb.on('field', (name, val) => {
        fieldsLocal[name] = val;
      });

      bb.on('file', (name, stream, filename, encoding, mimeType) => {
        const chunks = [];
        let total = 0;

        stream.on('data', (d) => {
          total += d.length;
          if (total > maxFileSizeBytes) {
            stream.resume();
            reject(Object.assign(new Error('Arquivo excede o tamanho máximo (15MB).'), { status: 400 }));
            return;
          }
          chunks.push(d);
        });

        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          fileLocal = {
            fieldname: name,
            filename,
            mimeType,
            buffer,
            size: total
          };
        });

        stream.on('error', (err) => reject(err));
      });

      bb.on('finish', () => resolve({ fields: fieldsLocal, file: fileLocal }));
      bb.on('error', (err) => reject(err));

      req.pipe(bb);
    });

    const clienteIdFinal = fields.cliente_id || cliente_id;
    if (!clienteIdFinal) {
      return res.status(400).json({ error: 'cliente_id é obrigatório.' });
    }

    if (!file) {
      return res.status(400).json({ error: 'Arquivo não enviado.' });
    }

    const nome = nomeForm || file.filename || 'documento';
    const tipo = tipoForm || file.mimeType;

    // Limites (ajustáveis)
    const allowedContentTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];

    if (!tipo || !allowedContentTypes.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de arquivo não permitido.' });
    }

    const arquivoBuffer = file.buffer;


    if (!put) {
      return res.status(500).json({
        error: 'Falha no upload: @vercel/blob indisponível no runtime.',
        hint: 'Verifique se o pacote @vercel/blob e a variável BLOB_READ_WRITE_TOKEN estão disponíveis no build/deploy.'
      });
    }

    // @vercel/blob: para upload feito a partir do servidor, usar put()

    const blob = await put(nome || 'documento', arquivoBuffer, {
      access: 'public',
      contentType: tipo
    });



    const url = blob.url;


    if (!url) {
      throw new Error('Falha ao gerar URL no Blob.');
    }

    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('documentos')
      .insert({

        nome: nome || 'documento',
        url,
        tipo,
        cliente_id,
        upload_por: req.user.id
      })
      .select()
      .single();

    if (dbError) throw dbError;

    res.json(dbData);
  } catch (error) {
    console.error('Erro blob-upload:', error);
    res.status(500).json({ error: error.message });
  }
});




// DELETE /api/documentos/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Busca dados do documento para remover o arquivo físico do Storage
    const { data: doc } = await supabaseAdmin

      .from('documentos')

      .select('url')
      .eq('id', id)
      .single();

    if (doc?.url) {
      try {
        await del(doc.url);
      } catch (_) {
        // não bloqueia remoção do registro
      }
    }


    const { error } = await supabaseAdmin.from('documentos').delete().eq('id', id);


    if (error) throw error;


    res.json({ message: 'Documento excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;