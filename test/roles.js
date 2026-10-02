/* Cada uno ve lo suyo: el presupuesto es el ancla y sólo lo ven
   Administración, el PE y el jefe de producción. El plan nunca cambia el
   presupuesto: avisa. Tareas, cheques de garantía, la versión de rodaje,
   líneas × N, links directos y el proyecto por partes.                    */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
global.confirm = () => true;
global.prompt = () => 'listo';

DB = dbVacia(); sembrar();
const pr = getPr(), py = getPy();
const quien = rol => pr.usuarios.find(u => u.rol === rol);
const como = rol => { DB.ui.usuarioId = quien(rol).id; };
const plataDe = () => fmt(calcular(getV()).total, getV().monedaBase);

console.log('--- 1. QUIÉN VE QUÉ ---');
como('ejecutivo'); const total = plataDe();
['admin','ejecutivo','produccion'].forEach(r => { como(r); ok(`${ROL(r).l} ve la plata y todas las solapas`, vePlata() && puedeSolapa('presu') && puedeSolapa('personal:liquidacion')); });
const SOLAS = {asistdir: ['desglose','plan','callsheet'], asistprod: ['luces','personal:alta','callsheet','rodaje','gastos'], arte: ['callsheet','gastos'], equipo: ['callsheet','gastos']};
Object.entries(SOLAS).forEach(([r, ls]) => {
  como(r);
  ok(`${ROL(r).l}: no ve la plata ni el presupuesto`, !vePlata() && !puedeSolapa('presu') && !puedeSolapa('personal:liquidacion'));
  ok(`${ROL(r).l}: entra a ${ls.join(', ')}`, ls.every(k => puedeSolapa(k)));
  DB.ui.tab = 'presu'; render();
  ok(`${ROL(r).l}: si va al presupuesto, cae en su panel`, DB.ui.tab === 'resumen' && /Tus tareas/.test(app.innerHTML));
  ok(`${ROL(r).l}: en ninguna de sus solapas aparece el total del presupuesto`, ls.every(k => { setTab(k); return !app.innerHTML.includes(total); }), total);
  ok(`${ROL(r).l}: sin selector de versión ni Invitar`, !/selVersion\(/.test(app.innerHTML) && !/invitarAlProyecto\(\)/.test(app.innerHTML));
  ok(`${ROL(r).l}: no invita`, rolesQuePuedoInvitar().length === 0);
});
como('asistdir');
ok('el asistente de dirección edita el plan y sólo mira el callsheet', editaSolapa('plan') && !editaSolapa('callsheet'));
como('asistprod');
ok('el asistente de producción edita el rodaje, las altas, las luces y los gastos', ['rodaje','personal:alta','luces','gastos','callsheet'].every(k => editaSolapa(k)));
setTab('rodaje');
ok('en el rodaje no ve "Horas y extras" (tienen plata)', !/setSubRodaje\('horas'\)/.test(app.innerHTML));
setTab('luces');
ok('en las luces no ve lo presupuestado ni "Pasar al presupuesto"', !/lzAlPresupuesto\(\)/.test(app.innerHTML) && !/Presupuestado \(rubro 11/.test(app.innerHTML));
setTab('personal:alta');
ok('en las altas ve el contrato de cada uno', /upAlta\('[^']+','contrato'/.test(app.innerHTML));
como('produccion');
ok('el jefe invita, hasta su rol', rolesQuePuedoInvitar().map(r => r.k).join(',') === 'equipo,arte,asistprod,asistdir,produccion');

console.log('\n--- 2. EL PLAN NO TOCA EL PRESUPUESTO ---');
como('produccion');
const v = versionRodaje(py);
py.desglose = nuevoDesglose(); py.plan = null;
const p = planDe(py);
const crew = v.rubros.find(r => RUBROS_CREW.includes(r.codigo) && r.lineas.some(l => l.unidad === 'jornada' && !l.etapa && !NO_ES_PERSONA.test(l.concepto)));
v.rubros.filter(r => RUBROS_CREW.includes(r.codigo)).forEach(r => r.lineas.forEach(l => { if(l.unidad === 'jornada' && !l.etapa) l.dias = 2; }));
const r9 = v.rubros.find(r => r.codigo === '09');
r9.lineas = [nuevaLinea({concepto: 'Protagonista', personaje: 'Franco', dias: 1, unidad: 'jornada', valorUnit: 300000})];
const r10 = v.rubros.find(r => r.codigo === '10'); r10.lineas = [nuevaLinea({concepto: 'Locación — Oficina', dias: 1, unidad: 'jornada', valorUnit: 100})];
nuevaJornadaPlan(py); nuevaJornadaPlan(py); nuevaJornadaPlan(py);
[[1, 'Franco', 'Oficina'], [2, 'Franco, Ana', 'Oficina'], [3, '', 'Plaza']].forEach(([num, elenco, set], i) => {
  const it = nuevoItemPlan({tipo: 'plano', numero: String(i + 1), desc: 'Plano', set, elenco, extras: num === 3 ? 'Transeúntes x10' : '', camB: num === 2 ? 'Komodo' : ''});
  p.items.push(it); meterEnJornada(py, it, num); });
const antes = canon(py.versiones);
armarRodaje(py); quitarJornada(py, 3); nuevaJornadaPlan(py); armarDia(py, 1);
p.items.slice(0, 2).forEach(it => moverItem(py, it, 2));
volcarHorarios(py, 1); citarDia(py, 2);
ok('armar, quitar jornadas, mover y citar no cambian ni una coma del presupuesto', canon(py.versiones) === antes);
const A = avisosPlanPresupuesto(py, v);
const hay = (k, re) => A.some(x => x.k === k && re.test(x.t));
ok('avisa que el plan tiene más jornadas que el presupuesto', hay('pasa', /jornadas y el presupuesto paga 2/), A.map(x => x.k + ': ' + x.t).join(' | '));
ok('Franco se encuentra por su personaje aunque la línea diga "Protagonista"', !hay('falta', /Franco/));
ok('Ana no está en el presupuesto', hay('falta', /Ana no está/));
ok('la Plaza no está en el presupuesto', hay('falta', /Plaza/));
ok('extras sin presupuestar', hay('falta', /extras?/i));
ok('cámara B sin presupuestar', hay('falta', /cámara B/));
setTab('plan'); DB.ui.subPlan = 'dia'; render();
ok('el plan lo muestra arriba y en su solapa', /avisos? del plan contra el presupuesto/.test(app.innerHTML) && /setSubPlan\('presu'\)/.test(app.innerHTML));
DB.ui.subPlan = 'presu'; render();
ok('la solapa "Contra el presupuesto" los lista', /Se pasa/.test(app.innerHTML) && /Falta/.test(app.innerHTML));
como('asistdir'); setTab('plan'); DB.ui.subPlan = 'presu'; render();
ok('el asistente de dirección los ve, sin montos', /Contra el presupuesto/.test(app.innerHTML) && !app.innerHTML.includes(total) && /para el jefe de producción/.test(app.innerHTML));
como('asistprod');
ok('el asistente de producción no', !veAvisosPresu());
como('produccion'); setTab('resumen');
ok('el Resumen del jefe los cuenta', /avisos? del plan contra el presupuesto/.test(app.innerHTML));

console.log('\n--- 3. TAREAS ---');
como('produccion');
const linea = crew.lineas[0];
render();
ok('cada línea del presupuesto tiene "＋ tarea"', (setTab('presu'), /editTarea\(null,'/.test(app.innerHTML)));
const ap = quien('asistprod');
tareasDe(py).push(nuevaTarea({titulo: 'Conseguir ' + linea.concepto, lineaId: linea.id, asignadoA: ap.id, creadaPor: quien('produccion').id, vence: '2020-01-01'}));
render();
ok('la línea muestra a quién se le encargó', new RegExp('tarea: ' + ap.nombre).test(app.innerHTML));
como('asistprod'); setTab('resumen');
ok('le aparece en su panel', /Conseguir/.test(app.innerHTML) && /terminarTarea\(/.test(app.innerHTML));
const t = tareasDe(py).find(x => x.lineaId === linea.id);
terminarTarea(t.id);
ok('la confirma y queda quién y cuándo, con su nota', t.estado === 'hecha' && t.hechaPor === ap.id && t.hechaEl === hoy() && t.nota === 'listo');
como('produccion'); setTab('presu');
ok('y la línea dice "hecha"', /tarea hecha ✓/.test(app.innerHTML));

console.log('\n--- 4. CHEQUES DE GARANTÍA ---');
como('arte'); const arte = getUsuario();
chequesDe(py).push(nuevoCheque({a: 'Rental Sur', monto: 300000, pedidoPor: arte.id, devolverEl: '2020-01-01'}));
const ch = chequesDe(py)[chequesDe(py).length - 1];
setTab('gastos'); DB.ui.subGasto = 'cheques'; render();
ok('arte los pide desde Gastos', /pedirCheque\(\)/.test(app.innerHTML) && /Rental Sur/.test(app.innerHTML));
ok('no los aprueba', !/avanzarCheque\('/.test(app.innerHTML));
como('ejecutivo');
ok('al PE le aparece para aprobar', chequesPend() >= 1);
setTab('resumen');
ok('arriba de todo en su Resumen, "Para aprobar y controlar"', /Para aprobar y controlar/.test(app.innerHTML) && app.innerHTML.indexOf('Para aprobar y controlar') < app.innerHTML.indexOf('Costo directo') && /cheques? de garantía/.test(app.innerHTML));
avanzarCheque(ch.id);
ok('el PE lo aprueba', ch.estado === 'aprobado');
como('admin'); avanzarCheque(ch.id);
ok('Administración lo entrega', ch.estado === 'entregado');
setTab('resumen');
ok('si no volvió a tiempo, se avisa', /no volvi/.test(app.innerHTML));
avanzarCheque(ch.id);
ok('y anota que volvió', ch.estado === 'devuelto' && ch.historial.length === 3);

console.log('\n--- 5. LA VERSIÓN DE RODAJE ---');
como('produccion');
const vr = versionRodaje(py);
DB.ui.versionId = vr.id;
const j1 = py.desglose.jornadas[0]; normalizarJornada(j1);
const l0 = crew.lineas[0];
j1.parte.fichadas['l:' + l0.id] = {entrada: '07:00', salida: '20:00'};
j1.citaciones['l:' + l0.id] = {citacion: '06:30', auto: false};
duplicarVersion();
const v2 = getV();
ok('duplicar guarda de qué línea viene cada una', v2 !== vr && v2.rubros.flatMap(r => r.lineas).every(l => l.origenId));
ok('la versión de rodaje sigue siendo la otra (duplicar para cotizar no mueve el set)', versionRodaje(py) === vr);
setVersionRodaje(v2.id);
const l2 = v2.rubros.flatMap(r => r.lineas).find(l => l.origenId === raizLinea(l0));
ok('al cambiarla, las fichadas y citaciones pasan a sus líneas', versionRodaje(py) === v2 && j1.parte.fichadas['l:' + l2.id] && j1.citaciones['l:' + l2.id] && !j1.parte.fichadas['l:' + l0.id]);

console.log('\n--- 6. UNA LÍNEA × 3 SON TRES PERSONAS; EL ELENCO POR SU PERSONAJE ---');
const lx = nuevaLinea({concepto: 'Asistente de producción', cantidad: 3, dias: 1, unidad: 'jornada', valorUnit: 50000});
v2.rubros.find(r => r.codigo === '03').lineas.push(lx);
const C = gentePorJornada(py, v2, 1).gente.filter(g => g.clave.startsWith('l:' + lx.id));
ok('tres citaciones', C.length === 3 && C.map(g => g.clave).join() === ['l:' + lx.id, 'l:' + lx.id + '#2', 'l:' + lx.id + '#3'].join());
j1.parte.fichadas['l:' + lx.id + '#2'] = {entrada: '07:00', salida: '23:00'};
const h = horasDeLinea(py, '03', lx, j1, py.configRodaje || nuevaConfigRodaje());
ok('las horas extra de cualquiera de los tres cuentan', !h.sinDatos && h.extra > 0);
const ge = py.desglose.jornadas.map(j => gentePorJornada(py, v2, j.numero).gente.find(g => g.rol === 'Franco')).find(Boolean);
ok('Franco se engancha con la línea "Protagonista" por su personaje', ge && ge.linea && ge.linea.concepto === 'Protagonista');

console.log('\n--- 7. LINKS DIRECTOS Y EL SIGUIENTE PASO ---');
DB.ui.tab = 'rodaje'; DB.ui.subRodaje = 'citaciones'; DB.ui.jornada = 2;
ok('el link de la citación de la J2', hashDeUI() === '#/rodaje/citaciones/j2', hashDeUI());
DB.ui.tab = 'resumen';
ok('abrirlo lleva ahí', aplicarHash('#/rodaje/parte/j1') && DB.ui.tab === 'rodaje' && DB.ui.subRodaje === 'parte' && DB.ui.jornada === 1);
ok('los links de invitación no se tocan', !aplicarHash('#inv=abc') && !aplicarHash('#access_token=x'));
ok('liquidación', aplicarHash('#/liquidacion') && DB.ui.tab === 'personal' && DB.ui.subPersonal === 'liquidacion');
setTab('plan'); DB.ui.subPlan = 'dia'; render();
ok('al pie del plan, "Siguiente: Pedido de luces" y "← Desglose"', /Siguiente: Pedido de luces/.test(app.innerHTML) && /← Desglose/.test(app.innerHTML));
como('asistdir'); setTab('plan');
ok('para el asistente de dirección, después del plan viene el callsheet', /Siguiente: Callsheet/.test(app.innerHTML));

console.log('\n--- 8. LA PLATA DE LA LIQUIDACIÓN LLEGA AL TABLERO ---');
como('admin');
const G = genteDelProyecto(py, v2).find(g => g.lineas.some(x => x.l === l2));
const P0 = resumenPlata(py, getV());
liqDe(py)[G.clave] = {estado: 'pagado', montoPagado: 123456};
const P1 = resumenPlata(py, getV());
ok('lo pagado en la liquidación suma a real y pagado', Math.round(P1.pagado - P0.pagado) === 123456 && Math.round(P1.real - P0.real) === 123456);
liqDe(py)[G.clave] = {estado: 'aprobado', montoAprobado: 1000};
ok('lo aprobado, a comprometido', Math.round(resumenPlata(py, getV()).comp - P0.comp) === 1000);

console.log('\n--- 9. EL PROYECTO POR PARTES ---');
ok('la parte "gente" no lleva plata', gentePublica(py).versiones[0].rubros.every(r => r.lineas.every(l => l.valorUnit === 0)) && !canon(gentePublica(py)).includes('"fee"'));
const vieja = {cs: [{id: 'a', x: 1}, {id: 'b', x: 1}]};
const mia = {cs: [{id: 'a', x: 2}, {id: 'b', x: 1}, {id: 'c', x: 1}]};
const suya = {cs: [{id: 'a', x: 1}, {id: 'd', x: 1}]};
const junto = fusionar3(vieja, mia, suya);
ok('juntar: lo mío nuevo, lo suyo nuevo, lo que borró él y lo que cambié yo', canon(junto) === canon({cs: [{id: 'a', x: 2}, {id: 'd', x: 1}, {id: 'c', x: 1}]}), canon(junto));
ok('el orden de las claves no importa', canon({a: 1, b: {c: 2, d: 3}}) === canon({b: {d: 3, c: 2}, a: 1}));
ok('los permisos de la app copian los de la base', puedeParte('plan', true, quien('asistdir')) && !puedeParte('presupuesto', false, quien('asistprod'))
  && !puedeParte('presupuesto_real', true, quien('produccion')) && puedeParte('rodaje', true, quien('asistprod')) && !puedeParte('liquidacion', false, quien('arte')));
const otro = JSON.parse(JSON.stringify(DB));
otro.productoras[0].proyectos[0].nombre = 'Del archivo';
const n0 = py.comprobantes.length;
const r = importarRespaldo(otro);
ok('importar no borra todo: reemplaza el proyecto del archivo', r && r.pisa === 1 && getPr().proyectos.length === 1 && getPy().nombre === 'Del archivo');

console.log('\n--- 10. EL MARGEN: SÓLO ADMINISTRACIÓN Y EL PE ---');
DB = dbVacia(); sembrar();
const pr3 = getPr(), py3 = getPy(), q3 = rol => pr3.usuarios.find(u => u.rol === rol);
DB.ui.usuarioId = q3('ejecutivo').id;
const R3 = calcular(getV()), tot3 = fmt(R3.total, 'ARS'), fee3 = fmt(R3.fee, 'ARS');
setTab('presu');
ok('el PE ve el fee y el total al cliente', app.innerHTML.includes(tot3) && app.innerHTML.includes(fee3) && /setVista\('cliente'\)/.test(app.innerHTML));
DB.ui.usuarioId = q3('produccion').id; DB.ui.vista = 'cliente';
const vistos = ['resumen','presu','gastos','personal:liquidacion','config'].filter(k => { setTab(k); return app.innerHTML.includes(tot3) || app.innerHTML.includes(fee3) || />Fee</.test(app.innerHTML); });
ok('el jefe de producción no ve el fee ni el total al cliente en ninguna solapa', !vistos.length, vistos.join(','));
setTab('presu');
ok('ve su costo de producción (costo directo + contingencia), sin la vista Cliente', /COSTO DE PRODUCCIÓN/.test(app.innerHTML) && app.innerHTML.includes(fmt(R3.subtotal + R3.contingencia, 'ARS')) && !/setVista\('cliente'\)/.test(app.innerHTML));
const vc = nuevaVersion(); vc.nivel = 'cliente'; py3.versiones.push(vc);
ok('no abre la versión del Cliente', !versionesQueVeo(py3).includes(vc));
ok('ni le llega: el Real y el Cliente viajan en la parte que no lee', PARTES_PY.presupuesto_real.lee(py3).versiones.includes(vc) && !PARTES_PY.presupuesto.lee(py3).versiones.includes(vc) && !puedeParte('presupuesto_real', false, q3('produccion')));

ok('el presupuesto viaja sin el fee; el fee, en la parte del PE', !canon(PARTES_PY.presupuesto.lee(py3)).includes('"fee"') && canon(PARTES_PY.presupuesto_real.lee(py3)).includes('"fees"'));

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
