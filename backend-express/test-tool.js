const WebSocket = require('ws');
require('dotenv').config({path: '../.env'});

const MODELO = "models/gemini-3.1-flash-live-preview";
const apiKey = process.env.GEMINI_API_KEY;
const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  const setupMsg = {
    setup: {
      model: MODELO,
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Dipper" } } }
      },
      systemInstruction: { parts: [{ text: "You are a helpful AI. If asked to save, ALWAYS call guardar_contexto." }] },
      tools: [{ functionDeclarations: [{
        name: "guardar_contexto",
        description: "Guarda el contexto.",
        parameters: { type: "OBJECT", properties: { data: { type: "STRING" } } }
      }] }]
    }
  };
  ws.send(JSON.stringify(setupMsg));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('Received type:', Object.keys(msg)[0]);
  if (msg.setupComplete) {
    ws.send(JSON.stringify({
      clientContent: {
        turns: [{ role: "user", parts: [{ text: "Please save the context now." }] }],
        turnComplete: true
      }
    }));
  }
  if (msg.serverContent && msg.serverContent.modelTurn) {
    console.log(JSON.stringify(msg.serverContent.modelTurn, null, 2));
  }
});
