// controllers/documentosController.js
// Tabla: documentos (tramite_id, nombre_archivo, url_storage, tipo_documento, subido_en)

const { getSupabaseUser } = require('../supabaseClient');
const { crearError }      = require('../middlewares/errorHandler');

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'];
const TAMANO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// POST /api/documentos/:tramiteId
const registrarDocumento = async (req, res, next) => {
  try {
    const db = getSupabaseUser(req);
    const { tramiteId } = req.params;
    const { nombre_archivo, url_storage, tipo_documento, tipo_mime, tamano_bytes } = req.body;

    if (!nombre_archivo || !url_storage || !tipo_mime || !tamano_bytes) {
      throw crearError(400, 'Faltan campos: nombre_archivo, url_storage, tipo_mime, tamano_bytes');
    }
    if (!TIPOS_PERMITIDOS.includes(tipo_mime)) {
      throw crearError(400, 'Tipo no permitido. Solo: PDF, JPG, PNG');
    }
    if (tamano_bytes > TAMANO_MAX_BYTES) {
      throw crearError(400, 'El archivo supera el límite de 10 MB');
    }

    // Verificar que el trámite existe
    const { data: tramite, error: errTramite } = await db
      .from('tramites')
      .select('solicitante_id')
      .eq('id', tramiteId)
      .single();

    if (errTramite || !tramite) throw crearError(404, 'Trámite no encontrado');

    if (req.usuario.rol === 'ciudadano' && tramite.solicitante_id !== req.usuario.id) {
      throw crearError(403, 'No puedes agregar documentos a este trámite');
    }

    const { data: documento, error } = await db
      .from('documentos')
      .insert({
        tramite_id:     tramiteId,
        nombre_archivo,
        url_storage,
        tipo_documento: tipo_documento || tipo_mime,
        subido_en:      new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw crearError(500, error.message);

    res.status(201).json({ mensaje: 'Documento registrado exitosamente', documento });
  } catch (err) {
    next(err);
  }
};

// GET /api/documentos/:tramiteId
const listarDocumentos = async (req, res, next) => {
  try {
    const db = getSupabaseUser(req);
    const { tramiteId } = req.params;

    const { data: documentos, error } = await db
      .from('documentos')
      .select('*')
      .eq('tramite_id', tramiteId)
      .order('subido_en', { ascending: false });

    if (error) throw crearError(500, error.message);

    res.json({ documentos: documentos || [] });
  } catch (err) {
    next(err);
  }
};

module.exports = { registrarDocumento, listarDocumentos };
