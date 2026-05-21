// services/pdfService.js
// Genera PDFs oficiales y reportes Excel.

const PDFDocument = require('pdfkit');
const ExcelJS    = require('exceljs');

// Devuelve un Buffer con el PDF del documento oficial aprobado
const generarDocumentoOficial = (tramite) => {
  return new Promise((resolve, reject) => {
    const doc     = new PDFDocument({ margin: 60 });
    const buffers = [];

    doc.on('data',  chunk => buffers.push(chunk));
    doc.on('end',   ()    => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Encabezado
    doc.fontSize(16).font('Helvetica-Bold')
      .text('MUNICIPALIDAD DE GUATEMALA', { align: 'center' })
      .fontSize(13).text('DIRECCIÓN DE GESTIÓN MUNICIPAL', { align: 'center' })
      .moveDown(0.5)
      .fontSize(11).font('Helvetica')
      .text(`Ciudad de Guatemala, ${new Date().toLocaleDateString('es-GT', { dateStyle: 'long' })}`, { align: 'center' })
      .moveDown();

    // Línea separadora
    doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke().moveDown();

    // Título resolución
    doc.fontSize(14).font('Helvetica-Bold')
      .text('RESOLUCIÓN DE APROBACIÓN', { align: 'center' })
      .moveDown();

    // Cuerpo
    doc.fontSize(11).font('Helvetica')
      .text(`Expediente N°: ${tramite.numero_expediente}`, { continued: false })
      .text(`Tipo de trámite: ${tramite.tipo_tramite}`)
      .text(`Fecha de aprobación: ${new Date().toLocaleDateString('es-GT')}`)
      .moveDown()
      .text(
        'POR MEDIO DE LA PRESENTE RESOLUCIÓN, las autoridades competentes de la ' +
        'Municipalidad de Guatemala HACEN CONSTAR que el trámite detallado ha sido ' +
        'debidamente revisado, evaluado y APROBADO conforme la normativa municipal vigente.',
        { align: 'justify' }
      )
      .moveDown()
      .text(`Descripción del trámite:`)
      .text(tramite.descripcion || 'Sin descripción', { indent: 20 });

    // Firma
    doc.moveDown(3)
      .text('_________________________', { align: 'center' })
      .text('Firma y Sello Funcionario', { align: 'center' })
      .text('Dirección Municipal', { align: 'center' });

    doc.end();
  });
};

// Devuelve Buffer de Excel con la lista de trámites
const generarExcel = async (tramites) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator  = 'Sistema Trámites Municipales';
  workbook.created  = new Date();

  const sheet = workbook.addWorksheet('Trámites', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'Expediente',   key: 'numero_expediente', width: 22 },
    { header: 'Tipo',         key: 'tipo_tramite',       width: 28 },
    { header: 'Estado',       key: 'estado',             width: 16 },
    { header: 'Ciudadano ID', key: 'ciudadano_id',       width: 38 },
    { header: 'Descripción',  key: 'descripcion',        width: 45 },
    { header: 'Fecha',        key: 'created_at',         width: 22 },
  ];

  // Estilo de encabezado
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A56DB' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 20;

  tramites.forEach(t => {
    const row = sheet.addRow(t);
    // Color por estado
    const colores = { aprobado: 'FFD1FAE5', rechazado: 'FFFEE2E2', pendiente: 'FFFEF3C7', en_revision: 'FFE0F2FE' };
    const color = colores[t.estado] || 'FFFFFFFF';
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  });

  return workbook.xlsx.writeBuffer();
};

// Devuelve Buffer de PDF con reporte de múltiples trámites
const generarReportePDF = (tramites) => {
  return new Promise((resolve, reject) => {
    const doc     = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on('data',  chunk => buffers.push(chunk));
    doc.on('end',   ()    => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(16).font('Helvetica-Bold')
      .text('REPORTE DE TRÁMITES MUNICIPALES', { align: 'center' });
    doc.fontSize(10).font('Helvetica')
      .text(`Generado: ${new Date().toLocaleString('es-GT')} | Total: ${tramites.length}`, { align: 'center' });
    doc.moveDown().moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown();

    tramites.forEach((t, i) => {
      if (doc.y > 700) doc.addPage(); // Nueva página si se acabó el espacio
      doc.fontSize(10).font('Helvetica-Bold')
        .text(`${i + 1}. ${t.numero_expediente}`, { continued: true })
        .font('Helvetica').text(`  —  ${t.tipo_tramite}`);
      doc.fontSize(9)
        .text(`   Estado: ${t.estado}   |   Fecha: ${t.created_at?.split('T')[0] || ''}`, { color: '#666' })
        .moveDown(0.3);
    });

    doc.end();
  });
};

module.exports = { generarDocumentoOficial, generarExcel, generarReportePDF };
