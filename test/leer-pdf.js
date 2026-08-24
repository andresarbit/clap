/* Lee un PDF con el MISMO extractor que usa CLAP. Sirve para dos cosas:
   traer datos reales (escalas salariales) y probar el lector contra PDFs
   del mundo real, que es donde se rompen los parsers. */
const fs = require('fs');
const ruta = process.argv[3];
if (!ruta) { console.log('uso: node test/run.js test/leer-pdf.js <archivo.pdf>'); process.exit(1); }
const bytes = new Uint8Array(fs.readFileSync(ruta));
(async () => {
  try {
    const t = await pdfATexto(bytes);
    console.log(t);
  } catch (e) { console.log('ERROR: ' + e.message); process.exitCode = 1; }
})();
