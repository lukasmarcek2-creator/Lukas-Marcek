import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

// Initialize the official Gemini SDK client with our process.env.GEMINI_API_KEY
// and telemetric User-Agent header for AI Studio
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Custom CORS middleware to support seamless Flutter/mobile emulator testing on port 3000
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Enable JSON request bodies with an increased file limit for high-res captured images
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API endpoint for coffee shop mission verification using Gemini 3.5-flash
  app.post("/verify-mission", async (req, res) => {
    try {
      const { imageBase64, cafeName } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ 
          approved: false, 
          reason: "Chýba fotka pre overenie." 
        });
      }

      // Regex matches base64 data URIs e.g. "data:image/jpeg;base64,...."
      const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      
      let mimeType = "image/jpeg";
      let cleanBase64 = imageBase64;

      if (match) {
        mimeType = match[1];
        cleanBase64 = match[2];
      }

      console.log(`Starting mission verification for: ${cafeName || 'neznámu kaviareň'} (mime: ${mimeType})`);

      const textPart = {
        text: `Overte, či táto zaslaná fotografia zobrazuje návštevu, interiér, kávu, zákusok alebo nákup v kaviarni/cukrárni s názvom "${cafeName || 'kaviareň'}". Rozhodnite, či je fotografia autentická. Odpovedzte v slovenskom jazyku.`
      };

      const imagePart = {
        inlineData: {
          mimeType,
          data: cleanBase64
        }
      };

      // Call Gemini 3.5-flash with Structured Output schema constraints
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              approved: {
                type: Type.BOOLEAN,
                description: "True ak fotka autenticky dokazuje návštevu alebo nákup v danej kaviarni, inak False."
              },
              reason: {
                type: Type.STRING,
                description: "Stručné slovenské odôvodnenie rozhodnutia pre používateľa (max 2 vety)."
              }
            },
            required: ["approved", "reason"]
          }
        }
      });

      const responseText = response.text || "{}";
      const result = JSON.parse(responseText.trim());

      console.log("Verification result from Gemini:", result);
      return res.json(result);

    } catch (error: any) {
      console.error("Chyba počas overovania misie s Gemini:", error);
      return res.status(500).json({
        approved: false,
        reason: `Overenie zlyhalo kvôli chybe servera: ${error?.message || error}`
      });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development vs static asset serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Full-stack Server] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
