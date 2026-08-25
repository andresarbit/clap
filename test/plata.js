/* Órdenes de compra, caja chica y el tablero de plata. */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

const pr = getPr(), py = getPy(), v = getV();
pr.usuarios = [];
const mk = (nombre, rol) => { const u = nuevoUsuario({ nombre, rol }); pr.usuarios.push(u); return u; };
const arte = mk('Sofía Arte', 'equipo'), prod = mk('Lucía', 'produccion');
const ejec = mk('Andrés', 'ejecutivo'), admi = mk('Marta', 'admin');
DB.ui.usuarioId = ejec.id;
py.comprobantes = []; py.ocs = []; py.cajas = [];
const BASE = v.monedaBase, TC = v.tc;
const cbte = o => { const c = nuevoComprobante({ cargadoPor: arte.id, ...o }); py.comprobantes.push(c); return c; };

/* --- 1. numeración y alta de OC ----------------------------------------- */
console.log('--- 1. ORDENES DE COMPRA ---');
ok('numera desde OC-0001', proximoNumeroOC(py) === 'OC-0001', proximoNumeroOC(py));
const oc1 = nuevaOC({ numero: proximoNumeroOC(py), rubro: '11', subrubro: 'Paquete de luces', proveedor: 'Rental Sur', importe: 520000 });
py.ocs.push(oc1);
ok('la siguiente es OC-0002', proximoNumeroOC(py) === 'OC-0002', proximoNumeroOC(py));
ok('arranca en borrador', oc1.estado === 'borrador');
ok('en borrador NO compromete', comprometidoDeOC(py, oc1, BASE, TC) === 0);

emitirOC(oc1.id);
ok('emitida compromete el total', comprometidoDeOC(py, oc1, BASE, TC) === 520000,
  comprometidoDeOC(py, oc1, BASE, TC));
ok('registra quién la emitió', oc1.emitidaPor === ejec.id && oc1.historial.length === 1);

/* --- 2. la factura contra la OC no cuenta dos veces ---------------------- */
console.log('\n--- 2. NO CONTAR DOS VECES ---');
const f1 = cbte({ rubro: '11', subrubro: 'Paquete de luces', importe: 300000, ocId: oc1.id });
ok('facturado parcial', facturadoDeOC(py, oc1.id, BASE, TC) === 300000);
ok('el comprometido baja a la diferencia', comprometidoDeOC(py, oc1, BASE, TC) === 220000,
  comprometidoDeOC(py, oc1, BASE, TC));
let P = resumenPlata(py, v);
let r11 = P.filas.find(f => f.codigo === '11');
ok('comprometido + real = el total de la OC', r11.comp + r11.real === 520000,
  `${fmt(r11.comp)} + ${fmt(r11.real)}`);

const f2 = cbte({ rubro: '11', importe: 220000, ocId: oc1.id });
ok('facturada entera, no queda comprometido', comprometidoDeOC(py, oc1, BASE, TC) === 0);
ok('si se factura de más, el comprometido no se va a negativo', (() => {
  const extra = cbte({ rubro: '11', importe: 50000, ocId: oc1.id });
  const c0 = comprometidoDeOC(py, oc1, BASE, TC);
  py.comprobantes = py.comprobantes.filter(x => x.id !== extra.id);
  return c0 === 0;
})());
ok('un comprobante rechazado no cuenta como facturado', (() => {
  f2.estado = 'rechazado';
  const fac = facturadoDeOC(py, oc1.id, BASE, TC);
  f2.estado = 'cargado';
  return fac === 300000;
})());
cerrarOC(oc1.id);
ok('dada por cumplida deja de comprometer', comprometidoDeOC(py, oc1, BASE, TC) === 0, oc1.estado);

