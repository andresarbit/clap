/* La migración de ids a UUID. Lo que importa no es que los ids cambien —eso es
   fácil— sino que NINGUNA referencia quede colgada. El id de una línea vive
   también dentro del comprobante que la paga, del contacto de esa línea, y como
   CLAVE de objeto en un par de lugares. Si se pierde una, el dato queda
   huérfano sin avisar.

   En vez de escribir a mano una DB de mentira —que envejece mal y se olvida de
   la mitad de los casos— acá se siembra un proyecto REAL con el mismo código
   que usa la app, se le devuelven los ids al formato viejo, y recién ahí se
   migra. Así el test cubre todo lo que la app sepa crear, hoy y mañana. */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

/* --- helpers ------------------------------------------------------------- */
const todosLosIds = () => { const r = [];
  (function j(x) { if (Array.isArray(x)) return x.forEach(j);
    if (!x || typeof x !== 'object') return;
    if (typeof x.id === 'string') r.push(x.id);
    Object.values(x).forEach(j); })(DB);
  return r; };

/* Devuelve la DB al formato de antes: ids tipo `ln_a1b2c3`, referencias y
   claves incluidas. Es exactamente lo inverso de lo que hace la migración. */
function envejecer() {
  const mapa = new Map();
  let cnt = 0;
  todosLosIds().forEach(i => { if (!mapa.has(i)) mapa.set(i, 'x' + (++cnt) + '_' + i.slice(0, 6)); });
  (function reesc(x) {
    if (Array.isArray(x)) return x.forEach(reesc);
    if (!x || typeof x !== 'object') return;
    for (const k of Object.keys(x)) {
      const v = x[k];
      if (typeof v === 'string' && mapa.has(v)) x[k] = mapa.get(v);
      else reesc(v);
      if (mapa.has(k)) { x[mapa.get(k)] = x[k]; delete x[k]; }
    }
  })(DB);
  return mapa.size;
}

console.log('--- 1. LOS IDS NUEVOS SON UUID ---');
const ids = Array.from({ length: 500 }, () => uid('ln'));
ok('tienen forma de UUID', ids.every(esUuid), ids[0]);
ok('son versión 4', ids.every(i => i[14] === '4'));
ok('no se repiten', new Set(ids).size === 500);
ok('el prefijo viejo se ignora', !ids[0].includes('ln_'));
ok('esUuid rechaza los de antes', !esUuid('ln_a1b2c3') && !esUuid('') && !esUuid(null) && !esUuid(7));

console.log('\n--- 2. SEMBRAR YA GENERA UUID ---');
DB = dbVacia(); sembrar();
ok('todos los ids del ejemplo son UUID', todosLosIds().every(esUuid),
  todosLosIds().filter(i => !esUuid(i)).join(',') || todosLosIds().length + ' ids, todos UUID');

/* --- 3. una foto de todo lo que hay que preservar ------------------------ */
console.log('\n--- 3. UN PROYECTO REAL, ENVEJECIDO Y MIGRADO ---');
const PY0 = getPy();
/* referencias cruzadas de verdad, para que haya algo que pueda romperse */
const per = DB.catalogo.personas[0] || nuevaPersona({ nombre: 'Roberto Díaz', funcion: 'Gaffer', rubro: '05' });
if (!DB.catalogo.personas.length) DB.catalogo.personas.push(per);
const linea = getV().rubros.find(r => r.lineas.length).lineas[0];
linea.refId = per.id;
PY0.contactos.porLinea[linea.id] = { nombre: 'Roberto Díaz', tel: '11 5555-1' };
if (!PY0.desglose.jornadas.length)
  PY0.desglose.jornadas.push(nuevaJornada({ numero: 1, fecha: '2026-09-14' }));
const J0 = PY0.desglose.jornadas[0];
J0.parte ||= nuevoParte();
J0.parte.fichadas[per.id] = { entrada: '07:00', salida: '19:00' };
J0.parte.citados[per.id] = '07:00';
if (PY0.comprobantes.length) PY0.comprobantes[0].lineaId = linea.id;
if (!PY0.desglose.escenas.length)
  PY0.desglose.escenas.push(nuevaEscena({ numero: 1, encabezado: 'INT. CASA - DIA' }));

const cuantosIds = todosLosIds().length;
const antesDeTodo = calcular(getV());
const nombresAntes = todosLosIds().length;

const envejecidos = envejecer();
ok('la DB quedó con ids viejos', todosLosIds().every(i => !esUuid(i)), envejecidos + ' ids envejecidos');
DB.schemaVersion = 1;

const migrados = migrarIdsAUuid();
ok('migró exactamente los que había', migrados === envejecidos, migrados + ' de ' + envejecidos);
ok('no se perdió ni se duplicó ningún id', todosLosIds().length === cuantosIds,
  todosLosIds().length + ' vs ' + cuantosIds);
ok('todos son UUID ahora', todosLosIds().every(esUuid),
  todosLosIds().filter(i => !esUuid(i)).join(',') || 'todos');
ok('no hay ids repetidos', new Set(todosLosIds()).size === todosLosIds().length);

