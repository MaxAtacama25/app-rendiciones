const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add JSZip import
code = code.replace(
  'import { PieChart',
  'import JSZip from "jszip";\nimport { PieChart'
);

// 2. Add isExportingZip state
code = code.replace(
  'const [isOCRProcessing, setIsOCRProcessing] = useState<boolean>(false);',
  'const [isOCRProcessing, setIsOCRProcessing] = useState<boolean>(false);\n  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);'
);

// 3. Add exportToZip function below exportToCSV
const exportCSVLogic = `  const exportToCSV = () => {
    if (finalBuscadorList.length === 0) return;
    const headers = ["ID", "Usuario", "Email", "Categoría", "RUT Emisor", "Comercio", "Fecha", "Monto CLP", "Estado", "Motivo Rechazo"];
    const rows = finalBuscadorList.map(e => [
      e.id,
      e.userName,
      e.userEmail,
      e.category,
      e.rut,
      e.vendorName,
      e.date,
      e.totalAmount.toString(),
      e.status,
      e.rejectionReason || ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\\n" 
      + rows.map(e => e.join(",")).join("\\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", \`Rendicion_Gastos_Desde_\${startDateFilter || "all"}.csv\`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };`;

const exportZipLogic = `
  const exportToZip = async () => {
    if (finalBuscadorList.length === 0) return;
    setIsExportingZip(true);
    
    try {
      const zip = new JSZip();
      let hasFiles = false;

      finalBuscadorList.forEach((exp) => {
        if (exp.receiptBase64) {
          hasFiles = true;
          const parts = exp.receiptBase64.split(',');
          if (parts.length === 2) {
            const mimeMatch = parts[0].match(/:(.*?);/);
            let ext = 'bin';
            if (mimeMatch) {
              const mime = mimeMatch[1];
              if (mime.includes('pdf')) ext = 'pdf';
              else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
              else if (mime.includes('png')) ext = 'png';
            }
            
            const safeVendor = exp.vendorName.replace(/[^a-zA-Z0-9]/g, '_');
            const safeRut = exp.rut.replace(/[^a-zA-Z0-9-]/g, '_');
            const fileName = \`\${exp.date}_\${safeRut}_\${safeVendor}_\${exp.totalAmount}.\${ext}\`;
            
            zip.file(fileName, parts[1], { base64: true });
          }
        }
      });

      if (!hasFiles) {
        alert("Ninguna de las rendiciones filtradas tiene archivos adjuntos.");
        setIsExportingZip(false);
        return;
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = \`Comprobantes_\${startDateFilter || "Todos"}.zip\`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
    } catch (error) {
      console.error("Error generando ZIP:", error);
      alert("Hubo un error al generar el archivo ZIP.");
    } finally {
      setIsExportingZip(false);
    }
  };
`;

code = code.replace(exportCSVLogic, exportCSVLogic + exportZipLogic);

// 4. Add the button to the UI
const csvButtonUI = `<button
                    onClick={exportToCSV}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg text-xs cursor-pointer shadow-sm transition-all"
                    title="Exportar base de datos a planilla"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>`;

const zipButtonUI = `<button
                    onClick={exportToZip}
                    disabled={isExportingZip}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg text-xs cursor-pointer shadow-sm transition-all disabled:opacity-50"
                    title="Descargar comprobantes en archivo ZIP"
                  >
                    {isExportingZip ? (
                       <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                       <FileCheck className="w-3.5 h-3.5" />
                    )}
                    {isExportingZip ? "Generando ZIP..." : "Comprobantes"}
                  </button>`;

code = code.replace(csvButtonUI, csvButtonUI + '\n                  ' + zipButtonUI);

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx updated with ZIP export successfully');
