/*
 * Rotas de Documentos (Backend)
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const supabase = require('../supabase');

// IMPORT Opcional para evitar falha do deployment caso o pacote não exista no runtime.
let del = null;
try {
  ({ del } = require('@vercel/blob'));
} catch (e) {
  // fallback: exclusão via blob vai retornar erro claro
}


router.use(auth);

// GET /api/documentos
router.get('/', async (req, res) => {

  try {
    const { cliente_id } = req.query;

    // Constrói a query base
    let query = supabase
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

// POST /api/documentos/blob-upload
// Upload direto do cliente -> Vercel Blob (evita limites de payload serverless)
router.post('/blob-upload', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const { cliente_id, nome, tipo, base64 } = req.body || {};

    if (!cliente_id) {
      return res.status(400).json({ error: 'cliente_id é obrigatório.' });
    }

    if (!base64) {
      return res.status(400).json({ error: 'Arquivo não enviado.' });
    }

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

    // Estimativa de tamanho (base64)
    const base64Part = String(base64).split(',')[1] || String(base64);
    const sizeBytes = Math.floor((base64Part.length * 3) / 4);
    const maximumSizeInBytes = 15 * 1024 * 1024; // 15MB

    if (sizeBytes > maximumSizeInBytes) {
      return res.status(400).json({ error: 'Arquivo excede o tamanho máximo (15MB).' });
    }

    const arquivoBuffer = Buffer.from(base64Part, 'base64');

    // @vercel/blob: para upload feito a partir do servidor, usar put()
    const { put } = require('@vercel/blob');
    const blob = await put(nome || 'documento', arquivoBuffer, {
      access: 'public',
      contentType: tipo
    });

    const url = blob.url;


    if (!url) {
      throw new Error('Falha ao gerar URL no Blob.');
    }

    const { data: dbData, error: dbError } = await supabase
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

// POST /api/documentos/upload
// Recebe arquivo em Base64 para fallback (arquivos menores)
router.post('/upload', async (req, res) => {
  try {
    const { nome, arquivo, tipo, cliente_id, processo_id } = req.body;

    if (!arquivo) return res.status(400).json({ error: 'Arquivo não enviado' });

    // 1. Upload para o Storage do Supabase
    const fileName = `${Date.now()}_${nome}`;
    const fileBuffer = Buffer.from(arquivo.split(',')[1] || arquivo, 'base64');

    const { error: storageError } = await supabase.storage
      .from('documentos')
      .upload(fileName, fileBuffer, { contentType: tipo, upsert: true });

    if (storageError) throw storageError;

    // 2. Obtém URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('documentos')
      .getPublicUrl(fileName);

    // 3. Salva referência no banco de dados
    const { data: dbData, error: dbError } = await supabase
      .from('documentos')
      .insert([{
        nome: nome,
        url: publicUrl,
        tipo: tipo,
        cliente_id: cliente_id || null,
        processo_id: processo_id || null,
        upload_por: req.user.id
      }])
      .select()
      .single();

    if (dbError) throw dbError;

    res.json(dbData);
  } catch (error) {
    console.error('Erro Upload:', error);
    res.status(500).json({ error: error.message });
  }
});


// DELETE /api/documentos/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Busca dados do documento para remover o arquivo físico do Storage
    const { data: doc } = await supabase
      .from('documentos')
      .select('url')
      .eq('id', id)
      .single();

    if (doc?.url) {
      // Se for Blob, tenta remover via Vercel Blob; caso contrário remove do Supabase Storage.
      try {
        await del(doc.url);
      } catch (_) {
        try {
          const fileName = doc.url.split('/').pop();
          await supabase.storage.from('documentos').remove([fileName]);
        } catch (e2) {
          // não bloqueia remoção do registro
        }
      }
    }

    const { error } = await supabase.from('documentos').delete().eq('id', id);

    if (error) throw error;


    res.json({ message: 'Documento excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;