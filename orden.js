// api/orden.js — Vercel Serverless Function
// Recibe la orden del formulario y la crea en Notion sin problemas de CORS

const https = require('https');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DB_ID = process.env.NOTION_DB_ID;

const DOCTORES = {
  'dr cestero':                      '34d37f045c51815e9200dba7c922b3e1',
  'dra. andrea chavez':              '34d37f045c518193944fd3947099b125',
  'dra andrea chavez':               '34d37f045c518193944fd3947099b125',
  'dr. carlos escalante':            '34d37f045c518103b0f1cc0d77bf8bad',
  'dr carlos escalante':             '34d37f045c518103b0f1cc0d77bf8bad',
  'dr. luis grallar':                '34d37f045c5181909b1def6a9d852907',
  'dr luis grallar':                 '34d37f045c5181909b1def6a9d852907',
  'dr sergio vargas':                '34d37f045c5181bfae93fee885ce80c3',
  'dr. guillermo arcadio gutierrez': '34d37f045c518121b4a8f6e2940ea82a',
  'tpd ismar carolina acevedo':      '34d37f045c518187ba1acea79eb31f71',
  'tpd. maria laura calderon':       '34d37f045c5181f3af90cb95308eecfa',
  'dr. alberto':                     '34d37f045c51813287d5e981576c6f6b',
  'dra. isabella chiriboga':         '34d37f045c518123ab98e565e980bd37',
  'dra monserrat rosas':             '34d37f045c5181ac985cf8676238dd35'
};

function findDoctorId(nombre) {
  const key = nombre.toLowerCase().trim();
  if (DOCTORES[key]) return DOCTORES[key];
  for (const k in DOCTORES) {
    if (key.includes(k) || k.includes(key)) return DOCTORES[k];
  }
  return null;
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const data = req.body;

    // Validación básica
    if (!data.doctor || !data.paciente || !data.tipo) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const nombre   = `${data.paciente} — ${data.tipo}`;
    const fecha    = data.fechaEntrega || new Date().toISOString().split('T')[0];
    const unidades = data.piezas ? data.piezas.split(',').length : 1;

    // Construir notas
    const notas = [];
    if (data.clinica)        notas.push(`Clínica: ${data.clinica}`);
    if (data.telefono)       notas.push(`Tel: ${data.telefono}`);
    if (data.email)          notas.push(`Email: ${data.email}`);
    if (data.edad)           notas.push(`Edad: ${data.edad}`);
    if (data.arcada)         notas.push(`Arcada: ${data.arcada}`);
    if (data.piezas)         notas.push(`Piezas FDI: ${data.piezas}`);
    if (data.shade)          notas.push(`Shade: ${data.shade}`);
    if (data.impMarca)       notas.push(`Implante: ${data.impMarca}`);
    if (data.impConexion)    notas.push(`Conexión: ${data.impConexion}`);
    if (data.impDiametro)    notas.push(`Diámetro: ${data.impDiametro}`);
    if (data.impRetencion)   notas.push(`Retención: ${data.impRetencion}`);
    if (data.archivos)       notas.push(`Archivos: ${data.archivos}`);
    if (data.notas)          notas.push(data.notas);

    const props = {
      'Nombre':     { title:     [{ text: { content: nombre } }] },
      'Paciente':   { rich_text: [{ text: { content: data.paciente } }] },
      'Estado':     { status:    { name: 'Ingresado' } },
      'Fecha':      { date:      { start: fecha } },
      '# Unidades': { number: unidades }
    };

    if (data.material)      props['Material']         = { select: { name: data.material } };
    if (data.tipo)          props['Tipo de trabajo']  = { select: { name: data.tipo } };
    if (data.fechaEntrega)  props['Fecha de entrega'] = { date:   { start: data.fechaEntrega } };
    if (notas.length)       props['Notas']            = { rich_text: [{ text: { content: notas.join(' | ').substring(0, 2000) } }] };

    const doctorId = findDoctorId(data.doctor);
    if (doctorId) props['💽 Clientes'] = { relation: [{ id: doctorId }] };

    // Llamada a Notion via https nativo
    const notionBody = JSON.stringify({ parent: { database_id: NOTION_DB_ID }, properties: props });

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.notion.com',
        path: '/v1/pages',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
          'Content-Length': Buffer.byteLength(notionBody)
        }
      };
      const req2 = https.request(options, (res2) => {
        let data = '';
        res2.on('data', chunk => data += chunk);
        res2.on('end', () => resolve({ status: res2.statusCode, body: data }));
      });
      req2.on('error', reject);
      req2.write(notionBody);
      req2.end();
    });

    if (result.status !== 200) {
      const err = JSON.parse(result.body);
      console.error('Notion error:', err);
      return res.status(500).json({ error: err.message || 'Error al crear en Notion' });
    }

    const created = JSON.parse(result.body);
    return res.status(200).json({ ok: true, id: created.id });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
