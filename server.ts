import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load local environment variables if available
dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  const app = express();

  // Configure limit of payload to handle image or pdf receipts uploads gracefully
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // API - Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API - OCR Receipts parser with Gemini 1.5 Flash
  app.post("/api/ocr", async (req, res) => {
    try {
      const { fileData, mimeType } = req.body;
      if (!fileData || !mimeType) {
        return res.status(400).json({ error: "Faltan datos de archivo o tipo mime del documento." });
      }

      // Check for Gemini API Key
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ 
          error: "API Key de Gemini no configurada en el servidor. Configure GEMINI_API_KEY en las variables de entorno." 
        });
      }

      // Extract raw base64 and accurate mime type
      let base64Data = fileData;
      let finalMime = mimeType;
      if (fileData.includes(";base64,")) {
        const parts = fileData.split(";base64,");
        finalMime = parts[0].split(":")[1];
        base64Data = parts[1];
      }

      console.log("Iniciando escaneo con Google Gemini 2.5 Flash...");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const prompt = `Analiza esta imagen o documento de un recibo o boleta de Chile. 
      Extrae la siguiente información y devuélvela ESTRICTAMENTE en formato JSON:
      - rut: RUT del emisor (formato XXXXXXXX-X). Si no lo encuentras, devuelve string vacío.
      - vendorName: Nombre exacto de la tienda o comercio emisor. Si no lo encuentras, "Desconocido".
      - date: Fecha de emisión en formato YYYY-MM-DD. Si no la encuentras, string vacío.
      - totalAmount: Monto total final a pagar (número entero). Si no lo encuentras, 0.
      
      No incluyas explicaciones, solo el bloque JSON válido.`;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          prompt,
          {
            inlineData: {
              data: base64Data,
              mimeType: finalMime
            }
          }
        ],
        config: {
          responseMimeType: "application/json",
        }
      });

      const responseText = aiResponse.text;
      console.log("Respuesta de Gemini:", responseText);
      
      let cleanJson;
      try {
        cleanJson = JSON.parse(responseText);
      } catch (parseErr) {
        // Fallback robust parsing in case the model wraps it in markdown blocks
        const match = responseText.match(/\\{.*\\}/s);
        if (match) {
          cleanJson = JSON.parse(match[0]);
        } else {
          throw new Error("El modelo no devolvió un JSON válido.");
        }
      }

      res.json({ success: true, data: cleanJson });
    } catch (err: any) {
      console.error("Error en servicio OCR:", err);
      res.status(500).json({ error: err.message || "Error desconocido en el OCR de Gemini." });
    }
  });

  // Setup of Vite Development Server or Production Static Bundles
  if (process.env.NODE_ENV !== "production") {
    console.log("Iniciando Vite en modo de desarrollo integrado...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Sirviendo archivos de producción estáticos de la carpeta dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor full-stack en ejecución en http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Error al iniciar el servidor:", error);
});
