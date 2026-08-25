/* La portada y la semilla: ninguna pantalla tiene que arrancar vacía. */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

const pr = getPr(), py = getPy(), v = getV();

console.log('--- 1. LA SEMILLA TRAE DATOS ---');
ok('la portada es la solapa por defecto', DB.ui.tab === 'resumen', DB.ui.tab);
ok('trae equipo con los 4 roles', (pr.usuarios || []).length === 4,
  (pr.usuarios || []).map(u => u.nombre + '/' + u.rol).join(', '));
ok('hay uno por cada rol', ROLES.every(r => pr.usuarios.some(u => u.rol === r.k)),
  ROLES.map(r => r.k).join(','));
ok('arranca con una sesión activa', !!getUsuario(), getUsuario()?.nombre + ' · ' + ROL(getUsuario().rol).l);
ok('trae comprobantes', py.comprobantes.length === 4, py.comprobantes.length);
ok('en distintos estados', new Set(py.comprobantes.map(c => c.estado)).size >= 3,
  [...new Set(py.comprobantes.map(c => c.estado))].join(', '));
ok('trae una orden de compra emitida', py.ocs.length === 1 && py.ocs[0].estado === 'emitida');
ok('trae una caja abierta con adelanto', py.cajas.length === 1 && py.cajas[0].adelantos.length === 1,
  fmt(saldoCaja(py, py.cajas[0]).entregado) + ' entregado');
ok('todos los comprobantes tienen rubro', py.comprobantes.every(c => c.rubro));
ok('los historiales son coherentes con el estado',
  py.comprobantes.every(c => c.historial.length && c.historial[c.historial.length - 1].a === c.estado),
  py.comprobantes.map(c => c.estado + ':' + c.historial.length).join(' '));
ok('el comprobante contra la OC la referencia',
  py.comprobantes.some(c => c.ocId === py.ocs[0].id));
ok('los de caja la referencian', py.comprobantes.filter(c => c.cajaId === py.cajas[0].id).length === 2);

console.log('\n--- 2. NINGUNA PANTALLA VACIA ---');
const pantallas = [
  ['resumen', () => vistaResumen(pr, py, v)],
  ['equipo', () => vistaEquipo(pr)],
  ['gastos · bandeja', () => { DB.ui.subGasto = 'bandeja'; return vistaGastos(pr, py, v); }],
  ['gastos · comprobantes', () => { DB.ui.subGasto = 'todos'; return vistaGastos(pr, py, v); }],
  ['gastos · OC', () => { DB.ui.subGasto = 'oc'; return vistaGastos(pr, py, v); }],
  ['gastos · caja', () => { DB.ui.subGasto = 'caja'; return vistaGastos(pr, py, v); }],
  ['gastos · tablero', () => { DB.ui.subGasto = 'control'; return vistaGastos(pr, py, v); }],
];
pantallas.forEach(([n, f]) => {
  let h = '';
  try { h = f(); } catch (e) { ok(n, false, e.message); return; }
  const vacia = /class="empty"/.test(h) && !/tbody>\s*<tr/.test(h);
  ok(n + ' muestra contenido', !vacia && h.length > 400, h.length + ' chars' + (vacia ? ' pero está VACIA' : ''));
});

console.log('\n--- 3. LA PORTADA DICE LO QUE PASA ---');
const html = vistaResumen(pr, py, v);
const P = resumenPlata(py, v);
console.log('  presupuestado ' + fmt(P.presu) + ' · comprometido ' + fmt(P.comp) +
  ' · real ' + fmt(P.real) + ' · pagado ' + fmt(P.pagado) + ' · disponible ' + fmt(P.disponible));
ok('muestra el nombre del proyecto', html.includes(esc(py.nombre)));
ok('muestra las cinco cifras', ['Costo directo', 'Comprometido', 'Real cargado', 'Pagado', 'Disponible']
  .every(x => html.includes(x)));
ok('tiene el bloque de pendientes', /Esperan algo/.test(html));
ok('tiene el bloque del proyecto', /Guion y desglose/.test(html) && /Rodaje/.test(html) && /Equipo/.test(html));
ok('la OC emitida se ve como comprometida', P.comp === 220000, fmt(P.comp) + ' (520.000 − 300.000 facturados)');

console.log('\n--- 4. LOS PENDIENTES SON REALES ---');
/* el ejecutivo tiene que ver el comprobante revisado esperando aprobación */
const ejec = pr.usuarios.find(u => u.rol === 'ejecutivo');
DB.ui.usuarioId = ejec.id;
const pendEjec = py.comprobantes.filter(c => accionesDe(c, ejec).length);
ok('el ejecutivo tiene algo para aprobar', pendEjec.some(c => c.estado === 'revisado'),
  pendEjec.map(c => c.estado).join(','));
ok('la portada lo lista', /comprobantes (para aprobar|esperándote)/.test(vistaResumen(pr, py, v)),
  (vistaResumen(pr, py, v).replace(/<[^>]+>/g, ' ').match(/\d+\s+comprobantes?[^<]{0,24}/) || [''])[0].trim());
ok('avisa de la caja sin rendir', /sin rendir/.test(vistaResumen(pr, py, v)));
/* arte, que sólo carga, no debería tener pendientes de aprobación */
const arte = pr.usuarios.find(u => u.rol === 'equipo');
DB.ui.usuarioId = arte.id;
ok('arte no tiene nada para aprobar', py.comprobantes.filter(c => accionesDe(c, arte).length).length === 0);
DB.ui.usuarioId = ejec.id;

/* al pagar todo, el pendiente desaparece */
py.comprobantes.forEach(c => { c.estado = 'pagado'; });
ok('sin pendientes de comprobantes lo dice',
  !/(para revisar|para aprobar|para pagar|esperándote)/.test(vistaResumen(pr, py, v)));
/* y si un rubro se pasa, aparece la alerta */
py.comprobantes[0].rubro = '02'; py.comprobantes[0].importe = 99000000;
ok('alerta de rubro pasado de presupuesto', /pasados de presupuesto/.test(vistaResumen(pr, py, v)));

console.log('\n--- 5. ROBUSTEZ ---');
ok('proyecto nuevo y vacío no rompe', (() => {
  const p2 = nuevoProyecto({ nombre: 'Nuevo' }); pr.proyectos.push(p2);
  try { vistaResumen(pr, p2, p2.versiones[0]); return true; } catch (e) { return e.message; }
})() === true);
ok('sin sesión no rompe', (() => {
  const g = DB.ui.usuarioId; DB.ui.usuarioId = null;
  const us = pr.usuarios; pr.usuarios = [];
  let r; try { vistaResumen(pr, py, v); r = true; } catch (e) { r = e.message; }
  pr.usuarios = us; DB.ui.usuarioId = g; return r;
})() === true);
ok('render de todas las solapas', (() => {
  const errs = [];
  ['resumen', 'presu', 'desglose', 'callsheet', 'rodaje', 'gastos', 'equipo', 'catalogo', 'config']
    .forEach(k => { try { setTab(k); } catch (e) { errs.push(k + ': ' + e.message); } });
  return errs.length ? errs.join(' | ') : true;
})() === true);

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
