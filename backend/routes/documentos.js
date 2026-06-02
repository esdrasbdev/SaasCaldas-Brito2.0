/*
 * Rotas de Documentos (Backend)
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const supabase = require('../supabase');

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

// POST /api/documentos/upload
// Recebe arquivo em Base64 para simplificar a infraestrutura (sem multer)
router.post('/upload', async (req, res) => {
  try {
    const { nome, arquivo, tipo, cliente_id, processo_id } = req.body;
    
    if (!arquivo) return res.status(400).json({ error: 'Arquivo não enviado' });

    // 1. Upload para o Storage do Supabase
    const fileName = `${Date.now()}_${nome}`;
    const fileBuffer = Buffer.from(arquivo.split(',')[1] || arquivo, 'base64');

    const { data: storageData, error: storageError } = await supabase.storage
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
        upload_por: req.user.id // Identifica quem subiu, mas todos verão
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

    if (doc && doc.url) {
      const fileName = doc.url.split('/').pop();
      await supabase.storage.from('documentos').remove([fileName]);
    }

    const { error } = await supabase.from('documentos').delete().eq('id', id);
    
    if (error) throw error;

    res.json({ message: 'Documento excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;