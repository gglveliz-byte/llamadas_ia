/**
 * Prueba de ciclo de vida del simulador:
 * 1. Conecta a /stream/sim y envía "iniciar" -> espera "listo".
 * 2. Envía audio (silencio) continuamente, incluso después de "detener"
 *    (simula el mic fugado que antes cancelaba el cierre).
 * 3. PASS si el servidor cierra el WS en <= 30s tras "detener".
 */
const WebSocket = require('ws');

const USER_ID = process.env.TEST_USER_ID || '5fff2c02-d7bb-42a8-a255-048e0de4088b';
const URL_WS = `ws://localhost:3001/stream/sim?user_id=${USER_ID}&token=dev`;

const silencio = Buffer.alloc(3200).toString('base64'); // 1600 muestras Int16 = 100ms @16kHz
let listo = false;
let detenerEnviado = false;
let cerrado = false;

const ws = new WebSocket(URL_WS);

ws.on('open', () => {
  console.log('[test] conectado, enviando iniciar');
  ws.send(JSON.stringify({ tipo: 'iniciar' }));
});

ws.on('message', (data) => {
  let msg;
  try { msg = JSON.parse(data.toString()); } catch { return; }
  if (msg.tipo === 'listo' && !listo) {
    listo = true;
    clearTimeout(timerGlobal);
    console.log('[test] listo recibido');
    setTimeout(() => {
      console.log('[test] enviando detener (el audio seguirá fluyendo como mic fugado)');
      detenerEnviado = true;
      ws.send(JSON.stringify({ tipo: 'detener' }));
      setTimeout(() => fail('el servidor NO cerró la sesión en 30s tras detener'), 30000).unref();
    }, 2000);
  } else if (msg.tipo === 'texto') {
    console.log('[test] texto:', msg.texto.slice(0, 80));
  } else if (msg.tipo === 'estado') {
    console.log('[test] estado:', msg.estado);
  }
});

// Audio constante (incluso tras detener) para probar que el cierre no se cancela
const envioAudio = setInterval(() => {
  if (ws.readyState === WebSocket.OPEN && listo) {
    ws.send(JSON.stringify({ tipo: 'audio', base64: silencio, mimeType: 'audio/pcm;rate=16000' }));
  }
}, 100);

ws.on('close', () => {
  cerrado = true;
  clearInterval(envioAudio);
  if (detenerEnviado) {
    console.log('[test] PASS: servidor cerró la sesión tras detener');
    process.exit(0);
  } else {
    fail('WS cerrado antes de tiempo (sin detener)');
  }
});

ws.on('error', (err) => {
  fail('error de conexión: ' + err.message);
});

function fail(motivo) {
  if (cerrado) return;
  console.error('[test] FAIL:', motivo);
  process.exit(1);
}

const timerGlobal = setTimeout(() => fail('timeout global: nunca llegó "listo"'), 20000);
timerGlobal.unref();
