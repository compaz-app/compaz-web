// Ensayo de Luis · entrega el enlace y la contraseña dentro de la base privada "Compaz Pruebas"
// (nunca en los registros públicos de GitHub). Solo escribe en la base de pruebas.
const { AIRTABLE_API_KEY: KEY, AIRTABLE_BASE_ID: BASE, ENSAYO_URL: URL, ENSAYO_CLAVE: CLAVE, ENSAYO_HASTA: HASTA } = process.env
if (!KEY || !BASE || !URL || !CLAVE) throw new Error('faltan variables del ensayo')
if (BASE === 'appd3xCmNZEIJ0rWS') throw new Error('ABORTADO: es la base de producción')
const res = await fetch(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(process.env.AIRTABLE_TABLE_NAME ?? 'Lista de Espera')}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ records: [{ fields: {
    Nombre: 'ENLACE DEL ENSAYO',
    Contacto: `${URL} · usuario: luis · contraseña: ${CLAVE}`,
    Ciudad: `Abierto hasta las ${HASTA} (hora de Nueva York). Solo datos inventados.`,
  } }] }),
})
if (!res.ok) throw new Error(`Airtable respondió ${res.status}`)
console.log('enlace entregado en Compaz Pruebas')
