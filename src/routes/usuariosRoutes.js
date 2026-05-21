const { Router } = require('express');
const { verificarToken, verificarRol } = require('../middlewares/auth');
const ctrl = require('../controllers/usuariosController');

const router = Router();
router.use(verificarToken);

router.post('/funcionario',       verificarRol('admin'), ctrl.crearFuncionario);
router.patch('/:id/desactivar',   verificarRol('admin'), ctrl.desactivarCuenta);

module.exports = router;
