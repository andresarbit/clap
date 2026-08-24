/* Convierte la escala salarial del SICA (PDF) en datos estructurados.
   El PDF sale como: CARGO, luego sus 3 importes (8 hs / 4 hs extras / total 12 hs).
   Los nombres de departamento salen sueltos al final por el orden del PDF. */
const fs = require('fs');
const ruta = process.argv[3];

const DEPTOS_SICA = ['DIRECCION', 'PRODUCCION', 'LOCACIONES', 'FOTOGRAFIA Y CAMARA',
  'ELECTRICIDAD', 'ILUMINACION', 'SONIDO', 'GRIP', 'UTILERIA', 'MAQUILLAJE Y PEINADO',
  'ARTE Y VESTUARIO', 'EDICION', 'EDICION DE VIDEO EN FILM', 'APRENDICES'];

(async () => {
  const bytes = new Uint8Array(fs.readFileSync(ruta));
  const txt = await pdfATexto(bytes);
  const ls = txt.split('\n').map(x => x.trim()).filter(Boolean);

  const vig = ls.find(l => /A PARTIR DEL/i.test(l)) || '';
  const hasta = ls.find(l => /VIGENTES HASTA/i.test(l)) || '';

  const plata = s => { const m = String(s||"").match(/^\$\s*([\d.]+)$/); return m ? +m[1].replace(/\./g, '') : null; };
  const esRuido = l => /^(ASIGNACION|CARGO|8 HORAS|4HS? EXTRAS|TOTAL 12|mail:|SICAAPMA|Adherido|Sindicato|SALARIOS|VIGENTES)/i.test(l)
    || DEPTOS_SICA.includes(l) || /[Ͱ-￿]{2,}/.test(l) || l.length < 3;

  /* recorrer: un cargo seguido de 3 importes */
  const filas = [];
  for (let i = 0; i < ls.length; i++) {
    if (plata(ls[i]) !== null || esRuido(ls[i])) continue;
    const a = plata(ls[i + 1]), b = plata(ls[i + 2]), c = plata(ls[i + 3]);
    if (a && b && c) { filas.push({ cargo: ls[i], base8: a, extras4: b, total12: c }); i += 3; }
  }

  console.log(vig + '  ' + hasta);
  console.log('cargos encontrados:', filas.length);
  console.log('');
  console.log('CARGO'.padEnd(38) + '8 HS'.padStart(12) + '+4 EXTRAS'.padStart(12) + 'TOTAL 12'.padStart(12) + '   $/hora');
  console.log('-'.repeat(88));
  filas.forEach(f => console.log(
    f.cargo.slice(0, 37).padEnd(38) +
    f.base8.toLocaleString('es-AR').padStart(12) +
    f.extras4.toLocaleString('es-AR').padStart(12) +
    f.total12.toLocaleString('es-AR').padStart(12) +
    ('   ' + Math.round(f.base8 / 8).toLocaleString('es-AR'))));

  /* controles de consistencia */
  console.log('');
  const malos = filas.filter(f => Math.abs((f.base8 + f.extras4) - f.total12) > 2);
  console.log('filas donde 8hs + extras != total:', malos.length,
    malos.length ? JSON.stringify(malos[0]) : '(todas cuadran)');
  const ratio = filas.map(f => f.extras4 / f.base8);
  console.log('proporcion extras/base:', (Math.min(...ratio)).toFixed(3), 'a', (Math.max(...ratio)).toFixed(3));

  fs.writeFileSync(ruta.replace(/\.pdf$/i, '.json'),
    JSON.stringify({ vigencia: vig, hasta, cargos: filas }, null, 2), 'utf8');
  console.log('\nguardado:', ruta.replace(/\.pdf$/i, '.json'));
})();
