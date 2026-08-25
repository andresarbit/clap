/* Tags del proyecto: qué cosas hay y qué arrastra cada una. */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

const py = getPy();

console.log('--- 1. EL CATALOGO ---');
console.log(TAGS.map(t => `  ${t.l.padEnd(28)} ${t.pide.length} cosas para resolver`).join('\n'));
ok('hay tags cargados', TAGS.length >= 14, TAGS.length);
ok('todos tienen nombre, color y qué piden',
  TAGS.every(t => t.l && t.c && t.pide && t.pide.length), 'todos');
ok('todos tienen alguna forma de detectarse',
  TAGS.every(t => t.re || t.dep || t.sub || t.momento || t.lugar || t.k === 'viaje'),
  TAGS.filter(t => !(t.re || t.dep || t.sub || t.momento || t.lugar) && t.k !== 'viaje').map(t => t.k).join(',') || 'todos');
ok('no hay claves repetidas', new Set(TAGS.map(t => t.k)).size === TAGS.length);

console.log('\n--- 2. SE DETECTAN DEL GUION ---');
const GUION = `LAVANDINA Z — "MUDANZA"

Abrimos en la calle, de noche. Un HOMBRE camina bajo la lluvia. Un DRON
lo sigue desde arriba.

En el techo del edificio, la NENA de 8 años mira la ciudad. Su PERRO ladra.

En la pileta del club, de día, alguien nada. Hay GENTE mirando alrededor.

Corte a: el auto arranca y se pierde entre el humo.
`;
DB.ui.tab = 'desglose';
importarGuion(GUION);
const det = tagsDetectados(py);
console.log(Object.entries(det).map(([k, v]) =>
  `  ${TAG(k).l.padEnd(28)} escenas ${[...v.escenas].join(',').padEnd(8)} por: ${[...v.motivos].slice(0, 2).join(', ')}`).join('\n'));

[['nocturno', 'rodaje nocturno'], ['viaPublica', 'vía pública'], ['drone', 'drone'],
['menores', 'menores'], ['animales', 'animales'], ['agua', 'agua'],
['altura', 'trabajo en altura'], ['multitud', 'extras'], ['vehiculos', 'vehículos'],
['efectos', 'efectos']].forEach(([k, l]) =>
  ok('detecta ' + l, !!det[k], det[k] ? 'escenas ' + [...det[k].escenas].join(',') : 'NO'));
ok('no inventa lo que no está', !det.armas && !det.vfx,
  'sin armas ni vfx en este guion');
ok('cada detección dice por qué', Object.values(det).every(v => v.motivos.size > 0));
ok('y en qué escena', Object.values(det).every(v => v.escenas.size > 0));

console.log('\n--- 3. LO QUE ARRASTRA CADA UNO ---');
const tags = tagsDelProyecto(py);
const menores = tags.find(t => t.k === 'menores');
console.log('  ' + menores.l + ':');
menores.pide.forEach(p => console.log('    ☐ ' + p));
ok('menores pide permiso y tutor',
  menores.pide.some(p => /permiso de trabajo/i.test(p)) && menores.pide.some(p => /tutor/i.test(p)));
ok('drone pide piloto habilitado',
  tags.find(t => t.k === 'drone').pide.some(p => /ANAC/i.test(p)));
ok('vía pública pide permiso municipal',
  tags.find(t => t.k === 'viaPublica').pide.some(p => /municipal/i.test(p)));
ok('agua pide guardavidas',
  tags.find(t => t.k === 'agua').pide.some(p => /guardavidas/i.test(p)));
ok('altura pide arnés',
  tags.find(t => t.k === 'altura').pide.some(p => /arn[ée]s/i.test(p)));
const totalPide = tags.reduce((s, t) => s + t.pide.length, 0);
ok('junta todo lo que hay que resolver', totalPide > 20, totalPide + ' cosas');

console.log('\n--- 4. AGREGAR Y QUITAR A MANO ---');
ok('los detectados vienen marcados como automáticos', tags.every(t => t.auto || t.manual));
const antes = tags.length;
agregarTag('armas');
let t2 = tagsDelProyecto(py);
ok('se puede agregar uno que no estaba', t2.length === antes + 1 && t2.some(t => t.k === 'armas'));
ok('el agregado a mano se marca como tal',
  t2.find(t => t.k === 'armas').manual && !t2.find(t => t.k === 'armas').auto);
ok('y trae lo que pide', t2.find(t => t.k === 'armas').pide.some(p => /armero/i.test(p)));
quitarTag('armas');
ok('se puede sacar', !tagsDelProyecto(py).some(t => t.k === 'armas'));
/* quitar uno detectado también funciona: es un falso positivo que se descarta */
quitarTag('multitud');
ok('se puede descartar un detectado', !tagsDelProyecto(py).some(t => t.k === 'multitud'));
ok('queda registrado como descartado', py.tags.descartados.includes('multitud'));
agregarTag('multitud');
ok('y se puede recuperar', tagsDelProyecto(py).some(t => t.k === 'multitud'));
ok('al recuperarlo deja de estar descartado', !py.tags.descartados.includes('multitud'));

console.log('\n--- 5. PREPRODUCCION COMO AREA ---');
ok('preproducción es un área', !!AREA('preproduccion'), areaLbl('preproduccion'));
ok('el rubro 01 le pertenece', areaDeRubro('01') === 'preproduccion', areaDeRubro('01'));
ok('ya no cae en producción', areaDeRubro('01') !== 'produccion');
ok('cada área tiene un rubro que la usa o es transversal',
  AREAS.every(a => RUBROS_BASE.some(r => r.area === a.k) || a.k === 'catering'),
  AREAS.filter(a => !RUBROS_BASE.some(r => r.area === a.k)).map(a => a.k).join(',') || 'todas');

console.log('\n--- 6. RENDER ---');
const html = tagsHTML(py);
ok('la vista lista los tags', tags.every(t => html.includes(esc(t.l))));
ok('muestra lo que pide cada uno', /class="pide"/.test(html));
ok('dice de qué escena salió', /Escenas \d/.test(html));
ok('ofrece agregar los que faltan', /tagadd/.test(html));
ok('los chips de la portada', /tagchip/.test(tagsChipsHTML(py)));
ok('la portada los muestra', /Qué tiene este proyecto/.test(vistaResumen(getPr(), py, getV())));
const errs = [];
['escenas', 'deptos', 'tags', 'plan'].forEach(k => {
  try { setSub(k); render(); } catch (e) { errs.push(k + ': ' + e.message); }
});
ok('las 4 sub-vistas del desglose', !errs.length, errs.join(' | ') || 'sin errores');
ok('proyecto sin guion no rompe', (() => {
  const p2 = nuevoProyecto({ nombre: 'Vacío' }); getPr().proyectos.push(p2);
  try { tagsHTML(p2); tagsChipsHTML(p2); return true; } catch (e) { return e.message; }
})() === true);

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
