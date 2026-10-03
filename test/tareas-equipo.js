/* El tablero "Tareas del equipo" del jefe (también el PE y Administración),
   las tarjetas del panel de Equipo, y que el jefe no vea nada del fee.
   Uso: node test/run.js test/tareas-equipo.js                               */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
global.confirm = () => true;
global.prompt = () => '';
let campos = {};
const formu = c => { campos = c; document.querySelectorAll = s => /\[name\]/.test(s) ? Object.entries(campos).map(([name, value]) => ({name, value})) : []; };
const sinFormu = () => { document.querySelectorAll = () => []; };

DB = dbVacia(); sembrar();
const pr = getPr(), py = getPy();
const U = r => pr.usuarios.find(u => u.rol === r);
const como = r => { DB.ui.usuarioId = U(r).id; modal = null; };
const jefe = U('produccion'), diego = U('asistprod'), carla = U('arte'), sofia = U('equipo'), paula = U('asistdir');

console.log('--- 1. EL TABLERO DEL JEFE ---');
como('produccion'); setTab('resumen'); render();
let h = app.innerHTML;
ok('en el Resumen del jefe está "Tareas del equipo"', /Tareas del equipo/.test(h) && /id="res-tareas"/.test(h));
ok('agrupado por persona: los asistentes y él mismo ("Vos")', h.includes(diego.nombre) && h.includes(carla.nombre) && h.includes(paula.nombre) && />Vos</.test(h));
ok('con estado de cada tarea (pendiente / vencida / hecha)', /te-est pend/.test(h) && /te-est (venc|hecha)/.test(h));
ok('"+ Tarea" general y por persona, y el filtro', /onclick="editTarea\(\)"/.test(h) && h.includes(`editTarea(null,null,'${diego.id}')`) && /filtroTareas\(this.value\)/.test(h));
const nAntes = tareasDe(py).length;
editTarea(null, null, sofia.id);
ok('"+ Tarea" para alguien: el diálogo viene con esa persona elegida', new RegExp(`<option value="${sofia.id}"[^>]*selected`).test(modal || ''));
ok('se puede atar a una línea del presupuesto (opcional)', /name="lineaId"/.test(modal || ''));
ok('se le puede encargar a cualquiera del proyecto, también a él mismo', (modal || '').includes(`value="${jefe.id}"`) && /Yo · /.test(modal || ''));
const linea = versionRodaje(py).rubros.flatMap(r => r.lineas)[0];
formu({titulo: 'Confirmar el catering de la J2', detalle: 'Cantidad y horario', asignadoA: jefe.id, vence: hoyMas(1), lineaId: linea.id});
saveTarea(null, null); sinFormu();
const tYo = tareasDe(py)[tareasDe(py).length - 1];
ok('el jefe se encarga una tarea a sí mismo, con su línea', tareasDe(py).length === nAntes + 1 && tYo.asignadoA === jefe.id && tYo.lineaId === linea.id && tYo.creadaPor === jefe.id);
render(); h = app.innerHTML;
ok('y le aparece en el tablero con "Listo ✓"', h.includes(`hechaTarea('${tYo.id}')`) && /Listo ✓/.test(h));
/* reasignar */
const tD = tareasDe(py).find(t => t.asignadoA === diego.id && t.estado !== 'hecha');
reasignarTarea(tD.id, carla.id);
ok('reasignar: pasa a otra persona (la misma tarea, no una copia)', tD.asignadoA === carla.id && tareasDe(py).length === nAntes + 1);
como('arte'); setTab('resumen'); render();
ok('y a esa persona le aparece en su panel', app.innerHTML.includes(tD.titulo) && /Tus tareas/.test(app.innerHTML));
como('produccion'); reasignarTarea(tD.id, diego.id);
/* marcar hecha */
hechaTarea(tD.id);
ok('el jefe la marca hecha (queda que la marcó él)', tD.estado === 'hecha' && tD.hechaPor === jefe.id);
reabrirTarea(tD.id);
ok('y la puede volver a pendiente', tD.estado === 'pendiente');
/* filtro */
filtroTareas(diego.id); render(); h = app.innerHTML;
const bloque = h.slice(h.indexOf('id="res-tareas"'));
ok('filtrar por persona: sólo las de esa persona', bloque.includes(diego.nombre) && !bloque.includes(`editTarea(null,null,'${carla.id}')`));
filtroTareas('');
/* PE y Administración también lo ven */
['ejecutivo', 'admin'].forEach(r => { como(r); setTab('resumen'); render();
  ok(`${ROL(r).l} también ve el tablero`, /Tareas del equipo/.test(app.innerHTML) && app.innerHTML.includes(diego.nombre)); });
/* los asistentes no ven el tablero: ven las suyas */
como('asistprod'); setTab('resumen'); render();
ok('el asistente de producción no ve el tablero, ve sus tareas', !/Tareas del equipo/.test(app.innerHTML) && /Tus tareas/.test(app.innerHTML));
ok('las del asistente de producción (motorhome, generador, agarres)', /motorhome/i.test(app.innerHTML) && /generador/i.test(app.innerHTML) && /agarres/i.test(app.innerHTML));

