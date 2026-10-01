/* Citaciones que salen del plan, aprendidas de un shooting schedule real
   de una producción grande (5 días, misma estructura).
   ---------------------------------------------------------------------------
   Cada departamento escalonado contra el crew call; cada actor con citación,
   a vestuario, listo y desde cuándo entra en extras, y dónde; los extras por
   grupo; punto de encuentro y salida; las comidas con su nombre; la escala
   de la producción cambia los tiempos.                                     */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

DB = dbVacia(); sembrar();
const pr = getPr();
const py = nuevoProyecto({ nombre: 'Spot Grande', tipo: 'publicidad' }); pr.proyectos.push(py);
DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;
const v = getV();
/* el equipo, en el presupuesto */
const R_ = c => v.rubros.find(r => r.codigo === c);
const linea = (c, concepto, o = {}) => { const l = nuevaLinea({ concepto, cantidad: 1, dias: 2, valorUnit: 100000, unidad: 'jornada', ...o }); R_(c).lineas.push(l); return l; };
R_('03').lineas = []; R_('02').lineas = []; R_('04').lineas = []; R_('05').lineas = []; R_('06').lineas = []; R_('07').lineas = []; R_('08').lineas = [];
const jefe = linea('03', 'Jefe de Producción');
const locs = linea('03', 'Jefe de Locaciones');
const ad = linea('02', '1er Asistente de Dirección');
const maq = linea('07', 'Maquillador/a');
const vest = linea('07', 'Vestuarista');
const gaffer = linea('05', 'Gaffer');
const df = linea('04', 'Director de Fotografía');
const alq = linea('04', 'Alquiler de cámara');
const prepro = linea('03', 'Productor de prepro', { etapa: 'prepro' });

py.desglose = nuevoDesglose();
nuevaJornadaPlan(py);
const j1 = py.desglose.jornadas[0];
j1.citacion = '06:00'; j1.fecha = '2026-09-19';
const p = planDe(py);
const plano = (numero, o) => { const it = nuevoItemPlan({ tipo: 'plano', numero, ...o }); p.items.push(it); meterEnJornada(py, it, 1); return it; };
plano('1', { desc: 'Wide de Franco en la mesa', set: 'Arenas Studios - Oficina', elenco: 'Franco', movimiento: 'Grúa', vfx: 'Clean plate, HDR' });
plano('2', { desc: 'CU de Franco', set: 'Arenas Studios - Oficina', elenco: 'Franco' });
plano('3', { desc: 'Franco pasa frente a cámara', set: 'Puerto Madero - Calle', elenco: 'Franco, Doble de riesgo', extras: '5 peatones', camB: 'Alexa en slider' });

console.log('--- 1. LA ESCALA DE LA PRODUCCIÓN ---');
const durChica = duracionItem(py, p.items.find(x => x.numero === '2'));
p.escala = 'grande';
const durGrande = duracionItem(py, p.items.find(x => x.numero === '2'));
ok('un plano fijo: 15 min en chica, el doble en grande', durChica === 15 && durGrande === 30, durChica + ' → ' + durGrande);
ok('cada pasada de VFX suma 5 min', duracionItem(py, p.items.find(x => x.numero === '1')) === Math.round(35 * 2) + 10);

console.log('\n--- 2. CITAR EL DÍA ---');
armarDia(py, 1);
const D = calcularDia(py, 1), H = horariosDelDia(py, 1, D);
const c = clave => j1.citaciones[clave] || {};
const crewCall = aMin(j1.citacion);
ok('locaciones 1 h 15 antes del crew call', c('l:' + locs.id).citacion === aHora(crewCall - 75), c('l:' + locs.id).citacion);
ok('producción y asistentes de dirección, 1 h antes', c('l:' + jefe.id).citacion === aHora(crewCall - 60) && c('l:' + ad.id).citacion === aHora(crewCall - 60));
ok('eléctrica y fotografía, con el crew call', c('l:' + gaffer.id).citacion === j1.citacion && c('l:' + df.id).citacion === j1.citacion);
const franco = elencoDelDia(py, 1, D).find(x => x.nombre === 'Franco');
ok('maquillaje y vestuario, con el primer actor (15 min antes)', c('l:' + maq.id).citacion === aHora(Math.min(crewCall, franco.citacion - 15)) && c('l:' + vest.id).citacion === c('l:' + maq.id).citacion, c('l:' + maq.id).citacion);
ok('cada técnico sabe su departamento', c('l:' + locs.id).depto === 'Locaciones' && c('l:' + gaffer.id).depto === 'Eléctrica y grip');
ok('alquileres y prepro no se citan como gente', !j1.citaciones['l:' + alq.id] && !j1.citaciones['l:' + prepro.id]);

