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

/* --- la cartera de proyectos, y desde donde se crea uno -------------------
   Crear un proyecto sólo se podía desde la solapa Productoras, que es el
   último lugar donde alguien lo busca. Ahora la lista y el botón están en el
   Resumen, que es lo primero que se abre.                                   */
console.log('\n--- 6. LOS PROYECTOS, EN EL RESUMEN ---');
DB.ui.tab = 'resumen'; render();
let h = app.innerHTML;
ok('hay un bloque con los proyectos de la productora',
  new RegExp('Proyectos de ' + pr.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(h));
ok('BOTON DE PROYECTO NUEVO', /editProyecto\(\)/.test(h));
ok('dice "Nuevo proyecto"', /\+ Nuevo proyecto/.test(h));
ok('lista el proyecto que hay', h.includes(esc(py.nombre)), py.nombre);
ok('marca en cuál estoy parado', /pyaqui/.test(h) && /estás acá/.test(h));
ok('muestra el cliente', h.includes(py.cliente));
ok('y el total de la última versión', /class="pytot"/.test(h));
ok('se puede saltar a otro con un toque', /selProyecto\('/.test(h));
ok('el botón está ARRIBA de la lista',
  h.indexOf('+ Nuevo proyecto') < h.indexOf('class="pylista"'));

/* con varios proyectos, están todos y sólo uno queda marcado */
const otro = nuevoProyecto({nombre:'Corto de prueba', cliente:'Cliente B', jornadas:2});
pr.proyectos.push(otro); render(); h = app.innerHTML;
ok('con dos proyectos aparecen los dos',
  h.includes(esc(py.nombre)) && h.includes('Corto de prueba'));
ok('sólo uno dice "estás acá"', (h.match(/estás acá/g)||[]).length === 1);
ok('el que no tiene presupuesto no rompe', /sin presupuesto|—/.test(h));

/* crear uno de verdad desde ahí */
const antes = pr.proyectos.length;
global.document.querySelectorAll = s => /\[name\]/.test(s)
  ? Object.entries({nombre:'Nuevo desde el Resumen', tipo:'publicidad', cliente:'Marca Z',
      agencia:'', producto:'', jornadas:'1', medios:'Digital', territorio:'Argentina',
      plazo:'12 meses'}).map(([name,value])=>({name,value})) : [];
saveProyecto();
ok('crear desde ahí lo agrega', pr.proyectos.length === antes + 1);
const creado = pr.proyectos.find(p => p.nombre === 'Nuevo desde el Resumen');
ok('con su nombre y cliente', creado && creado.cliente === 'Marca Z');
ok('y con una versión lista para presupuestar', creado && creado.versiones.length === 1);
ok('queda elegido', DB.ui.proyectoId === creado.id);
DB.ui.tab = 'resumen'; render();
ok('y aparece en la lista', app.innerHTML.includes('Nuevo desde el Resumen'));

/* sin ningún proyecto, la pantalla lo dice y ofrece crear */
const guardados = pr.proyectos;
pr.proyectos = []; DB.ui.proyectoId = null; DB.ui.tab = 'resumen'; render();
ok('sin proyectos ofrece crear igual', /editProyecto\(\)/.test(app.innerHTML));
pr.proyectos = guardados; DB.ui.proyectoId = py.id; render();

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