console.log('\n--- 2. LAS TARJETAS DEL PANEL DE EQUIPO ---');
como('equipo'); setTab('resumen'); render(); h = app.innerHTML;
ok('las tres tarjetas', /¿Cambió tu hora\?/.test(h) && /¿Un cheque de garantía\?/.test(h) && /¿Tus datos para el pago\?/.test(h));
/* la próxima jornada (la J2): en el ejemplo a Sofía le adelantaron la hora después de citarla */
const j2 = py.desglose.jornadas.find(j => j.fecha >= hoy());
const gS = gentePorJornada(py, versionRodaje(py), j2.numero).gente.find(g => esLaPersona(g, sofia));
ok('su citación de verdad (la hora del callsheet)', !!gS && h.includes(horaCitada(j2, gS.clave)), gS && horaCitada(j2, gS.clave));
const ec = estadoCitado(j2, gS.clave);
ok('si le cambiaron la hora después de citarla, lo dice (con la hora vieja y la nueva)', ec.k === 'cambio' && h.includes(`Cambió: era a las ${ec.antes}, ahora a las <b>${ec.ahora}</b>`), JSON.stringify(ec));
ok('y que tiene que volver a confirmar', /volvé a confirmar con tu link/.test(h));
ok('el cheque: Equipo no lo pide, le dice a quién pedírselo (con WhatsApp)', !/pedirCheque\(\)/.test(h.slice(h.indexOf('¿Un cheque'), h.indexOf('¿Tus datos'))) && h.includes(diego.nombre) && /wa\.me\//.test(h));
ok('sus datos: qué le falta para el pago y el seguro', /Para el pago:/.test(h) && /Para el seguro:/.test(h));
como('arte'); setTab('resumen'); render();
ok('las tarjetas son del panel de Equipo', !/¿Cambió tu hora\?/.test(app.innerHTML));

console.log('\n--- 3. EL JEFE NO TIENE NADA DEL FEE ---');
como('produccion');
const vistas = [];
['resumen', 'presu', 'desglose', 'plan', 'luces', 'callsheet', 'rodaje', 'gastos', 'catalogo', 'equipo', 'config', 'guia'].forEach(k => {
  try { setTab(k); render(); vistas.push([k, app.innerHTML]); } catch (e) { vistas.push([k, 'ERROR ' + e.message]); } });
DB.ui.tab = 'presu'; versionRodaje(py).rubros.forEach(r => { r.abierto = true; }); render(); vistas.push(['presu abierto', app.innerHTML]);
['bandeja', 'todos', 'control', 'rend', 'oc', 'cheques'].forEach(s => { try { DB.ui.tab = 'gastos'; DB.ui.subGasto = s; render(); vistas.push(['gastos/' + s, app.innerHTML]); } catch (e) {} });
const conFee = vistas.filter(([, x]) => /\bfee\b|s\/fee/i.test(x.replace(/Fee de locaci[oó]n|Fee de agencia de casting/gi, '')));
ok('ninguna pantalla del jefe dice "fee" (ni "Quitar del fee", ni "s/fee")', !conFee.length,
  conFee.map(([k, x]) => k + ': ' + (x.match(/.{30}(\bfee\b|s\/fee).{30}/i) || [''])[0]).join(' | '));
ok('ni las condiciones para el cliente', !vistas.some(([, x]) => /Condiciones para el cliente/.test(x)));
ok('ni errores al dibujarlas', !vistas.some(([, x]) => x.startsWith('ERROR')), vistas.filter(([, x]) => x.startsWith('ERROR')).map(([k]) => k).join(','));
const r0 = versionRodaje(py).rubros[0], f0 = r0.aplicaFee;
upRubro(r0.id, 'aplicaFee', !f0);
ok('y aunque toque la función, no cambia el fee de un rubro', r0.aplicaFee === f0);
como('ejecutivo'); DB.ui.tab = 'presu'; render();
ok('el PE sí tiene "Quitar del fee" / "Incluir en el fee"', /Quitar del fee|Incluir en el fee/.test(app.innerHTML));
como('produccion');
let csv = ''; const _b = bajar; bajar = (n, c) => { csv = c; }; expCSV(); bajar = _b;
ok('el CSV del presupuesto del jefe no tiene el fee', csv.length > 0 && !/\bfee\b/i.test(csv.replace(/Fee de locaci[oó]n|Fee de agencia de casting/gi, '')));

console.log('\n--- 4. INVITAR: LO QUE OFRECE EL BOTÓN ---');
como('ejecutivo'); invitarAlProyecto();
ok('al PE, "Entra como" incluye Administración', /<option value="admin"/.test(modal || ''));
como('produccion'); invitarAlProyecto();
ok('al jefe, su equipo: no Administración ni el PE', !/<option value="admin"/.test(modal || '') && !/<option value="ejecutivo"/.test(modal || '') && /<option value="asistprod"/.test(modal || ''));

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
process.exitCode = fallos ? 1 : 0;
