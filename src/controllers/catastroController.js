// controllers/catastroController.js
// Tabla: inmuebles (numero_finca, propietario_nombre, area_m2, uso_suelo,
//                   direccion, latitud, longitud, actualizado_en)

const { getSupabaseUser } = require('../supabaseClient');
const { crearError }      = require('../middlewares/errorHandler');

const CAMPOS_EDITABLES = ['propietario_nombre', 'area_m2', 'uso_suelo', 'direccion', 'latitud', 'longitud'];

// GET /api/catastro/mapa — coordenadas de todos los inmuebles
const obtenerCoordenadas = async (req, res, next) => {
  try {
    const db = getSupabaseUser(req);

    const { data: inmuebles, error } = await db
      .from('inmuebles')
      .select('id, numero_finca, latitud, longitud, propietario_nombre, uso_suelo')
      .not('latitud', 'is', null)
      .not('longitud', 'is', null);

    if (error) throw crearError(500, error.message);

    res.json({ inmuebles: inmuebles || [] });
  } catch (err) {
    next(err);
  }
};

// GET /api/catastro/:numeroFinca — buscar inmueble por finca
const buscarPorFinca = async (req, res, next) => {
  try {
    const db = getSupabaseUser(req);
    const { numeroFinca } = req.params;

    const { data: inmueble, error } = await db
      .from('inmuebles')
      .select('*')
      .eq('numero_finca', numeroFinca)
      .single();

    if (error || !inmueble) throw crearError(404, `Finca "${numeroFinca}" no encontrada`);

    res.json({ inmueble });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/catastro/:id — editar ficha (solo funcionario/jefe/admin)
const editarFicha = async (req, res, next) => {
  try {
    const db     = getSupabaseUser(req);
    const { id } = req.params;

    const actualizaciones = {};
    CAMPOS_EDITABLES.forEach(campo => {
      if (req.body[campo] !== undefined) actualizaciones[campo] = req.body[campo];
    });

    if (Object.keys(actualizaciones).length === 0) {
      throw crearError(400, `Sin campos válidos. Editables: ${CAMPOS_EDITABLES.join(', ')}`);
    }

    actualizaciones.actualizado_en = new Date().toISOString();

    const { data: ficha, error } = await db
      .from('inmuebles')
      .update(actualizaciones)
      .eq('id', id)
      .select()
      .single();

    if (error)  throw crearError(500, error.message);
    if (!ficha) throw crearError(404, 'Inmueble no encontrado');

    res.json({ mensaje: 'Ficha actualizada', ficha });
  } catch (err) {
    next(err);
  }
};

module.exports = { buscarPorFinca, editarFicha, obtenerCoordenadas };