/* --- 3. el tablero ------------------------------------------------------- */
console.log('\n--- 3. TABLERO ---');
const oc2 = nuevaOC({ numero: 'OC-0002', rubro: '13', subrubro: 'Almuerzo', proveedor: 'Catering', importe: 400000 });
py.ocs.push(oc2); emitirOC(oc2.id);
cbte({ rubro: '06', subrubro: 'Compras de arte', importe: 185000, estado: 'pagado' });
P = resumenPlata(py, v);
console.log('  ' + 'RUBRO'.padEnd(30) + 'PRESU'.padStart(13) + 'COMPROM'.padStart(12) + 'REAL'.padStart(12) + 'DISPON'.padStart(13));
P.filas.filter(f => f.presu || f.comp || f.real).forEach(f => console.log('  ' +
  (f.codigo + ' ' + f.nombre).slice(0, 29).padEnd(30) +
  Math.round(f.presu).toLocaleString('es-AR').padStart(13) +
  Math.round(f.comp).toLocaleString('es-AR').padStart(12) +
  Math.round(f.real).toLocaleString('es-AR').padStart(12) +
  Math.round(f.disponible).toLocaleString('es-AR').padStart(13)));
console.log('  ' + 'TOTAL'.padEnd(30) + Math.round(P.presu).toLocaleString('es-AR').padStart(13) +
  Math.round(P.comp).toLocaleString('es-AR').padStart(12) +
  Math.round(P.real).toLocaleString('es-AR').padStart(12) +
  Math.round(P.disponible).toLocaleString('es-AR').padStart(13));

ok('disponible = presupuestado − comprometido − real',
  Math.abs(P.disponible - (P.presu - P.comp - P.real)) < 1);
ok('los totales son la suma de las filas',
  Math.abs(P.real - P.filas.reduce((s, f) => s + f.real, 0)) < 1);
ok('el catering queda comprometido', P.filas.find(f => f.codigo === '13').comp === 400000);
ok('separa pagado de real', P.pagado === 185000 && P.real > P.pagado, fmt(P.pagado) + ' de ' + fmt(P.real));
ok('marca el desvío', P.desvio === (P.comp + P.real) - P.presu);

/* USD se convierte */
cbte({ rubro: '09', importe: 1000, moneda: 'USD' });
P = resumenPlata(py, v);
ok('convierte USD al tipo de cambio', P.filas.find(f => f.codigo === '09').real === 1000 * TC,
  fmt(P.filas.find(f => f.codigo === '09').real));

/* --- 4. caja chica ------------------------------------------------------- */
console.log('\n--- 4. CAJA CHICA ---');
const cj = nuevaCaja({ nombre: 'Caja arte J1', responsable: arte.id, jornada: 1 });
py.cajas.push(cj);
cj.adelantos.push({ id: uid('ad'), fecha: hoy(), importe: 200000, circuito: 'efectivo' });
let s = saldoCaja(py, cj);
ok('el adelanto entra', s.entregado === 200000 && s.saldo === 200000, fmt(s.saldo));
cbte({ rubro: '06', subrubro: 'Utilero', importe: 45000, cajaId: cj.id, tipo: 'facBC' });
cbte({ rubro: '06', subrubro: 'Compras de arte', importe: 30000, cajaId: cj.id, tipo: 'ninguno' });
s = saldoCaja(py, cj);
ok('los gastos bajan el saldo', s.gastado === 75000 && s.saldo === 125000, fmt(s.saldo));
ok('cuenta cuánto tiene comprobante', s.conComprobante === 45000, fmt(s.conComprobante));
ok('y cuánto no', s.sinComprobante === 30000, fmt(s.sinComprobante));
ok('un gasto rechazado no consume la caja', (() => {
  const rech = cbte({ rubro: '06', importe: 99000, cajaId: cj.id, estado: 'rechazado' });
  const s2 = saldoCaja(py, cj);
  py.comprobantes = py.comprobantes.filter(x => x.id !== rech.id);
  return s2.gastado === 75000;
})());
cj.adelantos.push({ id: uid('ad'), fecha: hoy(), importe: 50000, circuito: 'efectivo' });
ok('un segundo adelanto suma', saldoCaja(py, cj).entregado === 250000);

/* rendición con saldo a favor de la productora */
DB.ui.usuarioId = admi.id;
global.document.querySelectorAll = sel => String(sel).includes('[name]') ? [{ name: 'notas', value: 'Devolvió en efectivo' }] : [];
confirmarRendicion(cj.id);
ok('queda rendida', cj.estado === 'rendida' && cj.rendidaEl === hoy());
ok('calcula lo que tiene que devolver', cj.devuelto === 175000 && cj.reintegro === 0, fmt(cj.devuelto));
ok('guarda la nota', cj.notas === 'Devolvió en efectivo');

