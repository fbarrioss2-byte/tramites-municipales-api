const request = require('supertest');

jest.mock('../supabaseClient', () => {
  const buildChain = (val) => {
    const c = {
      select: jest.fn().mockReturnThis(), insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(), eq:     jest.fn().mockReturnThis(),
      neq:    jest.fn().mockReturnThis(), gte:    jest.fn().mockReturnThis(),
      lt:     jest.fn().mockReturnThis(), lte:    jest.fn().mockReturnThis(),
      not:    jest.fn().mockReturnThis(), order:  jest.fn().mockReturnThis(),
      range:  jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue(val),
    };
    return c;
  };
  const mockClient = { from: jest.fn(() => buildChain({ data: null, error: null, count: 0 })), auth: { getUser: jest.fn() } };
  return { supabase: mockClient, getSupabaseUser: jest.fn(() => mockClient) };
});

jest.mock('../services/notificaciones', () => ({ enviarCambioEstado: jest.fn().mockResolvedValue({}) }));
jest.mock('../services/pdfService', () => ({
  generarDocumentoOficial: jest.fn().mockResolvedValue(Buffer.from('pdf')),
  generarExcel:            jest.fn().mockResolvedValue(Buffer.from('xlsx')),
  generarReportePDF:       jest.fn().mockResolvedValue(Buffer.from('pdf')),
}));

const app      = require('../app');
const { supabase, getSupabaseUser } = require('../supabaseClient');

const mockAuth = (rol = 'ciudadano', id = 'user-abc') => {
  supabase.auth.getUser.mockResolvedValueOnce({
    data: { user: { id, email: `${rol}@test.com`, user_metadata: { rol } } }, error: null,
  });
  // mock perfil en tabla usuarios
  const mockDb = getSupabaseUser();
  mockDb.from.mockReturnValueOnce({
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { rol, activo: true, nombre: 'Test' }, error: null }),
  });
};

const mockAuthFail = () => {
  supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'JWT expired' } });
};

describe('GET /health', () => {
  it('responde 200 con status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('404', () => {
  it('responde 404 para rutas inexistentes', async () => {
    const res = await request(app).get('/api/ruta-inexistente');
    expect(res.status).toBe(404);
  });
});

describe('verificarToken', () => {
  it('401 sin header Authorization', async () => {
    const res = await request(app).get('/api/tramites/mis-tramites');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/token/i);
  });

  it('401 si el header no empieza con Bearer', async () => {
    const res = await request(app).get('/api/tramites/mis-tramites').set('Authorization', 'Basic xxx');
    expect(res.status).toBe(401);
  });

  it('401 con token inválido', async () => {
    mockAuthFail();
    const res = await request(app).get('/api/tramites/mis-tramites').set('Authorization', 'Bearer malo');
    expect(res.status).toBe(401);
  });
});

describe('verificarRol', () => {
  it('403 ciudadano intenta acceder a bandeja', async () => {
    mockAuth('ciudadano');
    const res = await request(app).get('/api/tramites/bandeja').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(403);
  });

  it('403 funcionario intenta ver métricas', async () => {
    mockAuth('funcionario');
    const res = await request(app).get('/api/tramites/metricas').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(403);
  });

  it('403 ciudadano intenta crear funcionario', async () => {
    mockAuth('ciudadano');
    const res = await request(app).post('/api/usuarios/funcionario').set('Authorization', 'Bearer tok').send({});
    expect(res.status).toBe(403);
  });
});

describe('POST /api/tramites — validaciones', () => {
  it('400 si falta tipo', async () => {
    mockAuth('ciudadano');
    const res = await request(app).post('/api/tramites').set('Authorization', 'Bearer tok')
      .send({ descripcion: 'Descripción suficientemente larga' });
    expect(res.status).toBe(400);
  });

  it('400 si tipo no está en la lista', async () => {
    mockAuth('ciudadano');
    const res = await request(app).post('/api/tramites').set('Authorization', 'Bearer tok')
      .send({ tipo: 'tipo_inventado', descripcion: 'Descripción válida larga' });
    expect(res.status).toBe(400);
  });

  it('403 si funcionario intenta crear trámite', async () => {
    mockAuth('funcionario');
    const res = await request(app).post('/api/tramites').set('Authorization', 'Bearer tok')
      .send({ tipo: 'licencia_comercial', descripcion: 'Test descripción larga suficiente' });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/tramites/:id/estado — validaciones', () => {
  it('400 si falta estado_nuevo', async () => {
    mockAuth('funcionario');
    const res = await request(app).patch('/api/tramites/id-123/estado').set('Authorization', 'Bearer tok').send({});
    expect(res.status).toBe(400);
  });

  it('403 si ciudadano intenta cambiar estado', async () => {
    mockAuth('ciudadano');
    const res = await request(app).patch('/api/tramites/id-123/estado').set('Authorization', 'Bearer tok')
      .send({ estado_nuevo: 'aprobado' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/documentos/:tramiteId', () => {
  it('400 si faltan campos requeridos', async () => {
    mockAuth('ciudadano');
    const res = await request(app).post('/api/documentos/tramite-123').set('Authorization', 'Bearer tok')
      .send({ nombre_archivo: 'doc.pdf' });
    expect(res.status).toBe(400);
  });

  it('400 si tipo MIME no está permitido', async () => {
    mockAuth('ciudadano');
    const res = await request(app).post('/api/documentos/tramite-123').set('Authorization', 'Bearer tok')
      .send({ nombre_archivo: 'virus.exe', url_storage: 'https://x.com/f', tipo_mime: 'application/exe', tamano_bytes: 100 });
    expect(res.status).toBe(400);
  });

  it('400 si archivo supera 10 MB', async () => {
    mockAuth('ciudadano');
    const res = await request(app).post('/api/documentos/tramite-123').set('Authorization', 'Bearer tok')
      .send({ nombre_archivo: 'grande.pdf', url_storage: 'https://x.com/f', tipo_mime: 'application/pdf', tamano_bytes: 11 * 1024 * 1024 });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/catastro', () => {
  it('401 sin token en buscar por finca', async () => {
    const res = await request(app).get('/api/catastro/F-001');
    expect(res.status).toBe(401);
  });

  it('401 sin token en /mapa', async () => {
    const res = await request(app).get('/api/catastro/mapa');
    expect(res.status).toBe(401);
  });

  it('403 ciudadano intenta editar ficha', async () => {
    mockAuth('ciudadano');
    const res = await request(app).patch('/api/catastro/id-123').set('Authorization', 'Bearer tok')
      .send({ propietario_nombre: 'Juan' });
    expect(res.status).toBe(403);
  });
});

describe('errorHandler', () => {
  it('500 cuando Supabase lanza excepción', async () => {
    supabase.auth.getUser.mockRejectedValueOnce(new Error('conexión perdida'));
    const res = await request(app).get('/api/tramites/mis-tramites').set('Authorization', 'Bearer tok');
    expect(res.status).toBe(500);
  });
});
