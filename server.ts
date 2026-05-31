import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Tesseract from "tesseract.js";
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

  // API - OCR Receipts parser with Gemini
  app.post("/api/ocr", async (req, res) => {
    try {
      const { fileData, mimeType } = req.body;
      if (!fileData || !mimeType) {
        return res.status(400).json({ error: "Faltan datos de archivo o tipo mime del documento." });
      }

      // Tesseract.js does not support PDFs. We skip OCR to prevent server crashes.
      if (mimeType === "application/pdf" || fileData.includes("application/pdf")) {
        console.log("Archivo PDF detectado. Omitiendo OCR local para evitar fallos de Tesseract.");
        return res.json({ success: true, data: { rut: "", vendorName: "Archivo PDF", date: "", totalAmount: 0 } });
      }

      // Remove base64 prefix if needed, Tesseract can accept buffers or data URIs
      let base64Data = fileData;
      if (fileData.includes(";base64,")) {
        base64Data = fileData.split(";base64,").pop() || fileData;
      }
      const imageBuffer = Buffer.from(base64Data, "base64");

      // Extract text using Tesseract
      console.log("Iniciando escaneo local con Tesseract...");
      const { data: { text } } = await Tesseract.recognize(imageBuffer, 'spa');
      console.log("Texto extraído:", text);

      // Parse text with regex
      // RUT: Look for typical format XX.XXX.XXX-X or XXXXXXXX-X
      const rutMatch = text.match(/\b(\d{1,2}\.?\d{3}\.?\d{3}[-‐‑][0-9kK])\b/i);
      const rut = rutMatch ? rutMatch[1].toUpperCase() : "";

      // Date: Look for DD/MM/YYYY or DD-MM-YYYY
      const dateMatch = text.match(/\b(\d{2}[-/]\d{2}[-/]\d{4})\b/);
      let date = "";
      if (dateMatch) {
        // Convert to YYYY-MM-DD if possible
        const parts = dateMatch[1].split(/[-/]/);
        if (parts.length === 3) {
          date = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      // Total: Look for TOTAL or similar keyword and grab the number
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let totalAmount = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toUpperCase();
        if (line.includes("TOTAL") || line.includes("MONTO")) {
          // Extract numbers from this line
          const numbers = line.match(/(\d[\d\.\,]*)/g);
          if (numbers && numbers.length > 0) {
            // Pick the last number on the line, strip non-digits
            const lastNum = numbers[numbers.length - 1].replace(/[^\d]/g, '');
            if (lastNum) {
              totalAmount = parseInt(lastNum, 10);
            }
          }
        }
      }

      // Vendor Name: Heuristic -> Use the first line that looks like a name (not a date/number)
      let vendorName = "Desconocido";
      if (lines.length > 0) {
        vendorName = lines[0]; // Simplest heuristic: first line is the vendor
      }

      const cleanJson = {
        rut,
        vendorName,
        date,
        totalAmount
      };

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
