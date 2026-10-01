/* Plan de rodaje.
   ---------------------------------------------------------------------------
   Pedido: una sección de plan de rodaje con el orden de planos de cada
   jornada, los breaks y todo lo que hace falta para planificar un día; que
   cambie según sea publicidad o cine, y que se puedan cargar las tomas del
   storyboard e ir acomodándolas.                                           */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const cerca = (a, b, tol) => a != null && Math.abs(a - b) <= tol;

DB = dbVacia(); sembrar();
const pr = getPr();

console.log('--- 1. EL SOL ---');
/* Buenos Aires: solsticio de verano sale 05:36 y se pone 20:08;
   solsticio de invierno sale 08:00 y se pone 17:50 (hora argentina). */
const L = LUGARES_SOL[0];
const hs = (f, c, s) => horaSol(f, L.lat, L.lon, L.tz, c, s);
ok('21/12 sale ~05:36', cerca(hs('2026-12-21', 90.833, true), 5*60+36, 6), aHora(hs('2026-12-21', 90.833, true)));
ok('21/12 se pone ~20:08', cerca(hs('2026-12-21', 90.833, false), 20*60+8, 6), aHora(hs('2026-12-21', 90.833, false)));
ok('21/6 sale ~08:00', cerca(hs('2026-06-21', 90.833, true), 8*60, 6), aHora(hs('2026-06-21', 90.833, true)));
ok('21/6 se pone ~17:50', cerca(hs('2026-06-21', 90.833, false), 17*60+50, 6), aHora(hs('2026-06-21', 90.833, false)));
const pySol = nuevoProyecto({nombre: 'Sol', tipo: 'publicidad'});
const S = solDelDia(pySol, '2026-10-14');
ok('la hora dorada de la tarde rodea la puesta y la azul sigue', S.doradaPm[0] < S.atardecer && S.doradaPm[1] > S.atardecer && S.azulPm[0] === S.doradaPm[1] && S.azulPm[1] > S.azulPm[0]);
ok('la hora azul dura unos 8 a 25 minutos', S.azulPm[1] - S.azulPm[0] >= 8 && S.azulPm[1] - S.azulPm[0] <= 25, (S.azulPm[1] - S.azulPm[0]) + ' min');
ok('Ushuaia en invierno: el sol sale mucho más tarde que en Buenos Aires',
  horaSol('2026-06-21', -54.8019, -68.3030, -3, 90.833, true) > hs('2026-06-21', 90.833, true) + 60);

console.log('\n--- 2. LA LISTA DE PLANOS DEL DIRECTOR ---');
const SL = leerShotList(`1 PG EXT casa, dron, hora dorada
2 - PM Ana entra a la cocina, steadicam
Plano 3: PD mano abre la heladera 100mm
3A PP Ana sonríe
sin número, cámara en mano de noche`);
ok('cinco planos', SL.length === 5, SL.length);
ok('1: número, tamaño, dron, EXT y hora dorada', SL[0].numero === '1' && SL[0].tamano === 'Plano general' && SL[0].movimiento === 'Dron' && SL[0].intExt === 'EXT' && SL[0].luz === 'dorada');
ok('2: steadicam y plano medio', SL[1].movimiento === 'Steadicam' && SL[1].tamano === 'Plano medio' && /Ana entra/.test(SL[1].desc));
ok('3: "Plano 3:" y la lente', SL[2].numero === '3' && SL[2].tamano === 'Plano detalle' && SL[2].lente === '100mm');
ok('3A con letra', SL[3].numero === '3A' && SL[3].tamano === 'Primer plano');
ok('sin número: queda vacío, de noche y en mano', SL[4].numero === '' && SL[4].luz === 'noche' && SL[4].movimiento === 'Cámara en mano');