/* rendición cuando gastó de más */
const cj2 = nuevaCaja({ nombre: 'Caja 2', responsable: prod.id });
py.cajas.push(cj2);
cj2.adelantos.push({ id: uid('ad'), fecha: hoy(), importe: 50000, circuito: 'efectivo' });
cbte({ rubro: '13', importe: 72000, cajaId: cj2.id, tipo: 'reciboS' });
const s2 = saldoCaja(py, cj2);
ok('saldo negativo cuando gastó de más', s2.saldo === -22000, fmt(s2.saldo));
confirmarRendicion(cj2.id);
ok('calcula el reintegro', cj2.reintegro === 22000 && cj2.devuelto === 0, fmt(cj2.reintegro));

/* --- 5. separar facturas por rubro (lo que pidió administración) --------- */
console.log('\n--- 5. FACTURAS POR RUBRO ---');
ok('el rubro es obligatorio', (() => {
  let alertado = false; const _a = global.alert; global.alert = () => alertado = true;
  const antes = py.comprobantes.length;
  global.document.querySelectorAll = sel => String(sel).includes('[name]')
    ? [{ name: 'rubro', value: '' }, { name: 'importe', value: '5000' }] : [];
  saveComprobante(''); global.alert = _a;
  return alertado && py.comprobantes.length === antes;
})(), 'no deja guardar sin rubro');
const porRubro = {};
py.comprobantes.forEach(c => (porRubro[c.rubro] ||= []).push(c));
Object.entries(porRubro).sort().forEach(([k, xs]) => console.log(
  `  ${k} ${((RUBROS_BASE.find(r => r.codigo === k) || {}).nombre || '').padEnd(32)} ${xs.length} cbte(s)  ${fmt(xs.reduce((a, c) => a + (c.moneda === 'ARS' ? c.importe : 0), 0))}`));
ok('todos los comprobantes tienen rubro', py.comprobantes.every(c => c.rubro), Object.keys(porRubro).join(','));
DB.ui.fGasto = { rubro: '06', estado: '', q: '' };
const soloArte = py.comprobantes.filter(c => c.rubro === DB.ui.fGasto.rubro);
ok('se pueden filtrar los de un rubro', soloArte.length === 3, soloArte.length + ' de arte');
DB.ui.fGasto = { rubro: '', estado: 'pagado', q: '' };
ok('y por estado', py.comprobantes.filter(c => c.estado === 'pagado').length === 1);
DB.ui.fGasto = { rubro: '', estado: '', q: 'catering' };
limpiarFiltros();
ok('limpiar deja los filtros vacíos', !DB.ui.fGasto.rubro && !DB.ui.fGasto.estado && !DB.ui.fGasto.q);

/* export para el contador */
let csv = null; const _b = bajar; bajar = (nm, c) => csv = c; expGastosCSV(); bajar = _b;
const cab = csv.split('\n')[0];
ok('el CSV trae el rubro en cada fila', /Rubro.*Cód. rubro.*Subrubro/.test(cab), cab.slice(0, 70));
ok('el CSV trae todas las filas', csv.split('\n').length === py.comprobantes.length + 1,
  (csv.split('\n').length - 1) + ' filas');
ok('el CSV incluye OC y caja', /Orden de compra/.test(cab) && /Caja chica/.test(cab));

/* --- 6. render ----------------------------------------------------------- */
console.log('\n--- 6. RENDER ---');
DB.ui.tab = 'gastos';
['bandeja', 'todos', 'oc', 'caja', 'control'].forEach(k => {
  try { setSubGasto(k); render(); ok('render ' + k, true); } catch (e) { ok('render ' + k, false, e.message); }
});
ok('el tablero muestra las cinco columnas', (() => {
  const h = tableroHTML(py, v);
  return ['Presupuestado', 'Comprometido', 'Real', 'Pagado', 'Disponible'].every(x => h.includes(x));
})());
ok('la caja rendida muestra la devolución', /Devolvió/.test(cajasHTML(py, v, getUsuario(), pr)));
ok('proyecto vacío no rompe', (() => {
  const p2 = nuevoProyecto({ nombre: 'Vacío' }); pr.proyectos.push(p2);
  try { resumenPlata(p2, p2.versiones[0]); tableroHTML(p2, p2.versiones[0]); return true; }
  catch (e) { return e.message; }
})() === true);

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
