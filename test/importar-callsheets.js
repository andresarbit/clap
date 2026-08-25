/* Armar el catálogo desde callsheets viejos, y el buscador con disponibilidad. */
const fs = require('fs');
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

const TXT = fs.readFileSync('D:/Cuadro/test/callsheet-ejemplo.txt', 'utf-8');

console.log('--- 1. EXTRACCION ---');
const cs = extraerContactos(TXT, 'callsheet-J1.txt');
console.log(cs.slice(0, 8).map(c =>
  `  ${(c.nombre || '—').padEnd(20)} ${(c.funcion || '—').padEnd(30)} ${(c.rubro || '—').padEnd(3)} ${(c.tel || '').padEnd(18)} ${c.email || ''}`).join('\n'));
console.log(`  … ${cs.length} en total`);
ok('saca contactos del callsheet', cs.length >= 18, cs.length);
ok('todos tienen teléfono o mail', cs.every(c => c.tel || c.email));
ok('la mayoría tiene nombre', cs.filter(c => c.nombre).length >= cs.length - 2,
  cs.filter(c => c.nombre).length + ' de ' + cs.length);
ok('reconoce las funciones', cs.filter(c => c.funcion).length >= 14,
  cs.filter(c => c.funcion).length + ' con función');

/* casos concretos */
const buscar = n => cs.find(c => new RegExp(n, 'i').test(c.nombre || ''));
[['Ana Suárez', 'Director', '02'],
['Martín Bevilacqua', 'Director de Fotografía', '04'],
['Lucía Ferrer', 'Jefe de Producción', '03'],
['Roberto Díaz', 'Gaffer', '05'],
['Sofía Roldán', 'Director de Arte', '06']].forEach(([nom, fun, rub]) => {
  const c = buscar(nom.split(' ')[0]);
  ok('extrae a ' + nom, c && new RegExp(fun, 'i').test(c.funcion || '') && c.rubro === rub,
    c ? `${c.nombre} · ${c.funcion} · rubro ${c.rubro}` : 'no lo encontró');
});
ok('la función más larga gana sobre la corta',
  (buscar('Sol') || {}).funcion === 'Asistente de Producción', (buscar('Sol') || {}).funcion);

console.log('\n--- 2. TELEFONOS EN TODAS SUS FORMAS ---');
[['Ana', '11 5555-3001'], ['Pablo', '011 15 4444-2210'], ['Carla', '1155667788'],
['Nicolás', '+54 9 11 6677-8899'], ['Diego', '011 4567-8901']].forEach(([n, esp]) => {
  const c = buscar(n);
  ok('teléfono de ' + n, c && c.tel.replace(/\s+/g, ' ').trim() === esp, c ? c.tel : '—');
});
ok('los mails salen en minúscula', cs.filter(c => c.email).every(c => c.email === c.email.toLowerCase()));
ok('sin ruido en los mails', cs.filter(c => c.email).every(c => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(c.email)),
  cs.filter(c => c.email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(c.email)).map(c => c.email).join(',') || 'todos limpios');

console.log('\n--- 3. NO SE CUELA BASURA ---');
/* el hospital SI es un contacto util del callsheet, pero no es crew:
   sin funcion reconocida entra como proveedor y se revisa antes de guardar */
const hosp = cs.find(c => /Hospital/i.test(c.nombre || ''));
ok('el hospital entra como proveedor, no como crew',
  hosp && hosp.tipo === 'proveedor' && !hosp.funcion, hosp ? hosp.tipo : 'no lo tomó');
ok('lo que tiene función reconocida es persona',
  cs.filter(c => c.funcion).every(c => c.tipo === 'persona'));
ok('no toma etiquetas de columna como nombre',
  !cs.some(c => /^(tel|mail|contacto|nombre|funcion)$/i.test(c.nombre)));
ok('cada candidato dice de qué línea salió', cs.every(c => c.linea > 0 && c.crudo));
ok('y de qué archivo', cs.every(c => c.origen === 'callsheet-J1.txt'));

console.log('\n--- 4. UNIFICAR VARIOS CALLSHEETS ---');
/* la misma gente aparece en las tres jornadas */
const j2 = extraerContactos(TXT, 'callsheet-J2.txt');
const j3 = extraerContactos(TXT.replace('Roberto Díaz', 'Roberto Diaz'), 'callsheet-J3.txt');
const uni = unificarContactos([...cs, ...j2, ...j3]);
ok('no duplica a la misma persona', uni.length === cs.length, uni.length + ' únicos de ' + (cs.length * 3));
const rob = uni.find(c => /Roberto/i.test(c.nombre));
ok('unifica por mail aunque cambie el nombre', rob && rob.veces === 3, rob && rob.veces + ' apariciones');
ok('registra en qué archivos apareció', rob && rob.origenes.length === 3, (rob.origenes || []).join(', '));
ok('los más repetidos van primero', uni[0].veces >= uni[uni.length - 1].veces);
/* completar campos entre apariciones */
const parcial = [{ nombre: 'Test Uno', funcion: '', tel: '11 1111-1111', email: '', rubro: '', origen: 'a' },
{ nombre: '', funcion: 'Gaffer', tel: '11 1111-1111', email: 'test@x.com', rubro: '05', origen: 'b' }];
const u2 = unificarContactos(parcial)[0];
ok('completa los campos que falten entre apariciones',
  u2.nombre === 'Test Uno' && u2.funcion === 'Gaffer' && u2.email === 'test@x.com',
  `${u2.nombre} · ${u2.funcion} · ${u2.email}`);

