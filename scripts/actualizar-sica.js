/* Busca en sicacine.org.ar escalas salariales de publicidad que CLAP todavía no
   tenga, las baja, las lee y las mete en clap.html.

   Por qué corre acá y no en el navegador: el sitio del SICA no manda cabeceras
   CORS, así que una página web no puede leer sus PDF. Un proceso del lado del
   servidor sí. Lo corre GitHub Actions una vez por semana
   (.github/workflows/sica.yml) y, si encontró algo, commitea: GitHub Pages
   publica solo y todos ven la escala nueva al recargar.

   Qué hace, en orden:
     1. junta candidatos: los links de la home que dicen "Escala Salarial
        Publicidad", y además prueba el nombre de los próximos meses con el
        mismo patrón de URL que usa el SICA (por si el link no está en la home)
     2. baja los que no estén en test/sica
     3. los lee con el MISMO lector de PDF que usa CLAP (test/sica-tabla.js)
     4. arma el bloque con scripts/sica-escalas.js, que VALIDA: mismo número de
        cargos, mismos nombres en el mismo orden, y que 8 h + extras = 12 h.
        Si el SICA cambió la tabla, esto frena con error y no se publica nada:
        es preferible una escala sin actualizar que una con los sueldos
        corridos una fila. GitHub avisa por mail cuando falla.

   uso: node scripts/actualizar-sica.js [--seco]
        --seco  busca y avisa, pero no escribe nada                          */
const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const RAIZ = path.join(__dirname, '..');
const DIR = path.join(RAIZ, 'test', 'sica');
const BASE = 'https://www.sicacine.org.ar';
const SECO = process.argv.includes('--seco');
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto',
  'Septiembre','Octubre','Noviembre','Diciembre'];

/* "Escala Salarial Publicidad Octubre 2026.pdf" -> "Escala_Salarial_Publicidad_Octubre_2026.pdf" */
const nombreLocal = url => decodeURIComponent(url.split('/').pop()).trim().replace(/\s+/g, '_');

async function candidatos(){
  const urls = new Set();
  /* 1. los links de la home */
  try{
    const r = await fetch(BASE + '/', {headers:{'User-Agent':'CLAP actualizador de escalas'}});
    const html = await r.text();
    for(const m of html.matchAll(/href=["']([^"']*Escala[^"']*Salarial[^"']*Publicidad[^"']*\.pdf)["']/gi)){
      let u = m[1];
      if(!/^https?:/i.test(u)) u = BASE + '/' + u.replace(/^\/+/, '');
      urls.add(u.replace(/ /g, '%20'));
    }
  }catch(e){ console.log('No pude leer la home del SICA:', e.message); }
  /* 2. el patrón de los próximos meses, desde el mes pasado hasta 4 adelante */
  const hoy = new Date();
  for(let k = -1; k <= 4; k++){
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + k, 1);
    urls.add(`${BASE}/docs/Escala%20Salarial%20Publicidad%20${MESES[d.getMonth()]}%20${d.getFullYear()}.pdf`);
  }
  return [...urls];
}

async function existe(url){
  try{
    const r = await fetch(url, {method:'HEAD', headers:{'User-Agent':'CLAP actualizador de escalas'}});
    return r.ok && /pdf/i.test(r.headers.get('content-type') || '');
  }catch(e){ return false; }
}

(async () => {
  const yaTengo = new Set(fs.readdirSync(DIR).filter(f => /\.pdf$/i.test(f)));
  const nuevas = [];
  for(const url of await candidatos()){
    const archivo = nombreLocal(url);
    if(yaTengo.has(archivo)) continue;
    if(!await existe(url)) continue;
    nuevas.push({url, archivo});
  }

  if(!nuevas.length){
    console.log('Sin escalas nuevas. Las que hay:', [...yaTengo].join(', '));
    return;
  }
  console.log('Escalas nuevas encontradas:', nuevas.map(n => n.archivo).join(', '));
  if(SECO){ console.log('(--seco: no se escribe nada)'); return; }

  for(const {url, archivo} of nuevas){
    const r = await fetch(url, {headers:{'User-Agent':'CLAP actualizador de escalas'}});
    if(!r.ok) throw new Error(`No pude bajar ${url}: HTTP ${r.status}`);
    const destino = path.join(DIR, archivo);
    fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
    console.log('bajado:', archivo);
    /* leer con el mismo extractor que usa CLAP */
    const salida = execFileSync(process.execPath,
      [path.join(RAIZ, 'test', 'run.js'), path.join(RAIZ, 'test', 'sica-tabla.js'), destino],
      {encoding:'utf8'});
    const cuadran = /filas donde 8hs \+ extras != total: 0/.test(salida);
    const cuantos = (salida.match(/cargos encontrados: (\d+)/) || [])[1];
    console.log(`  ${cuantos} cargos · ${cuadran ? 'todos cuadran' : 'HAY FILAS QUE NO CUADRAN'}`);
    if(!cuadran) throw new Error(`${archivo}: la lectura no cuadra. Hay que revisarlo a mano.`);
  }

  /* arma y valida el bloque; si el SICA cambió la tabla, esto tira error */
  const {escribir} = require('./sica-escalas.js');
  const escalas = escribir();
  console.log('clap.html con escalas:', escalas.map(e => `${e.nombre} (${e.vigencia}–${e.hasta})`).join(' · '));
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
