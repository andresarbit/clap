/* Lista de contactos del proyecto: se tiene que armar SOLA a medida que se
   cargan los profesionales en el catálogo y en el presupuesto. */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

const pr = getPr(), py = getPy(), v = getV();
DB.ui.tab = 'callsheet'; DB.ui.subCall = 'contactos';

/* --- 1. se arma sola desde lo que ya está cargado ------------------------ */
console.log('--- 1. SE ARMA SOLA ---');
let C = armarContactos(py, v);
console.log(C.grupos.map(g => '  ' + g.nombre.padEnd(26) + g.filas.length + ' filas').join('\n'));
ok('hay grupos', C.grupos.length >= 4, C.grupos.map(g => g.nombre).join(' | '));
ok('incluye cliente y agencia', C.grupos[0].filas.some(f => f.nombre === py.cliente) &&
  C.grupos[0].filas.some(f => f.nombre === py.agencia), C.grupos[0].filas.map(f => f.nombre).join(','));
ok('un grupo por departamento técnico', C.grupos.some(g => g.nombre === 'Dirección') &&
  C.grupos.some(g => g.nombre === 'Fotografía y Cámara'));
ok('tiene Elenco', C.grupos.some(g => g.nombre === 'Elenco'));
ok('tiene Proveedores', C.grupos.some(g => g.nombre === 'Proveedores'));

/* los enlazados al catálogo traen nombre y datos solos */
const dfCat = DB.catalogo.personas.find(p => p.funcion === 'Director de Fotografía');
dfCat.tel = '11-5555-1111'; dfCat.email = 'martin@df.com';
C = armarContactos(py, v);
const df = C.grupos.flatMap(g => g.filas).find(f => f.refId === dfCat.id);
ok('el enlazado al catálogo trae nombre solo', df && df.nombre === dfCat.nombre, df && df.nombre);
ok('trae teléfono y mail del catálogo', df.tel === '11-5555-1111' && df.email === 'martin@df.com',
  df.tel + ' / ' + df.email);
ok('marca que está enlazado', !!df.refId);
ok('cuenta los que faltan', C.sinDatos > 0, C.sinDatos + ' sin tel ni mail de ' + C.total);

/* --- 2. cargar a mano un contacto de una línea sin catálogo -------------- */
console.log('\n--- 2. CARGAR A MANO ---');
const lineaDir = v.rubros.find(r => r.codigo === '02').lineas[0];
ok('la línea del Director no está enlazada', !lineaDir.refId, lineaDir.concepto);
upContacto('l:' + lineaDir.id, 'nombre', 'Ana Suárez');
upContacto('l:' + lineaDir.id, 'tel', '11-4444-2222');
upContacto('l:' + lineaDir.id, 'email', 'ana@directora.com');
C = armarContactos(py, v);
const dir = C.grupos.flatMap(g => g.filas).find(f => f.clave === 'l:' + lineaDir.id);
ok('guarda lo cargado a mano', dir.nombre === 'Ana Suárez' && dir.email === 'ana@directora.com',
  dir.nombre + ' / ' + dir.tel + ' / ' + dir.email);

/* --- 3. EL CIRCUITO: lo cargado acá aparece en el callsheet -------------- */
console.log('\n--- 3. EL DATO VIAJA AL CALLSHEET ---');
guionEjemplo(); autoAgrupar(); DB.ui.jornada = 1;
const CS = armarCallsheet(py, v, 1);
const enCS = CS.crew.find(c => c.clave === 'l:' + lineaDir.id);
ok('el nombre cargado a mano llega al callsheet', enCS && enCS.nombre === 'Ana Suárez', enCS && enCS.nombre);
ok('el teléfono también', enCS.tel === '11-4444-2222', enCS.tel);
ok('y el mail', enCS.email === 'ana@directora.com', enCS.email);
const enCSdf = CS.crew.find(c => c.clave.endsWith(dfCat.id) || (c.persona && c.persona.id === dfCat.id));
ok('los del catálogo también llegan', enCSdf && enCSdf.email === 'martin@df.com', enCSdf && enCSdf.email);
ok('el callsheet muestra la columna de mail', /<th>Mail<\/th>/.test(hojaCitacionHTML(pr, py, v)));

/* --- 4. editar un enlazado escribe en el catálogo ------------------------ */
console.log('\n--- 4. UN SOLO LUGAR POR PERSONA ---');
upContacto('l:' + v.rubros.find(r => r.codigo === '04').lineas[0].id, 'tel', '11-9999-0000');
ok('editar el contacto actualiza el CATÁLOGO', dfCat.tel === '11-9999-0000', dfCat.tel);
ok('no duplica en porLinea', !py.contactos.porLinea['l:' + v.rubros.find(r => r.codigo === '04').lineas[0].id]);
ok('el cambio se ve en todos lados', armarCallsheet(py, v, 1).crew.find(c => c.persona && c.persona.id === dfCat.id).tel === '11-9999-0000');

