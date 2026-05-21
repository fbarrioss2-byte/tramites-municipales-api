// controllers/tramitesController.js
// Nombres de columnas alineados con la BD real del proyecto:
//   tipo, solicitante_id, asignado_a, creado_en, resuelto_en

const { validationResult } = require('express-validator');
const { getSupabaseUser }   = require('../supabaseClient');
const { crearError }        = require('../middlewares/errorHandler');
const notificaciones        = require('../services/notificaciones');
const pdfService            = require('../services/pdfService');

// Genera TRM-2026-XXXXX contando trámites del año en curso
const generarNumeroExpediente = async (db) => {
  const anio = new Date().getFullYear();
  const { count } = await db
    .from('tramites')
    .select('*', { count: 'exact', head: true })
    .gte('creado_en', `${anio}-01-01T00:00:00.000Z`)
    .lt('creado_en',  `${anio + 1}-01-01T00:00:00.000Z`);
  return `TRM-${anio}-${String((count || 0) + 1).padStart(5, '0')}`;
};

// POST /api/tramites — ciudadano crea trámite
const crearTramite = async (req, res, next) => {
  try {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
      return res.status(400).json({ error: 'Datos inválidos', campos: errores.array() });
    }

    const db = getSupabaseUser(req);
    const { tipo, descripcion, datos_formulario } = req.body;

    const numeroExpediente = await generarNumeroExpediente(db);

    const { data: tramite, error } = await db
      .from('tramites')
      .insert({
        numero_expediente: numeroExpediente,
        tipo,
        descripcion,
        datos_formulario: datos_formulario || {},
        solicitante_id:   req.usuario.id,
        estado:           'pendiente',
        creado_en:        new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw crearError(500, `Error al crear trámite: ${error.message}`);

    // Primer registro en historial
    await db.from('historial_tramites').insert({
      tramite_id:      tramite.id,
      usuario_id:      req.usuario.id,
      accion:          'creacion',
      estado_anterior: null,
      estado_nuevo:    'pendiente',
      observaciones:   'Trámite ingresado al sistema',
      registrado_en:   new Date().toISOString(),
    });

    await notificaciones.enviarCambioEstado({
      emailDestino:     req.usuario.email,
      numeroExpediente,
      estadoNuevo:      'pendiente',
      comentario:       'Tu trámite fue recibido correctamente.',
    });

    res.status(201).json({ mensaje: 'Trámite creado exitosamente', tramite });
  } catch (err) {
    next(err);
  }
};

// GET /api/tramites/mis-tramites — trámites del ciudadano autenticado
const misTramites = async (req, res, next) => {
  try {
    const db      = getSupabaseUser(req);
    const pagina  = Math.max(1, parseInt(req.query.pagina)    || 1);
    const porPag  = Math.min(50, parseInt(req.query.porPagina) || 10);
    const desde   = (pagina - 1) * porPag;

    const { data: tramites, error, count } = await db
      .from('tramites')
      .select('*', { count: 'exact' })
      .eq('solicitante_id', req.usuario.id)
      .order('creado_en', { ascending: false })
      .range(desde, desde + porPag - 1);

    if (error) throw crearError(500, error.message);

    res.json({
      tramites,
      paginacion: { total: count, pagina, porPagina: porPag, totalPaginas: Math.ceil(count / porPag) },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/tramites/:id — detalle con historial
const detalleTramite = async (req, res, next) => {
  try {
    const db     = getSupabaseUser(req);
    const { id } = req.params;

    const { data: tramite, error } = await db
      .from('tramites')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !tramite) throw crearError(404, 'Trámite no encontrado');

    // Ciudadano solo ve sus propios trámites
    if (req.usuario.rol === 'ciudadano' && tramite.solicitante_id !== req.usuario.id) {
      throw crearError(403, 'No tienes permiso para ver este trámite');
    }

    const { data: historial } = await db
      .from('historial_tramites')
      .select('*')
      .eq('tramite_id', id)
      .order('registrado_en', { ascending: true });

    res.json({ tramite, historial: historial || [] });
  } catch (err) {
    next(err);
  }
};

// GET /api/tramites/bandeja — expedientes del funcionario
const bandeja = async (req, res, next) => {
  try {
    const db = getSupabaseUser(req);
    const { estado, tipo } = req.query;

    let query = db
      .from('tramites')
      .select('*')
      .eq('asignado_a', req.usuario.id)
      .order('creado_en', { ascending: false });

    if (estado) query = query.eq('estado', estado);
    if (tipo)   query = query.eq('tipo', tipo);

    const { data: tramites, error } = await query;
    if (error) throw crearError(500, error.message);

    res.json({ tramites: tramites || [] });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/tramites/:id/estado — cambiar estado
const cambiarEstado = async (req, res, next) => {
  try {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
      return res.status(400).json({ error: 'Datos inválidos', campos: errores.array() });
    }

    const db                           = getSupabaseUser(req);
    const { id }                       = req.params;
    const { estado_nuevo, observaciones } = req.body;

    const ESTADOS_VALIDOS = ['en_revision', 'aprobado', 'rechazado', 'trasladado'];
    if (!ESTADOS_VALIDOS.includes(estado_nuevo)) {
      throw crearError(400, `Estado inválido. Opciones: ${ESTADOS_VALIDOS.join(', ')}`);
    }

    const { data: tramiteActual, error: errBuscar } = await db
      .from('tramites')
      .select('*')
      .eq('id', id)
      .single();

    if (errBuscar || !tramiteActual) throw crearError(404, 'Trámite no encontrado');

    const actualizacion = {
      estado:     estado_nuevo,
      asignado_a: req.usuario.id,
    };
    if (estado_nuevo === 'aprobado' || estado_nuevo === 'rechazado') {
      actualizacion.resuelto_en = new Date().toISOString();
    }

    const { data: tramiteActualizado, error: errUpdate } = await db
      .from('tramites')
      .update(actualizacion)
      .eq('id', id)
      .select()
      .single();

    if (errUpdate) throw crearError(500, errUpdate.message);

    // Registrar en historial
    await db.from('historial_tramites').insert({
      tramite_id:      id,
      usuario_id:      req.usuario.id,
      accion:          estado_nuevo,
      estado_anterior: tramiteActual.estado,
      estado_nuevo,
      observaciones:   observaciones || '',
      registrado_en:   new Date().toISOString(),
    });

    // Generar PDF oficial si se aprueba
    if (estado_nuevo === 'aprobado') {
      await pdfService.generarDocumentoOficial(tramiteActualizado);
    }

    // Notificar al solicitante
    const { data: solicitante } = await db
      .from('usuarios')
      .select('correo')
      .eq('id', tramiteActual.solicitante_id)
      .single();

    if (solicitante?.correo) {
      await notificaciones.enviarCambioEstado({
        emailDestino:     solicitante.correo,
        numeroExpediente: tramiteActual.numero_expediente,
        estadoNuevo:      estado_nuevo,
        comentario:       observaciones,
      });
    }

    res.json({
      mensaje: `Estado actualizado: ${tramiteActual.estado} → ${estado_nuevo}`,
      tramite: tramiteActualizado,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/tramites/metricas — KPIs para jefe/admin
const metricas = async (req, res, next) => {
  try {
    const db = getSupabaseUser(req);

    const [
      { count: total },
      { count: pendientes },
      { count: aprobados },
      { count: rechazados },
      { count: en_revision },
    ] = await Promise.all([
      db.from('tramites').select('*', { count: 'exact', head: true }),
      db.from('tramites').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      db.from('tramites').select('*', { count: 'exact', head: true }).eq('estado', 'aprobado'),
      db.from('tramites').select('*', { count: 'exact', head: true }).eq('estado', 'rechazado'),
      db.from('tramites').select('*', { count: 'exact', head: true }).eq('estado', 'en_revision'),
    ]);

    res.json({
      metricas: {
        total, pendientes, en_revision, aprobados, rechazados,
        tasa_aprobacion: total > 0 ? `${((aprobados / total) * 100).toFixed(1)}%` : '0%',
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/tramites/exportar — descarga Excel o PDF
const exportar = async (req, res, next) => {
  try {
    const db = getSupabaseUser(req);
    const { formato = 'excel', estado, desde, hasta } = req.query;

    let query = db.from('tramites').select('*').order('creado_en', { ascending: false });
    if (estado) query = query.eq('estado', estado);
    if (desde)  query = query.gte('creado_en', desde);
    if (hasta)  query = query.lte('creado_en', hasta);

    const { data: tramites, error } = await query;
    if (error) throw crearError(500, error.message);

    if (formato === 'excel') {
      const buffer = await pdfService.generarExcel(tramites);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=reporte-tramites.xlsx');
      return res.send(buffer);
    }

    const buffer = await pdfService.generarReportePDF(tramites);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte-tramites.pdf');
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
};

module.exports = { crearTramite, misTramites, detalleTramite, bandeja, cambiarEstado, metricas, exportar };
