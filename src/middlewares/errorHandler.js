// middlewares/errorHandler.js
// Centraliza el formato de todos los errores de la API.
// Express detecta los 4 parámetros (err,req,res,next) y lo usa como manejador de errores.

const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err.type === 'validation') {
    return res.status(400).json({ error: 'Datos inválidos', campos: err.errors });
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  return res.status(500).json({
    error: 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { detalle: err.message }),
  });
};

// Helper: throw crearError(404, 'Trámite no encontrado')
const crearError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

module.exports = { errorHandler, crearError };
