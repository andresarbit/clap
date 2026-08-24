/* Genera la constante JS con la escala del SICA, mapeando cada cargo al rubro
   de CLAP. El orden de los cargos en el PDF es el de los departamentos, así
   que se asigna por tramos. */
const fs = require('fs');
const src = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));

/* [hasta_indice_exclusivo, departamento, rubro CLAP] */
const TRAMOS = [
  [4, 'Dirección', '02'],
  [7, 'Producción', '03'],
  [8, 'RR.PP.', '03'],
  [11, 'Locaciones', '10'],
  [18, 'Fotografía y Cámara', '04'],
  [22, 'Eléctrica e Iluminación', '05'],
  [24, 'Sonido', '08'],
  [25, 'Grip', '05'],
  [27, 'Utilería', '06'],
  [31, 'Maquillaje y Peinado', '07'],
  [35, 'Arte', '06'],
  [38, 'Vestuario', '07'],
  [40, 'Edición', '14'],
  [41, 'Aprendices', '03'],
];
const deptoDe = i => (TRAMOS.find(t => i < t[0]) || [, '—', '03']).slice(1);

/* Un cargo viene con una fuente de codificacion propia y sale ilegible.
   Decodificado caracter por caracter contra el resto de la tabla el mapeo
   es consistente (Z->R, K->O, d->T, ->A, ->espacio) y da este nombre. */
const ILEGIBLE = /[^ -~\u00C0-\u00FF\u00BA\u00B0]/;
const arreglar = c => ILEGIBLE.test(c) ? 'UTILERO/A - CARPINTERO/A' : c;

const filas = src.cargos.map((f, i) => {
  const [depto, rubro] = deptoDe(i);
  return { cargo: arreglar(f.cargo), depto, rubro, base8: f.base8, total12: f.total12 };
});

const vig = (src.vigencia.match(/(\d{2}\/\d{2}\/\d{4})/) || [, ''])[1];
const has = (src.hasta.match(/(\d{2}\/\d{2}\/\d{4})/) || [, ''])[1];

const out = [];
out.push('/* Escala salarial SICA · publicidad. Salarios BRUTOS de convenio, por');
out.push('   jornada de 8 horas; la columna de 12 h incluye 4 extras al 50%.');
out.push('   Es el PISO legal para relación de dependencia, no lo que cobra un');
out.push('   monotributista por su fee. Fuente: sicacine.org.ar                       */');
out.push(`const SICA = {vigencia:'${vig}', hasta:'${has}', fuente:'SICA · publicidad',`);
out.push('  cargos:[');
filas.forEach(f => out.push(
  `    {c:${JSON.stringify(f.cargo)}, d:${JSON.stringify(f.depto)}, r:'${f.rubro}', j8:${f.base8}, j12:${f.total12}},`));
out.push('  ]};');

fs.writeFileSync('D:/Cuadro/test/sica/sica-const.js', out.join('\n'), 'utf8');
console.log(out.join('\n'));
console.log('\ncargos:', filas.length, '· vigencia', vig, 'a', has);
const porDep = {};
filas.forEach(f => (porDep[f.depto] ||= []).push(f.cargo));
Object.entries(porDep).forEach(([d, cs]) => console.log('  ' + d.padEnd(26) + cs.join(' · ')));