console.log('\n--- 4. NINGUNA REFERENCIA QUEDO COLGADA ---');
const PY = getPy(), V = getV(), PR = getPr();
const ln = V.rubros.find(r => r.lineas.length).lineas[0];
const P = DB.catalogo.personas[0];
ok('la línea sigue apuntando a la persona del catálogo', ln.refId === P.id, ln.refId);
ok('el comprobante sigue apuntando a su línea', PY.comprobantes[0].lineaId === ln.id);
/* nada puede apuntar a un id que no exista */
const existentes = new Set(todosLosIds());
const colgadas = [];
(function rev(x, ruta) {
  if (Array.isArray(x)) return x.forEach((v, i) => rev(v, ruta + '[' + i + ']'));
  if (!x || typeof x !== 'object') return;
  for (const [k, v] of Object.entries(x)) {
    if (typeof v === 'string' && /Id$|^refId$/.test(k) && v && !existentes.has(v)) colgadas.push(ruta + '.' + k);
    else rev(v, ruta + '.' + k);
  }
})(DB.productoras, 'productoras');
ok('ningún campo *Id apunta al vacío', colgadas.length === 0, colgadas.slice(0, 4).join(' ') || 'ninguno');

console.log('\n--- 5. LAS CLAVES DE OBJETO, QUE ES LO QUE SE OLVIDA ---');
ok('contactos.porLinea se reindexó', Object.keys(PY.contactos.porLinea)[0] === ln.id,
  Object.keys(PY.contactos.porLinea)[0]);
ok('y conservó el contenido', PY.contactos.porLinea[ln.id].nombre === 'Roberto Díaz');
const parte = PY.desglose.jornadas[0].parte;
ok('las fichadas se reindexaron', !!parte.fichadas[P.id], Object.keys(parte.fichadas).join(','));
ok('con su horario intacto', parte.fichadas[P.id].entrada === '07:00');
ok('los citados también', parte.citados[P.id] === '07:00');

console.log('\n--- 6. LA UI SIGUE APUNTANDO A ALGO QUE EXISTE ---');
ok('productora seleccionada existe', !!getPr() && DB.ui.productoraId === PR.id);
ok('proyecto seleccionado existe', !!getPy() && DB.ui.proyectoId === PY.id);
ok('versión seleccionada existe', !!getV() && DB.ui.versionId === V.id);
ok('usuario seleccionado existe', !!getUsuario(), getUsuario() && getUsuario().nombre);

console.log('\n--- 7. LOS NUMEROS NO SE MOVIERON ---');
const despuesDeTodo = calcular(getV());
ok('el subtotal es el mismo', despuesDeTodo.subtotal === antesDeTodo.subtotal,
  '$ ' + despuesDeTodo.subtotal.toLocaleString('es-AR'));
ok('el total es el mismo', despuesDeTodo.total === antesDeTodo.total);
ok('el nombre del proyecto quedó igual', PY.nombre === 'Spot Verano — 30"', PY.nombre);
ok('los conceptos no se tocaron', ln.concepto && !esUuid(ln.concepto), ln.concepto);

console.log('\n--- 8. TODAS LAS PANTALLAS SIGUEN RENDERIZANDO ---');
const rotas = [];
const SOLAPAS = ['resumen', 'guia', 'presu', 'desglose', 'callsheet', 'rodaje',
  'gastos', 'equipo', 'catalogo', 'config'];
SOLAPAS.forEach(k => { try { setTab(k); } catch (e) { rotas.push(k + ': ' + e.message); } });
['bandeja', 'todos', 'oc', 'caja', 'areas', 'control'].forEach(k => {
  try { setTab('gastos'); setSubGasto(k); } catch (e) { rotas.push('gastos/' + k + ': ' + e.message); } });
['escenas', 'deptos', 'plan'].forEach(k => {
  try { setTab('desglose'); setSub(k); } catch (e) { rotas.push('desglose/' + k + ': ' + e.message); } });
['hoja', 'contactos'].forEach(k => {
  try { setTab('callsheet'); setSubCall(k); } catch (e) { rotas.push('callsheet/' + k + ': ' + e.message); } });
['citaciones', 'parte', 'horas'].forEach(k => {
  try { setTab('rodaje'); setSubRodaje(k); } catch (e) { rotas.push('rodaje/' + k + ': ' + e.message); } });
['gente', 'sica'].forEach(k => {
  try { setTab('catalogo'); setSubCat(k); } catch (e) { rotas.push('catalogo/' + k + ': ' + e.message); } });
ok('ninguna vista se rompió tras migrar', rotas.length === 0,
  rotas.slice(0, 3).join(' | ') || '24 vistas OK');

console.log('\n--- 9. CORRERLA DE NUEVO NO HACE NADA ---');
migrar();                       /* que normalice lo que tenga que normalizar */
const foto = JSON.stringify(DB);
ok('la segunda pasada no encuentra ids que migrar', migrarIdsAUuid() === 0);
ok('y no toca un solo byte', JSON.stringify(DB) === foto);
DB.schemaVersion = 1; migrar(); /* forzarla a creerse vieja otra vez */
ok('migrar() completo es idempotente', JSON.stringify(DB) === foto);
ok('y la deja marcada como v2', DB.schemaVersion === 2);

console.log('\n--- 10. SOBREVIVE A GUARDAR Y RECARGAR ---');
localStorage.setItem('clap.db.v1', JSON.stringify(DB));
const idAntes = getPy().id;
DB = null; cargar();
ok('recarga sin perder el proyecto', !!getPy() && getPy().id === idAntes);
ok('sigue siendo v2', DB.schemaVersion === 2);
ok('los ids siguen siendo UUID', todosLosIds().every(esUuid));

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
