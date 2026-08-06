/**
 * Prueba de sesiones duplicadas: al conectar una segunda sesión del mismo
 * usuario, el servidor debe cerrar la primera (evita "dos bots").
 * PASS si el WS A recibe close tras conectar B.
 */
const WebSocket = require('ws');

const USER_ID = process.env.TEST_USER_ID || '5fff2c02-d7bb-42a8-a255-048e0de4088b';
const URL_WS = `ws://localhost:3001/stream/sim?user_id=${USER_ID}&token=dev`;

const a = new WebSocket(URL_WS);
let bAbierto = false;

a.on('open', () => a.send(JSON.stringify({ tipo: 'iniciar' })));

a.on('message', (data) => {
  let m;
  try { m = JSON.parse(data.toString()); } catch { return; }
  if (m.tipo === 'listo' && !bAbierto) {
    bAbierto = true;
    console.log('[test] A listo; abriendo sesión B del mismo usuario');
    const b = new WebSocket(URL_WS);
    b.on('open', () => b.send(JSON.stringify({ tipo: 'iniciar' })));
    b.on('close', () => console.log('[test] (B cerrado)'));
  }
});

a.on('close', () => {
  console.log('[test] PASS: sesión A cerrada automáticamente al conectar B');
  process.exit(0);
});

a.on('error', (e) => {
  console.error('[test] FAIL: error en A:', e.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('[test] FAIL: A no fue cerrada tras conectar B');
  process.exit(1);
}, 25000);
