// __tests__/servicios.test.js
// Tests unitarios para servicios y lógica de controllers/middlewares
// que los tests de integración no alcanzan.

// ══════════════════════════════════════════════════════════════════════
// errorHandler y crearError
// ══════════════════════════════════════════════════════════════════════
const { errorHandler, crearError } = require('../middlewares/errorHandler');

describe('crearError', () => {
  it('crea un error con statusCode y message', () => {
    const err = crearError(404, 'No encontrado');
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('No encontrado');
  });

  it('crea error 400 para validaciones', () => {
    const err = crearError(400, 'Datos inválidos');
    expect(err.statusCode).toBe(400);
  });
});

describe('errorHandler middleware', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json   = jest.fn().mockReturnValue(res);
    return res;
  };
  const mockReq = (method = 'GET', path = '/test') => ({ method, path });
  const next = jest.fn();

  it('responde 400 para errores de tipo validation', () => {
    const err = { type: 'validation', errors: [{ field: 'email', msg: 'requerido' }] };
    const res = mockRes();
    errorHandler(err, mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Datos inválidos' }));
  });

  it('responde con el statusCode del error si tiene uno', () => {
    const err = crearError(422, 'Entidad no procesable');
    const res = mockRes();
    errorHandler(err, mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({ error: 'Entidad no procesable' });
  });

  it('responde 500 para errores sin statusCode', () => {
    const err = new Error('bug inesperado');
    const res = mockRes();
    process.env.NODE_ENV = 'production';
    errorHandler(err, mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error interno del servidor' });
  });

  it('incluye detalle del error en modo development', () => {
    const err = new Error('detalle del bug');
    const res = mockRes();
    process.env.NODE_ENV = 'development';
    errorHandler(err, mockReq(), res, next);
    const call = res.json.mock.calls[0][0];
    expect(call).toHaveProperty('detalle', 'detalle del bug');
    process.env.NODE_ENV = 'test';
  });
});

// ══════════════════════════════════════════════════════════════════════
// notificaciones service
// ══════════════════════════════════════════════════════════════════════
describe('notificaciones — enviarCambioEstado', () => {
  const { enviarCambioEstado } = require('../services/notificaciones');

  beforeEach(() => {
    process.env.NODE_ENV = 'development'; // Modo simulado (no envía email real)
  });

  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('ejecuta sin errores en modo development (simulado)', async () => {
    await expect(
      enviarCambioEstado({
        emailDestino:     'ciudadano@test.com',
        numeroExpediente: 'TRM-2026-00001',
        estadoNuevo:      'aprobado',
        comentario:       'Todo en orden',
      })
    ).resolves.not.toThrow();
  });

  it('ejecuta para todos los estados válidos', async () => {
    const estados = ['pendiente', 'en_revision', 'aprobado', 'rechazado', 'trasladado'];
    for (const estado of estados) {
      await expect(
        enviarCambioEstado({
          emailDestino: 'test@test.com',
          numeroExpediente: 'TRM-2026-00001',
          estadoNuevo: estado,
        })
      ).resolves.not.toThrow();
    }
  });

  it('funciona sin campo comentario (opcional)', async () => {
    await expect(
      enviarCambioEstado({
        emailDestino:     'test@test.com',
        numeroExpediente: 'TRM-2026-00002',
        estadoNuevo:      'pendiente',
      })
    ).resolves.not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════════
// pdfService
// ══════════════════════════════════════════════════════════════════════
describe('pdfService — generarDocumentoOficial', () => {
  const { generarDocumentoOficial, generarReportePDF, generarExcel } = require('../services/pdfService');

  it('genera un Buffer de PDF', async () => {
    const tramite = {
      numero_expediente: 'TRM-2026-00001',
      tipo_tramite:      'permiso_construccion',
      descripcion:       'Permiso para construir vivienda familiar de dos niveles',
    };
    const buffer = await generarDocumentoOficial(tramite);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(100);
    // Los PDFs empiezan con %PDF
    expect(buffer.toString('ascii', 0, 4)).toBe('%PDF');
  });

  it('genera PDF sin descripción (campo opcional)', async () => {
    const buffer = await generarDocumentoOficial({
      numero_expediente: 'TRM-2026-00002',
      tipo_tramite:      'otro',
    });
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });
});

describe('pdfService — generarReportePDF', () => {
  const { generarReportePDF } = require('../services/pdfService');

  it('genera PDF de reporte con lista vacía', async () => {
    const buffer = await generarReportePDF([]);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString('ascii', 0, 4)).toBe('%PDF');
  });

  it('genera PDF con múltiples trámites', async () => {
    const tramites = [
      { numero_expediente: 'TRM-2026-00001', tipo_tramite: 'otro', estado: 'aprobado', created_at: '2026-01-15T10:00:00Z' },
      { numero_expediente: 'TRM-2026-00002', tipo_tramite: 'permiso_construccion', estado: 'pendiente', created_at: '2026-01-16T10:00:00Z' },
      { numero_expediente: 'TRM-2026-00003', tipo_tramite: 'pago_impuesto', estado: 'rechazado', created_at: '2026-01-17T10:00:00Z' },
    ];
    const buffer = await generarReportePDF(tramites);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });
});

describe('pdfService — generarExcel', () => {
  const { generarExcel } = require('../services/pdfService');

  it('genera un Buffer de Excel', async () => {
    const tramites = [
      {
        numero_expediente: 'TRM-2026-00001',
        tipo_tramite:      'otro',
        estado:            'aprobado',
        ciudadano_id:      'uid-123',
        descripcion:       'Test',
        created_at:        '2026-01-15',
      },
    ];
    const buffer = await generarExcel(tramites);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(100);
    // Los archivos xlsx son ZIP (empiezan con PK)
    expect(buffer[0]).toBe(0x50); // 'P'
    expect(buffer[1]).toBe(0x4b); // 'K'
  });

  it('genera Excel con lista vacía', async () => {
    const buffer = await generarExcel([]);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// catastroController — lógica unitaria
// ══════════════════════════════════════════════════════════════════════
// Mock getSupabaseUser para tests unitarios de catastro
const mockDb = {
  select: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(), not:    jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  from:   jest.fn().mockReturnThis(),
};

jest.mock('../supabaseClient', () => ({
  supabase:        { from: jest.fn(), auth: { getUser: jest.fn() } },
  getSupabaseUser: jest.fn(),
}));

const { getSupabaseUser: mockGetSupabaseUser } = require('../supabaseClient');
mockGetSupabaseUser.mockReturnValue(mockDb);

describe('catastroController — editarFicha', () => {
  const { editarFicha } = require('../controllers/catastroController');

  const mockRes = () => {
    const r = {};
    r.status = jest.fn().mockReturnValue(r);
    r.json   = jest.fn().mockReturnValue(r);
    return r;
  };

  it('llama a next(error) si no hay campos válidos para actualizar', async () => {
    const req  = { params: { id: '123' }, body: { campo_invalido_xyz: 'x' }, usuario: { id: 'u1' }, headers: { authorization: 'Bearer tok' } };
    const res  = mockRes();
    const next = jest.fn();
    await editarFicha(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  it('llama a next(error) con 404 cuando supabase no devuelve ficha', async () => {
    mockDb.single.mockResolvedValueOnce({ data: null, error: null });
    const req  = { params: { id: 'no-existe' }, body: { propietario_nombre: 'Juan' }, usuario: { id: 'u1' }, headers: { authorization: 'Bearer tok' } };
    const res  = mockRes();
    const next = jest.fn();
    await editarFicha(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('catastroController — buscarPorFinca', () => {
  const { buscarPorFinca } = require('../controllers/catastroController');

  const mockRes = () => {
    const r = {};
    r.status = jest.fn().mockReturnValue(r);
    r.json   = jest.fn().mockReturnValue(r);
    return r;
  };

  it('llama a next con 404 cuando la finca no existe', async () => {
    mockDb.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
    const req  = { params: { numeroFinca: 'F-999' }, usuario: { id: 'u1' }, headers: { authorization: 'Bearer tok' } };
    const res  = mockRes();
    const next = jest.fn();
    await buscarPorFinca(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(404);
  });
});
