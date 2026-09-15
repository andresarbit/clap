/* Arma el bloque ESCALAS_SICA de clap.html a partir de los JSON de cada escala
   (los que genera test/sica-tabla.js desde el PDF oficial).

   El PDF no dice a qué departamento pertenece cada cargo en una forma que se
   pueda leer confiable, así que el departamento y el rubro de CLAP se toman de
   la escala que ya está en clap.html, POSICIÓN POR POSICIÓN — pero sólo si el
   nombre del cargo en esa posición es el mismo. Si el SICA agregó, sacó o
   reordenó un cargo, no se adivina: se frena con error y hace falta que lo mire
   una persona. Es preferible una escala sin actualizar que una con los sueldos
   corridos una fila.

   uso: node scripts/sica-escalas.js            -> imprime el bloque
        node scripts/sica-escalas.js --escribir -> lo reemplaza en clap.html   */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const DIR = path.join(RAIZ, 'test', 'sica');
const HTML = path.join(RAIZ, 'clap.html');

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
  'septiembre','octubre','noviembre','diciembre'];
const fechaDe = s => (String(s || '').match(/(\d{2}\/\d{2}\/\d{4})/) || [])[1] || '';
const aISO = dmy => { const [d, m, a] = dmy.split('/'); return `${a}-${m}-${d}`; };
const capital = s => s[0].toUpperCase() + s.slice(1);
/* Un cargo del PDF viene con una fuente propia y sale ilegible; decodificado a
   mano contra el resto de la tabla da siempre este nombre (ver gen-sica.js). */
const ILEGIBLE = /[^ -~À-ÿº°]/;

/* clap.html está con fin de línea de Windows en el disco: se trabaja con \n y
   se devuelve con el mismo fin de línea con el que vino. */
const leerHTML = () => {
  const crudo = fs.readFileSync(HTML, 'utf8');
  return {txt: crudo.replace(/\r\n/g, '\n'), crlf: /\r\n/.test(crudo)};
};

/* la referencia de departamentos: los cargos de la escala más vieja que ya
   esté en clap.html (en cualquiera de los dos formatos) */
function referencia(html){
  const m = html.match(/cargos:\[\n([\s\S]*?)\n\s*\]/);
  if(!m) throw new Error('No encontré los cargos de referencia en clap.html');
  return m[1].split('\n').map(l => {
    const c = l.match(/c:("[^"]*")/), d = l.match(/d:("[^"]*")/), r = l.match(/r:'(\d+)'/);
    return c && d && r ? {c: JSON.parse(c[1]), d: JSON.parse(d[1]), r: r[1]} : null;
  }).filter(Boolean);
}

function armar(){
  const {txt} = leerHTML();
  const ref = referencia(txt);
  const archivos = fs.readdirSync(DIR).filter(f => /^Escala_Salarial_Publicidad_.*\.json$/.test(f));
  if(!archivos.length) throw new Error('No hay escalas en test/sica');

  const escalas = archivos.map(f => {
    const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    const vig = fechaDe(j.vigencia), has = fechaDe(j.hasta);
    if(!vig || !has) throw new Error(`${f}: no pude leer las fechas de vigencia`);
    if(j.cargos.length !== ref.length)
      throw new Error(`${f}: trae ${j.cargos.length} cargos y la referencia ${ref.length}. ` +
        'El SICA cambió la tabla: hay que revisar a mano.');
    const cargos = j.cargos.map((c, i) => {
      const nombre = ILEGIBLE.test(c.cargo) ? 'UTILERO/A - CARPINTERO/A' : c.cargo;
      if(nombre !== ref[i].c)
        throw new Error(`${f}: en la fila ${i} dice "${nombre}" y la referencia "${ref[i].c}". ` +
          'El orden cambió: hay que revisar a mano.');
      if(Math.abs(c.base8 + c.extras4 - c.total12) > 2)
        throw new Error(`${f}: "${nombre}" no cuadra (8 h + extras distinto de 12 h).`);
      return {c: nombre, d: ref[i].d, r: ref[i].r, j8: c.base8, j12: c.total12};
    });
    const [, mm, aa] = vig.split('/');
    const mes = capital(MESES[+mm - 1]);
    return {nombre: `${mes} ${aa}`, vigencia: vig, hasta: has, desde: aISO(vig), hastaISO: aISO(has),
      url: `https://www.sicacine.org.ar/docs/Escala%20Salarial%20Publicidad%20${mes}%20${aa}.pdf`,
      cargos};
  }).sort((a, b) => a.desde.localeCompare(b.desde));

  /* dos escalas no pueden pisarse en las fechas */
  for(let k = 1; k < escalas.length; k++)
    if(escalas[k].desde <= escalas[k - 1].hastaISO)
      throw new Error(`${escalas[k].nombre} arranca antes de que termine ${escalas[k - 1].nombre}.`);

  const L = [];
  L.push('/* Escalas salariales SICA · publicidad. Salarios BRUTOS de convenio por');
  L.push('   jornada de 8 horas; la columna de 12 h incluye 4 extras al 50%.');
  L.push('   Es el PISO legal en relación de dependencia, no lo que cobra un');
  L.push('   monotributista por su fee. Fuente: sicacine.org.ar');
  L.push('   Cada escala vale entre `desde` y `hastaISO`, y la app usa la que');
  L.push('   corresponde a la FECHA DEL RODAJE, no la de hoy.');
  L.push('   NO EDITAR A MANO: lo genera scripts/sica-escalas.js desde los PDF.       */');
  L.push('const ESCALAS_SICA = [');
  escalas.forEach(e => {
    L.push(`  {nombre:${JSON.stringify(e.nombre)}, vigencia:'${e.vigencia}', hasta:'${e.hasta}', desde:'${e.desde}', hastaISO:'${e.hastaISO}',`);
    L.push(`   fuente:'SICA · publicidad', url:${JSON.stringify(e.url)},`);
    L.push('   cargos:[');
    e.cargos.forEach(c => L.push(`    {c:${JSON.stringify(c.c)}, d:${JSON.stringify(c.d)}, r:'${c.r}', j8:${c.j8}, j12:${c.j12}},`));
    L.push('  ]},');
  });
  L.push('];');
  return {bloque: L.join('\n'), escalas};
}

/* Reemplaza el bloque en clap.html, venga en el formato viejo (const SICA) o
   en el nuevo (const ESCALAS_SICA). */
function escribir(){
  const {bloque, escalas} = armar();
  const {txt, crlf} = leerHTML();
  const ini = txt.search(/\/\* Escalas? salarial(?:es)? SICA · publicidad/);
  if(ini < 0) throw new Error('No encontré el comentario de la escala en clap.html');
  let fin;
  const nuevo = txt.indexOf('const ESCALAS_SICA = [', ini);
  if(nuevo >= 0 && nuevo - ini < 1500) fin = txt.indexOf('\n];', nuevo) + 3;
  else fin = txt.indexOf('\n  ]};', ini) + 6;
  if(fin <= ini) throw new Error('No encontré el final del bloque de la escala');
  let out = txt.slice(0, ini) + bloque + txt.slice(fin);
  if(crlf) out = out.replace(/\n/g, '\r\n');
  fs.writeFileSync(HTML, out, 'utf8');
  return escalas;
}

if(require.main === module){
  try{
    if(process.argv.includes('--escribir')){
      const es = escribir();
      console.log('clap.html actualizado:', es.map(e => `${e.nombre} (${e.vigencia}–${e.hasta})`).join(' · '));
    } else console.log(armar().bloque);
  }catch(e){ console.error('ERROR:', e.message); process.exit(1); }
}
module.exports = {armar, escribir};
