const fs = require('fs');
const WS = require('ws');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
if(!apiKey) { console.error('No api key'); process.exit(1); }

const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
const ws = new WS(wsUrl);

ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({
    setup: {
      model: 'models/gemini-3.1-flash-live-preview',
      generationConfig: { responseModalities: ['AUDIO'] }
    }
  }));
});

let audioChunks = [];
ws.on('message', (data) => {
  let msg;
  try {
    msg = JSON.parse(data.toString());
  } catch(e) {
    return;
  }
  if(msg.setupComplete) {
    console.log('Setup complete');
    ws.send(JSON.stringify({
      clientContent: { turns: [{ role: 'user', parts: [{ text: 'Di hola y cuenta hasta 3' }] }], turnComplete: true }
    }));
  }
  if(msg.serverContent && msg.serverContent.modelTurn) {
    for(const part of msg.serverContent.modelTurn.parts) {
      if(part.inlineData && part.inlineData.mimeType) {
        console.log('Received audio part:', part.inlineData.mimeType, 'length:', part.inlineData.data.length);
        audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
      }
    }
  }
  if(msg.serverContent && msg.serverContent.turnComplete) {
    console.log('Turn complete');
    const totalBytes = Buffer.concat(audioChunks).length;
    console.log('Total bytes:', totalBytes);
    process.exit(0);
  }
});