/* --- 5. guardar en el catálogo lo cargado a mano ------------------------- */
console.log('\n--- 5. GUARDAR EN EL CATALOGO ---');
const antesCat = DB.catalogo.personas.length;
aCatalogo('l:' + lineaDir.id);
ok('suma la persona al catálogo', DB.catalogo.personas.length === antesCat + 1);
const nueva = DB.catalogo.personas[DB.catalogo.personas.length - 1];
ok('con nombre, tel y mail', nueva.nombre === 'Ana Suárez' && nueva.tel === '11-4444-2222' && nueva.email === 'ana@directora.com');
ok('con su función y rubro', nueva.funcion === 'Director' && nueva.rubro === '02', nueva.funcion + '/' + nueva.rubro);
ok('la línea del presupuesto queda enlazada', lineaDir.refId === nueva.id);
ok('deja de estar suelto en porLinea', !py.contactos.porLinea['l:' + lineaDir.id]);
C = armarContactos(py, v);
ok('sigue apareciendo, ahora enlazado',
  C.grupos.flatMap(g => g.filas).find(f => f.clave === 'l:' + lineaDir.id).refId === nueva.id);

/* --- 6. contactos sueltos (cliente, agencia, lo que sea) ----------------- */
console.log('\n--- 6. CONTACTOS SUELTOS ---');
const n0 = py.contactos.extra.length;
addContacto('Producción y cliente');
const ct = py.contactos.extra[py.contactos.extra.length - 1];
upContacto('x:' + ct.id, 'rol', 'Productor de agencia');
upContacto('x:' + ct.id, 'nombre', 'Pablo Gómez');
upContacto('x:' + ct.id, 'email', 'pablo@agencia.com');
C = armarContactos(py, v);
ok('el suelto aparece en su grupo',
  C.grupos[0].filas.some(f => f.nombre === 'Pablo Gómez' && f.rol === 'Productor de agencia'));
ok('se puede eliminar', (() => { delContacto(ct.id); return py.contactos.extra.length === n0; })());

/* --- 7. copiar mails y exportar ----------------------------------------- */
console.log('\n--- 7. MAILS Y EXPORT ---');
C = armarContactos(py, v);
console.log('  mails:', C.mails.join(', '));
ok('junta los mails sin repetir', C.mails.length === new Set(C.mails).size && C.mails.length >= 2, C.mails.length);
ok('sólo direcciones válidas', C.mails.every(m => m.includes('@')));
let copiado = null;
/* Node 21+ ya trae un `navigator` de sólo lectura: hay que redefinirlo */
Object.defineProperty(globalThis, 'navigator', {
  configurable: true, writable: true,
  value: { clipboard: { writeText: t => { copiado = t; return Promise.resolve(); } } }
});
copiarMails();
ok('copia separado por comas', copiado && copiado.split(', ').length === C.mails.length, copiado);
let csv = null; const _b = bajar; bajar = (n, c) => csv = c; expContactosCSV(); bajar = _b;
ok('el CSV trae encabezado y filas', csv && /Grupo.*Rol.*Nombre.*Tel/.test(csv.split('\n')[0]) &&
  csv.split('\n').length > 5, (csv || '').split('\n').length + ' filas');
ok('el CSV incluye a los del catálogo', /Ana Su/.test(csv) || /Martín/.test(csv));

/* --- 8. render y robustez ----------------------------------------------- */
console.log('\n--- 8. RENDER ---');
['hoja', 'contactos'].forEach(k => {
  try { setSubCall(k); ok('render sub-vista ' + k, true); }
  catch (e) { ok('render sub-vista ' + k, false, e.message); }
});
const html = vistaContactos(pr, py, v);
ok('muestra el total', /\d+<span> contactos<\/span>/.test(html));
ok('tiene botón de copiar mails', /Copiar los \d+ mails/.test(html));
ok('proyecto sin desglose no rompe', (() => {
  const p2 = nuevoProyecto({ nombre: 'Vacío' }); getPr().proyectos.push(p2);
  DB.ui.proyectoId = p2.id; DB.ui.versionId = p2.versiones[0].id;
  try { armarContactos(p2, p2.versiones[0]); vistaContactos(pr, p2, p2.versiones[0]); return true; }
  catch (e) { return e.message; }
})() === true);

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
