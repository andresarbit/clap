/* Equipo, roles y circuito de aprobación de comprobantes. */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

const pr = getPr(), py = getPy(), v = getV();

/* --- 1. la taxonomía de rubros ------------------------------------------ */
console.log('--- 1. RUBROS INTERNOS ---');
const totalSub = Object.values(FUNCIONES).reduce((s, x) => s + x.length, 0);
console.log('  ' + RUBROS_BASE.length + ' rubros · ' + totalSub + ' subrubros');
RUBROS_BASE.forEach(r => console.log(`  ${r.codigo} ${r.nombre.padEnd(38)} ${String((FUNCIONES[r.codigo] || []).length).padStart(3)} subrubros`));
ok('17 rubros', RUBROS_BASE.length === 17, RUBROS_BASE.length);
ok('todos los rubros tienen subrubros', RUBROS_BASE.every(r => (FUNCIONES[r.codigo] || []).length > 0),
  RUBROS_BASE.filter(r => !(FUNCIONES[r.codigo] || []).length).map(r => r.codigo).join(',') || 'todos');
ok('más de 200 subrubros', totalSub > 200, totalSub);
ok('no hay subrubros duplicados dentro de un rubro',
  Object.entries(FUNCIONES).every(([k, xs]) => new Set(xs).size === xs.length));
ok('la lista plana los tiene a todos', SUBRUBROS.length === totalSub, SUBRUBROS.length);
ok('están los rubros nuevos', RUBROS_BASE.some(r => r.codigo === '16') && RUBROS_BASE.some(r => r.codigo === '17'));
ok('los rubros nuevos se agregan a presupuestos viejos', (() => {
  const vv = getV(); return vv.rubros.some(r => r.codigo === '16') && vv.rubros.some(r => r.codigo === '17');
})(), getV().rubros.length + ' rubros en el presupuesto');
ok('el orden de rubros queda correlativo',
  getV().rubros.map(r => r.codigo).join(',') === RUBROS_BASE.map(r => r.codigo).join(','),
  getV().rubros.map(r => r.codigo).join(','));

/* --- 2. equipo y roles --------------------------------------------------- */
console.log('\n--- 2. EQUIPO Y ROLES ---');
pr.usuarios = [];
const mk = (nombre, rol, depto) => { const u = nuevoUsuario({ nombre, rol, depto }); pr.usuarios.push(u); return u; };
const arte = mk('Sofía Arte', 'equipo', 'Arte');
const prod = mk('Lucía Ferrer', 'produccion', 'Producción');
const ejec = mk('Andrés PE', 'ejecutivo', 'Producción');
const admi = mk('Marta Admin', 'admin', 'Administración');
DB.ui.usuarioId = arte.id;
ok('la sesión devuelve al usuario elegido', getUsuario().id === arte.id, getUsuario().nombre);
ok('arte sólo puede cargar', puede(arte, 'cargar') && !puede(arte, 'revisar') && !puede(arte, 'pagar'));
ok('producción puede revisar pero no pagar', puede(prod, 'revisar') && !puede(prod, 'pagar'));
ok('el ejecutivo aprueba pero no paga', puede(ejec, 'aprobar') && !puede(ejec, 'pagar'));
ok('administración paga', puede(admi, 'pagar'));
ok('si el elegido no existe cae en alguien activo', (() => {
  DB.ui.usuarioId = 'no_existe'; const u = getUsuario(); DB.ui.usuarioId = arte.id; return !!u;
})());
arte.activo = false;
ok('un inactivo no puede ser la sesión', getUsuario().id !== arte.id, getUsuario().nombre);
arte.activo = true; DB.ui.usuarioId = arte.id;

/* --- 3. EL CIRCUITO ------------------------------------------------------ */
console.log('\n--- 3. EL CIRCUITO ---');
py.comprobantes = [];
/* arte carga una factura */
DB.ui.usuarioId = arte.id;
modal = null;
/* el stub tiene que responder sólo al selector del formulario; el resto
   (por ejemplo el toast) sigue devolviendo vacío */
const CAMPOS = [
  { name: 'rubro', value: '06' }, { name: 'subrubro', value: 'Compras de arte' },
  { name: 'concepto', value: 'Telas y pintura' }, { name: 'proveedor', value: 'Pinturería Norte' },
  { name: 'cuit', value: '30-11111111-1' }, { name: 'tipo', value: 'facA' }, { name: 'numero', value: '0001-00004521' },
  { name: 'fecha', value: '2026-09-14' }, { name: 'importe', value: '185000' }, { name: 'moneda', value: 'ARS' },
  { name: 'circuito', value: 'transferencia' }, { name: 'jornada', value: '' }, { name: 'notas', value: 'Lo pidió el DA' }];
global.document.querySelectorAll = sel => String(sel).includes('[name]') ? CAMPOS : [];
saveComprobante('');
const c = py.comprobantes[0];
ok('se creó el comprobante', py.comprobantes.length === 1);
ok('queda en estado cargado', c.estado === 'cargado', c.estado);
ok('registra quién lo cargó', c.cargadoPor === arte.id, c.cargadoPor === arte.id ? arte.nombre : '?');
ok('arranca el historial', c.historial.length === 1 && c.historial[0].a === 'cargado');
ok('guardó el rubro y el subrubro', c.rubro === '06' && c.subrubro === 'Compras de arte');
ok('guardó el importe', c.importe === 185000, c.importe);

