/* Prueba los lectores de archivo: PDF, DOCX, RTF, FDX y .doc.
   El criterio es duro: cada formato tiene que dar el MISMO desglose que el .txt. */
const fs = require('fs');
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

const DIR = 'D:/Cuadro/test/muestras/';
/* File mínimo: sólo necesita name, text() y arrayBuffer() */
const archivo = (nombre) => {
  const buf = fs.readFileSync(DIR + nombre);
  return {
    name: nombre,
    async text() { return buf.toString('utf-8'); },
    async arrayBuffer() { return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); }
  };
};

/* referencia: el .txt */
const REF = parseGuion(fs.readFileSync('D:/Cuadro/test/guion-ejemplo.txt', 'utf-8'));
const huella = (es) => es.map(e =>
  [e.numero, e.intExt, e.locacion, e.momento, e.personajes.join('/')].join('|')).join(' ~ ');
const HREF = huella(REF);

console.log('referencia (.txt):', REF.length, 'escenas');
console.log('  ' + HREF.replace(/ ~ /g, '\n  '));
console.log('');

(async () => {
  for (const [nombre, etiqueta] of [
    ['guion.fdx', 'Final Draft (.fdx)'],
    ['guion.docx', 'Word (.docx)'],
    ['guion.rtf', 'RTF (.rtf)'],
    ['guion.pdf', 'PDF de texto (.pdf)'],
  ]) {
    let txt, es;
    try { txt = await archivoATexto(archivo(nombre)); }
    catch (e) { ok(etiqueta, false, 'EXCEPCION: ' + e.message); continue; }
    es = parseGuion(txt);
    ok(etiqueta + ' — extrae texto', txt.length > 400, txt.length + ' chars');
    ok(etiqueta + ' — misma cantidad de escenas', es.length === REF.length, es.length + ' vs ' + REF.length);
    ok(etiqueta + ' — mismo desglose que el .txt', huella(es) === HREF,
      huella(es) === HREF ? 'idéntico' : '\n     obtenido: ' + huella(es).replace(/ ~ /g, '\n     '));
    /* los elementos también tienen que coincidir */
    const els = (x) => x.map(e => Object.entries(e.elementos).map(([k, v]) => k + ':' + v.slice().sort().join(',')).sort().join(';')).join(' ~ ');
    ok(etiqueta + ' — mismos elementos detectados', els(es) === els(REF),
      els(es) === els(REF) ? 'idéntico' : 'difiere');
    console.log('');
  }

  /* .doc renombrados: algunos "doc" son en realidad docx o rtf */
  fs.copyFileSync(DIR + 'guion.docx', DIR + 'renombrado.doc');
  let es2 = parseGuion(await archivoATexto(archivo('renombrado.doc')));
  ok('.doc que en realidad es .docx', huella(es2) === HREF, es2.length + ' escenas');
  fs.copyFileSync(DIR + 'guion.rtf', DIR + 'renombrado2.doc');
  es2 = parseGuion(await archivoATexto(archivo('renombrado2.doc')));
  ok('.doc que en realidad es .rtf', huella(es2) === HREF, es2.length + ' escenas');

  /* .doc binario de verdad: heurística, se acepta que sea aproximada */
  const utf16 = Buffer.from('\uFEFF' + fs.readFileSync('D:/Cuadro/test/guion-ejemplo.txt', 'utf-8'), 'utf16le');
  const fake = Buffer.concat([Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]),
  Buffer.alloc(512), utf16, Buffer.alloc(64)]);
  fs.writeFileSync(DIR + 'binario.doc', fake);
  const t3 = await archivoATexto(archivo('binario.doc'));
  const es3 = parseGuion(t3);
  ok('.doc binario — rescata las escenas', es3.length === REF.length, es3.length + ' de ' + REF.length);
  ok('.doc binario — encabezados legibles', es3.every(e => /COCINA|CALLE|PLAZA/.test(e.locacion)),
    es3.map(e => e.locacion).join(' | '));

  /* errores claros, no excepciones crudas */
  const err = async (nombre, buf, espera) => {
    fs.writeFileSync(DIR + nombre, buf);
    try { await archivoATexto(archivo(nombre)); return 'NO TIRO ERROR'; }
    catch (e) { return e.message; }
  };
  let m = await err('vacio.xyz', Buffer.from('hola'));
  ok('extensión desconocida avisa', /Formato no reconocido/.test(m), m.split('\n')[0]);
  m = await err('roto.docx', Buffer.from('esto no es un zip'));
  ok('.docx roto avisa', /docx válido|índice del ZIP/.test(m), m.split('\n')[0]);
  m = await err('escaneado.pdf', Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Page /Contents 2 0 R >>\nendobj\ntrailer\n<< >>\n%%EOF'));
  ok('PDF sin texto avisa que puede ser escaneado', /escaneado|No pude leer el contenido/.test(m), m.split('\n')[0]);

  console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
  process.exitCode = fallos ? 1 : 0;
})();
