/* La escala de convenio embebida y su uso como referencia. */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

console.log('--- 1. LA ESCALA ---');
console.log('  fuente:', SICA.fuente, '· vigente', SICA.vigencia, 'a', SICA.hasta, '·', SICA.cargos.length, 'cargos');
ok('tiene los 41 cargos', SICA.cargos.length === 41, SICA.cargos.length);
ok('tiene vigencia con fecha', /^\d{2}\/\d{2}\/\d{4}$/.test(SICA.vigencia), SICA.vigencia);
ok('tiene fecha de vencimiento', /^\d{2}\/\d{2}\/\d{4}$/.test(SICA.hasta), SICA.hasta);
ok('todos tienen los dos importes', SICA.cargos.every(c => c.j8 > 0 && c.j12 > c.j8));
ok('la de 12 h es 1,75 veces la de 8 h (4 extras al 50%)',
  SICA.cargos.every(c => Math.abs(c.j12 / c.j8 - 1.75) < 0.001),
  'ratio ' + (SICA.cargos[0].j12 / SICA.cargos[0].j8).toFixed(3));
ok('ningún cargo quedó ilegible', SICA.cargos.every(c => !/[^\x20-\x7EÀ-ÿº°]/.test(c.c)),
  SICA.cargos.filter(c => /[^\x20-\x7EÀ-ÿº°]/.test(c.c)).map(c => c.c).join(',') || 'todos legibles');
ok('el utilero quedó bien decodificado', SICA.cargos.some(c => /UTILERO/.test(c.c)),
  SICA.cargos.find(c => /UTILERO/.test(c.c))?.c);
ok('todos caen en un rubro que existe',
  SICA.cargos.every(c => RUBROS_BASE.some(r => r.codigo === c.r)),
  [...new Set(SICA.cargos.map(c => c.r))].sort().join(','));

/* valores concretos, contra el PDF */
const df = SICA.cargos.find(c => /DIRECTOR\/A DE FOTOGRAFIA/.test(c.c));
ok('DF: 973.242 la jornada de 8 h', df.j8 === 973242, df.j8);
ok('DF: 1.703.173 con extras', df.j12 === 1703173, df.j12);
const gaffer = SICA.cargos.find(c => c.c === 'GAFFER');
ok('Gaffer: 291.131', gaffer.j8 === 291131, gaffer.j8);
ok('Aprendiz es el más bajo', Math.min(...SICA.cargos.map(c => c.j8)) === 39248);
ok('el DF es el más alto', Math.max(...SICA.cargos.map(c => c.j8)) === 973242);

console.log('\n--- 2. BUSCAR EL CARGO DE UNA FUNCION ---');
[['Director de Fotografía', '04', 'DIRECTOR/A DE FOTOGRAFIA'],
['Gaffer', '05', 'GAFFER'],
['Sonidista Directo', '08', 'SONIDISTA'],
['Maquillador/a', '07', 'MAQUILLADOR/A'],
['Montajista', '14', null],
['Cosa inventada', '03', null]].forEach(([f, r, esp]) => {
  const g = sicaDe(f, r);
  ok('sicaDe("' + f + '")', esp ? (g && g.c === esp) : true, g ? g.c + ' · ' + fmt(g.j12) : 'sin cargo de convenio');
});
ok('sin función devuelve null', sicaDe('', '04') === null);
ok('respeta el rubro', (sicaDe('ASISTENTE', '02') || {}).d === 'Dirección', (sicaDe('ASISTENTE', '02') || {}).d);
ok('el mismo nombre en otro rubro da otro cargo',
  (sicaDe('ASISTENTE', '03') || {}).d === 'Producción', (sicaDe('ASISTENTE', '03') || {}).d);

console.log('\n--- 3. LA JORNADA BASE SIGUE AL CONVENIO ---');
const cfg = nuevaConfigRodaje();
ok('jornada base 8 h', cfg.horasJornada === 8, cfg.horasJornada);
ok('recargo 50%', cfg.recargoHE === 50, cfg.recargoHE);
/* con la escala: 4 extras sobre 8 h de base tienen que dar la columna de 12 h */
const j = { citacion: '07:00', citaciones: {}, parte: nuevoParte() };
j.parte.fichadas['x'] = { entrada: '07:00', salida: '19:00' };   /* 12 h, sin comida */
const cfg2 = { ...cfg, descontarComida: false };
const h = horasDe('x', j, cfg2, df.j8, 'ARS');
ok('12 h dan 4 de extra', h.extra === 240, fmtHoras(h.extra));
ok('el costo de esas 4 extras es el del convenio',
  Math.abs((df.j8 + h.costoHE) - df.j12) < 2,
  fmt(df.j8) + ' + ' + fmt(h.costoHE) + ' = ' + fmt(df.j8 + h.costoHE) + ' vs convenio ' + fmt(df.j12));

console.log('\n--- 4. RENDER Y ALTA DESDE LA ESCALA ---');
DB.ui.tab = 'catalogo';
['gente', 'sica'].forEach(k => {
  try { setSubCat(k); render(); ok('render ' + k, true); } catch (e) { ok('render ' + k, false, e.message); }
});
const html = tarifarioHTML();
ok('el tarifario muestra la vigencia', html.includes(SICA.vigencia));
ok('avisa que es un piso y no la tarifa', /Esto es el piso, no la tarifa/.test(html));
ok('avisa que vence', html.includes('vencen el ' + SICA.hasta));
ok('agrupa por departamento', /Fotografía y Cámara/.test(html) && /Eléctrica e Iluminación/.test(html));

const antes = DB.catalogo.personas.length;
modal = null;
desdeSica('GAFFER', '05', 509480);
ok('crea la ficha en el catálogo', DB.catalogo.personas.length === antes + 1);
const nueva = DB.catalogo.personas[DB.catalogo.personas.length - 1];
ok('con el cargo y el rubro', nueva.funcion === 'GAFFER' && nueva.rubro === '05', nueva.funcion + '/' + nueva.rubro);
ok('con la tarifa arrancando en el piso', nueva.tarifaRef === 509480, nueva.tarifaRef);
ok('abre la ficha para completarla', !!modal && /GAFFER/.test(modal));
ok('la ficha muestra el piso de convenio', /piso de convenio SICA/.test(modal));

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