console.log('\n--- 3. CADA ACTOR ---');
const cf = c('p:Franco');
ok('citación según su primer plano', cf.citacion === aHora(franco.citacion));
ok('a vestuario 15 min después', cf.vestuario === aHora(franco.citacion + 15));
ok('listo antes de su primer plano', cf.listo && aMin(cf.listo) <= franco.primera);
ok('desde cuándo entra en horas extra', cf.extras === aHora(franco.citacion + horasJornadaDe(py.configRodaje || nuevaConfigRodaje()) * 60 + (D.comida ? D.comida.dur : 60)), cf.extras);
ok('dónde se lo cita: la locación de su primer plano', cf.lugar === 'Arenas Studios');
const doble = c('p:Doble de riesgo');
ok('el doble de riesgo, que entra a la tarde, se cita en la otra locación', doble.lugar === 'Puerto Madero' && aMin(doble.citacion) > aMin(cf.citacion), doble.lugar + ' ' + doble.citacion);
ok('la hora en que se libera, del plan', cf.libera && doble.libera);

console.log('\n--- 4. LOS EXTRAS, POR GRUPO ---');
const X = extrasDelDia(py, 1, D);
ok('"5 peatones" es un grupo de 5', X.length === 1 && X[0].nombre === 'Peatones' && X[0].cant === 5, JSON.stringify(X.map(x => [x.nombre, x.cant])));
ok('citados una hora antes de su plano', c('x:peatones').citacion === aHora(Math.max(D.inicio, X[0].primera - 60)));
const G = gentePorJornada(py, v, 1).gente;
ok('en Rodaje aparecen para fichar', G.some(g => g.tipo === 'extras' && g.clave === 'x:peatones'));
ok('y no los alquileres ni la prepro', !G.some(g => g.clave === 'l:' + alq.id || g.clave === 'l:' + prepro.id));

console.log('\n--- 5. EL RESUMEN DEL DÍA ---');
ok('listo para filmar = el primer plano', H.listo === D.filas.find(f => f.it && f.it.tipo === 'plano').inicio);
ok('wrap de cámara antes del wrap total', H.wrapCamara < H.wrapTotal);
ok('agencia y cliente, 15 min antes de filmar', H.agencia === H.listo - 15);
DB.ui.tab = 'plan'; DB.ui.jornada = 1; render();
ok('la cabecera dice crew call, listo, wrap de cámara y total', ['Crew call', 'Listo para filmar', 'Wrap de cámara', 'Wrap total'].every(t => app.innerHTML.includes(t)));
ok('el bloque de citaciones con departamentos y extras', /Citaciones del día/.test(app.innerHTML) && /Locaciones/.test(app.innerHTML) && /Peatones/.test(app.innerHTML));
ok('el plano muestra cámara B, extras y VFX', /Cám\. B: Alexa en slider/.test(app.innerHTML) && /👥 5 peatones/.test(app.innerHTML) && /pl-vfx">Clean plate/.test(app.innerHTML));

console.log('\n--- 6. LAS COMIDAS SE LLAMAN POR LA HORA ---');
ok('al mediodía, almuerzo; de noche, cena', nombreEvento({ clase: 'almuerzo' }, 13 * 60) === 'Almuerzo' && nombreEvento({ clase: 'almuerzo' }, 20 * 60 + 45) === 'Cena');
ok('citación a la tarde: refrigerio, no desayuno', nombreEvento({ clase: 'desayuno' }, 14 * 60 + 15) === 'Citación y refrigerio' && nombreEvento({ clase: 'desayuno' }, 6 * 60) === 'Citación y desayuno');

console.log('\n--- 7. PUNTO DE ENCUENTRO ---');
j1.encuentro = 'Lima e Independencia'; j1.viaje = 60;
volcarHorarios(py, 1);
ok('cada uno sabe a qué hora sale', c('l:' + gaffer.id).salida === aHora(crewCall - 60) && c('p:Franco').salida === aHora(aMin(c('p:Franco').citacion) - 60));
const C = armarCallsheet(py, v, 1);
const txt = textoCitacion(pr, py, j1, C, { clave: 'p:Franco', rol: 'Franco', nombre: '' }, py.configRodaje || nuevaConfigRodaje());
ok('y el mensaje de la citación lo dice', /Salida de Lima e Independencia: /.test(txt) && /en Arenas Studios/.test(txt) && /A vestuario:/.test(txt), txt.split('\n').slice(3, 9).join(' | '));

console.log('\n--- 8. LO ESCRITO A MANO NO SE PISA; "RECALCULAR" SÍ ---');
upCitacion('l:' + gaffer.id, 'citacion', '05:30');
volcarHorarios(py, 1);
ok('cambiar el plan no pisa una citación escrita a mano', c('l:' + gaffer.id).citacion === '05:30');
plCitarElenco();
ok('"Recalcular citaciones" vuelve a la del plan', c('l:' + gaffer.id).citacion === j1.citacion);

console.log('\n--- 9. "ANA" Y "Ana" SON LA MISMA ---');
plano('4', { desc: 'Ana', set: 'Arenas Studios - Oficina', elenco: 'ANA' });
plano('5', { desc: 'Ana', set: 'Arenas Studios - Oficina', elenco: 'Ana' });
const C2 = armarCallsheet(py, v, 1);
ok('el callsheet no la duplica', C2.elenco.filter(e => norm(e.personaje) === 'ana').length === 1);
volcarHorarios(py, 1);
const claveAna = C2.elenco.find(e => norm(e.personaje) === 'ana').clave;
ok('y la citación cae en su renglón', !!(j1.citaciones[claveAna] || {}).citacion);

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