console.log('\n--- 5. NO PISA LO QUE YA ESTA ---');
DB.catalogo.personas = [nuevaPersona({ nombre: 'Martín Bevilacqua', funcion: 'Director de Fotografía', rubro: '04', email: 'martin@df.com' })];
const conEstado = uni.map(c => ({ ...c, ya: yaEnCatalogo(c) }));
ok('detecta al que ya está', conEstado.filter(c => c.ya).length === 1,
  conEstado.filter(c => c.ya).map(c => c.nombre).join(','));
ok('los demás son nuevos', conEstado.filter(c => !c.ya).length === uni.length - 1);
ok('el match es por mail', yaEnCatalogo({ email: 'martin@df.com', nombre: 'Otro Nombre' }) !== null);
ok('y también por nombre', yaEnCatalogo({ nombre: 'Martín Bevilacqua', email: '' }) !== null);
ok('no matchea a cualquiera', yaEnCatalogo({ nombre: 'Nadie', email: 'nadie@x.com' }) === null);

console.log('\n--- 6. DISPONIBILIDAD ---');
DB.catalogo.personas = [];
const gaffer = nuevaPersona({ nombre: 'Roberto Díaz', funcion: 'Gaffer', rubro: '05' });
const libre = nuevaPersona({ nombre: 'Nadie Ocupado', funcion: 'Eléctrico', rubro: '05' });
DB.catalogo.personas.push(gaffer, libre);
/* meterlo en un proyecto con jornadas con fecha */
const py = getPy();
py.versiones[0].rubros.find(r => r.codigo === '05').lineas.push(nuevaLinea({ concepto: 'Gaffer', refId: gaffer.id }));
py.desglose.jornadas = [nuevaJornada({ numero: 1, fecha: '2026-09-14' }), nuevaJornada({ numero: 2, fecha: '2026-09-15' })];
const cmp = compromisos(gaffer.id);
console.log('  ' + gaffer.nombre + ': ' + cmp.map(c => c.fecha + ' (' + c.proyecto + ')').join(', '));
ok('encuentra sus compromisos', cmp.length === 2, cmp.length + ' jornadas');
ok('dice en qué proyecto', cmp[0].proyecto === py.nombre, cmp[0].proyecto);
ok('ocupado en su rango', disponibilidad(gaffer.id, '2026-09-14', '2026-09-16').estado === 'ocupado');
ok('libre fuera del rango', disponibilidad(gaffer.id, '2026-10-01', '2026-10-05').estado === 'libre',
  disponibilidad(gaffer.id, '2026-10-01', '2026-10-05').d);
ok('el que no está en ningún lado, libre', disponibilidad(libre.id).estado === 'libre',
  disponibilidad(libre.id).d);
ok('el choque dice cuál es', disponibilidad(gaffer.id, '2026-09-14', '2026-09-14').choques[0].jornada === 1);
ok('mira todas las productoras', (() => {
  const pr2 = nuevaProductora({ nombre: 'Otra Productora' });
  const py2 = nuevoProyecto({ nombre: 'Otro Spot' });
  py2.versiones[0].rubros.find(r => r.codigo === '05').lineas.push(nuevaLinea({ concepto: 'Gaffer', refId: gaffer.id }));
  py2.desglose.jornadas = [nuevaJornada({ numero: 1, fecha: '2026-11-20' })];
  pr2.proyectos.push(py2); DB.productoras.push(pr2);
  return compromisos(gaffer.id).length === 3;
})(), 'el mismo gaffer tomado por otra productora');

console.log('\n--- 7. BUSCADOR ---');
DB.ui.tab = 'catalogo'; DB.ui.subCat = 'gente';
DB.ui.fCat = { q: '', rubro: '', tipo: '', desde: '', hasta: '', soloLibres: false };
let html = catalogoGenteHTML();
ok('lista a los dos', /Roberto/.test(html) && /Nadie Ocupado/.test(html));
setFCat('q', 'roberto');
ok('busca por nombre', /Roberto/.test(catalogoGenteHTML()) && !/Nadie Ocupado/.test(catalogoGenteHTML()));
setFCat('q', 'gaffer');
ok('busca por función', /Roberto/.test(catalogoGenteHTML()));
limpiarFCat();
setFCat('rubro', '05');
ok('filtra por rubro', /Roberto/.test(catalogoGenteHTML()));
setFCat('rubro', '02');
ok('el filtro descarta', !/Roberto/.test(catalogoGenteHTML()));
limpiarFCat();
setFCat('desde', '2026-09-14'); setFCat('hasta', '2026-09-16');
html = catalogoGenteHTML();
ok('muestra ocupado en el rango', /disp ocupado/.test(html));
setFCat('soloLibres', true);
html = catalogoGenteHTML();
ok('sólo los libres esconde al ocupado', !/Roberto/.test(html) && /Nadie Ocupado/.test(html));
limpiarFCat();
ok('tiene la zona para soltar archivos', /dropz/.test((() => { modal = null; menuCallsheets(); const h = modal; cerrar(); return h; })()));

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
