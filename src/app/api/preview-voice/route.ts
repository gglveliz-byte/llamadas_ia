import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const voice = url.searchParams.get("voice") || "Dipper";
  const lang = url.searchParams.get("lang") || "Español";
  const country = url.searchParams.get("country") || "México";
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "No API key" }, { status: 500 });
  }

  try {
    const audioBuffer = await new Promise<Buffer>((resolve, reject) => {
      // Use standard WebSocket available in Node 21+ / Next.js Edge
      const ws = new WebSocket(
        `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`
      );

      const audioChunks: Buffer[] = [];
      let timeoutId: NodeJS.Timeout;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            setup: {
              model: "models/gemini-3.1-flash-live-preview",
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
                },
              },
            },
          })
        );
        timeoutId = setTimeout(() => {
          ws.close();
          reject(new Error("Timeout waiting for Gemini audio"));
        }, 15000); // 15 seconds timeout
      };

      ws.onmessage = async (event) => {
        try {
          // Normalize event.data to string
          let dataStr = "";
          if (typeof event.data === "string") {
            dataStr = event.data;
          } else if (event.data instanceof Buffer) {
            dataStr = event.data.toString("utf8");
          } else if (event.data instanceof Blob) {
            dataStr = await event.data.text();
          } else {
            dataStr = event.data.toString();
          }

          const msg = JSON.parse(dataStr);

          // Si recibimos setupComplete, enviamos el mensaje del usuario
          if (msg.setupComplete) {
            ws.send(
              JSON.stringify({
                clientContent: {
                  turns: [
                    {
                      role: "user",
                      parts: [{ text: `Hola, por favor preséntate brevemente diciendo 'Hola, soy tu voz de IA llamada ${voice}'. Tienes que hablar obligatoriamente en el idioma ${lang} y con acento de ${country}. Es muy importante que tu acento y pronunciación suenen exactamente de ${country} y en idioma ${lang}.` }],
                    },
                  ],
                  turnComplete: true,
                },
              })
            );
          }

          if (msg.serverContent && msg.serverContent.modelTurn) {
            const parts = msg.serverContent.modelTurn.parts;
            for (const part of parts) {
              if (part.inlineData && part.inlineData.mimeType.startsWith("audio/")) {
                audioChunks.push(Buffer.from(part.inlineData.data, "base64"));
              }
            }
          }
          if (msg.serverContent && msg.serverContent.turnComplete) {
            clearTimeout(timeoutId);
            ws.close();
            resolve(Buffer.concat(audioChunks));
          }
        } catch (e) {
          console.error("Error parsing WS message", e);
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeoutId);
        reject(err);
      };
    });

    // Create WAV header for 24kHz, 16-bit, Mono PCM
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    
    const wavHeader = Buffer.alloc(44);
    wavHeader.write("RIFF", 0);
    wavHeader.writeUInt32LE(36 + audioBuffer.length, 4);
    wavHeader.write("WAVE", 8);
    wavHeader.write("fmt ", 12);
    wavHeader.writeUInt32LE(16, 16); // Subchunk1Size
    wavHeader.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    wavHeader.writeUInt16LE(numChannels, 22);
    wavHeader.writeUInt32LE(sampleRate, 24);
    wavHeader.writeUInt32LE(byteRate, 28);
    wavHeader.writeUInt16LE(blockAlign, 32);
    wavHeader.writeUInt16LE(bitsPerSample, 34);
    wavHeader.write("data", 36);
    wavHeader.writeUInt32LE(audioBuffer.length, 40);

    const wavBuffer = Buffer.concat([wavHeader, audioBuffer]);

    return new NextResponse(wavBuffer, {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Disposition": `inline; filename="${voice.toLowerCase()}.wav"`,
      },
    });
  } catch (error: any) {
    console.error("Error previewing voice:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
