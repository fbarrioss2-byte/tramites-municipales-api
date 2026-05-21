// middlewares/auth.js
// verificarToken: valida el JWT con Supabase y adjunta req.usuario
// verificarRol:   controla acceso por rol

const { supabase } = require('../supabaseClient');

const verificarToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Token no proporcionado',
        detalle: 'Header requerido: Authorization: Bearer <token>',
      });
    }

    const token = authHeader.split(' ')[1];

    // Validar el JWT contra Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'Token inválido o expirado',
        detalle: error?.message,
      });
    }

    // Buscar el rol en la tabla usuarios (fuente de verdad del sistema)
    const { data: perfil } = await supabase
      .from('usuarios')
      .select('rol, activo, nombre')
      .eq('id', user.id)
      .single();

    if (perfil && !perfil.activo) {
      return res.status(403).json({ error: 'Cuenta desactivada' });
    }

    req.usuario = {
      id:     user.id,
      email:  user.email,
      nombre: perfil?.nombre || user.email,
      rol:    perfil?.rol || user.user_metadata?.rol || 'ciudadano',
      token,  // guardamos el token para pasarlo a getSupabaseUser en controllers
    };

    next();
  } catch (err) {
    return res.status(500).json({ error: 'Error interno al verificar token' });
  }
};

const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        error: 'Acceso denegado',
        detalle: `Tu rol "${req.usuario.rol}" no tiene permiso. Roles válidos: ${rolesPermitidos.join(', ')}`,
      });
    }
    next();
  };
};

module.exports = { verificarToken, verificarRol };