console.log('\n--- 3. UN SPOT: JORNADA NUEVA Y CASCADA DE HORARIOS ---');
const py = nuevoProyecto({nombre: 'Spot Plan', tipo: 'publicidad'});
pr.proyectos.push(py);
DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;
const d = getD();
ok('publicidad se planifica por planos', !planPorEscenas(py));
plJornadaNueva();
ok('se crea la jornada 1 sin tener guion', d.jornadas.length === 1 && d.escenas.length === 0);
const p = planDe(py);
const evs = p.items.filter(x => x.jornada === 1).sort((a,b) => a.orden - b.orden).map(x => x.clase);
ok('arranca con desayuno, armado, almuerzo y wrap', evs.join() === 'desayuno,prelight,almuerzo,wrap', evs.join());
const j1 = d.jornadas[0];
j1.fecha = '2026-10-14'; j1.citacion = '07:00';
const nuevo = o => { const it = nuevoItemPlan({tipo: 'plano', ...o}); p.items.push(it); meterEnJornada(py, it, o.jornada === undefined ? 1 : o.jornada); return it; };
/* orden del storyboard, no el de rodaje */
const a1 = nuevo({numero: '1', set: 'Casa - Cocina', emplazamiento: 'A', tamano: 'Plano general', movimiento: 'Dolly'});
const a2 = nuevo({numero: '2', set: 'Casa - Cocina', emplazamiento: 'B', tamano: 'Primer plano', movimiento: 'Fijo', elenco: 'Ana'});
const a3 = nuevo({numero: '3', set: 'Casa - Cocina', emplazamiento: 'A', tamano: 'Plano medio', movimiento: 'Fijo', elenco: 'Ana, Nene'});
const a4 = nuevo({numero: '4', set: 'Casa - Terraza', emplazamiento: 'C', tamano: 'Plano general', luz: 'dorada', intExt: 'EXT'});
const a5 = nuevo({numero: '5', set: 'Casa - Cocina', emplazamiento: 'B', tamano: 'Plano detalle', movimiento: 'Fijo', prioridad: 'seguridad'});
let D = calcularDia(py, 1);
const fila = it => D.filas.find(f => f.it === it);
ok('el primer plano va después del desayuno (30) y el armado (60): 08:30', aHora(fila(a1).inicio) === '08:30', aHora(fila(a1).inicio));
ok('el dolly dura 25 min por defecto', fila(a1).dur === 25);
ok('entre A y B hay un cambio de emplazamiento de 20 min', D.filas.some(f => f.implicita === 'cambio') && fila(a2).inicio === fila(a1).fin + 20);
ok('pasar de la cocina a la terraza es un cambio de set, no un traslado', !D.filas.some(f => f.implicita === 'traslado'));
ok('el almuerzo es a hora fija: las 13:00', aHora(D.comida.inicio) === '13:00');
ok('antes del almuerzo queda tiempo libre', D.filas.some(f => f.implicita === 'libre'));
ok('el wrap estimado sale del cálculo', D.fin > D.comida.fin);
ok('cuenta los emplazamientos (A, B, A, B, C = 5 si no se agrupa)', D.emplazamientos === 5, D.emplazamientos);

console.log('\n--- 4. ACOMODAR POR EMPLAZAMIENTO ---');
const movidos = acomodarPorEmplazamiento(py, 1);
D = calcularDia(py, 1);
const ordenPl = D.filas.filter(f => f.it && f.it.tipo === 'plano').map(f => f.it.numero).join();
ok('junta A con A y B con B, de abierto a cerrado, y la hora dorada al final', ordenPl === '1,3,2,5,4', ordenPl);
ok('los eventos no se movieron', D.filas.filter(f => f.it && f.it.tipo === 'evento').map(f => f.it.clase).join() === 'desayuno,prelight,almuerzo,wrap');
ok('agrupado quedan 3 emplazamientos', D.emplazamientos === 3, D.emplazamientos);
ok('dijo cuántos movió', movidos > 0);

