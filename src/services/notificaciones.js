// services/notificaciones.js
// Envío de correos con Nodemailer. En desarrollo solo loguea, no envía.

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const MENSAJES = {
  pendiente:   'Tu trámite fue recibido y está en cola de revisión.',
  en_revision: 'Un funcionario está revisando tu expediente.',
  aprobado:    '¡Tu trámite fue APROBADO! Puedes recoger tu documentación en ventanilla.',
  rechazado:   'Tu trámite fue rechazado. Revisa el comentario adjunto.',
  trasladado:  'Tu trámite fue trasladado a otro departamento para su atención.',
};

const enviarCambioEstado = async ({ emailDestino, numeroExpediente, estadoNuevo, comentario }) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[EMAIL] → ${emailDestino} | ${numeroExpediente} → ${estadoNuevo}`);
    return { simulado: true };
  }

  return transporter.sendMail({
    from:    `"Municipalidad" <${process.env.SMTP_USER}>`,
    to:      emailDestino,
    subject: `Actualización de trámite ${numeroExpediente}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a56db">Actualización de tu trámite</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px;font-weight:bold">Expediente:</td><td>${numeroExpediente}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Estado:</td>
              <td><span style="color:#fff;background:#1a56db;padding:3px 10px;border-radius:4px">
                ${estadoNuevo.toUpperCase()}</span></td></tr>
        </table>
        <p>${MENSAJES[estadoNuevo] || ''}</p>
        ${comentario ? `<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555">
          <strong>Comentario:</strong> ${comentario}</blockquote>` : ''}
        <hr style="border:none;border-top:1px solid #eee">
        <small style="color:#999">Sistema de Gestión de Trámites — Municipalidad</small>
      </div>
    `,
  });
};

module.exports = { enviarCambioEstado };
