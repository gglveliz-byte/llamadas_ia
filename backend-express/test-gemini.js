const WebSocket = require('ws');
require('dotenv').config();

const MODELO = "models/gemini-2.0-flash-exp";
const apiKey = process.env.GEMINI_API_KEY;
const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('Connected to Gemini');
  const setupMsg = {
    setup: {
      model: MODELO,
      generationConfig: {
        responseModalities: ["AUDIO", "TEXT"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Dipper" } }
        }
      },
      systemInstruction: { parts: [{ text: "Hello" }] },
    }
  };
  ws.send(JSON.stringify(setupMsg));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
});

ws.on('close', (code, reason) => {
  console.log('Connection closed', code, reason.toString());
});

ws.on('error', (err) => {
  console.error('Error:', err);
});
