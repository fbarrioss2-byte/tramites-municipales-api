// controllers/usuariosController.js
// Tabla: usuarios (id, nombre, correo, rol, activo, creado_en)
// NOTA: crearFuncionario inserta en la tabla usuarios.
// El registro en Supabase Auth lo hace el admin desde el dashboard de Supabase
// (requiere service_role_key que no se usa en el backend por seguridad).

const { getSupabaseUser } = require('../supabaseClient');
const { crearError }      = require('../middlewares/errorHandler');

// POST /api/usuarios/funcionario
// Crea el perfil en la tabla usuarios con rol funcionario.
// El admin debe crear primero el usuario en Supabase Auth dashboard,
// luego registrar el perfil aquí con el UUID que Supabase asignó.
const crearFuncionario = async (req, res, next) => {
  try {
    const db = getSupabaseUser(req);
    const { user_id, nombre, correo, departamento } = req.body;

    if (!user_id || !nombre || !correo) {
      throw crearError(400, 'user_id, nombre y correo son requeridos');
    }

    // Verificar que no exista ya un perfil para ese user_id
    const { data: existente } = await db
      .from('usuarios')
      .select('id')
      .eq('id', user_id)
      .single();

    if (existente) {
      throw crearError(409, 'Ya existe un perfil para ese usuario');
    }

    const { data: usuario, error } = await db
      .from('usuarios')
      .insert({
        id:         user_id,
        nombre,
        correo,
        rol:        'funcionario',
        activo:     true,
        creado_en:  new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw crearError(500, `Error al crear perfil: ${error.message}`);

    res.status(201).json({
      mensaje:  'Perfil de funcionario creado',
      usuario:  { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: 'funcionario' },
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/usuarios/:id/desactivar
const desactivarCuenta = async (req, res, next) => {
  try {
    const db     = getSupabaseUser(req);
    const { id } = req.params;

    if (id === req.usuario.id) {
      throw crearError(400, 'No puedes desactivar tu propia cuenta');
    }

    const { error } = await db
      .from('usuarios')
      .update({ activo: false })
      .eq('id', id);

    if (error) throw crearError(500, error.message);

    res.json({ mensaje: 'Cuenta desactivada exitosamente' });
  } catch (err) {
    next(err);
  }
};

module.exports = { crearFuncionario, desactivarCuenta };
