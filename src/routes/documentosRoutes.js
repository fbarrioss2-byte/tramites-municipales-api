const { Router } = require('express');
const { verificarToken } = require('../middlewares/auth');
const ctrl = require('../controllers/documentosController');

const router = Router();
router.use(verificarToken);

router.post('/:tramiteId', ctrl.registrarDocumento);
router.get('/:tramiteId',  ctrl.listarDocumentos);

module.exports = router;