console.log('\n--- 5. AVISOS DE UN AD ---');
/* la hora dorada de la terraza está puesta a media tarde, lejos de la puesta */
ok('avisa que el plano 4 no está en la hora dorada', D.avisos.some(a => a.id === a4.id && /hora dorada/.test(a.txt)), D.avisos.map(a => a.txt).join(' | '));
/* le damos al plano 4 lo que falta hasta la hora dorada: sin aviso */
const av4 = D.avisos.find(a => a.id === a4.id);
ok('ofrece anclarlo al empezar la hora dorada', av4 && av4.anclar === S.doradaPm[0]);
plAnclar(a4.id, aHora(av4.anclar));
D = calcularDia(py, 1);
ok('con el plano 4 anclado a la hora dorada ya no avisa', !D.avisos.some(a => a.id === a4.id), D.avisos.map(a => a.txt).join(' | '));
ok('y el día termina después de la puesta', D.fin > S.atardecer - 30);
/* un exterior de día que cae de noche */
const noche = nuevo({numero: '6', set: 'Calle - Vereda', intExt: 'EXT', luz: 'dia', duracion: 30});
D = calcularDia(py, 1);
ok('un exterior de día puesto después de la puesta es un error', D.avisos.some(a => a.id === noche.id && a.nivel === 'mal'));
ok('cambiar de lugar suma un traslado', D.filas.some(f => f.implicita === 'traslado' && /Vereda/.test(f.texto)));
ok('las extras se avisan', D.extra > 0 && D.avisos.some(a => /horas extra/.test(a.txt)));
ok('y sugiere cortar los planos de seguridad', D.avisos.some(a => /de seguridad \(5\)/.test(a.txt)), D.avisos.map(a => a.txt).join(' | '));
p.items = p.items.filter(x => x !== noche); reordenar(py, 1);
/* almuerzo tarde */
const alm = p.items.find(x => x.jornada === 1 && x.clase === 'almuerzo');
alm.fijo = '14:30';
D = calcularDia(py, 1);
ok('almuerzo más de 6 h después de la citación: aviso', D.avisos.some(a => /almuerzo cae/.test(a.txt)));
alm.fijo = '13:00';
/* cena */
j1.citacion = '06:00';
D = calcularDia(py, 1);
ok('citación 06:00 con desayuno: no pide desayuno', !D.avisos.some(a => /corresponde desayuno/.test(a.txt)));
j1.citacion = '07:00';

console.log('\n--- 6. EL ELENCO DEL DÍA ---');
D = calcularDia(py, 1);
const E = elencoDelDia(py, 1, D);
const ana = E.find(x => x.nombre === 'Ana');
ok('Ana: citación sugerida 90 min antes de su primer plano', ana && ana.citacion === Math.max(D.inicio, ana.primera - 90), ana && aHora(ana.citacion));
ok('el Nene aparece', E.some(x => x.nombre === 'Nene'));
DB.ui.jornada = 1;
plCitarElenco();
ok('pasar las citaciones escribe en el callsheet', j1.citaciones['p:Ana'] && j1.citaciones['p:Ana'].citacion === aHora(ana.citacion));

console.log('\n--- 7. BANCO, OTRA JORNADA Y LO NO FILMADO ---');
const b1 = nuevo({numero: '7', jornada: null});
const b2 = nuevo({numero: '8', jornada: null});
ok('los planos sin jornada quedan en el banco', b1.jornada === null && b2.jornada === null);
plJornadaNueva();
ok('la jornada 2 toma la fecha siguiente', d.jornadas[1].fecha === '2026-10-15', d.jornadas[1].fecha);
plTodoA(2);
ok('todo el banco pasó a la jornada 2, antes del wrap', b1.jornada === 2 && b2.jornada === 2 &&
  p.items.filter(x => x.jornada === 2).sort((a,b) => a.orden - b.orden).slice(-1)[0].clase === 'wrap');
