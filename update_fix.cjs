const fs = require('fs');

// 1. FIX SERVER.TS
let serverCode = fs.readFileSync('server.ts', 'utf8');

const oldServerOcrStart = `      const { fileData, mimeType } = req.body;
      if (!fileData || !mimeType) {
        return res.status(400).json({ error: "Faltan datos de archivo o tipo mime del documento." });
      }

      // Remove base64 prefix if needed, Tesseract can accept buffers or data URIs`;

const newServerOcrStart = `      const { fileData, mimeType } = req.body;
      if (!fileData || !mimeType) {
        return res.status(400).json({ error: "Faltan datos de archivo o tipo mime del documento." });
      }

      // Tesseract.js does not support PDFs. We skip OCR to prevent server crashes.
      if (mimeType === "application/pdf" || fileData.includes("application/pdf")) {
        console.log("Archivo PDF detectado. Omitiendo OCR local para evitar fallos de Tesseract.");
        return res.json({ success: true, data: { rut: "", vendorName: "Archivo PDF", date: "", totalAmount: 0 } });
      }

      // Remove base64 prefix if needed, Tesseract can accept buffers or data URIs`;

serverCode = serverCode.replace(oldServerOcrStart, newServerOcrStart);
fs.writeFileSync('server.ts', serverCode);
console.log('server.ts updated');

// 2. FIX APP.TSX
let appCode = fs.readFileSync('src/App.tsx', 'utf8');

const oldFetchLogic = `      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData: base64String, mimeType })
      });

      const resData = await response.json();`;

const newFetchLogic = `      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData: base64String, mimeType })
      });

      const resText = await response.text();
      if (!response.ok) {
        throw new Error(resText || \`Error HTTP \${response.status}\`);
      }
      
      let resData;
      try {
        resData = JSON.parse(resText);
      } catch (e) {
        throw new Error("El servidor devolvió una respuesta no válida o vacía.");
      }`;

appCode = appCode.replace(oldFetchLogic, newFetchLogic);

fs.writeFileSync('src/App.tsx', appCode);
console.log('App.tsx updated');