/* arte NO puede revisarla */
ok('arte no puede mover lo que cargó', accionesDe(c, arte).length === 0, JSON.stringify(accionesDe(c, arte)));
/* producción sí */
ok('producción la ve para revisar', accionesDe(c, prod).includes('revisar'), accionesDe(c, prod).join(','));
ok('producción no puede aprobar todavía', !accionesDe(c, prod).includes('aprobar'));

DB.ui.usuarioId = prod.id;
moverComprobante(c.id, 'revisar');
ok('pasa a revisado', c.estado === 'revisado', c.estado);
ok('el historial firma quién revisó', c.historial[1].usuario === prod.nombre && c.historial[1].rol === 'produccion',
  c.historial[1].usuario);
ok('ahora producción no puede hacer nada más', !accionesDe(c, prod).includes('aprobar'));
ok('el ejecutivo la ve para aprobar', accionesDe(c, ejec).includes('aprobar'));

DB.ui.usuarioId = ejec.id;
moverComprobante(c.id, 'aprobar');
ok('pasa a aprobado', c.estado === 'aprobado', c.estado);
ok('el ejecutivo NO puede pagarla', !accionesDe(c, ejec).includes('pagar'), JSON.stringify(accionesDe(c, ejec)));
ok('administración sí', accionesDe(c, admi).includes('pagar'));

DB.ui.usuarioId = admi.id;
moverComprobante(c.id, 'pagar');
ok('pasa a pagado', c.estado === 'pagado', c.estado);
ok('cerrado: ya nadie puede moverlo', [arte, prod, ejec, admi].every(u => accionesDe(c, u).length === 0));
ok('el recorrido completo quedó registrado', c.historial.length === 4,
  c.historial.map(h => h.a + '/' + h.usuario.split(' ')[0]).join(' → '));

/* --- 4. rechazo ---------------------------------------------------------- */
console.log('\n--- 4. RECHAZO ---');
DB.ui.usuarioId = arte.id;
saveComprobante('');
const c2 = py.comprobantes[1];
DB.ui.usuarioId = prod.id;
ok('producción puede rechazar', accionesDe(c2, prod).includes('rechazar'));
moverComprobante(c2.id, 'rechazar', 'Este gasto no estaba autorizado');
ok('queda rechazado', c2.estado === 'rechazado', c2.estado);
ok('guarda el motivo', c2.historial[1].nota === 'Este gasto no estaba autorizado', c2.historial[1].nota);
ok('un rechazado no se puede seguir moviendo', accionesDe(c2, admi).length === 0);

/* --- 5. totales y control ------------------------------------------------ */
console.log('\n--- 5. PRESUPUESTADO VS REAL ---');
const RG = resumenGastos(py, v);
const arte06 = RG.filas.find(f => f.codigo === '06');
console.log(`  rubro 06: presupuestado ${fmt(arte06.presu)} · cargado ${fmt(arte06.gastado)} · pagado ${fmt(arte06.pagado)}`);
ok('suma sólo lo no rechazado', arte06.gastado === 185000, arte06.gastado);
ok('cuenta lo pagado aparte', arte06.pagado === 185000, arte06.pagado);
ok('el rechazado no entra en ningún rubro', RG.totalGastado === 185000, RG.totalGastado);
ok('pero sí figura en el conteo por estado', RG.porEstado.rechazado.cant === 1);
ok('calcula el desvío', arte06.desvio === 185000 - arte06.presu, arte06.desvio);

/* moneda extranjera se convierte a la base */
DB.ui.usuarioId = admi.id;
const cU = nuevoComprobante({ rubro: '09', importe: 1000, moneda: 'USD', estado: 'cargado', cargadoPor: admi.id });
py.comprobantes.push(cU);
const RG2 = resumenGastos(py, v);
ok('convierte USD a la moneda base', RG2.filas.find(f => f.codigo === '09').gastado === 1000 * v.tc,
  fmt(RG2.filas.find(f => f.codigo === '09').gastado) + ' con TC ' + v.tc);

/* --- 6. render ----------------------------------------------------------- */
console.log('\n--- 6. RENDER ---');
DB.ui.tab = 'gastos';
['bandeja', 'todos', 'control'].forEach(k => {
  try { setSubGasto(k); render(); ok('render ' + k, true); } catch (e) { ok('render ' + k, false, e.message); }
});
try { DB.ui.tab = 'equipo'; render(); ok('render equipo', true); } catch (e) { ok('render equipo', false, e.message); }
ok('la vista de equipo avisa que no es seguridad', /todavía no es seguridad/i.test(vistaEquipo(pr)));
ok('sin equipo cargado manda a cargarlo', (() => {
  const guardado = pr.usuarios; pr.usuarios = [];
  const h = vistaGastos(pr, py, v); pr.usuarios = guardado;
  return /Cargar el equipo/.test(h);
})());

/* la bandeja muestra lo correcto según el rol */
DB.ui.usuarioId = prod.id; DB.ui.subGasto = 'bandeja';
const pend = py.comprobantes.filter(x => accionesDe(x, prod).length);
ok('la bandeja de producción tiene lo que espera revisión', pend.length === 1, pend.length + ' pendiente(s)');
DB.ui.usuarioId = arte.id;
const mios = py.comprobantes.filter(x => x.cargadoPor === arte.id);
ok('arte ve lo que cargó', mios.length === 2, mios.length);

/* --- 7. espacio ---------------------------------------------------------- */
console.log('\n--- 7. ESPACIO ---');
localStorage.setItem(KEY, JSON.stringify(DB));   /* guardar() es diferido */
const esp = espacioUsado();
ok('mide el espacio usado', esp.bytes > 0 && esp.mb >= 0, esp.mb.toFixed(3) + ' MB · ' + esp.pct.toFixed(1) + '%');

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
