const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3001/stream/telnyx?userId=5fff2c02-d7bb-42a8-a255-048e0de4088b');

ws.on('open', () => {
  console.log('Connected to backend');
  ws.send(JSON.stringify({ tipo: "iniciar" }));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
});

ws.on('close', () => {
  console.log('Connection closed');
});

ws.on('error', (err) => {
  console.error('Error:', err);
});
