const { Router } = require('express');
const { body }   = require('express-validator');
const { verificarToken, verificarRol } = require('../middlewares/auth');
const ctrl = require('../controllers/tramitesController');

const router = Router();
router.use(verificarToken);

router.post('/',
  verificarRol('ciudadano'),
  [
    body('tipo')
      .notEmpty().withMessage('El tipo de trámite es requerido')
      .isIn(['licencia_comercial', 'permiso_construccion', 'actualizacion_catastral', 'otro'])
      .withMessage('Tipo inválido. Opciones: licencia_comercial, permiso_construccion, actualizacion_catastral, otro'),
    body('descripcion').optional().isString(),
  ],
  ctrl.crearTramite
);

// Rutas con nombre fijo — ANTES de /:id
router.get('/mis-tramites', verificarRol('ciudadano'),                    ctrl.misTramites);
router.get('/bandeja',      verificarRol('funcionario', 'jefe', 'admin'), ctrl.bandeja);
router.get('/metricas',     verificarRol('jefe', 'admin'),                ctrl.metricas);
router.get('/exportar',     verificarRol('funcionario', 'jefe', 'admin'), ctrl.exportar);

// Rutas con parámetro dinámico — AL FINAL
router.get('/:id', ctrl.detalleTramite);

router.patch('/:id/estado',
  verificarRol('funcionario', 'jefe', 'admin'),
  [
    body('estado_nuevo').notEmpty().withMessage('estado_nuevo es requerido'),
    body('observaciones').optional().isString().isLength({ max: 500 }),
  ],
  ctrl.cambiarEstado
);

module.exports = router;
