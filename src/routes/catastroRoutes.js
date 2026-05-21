const { Router } = require('express');
const { verificarToken, verificarRol } = require('../middlewares/auth');
const ctrl = require('../controllers/catastroController');

const router = Router();
router.use(verificarToken);

// /mapa va antes de /:numeroFinca para evitar colisión
router.get('/mapa', ctrl.obtenerCoordenadas);
router.get('/:numeroFinca', ctrl.buscarPorFinca);
router.patch('/:id', verificarRol('funcionario', 'jefe', 'admin'), ctrl.editarFicha);

module.exports = router;