DB.ui.jornada = 1;
plEstado(a1.id, 'filmado'); plEstado(a3.id, 'filmado'); plEstado(a2.id, 'cayo');
global.document.querySelectorAll = q => /toast/.test(q) ? [] : [{name: 'destino', value: '2'}];
plPendientesOk();
global.document.querySelectorAll = () => [];
ok('lo no filmado (2, 4 y 5) pasó a la jornada 2', [a2, a4, a5].every(x => x.jornada === 2) && a1.jornada === 1 && a3.jornada === 1);
ok('el que se había caído vuelve a pendiente', a2.estado === 'pendiente');
ok('lo filmado quedó donde estaba', a1.estado === 'filmado');
/* descanso entre jornadas */
d.jornadas[1].citacion = '05:00';
const dj1 = d.jornadas[0];
const extraLargo = nuevo({numero: '9', jornada: 1, duracion: 600});
D = calcularDia(py, 2);
ok('si la jornada 1 termina tarde y la 2 cita temprano, avisa el descanso', D.avisos.some(a => /mínimo es 12 h/.test(a.txt)), D.avisos.map(a => a.txt).join(' | '));
p.items = p.items.filter(x => x !== extraLargo); d.jornadas[1].citacion = '07:00';

console.log('\n--- 8. EL CALLSHEET SALE DEL PLAN ---');
DB.ui.tab = 'callsheet'; DB.ui.subCall = 'hoja'; DB.ui.jornada = 2;
render();
let h = app.innerHTML;
ok('un spot sin guion igual tiene callsheet', /JORNADA 2/.test(h));
ok('con el orden del día', /Orden del día/.test(h) && /pl-orden/.test(h));
ok('el elenco sale de los planos', /Ana/.test(h));
ok('las locaciones salen de los sets de los planos ("Casa - Cocina" es Casa)', /cslocn">Casa</.test(h));
const D2 = calcularDia(py, 2);
ok('el wrap estimado es el del plan', d.jornadas[1].wrap === aHora(D2.fin), d.jornadas[1].wrap + ' vs ' + aHora(D2.fin));
ok('y el almuerzo también', d.jornadas[1].comida === aHora(D2.comida.inicio));
ok('las horas de sol se completan solas con la fecha', /Sale \/ se pone el sol/.test(h));

console.log('\n--- 9. LA SOLAPA ---');
DB.ui.tab = 'plan'; DB.ui.subPlan = 'dia'; DB.ui.jornada = 1;
render(); h = app.innerHTML;
ok('la solapa "Plan de rodaje" está en el menú', /setTab\('plan'\)/.test(h));
ok('muestra la jornada con sus horarios', /Plan de rodaje · Jornada 1/.test(h) && /Wrap estimado/.test(h));
ok('las jornadas como fichas y el banco', /pl-chip/.test(h) && /Banco de planos/.test(h));
ok('la franja de luz', /pl-franja/.test(h) && /pl-luz/.test(h));
DB.ui.jornada = 2; render();
ok('las marcas del sol en la lista (la jornada 2 llega a la hora dorada)', /Se pone el sol/.test(app.innerHTML) && /Empieza la hora dorada/.test(app.innerHTML));
DB.ui.jornada = 1; render(); h = app.innerHTML;
ok('botones para cargar el storyboard y la lista', /plStoryboard/.test(h) && /plShotList/.test(h));
ok('se arrastra', /draggable="true"/.test(h));
const errs = [];
['dia', 'jornadas', 'elenco'].forEach(k => { try { setSubPlan(k); render(); } catch (e) { errs.push(k + ': ' + e.message); } });
ok('las tres vistas del plan andan', !errs.length, errs.join(' | '));
DB.ui.subPlan = 'jornadas'; render(); h = app.innerHTML;
ok('todas las jornadas en una tabla', /Todas las jornadas/.test(h) && /J2/.test(h));
DB.ui.subPlan = 'elenco'; render(); h = app.innerHTML;
ok('el elenco por jornada con los códigos de siempre', /SWF|SW/.test(h) && /Retenido/.test(h));
['plEditar', 'plAjustes', 'plStoryboard', 'plShotList', 'plPendientes'].forEach(f => {
  try { DB.ui.jornada = 1; f === 'plEditar' ? plEditar(a1.id) : window[f] ? window[f]() : eval(f + '()'); cerrar(); }
  catch (e) { errs.push(f + ': ' + e.message); } });
try { plEditar(null, 'evento'); cerrar(); plEditar(null, 'plano', true); cerrar(); } catch (e) { errs.push('nuevo: ' + e.message); }
ok('los modales abren', !errs.length, errs.join(' | '));

console.log('\n--- 10. MOVER, SUBIR, BORRAR ---');
DB.ui.subPlan = 'dia'; DB.ui.jornada = 2;
const l2 = () => p.items.filter(x => x.jornada === 2).sort((a,b) => a.orden - b.orden);
const i0 = l2().indexOf(b2);
plSubir(b2.id, -1);
ok('↑ lo sube un lugar', l2().indexOf(b2) === i0 - 1);
plMover(b2.id, 'banco');
ok('→ Banco', b2.jornada === null);
global.confirm = () => true;
plBorrar(b2.id);
ok('borrar un plano', !p.items.includes(b2));
_plArrastrado = b1.id;
plSoltarSobre({preventDefault(){}, stopPropagation(){}}, a2.id);
ok('arrastrar y soltar sobre otro plano lo pone antes', l2().indexOf(b1) === l2().indexOf(a2) - 1);
_plArrastrado = b1.id;
plSoltarEn({preventDefault(){}, stopPropagation(){}}, 1);
ok('soltar sobre la ficha de otra jornada lo pasa ahí', b1.jornada === 1);

console.log('\n--- 11. CINE: POR ESCENAS ---');
const pc = nuevoProyecto({nombre: 'Largo', tipo: 'cine'});
pr.proyectos.push(pc);
DB.ui.proyectoId = pc.id; DB.ui.versionId = pc.versiones[0].id;
const dc = getD();
dc.escenas = [
  nuevaEscena({numero: '1', intExt: 'INT', locacion: 'CASA - COCINA', momento: 'DÍA', octavos: 8, personajes: ['ANA'], jornada: 1}),
  nuevaEscena({numero: '2', intExt: 'EXT', locacion: 'PLAZA', momento: 'NOCHE', octavos: 4, personajes: ['ANA', 'JUAN'], jornada: 1}),
  nuevaEscena({numero: '3', intExt: 'INT', locacion: 'CASA - LIVING', momento: 'DÍA', octavos: 12, personajes: ['JUAN'], jornada: 2}),
  nuevaEscena({numero: '4', intExt: 'INT', locacion: 'CASA - COCINA', momento: 'DÍA', octavos: 6, personajes: ['ANA'], jornada: 3}),
];
sincronizarJornadas(dc);
ok('cine se planifica por escenas', planPorEscenas(pc));
DB.ui.tab = 'plan'; DB.ui.subPlan = 'dia'; DB.ui.jornada = 1; render(); h = app.innerHTML;
const pp = planDe(pc);
ok('cada escena con jornada es un ítem del plan', pp.items.filter(x => x.tipo === 'escena').length === 4);
ok('y cada jornada tiene sus eventos base', dc.jornadas.every(j => pp.items.some(x => x.jornada === j.numero && x.clase === 'wrap')));
const D1 = calcularDia(pc, 1);
const esc1 = D1.filas.find(f => f.it && f.it.tipo === 'escena' && escenaDe(pc, f.it.escenaId).numero === '1');
ok('la duración sale de las páginas (1 pg = jornada útil / 4)', esc1.dur === minPorPagina(pc), esc1.dur + ' vs ' + minPorPagina(pc));
ok('de la casa a la plaza es un traslado', D1.filas.some(f => f.implicita === 'traslado'));
ok('las tiras con el color de siempre', /tira-intd/.test(h) && /tira-extn/.test(h));
/* mover la escena 4 a la jornada 2 desde el plan cambia el desglose */
const it4 = pp.items.find(x => x.tipo === 'escena' && escenaDe(pc, x.escenaId).numero === '4');
plMover(it4.id, '2');
ok('mover una escena en el plan la mueve en el desglose', dc.escenas[3].jornada === 2 && it4.jornada === 2);
/* filmada en el plan = filmada en el parte */
plEstado(it4.id, 'filmado');
ok('filmada en el plan queda tildada en el parte', dc.jornadas[1].parte.filmadas.includes(dc.escenas[3].id));
dc.jornadas[1].parte.filmadas = [];
sincronizarPlan(pc);
ok('y destildada en el parte vuelve a pendiente', it4.estado === 'pendiente');
/* day out of days */
const X = diasDelElenco(pc);
const anaX = X.filas.find(f => f.personaje === 'ANA'), juanX = X.filas.find(f => f.personaje === 'JUAN');
ok('ANA: SW en la 1, WF en la 2', anaX.codigos[1] === 'SW' && anaX.codigos[2] === 'WF', JSON.stringify(anaX.codigos));
ok('JUAN trabaja la 1 y la 2', juanX.trabaja === 2);
/* desasignar todo en el desglose no borra las jornadas que tiene el plan */
limpiarJornadas();
ok('desasignar las escenas no borra las jornadas del plan', dc.jornadas.length === 3, dc.jornadas.length);
sincronizarPlan(pc);
ok('y las escenas vuelven al banco del plan', pp.items.filter(x => x.tipo === 'escena').every(x => x.jornada === null));
/* el desglose ya no tiene la sub-solapa, pero no se rompe si quedó guardada */
DB.ui.tab = 'desglose'; DB.ui.subDesglose = 'plan';
try { render(); ok('el desglose con la sub-solapa vieja guardada no se rompe', /Plan de rodaje →/.test(app.innerHTML)); }
catch (e) { ok('el desglose con la sub-solapa vieja guardada no se rompe', false, e.message); }

console.log('\n--- 12. QUITAR JORNADA ---');
DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;
const antes = d.jornadas.length;
const enLa2 = p.items.filter(x => x.jornada === 2 && x.tipo === 'plano');
plQuitarJornada();
ok('quitar la última jornada', d.jornadas.length === antes - 1);
ok('sus planos vuelven al banco', enLa2.every(x => x.jornada === null));
ok('y sus eventos se van', !p.items.some(x => x.jornada === 2));

console.log('\n--- 13. SIN EMPLAZAMIENTOS CARGADOS Y HUECOS ---');
const p3 = nuevoProyecto({nombre: 'Spot chico', tipo: 'publicidad'});
pr.proyectos.push(p3);
DB.ui.proyectoId = p3.id; DB.ui.versionId = p3.versiones[0].id;
plJornadaNueva();
const pl3 = planDe(p3);
leerShotList('1 PD mano\n2 PG cocina\n3 PP Ana\n4 PM Ana y Juan').forEach(x => {
  const it = nuevoItemPlan({...x, tipo: 'plano', set: 'Casa - Cocina'}); pl3.items.push(it); meterEnJornada(p3, it, 1); });
acomodarPorEmplazamiento(p3, 1);
const o3 = calcularDia(p3, 1).filas.filter(f => f.it && f.it.tipo === 'plano').map(f => f.it.numero).join();
ok('sin emplazamientos, en el mismo set va de lo abierto a lo cerrado', o3 === '2,4,3,1', o3);
const D3 = calcularDia(p3, 1);
ok('un hueco largo antes del almuerzo se avisa', D3.avisos.some(a => /sin nada que hacer antes de almuerzo/.test(a.txt)), D3.avisos.map(a => a.txt).join(' | '));
const alm3 = pl3.items.find(x => x.clase === 'almuerzo');
ok('el almuerzo quedó después de los planos de la mañana', calcularDia(p3, 1).filas.findIndex(f => f.it === alm3) > calcularDia(p3, 1).filas.findIndex(f => f.it && f.it.numero === '1'));

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
