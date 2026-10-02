/* Los pases entre solapas: lo que se mandó no cambia sin que se vea, lo
   pagado queda pagado, quitar un día no desordena los gastos, lo escrito a
   mano en el callsheet no se pisa, y las horas se escriben rápido.       */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
global.confirm = () => true;

DB = dbVacia(); sembrar();
const pr = getPr();
const py = nuevoProyecto({ nombre: 'Spot Puentes', tipo: 'publicidad' }); pr.proyectos.push(py);
DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;
const v = getV();
const R_ = c => v.rubros.find(r => r.codigo === c);
['02','03','04','05','06','07','08','09','10','11','12'].forEach(c => { if (R_(c)) R_(c).lineas = []; });
const gaffer = nuevaLinea({ concepto: 'Gaffer', cantidad: 1, dias: 1, valorUnit: 120000, unidad: 'jornada' }); R_('05').lineas.push(gaffer);
py.desglose = nuevoDesglose(); nuevaJornadaPlan(py); nuevaJornadaPlan(py); nuevaJornadaPlan(py);
const p = planDe(py);
[1, 2, 3].forEach(num => { const it = nuevoItemPlan({ tipo: 'plano', numero: String(num), desc: 'Plano', set: 'Oficina' }); p.items.push(it); meterEnJornada(py, it, num); });

console.log('--- 1. HORAS ESCRITAS RÁPIDO ---');
ok('"1930" es 19:30', normHora('1930') === '19:30');
ok('"8.30" es 08:30', normHora('8.30') === '08:30');
ok('"8" es 08:00', normHora('8') === '08:00');
ok('"7:05" es 07:05', normHora('7:05') === '07:05');
ok('lo que no es hora queda igual', normHora('a confirmar') === 'a confirmar' && normHora('2590') === '2590');

console.log('\n--- 2. LA CITACIÓN QUE CAMBIÓ DESPUÉS DE MANDARLA ---');
DB.ui.jornada = 1;
const j1 = py.desglose.jornadas[0]; normalizarJornada(j1);
const k = 'l:' + gaffer.id;
upCitacion(k, 'citacion', '0700');
ok('la citación escrita "0700" queda 07:00', j1.citaciones[k].citacion === '07:00');
DB.ui.tab = 'rodaje'; DB.ui.subRodaje = 'citaciones';
marcarCitado(k);
ok('citado guarda la hora que se mandó', j1.parte.citados[k].hora === '07:00');
ok('está al día', estadoCitado(j1, k).k === 'si');
upCitacion(k, 'citacion', '08:00');
const e = estadoCitado(j1, k);
ok('si la hora cambia, se ve: 07:00 → 08:00', e.k === 'cambio' && e.antes === '07:00' && e.ahora === '08:00');
render();
ok('la pantalla avisa y ofrece re-citar', /cambió 07:00 → 08:00/.test(app.innerHTML) && /copiarCambiadas\(\)/.test(app.innerHTML));
ok('el mensaje dice que cambió', /CAMBIÓ TU CITACIÓN: antes 07:00, ahora 08:00/.test(textoCitacionAl(pr, py, j1, gentePorJornada(py, v, 1).callsheet, gentePorJornada(py, v, 1).gente.find(g => g.clave === k), cfgActual())));
j1.parte.citados.viejo = true;
ok('lo citado antes (sí/no) sigue contando como citado', estadoCitado(j1, 'viejo').k === 'si');

console.log('\n--- 3. LO PAGADO QUEDA PAGADO ---');
const G = () => genteDelProyecto(py, v).find(g => g.lineas.some(x => x.l === gaffer));
avanzarLiq(G().clave, true); avanzarLiq(G().clave, true);
ok('al aprobar se guarda el monto', liqDe(py)[G().clave].montoAprobado === 120000);
avanzarLiq(G().clave, true);
ok('al pagar también', liqDe(py)[G().clave].montoPagado === 120000 && liqDe(py)[G().clave].estado === 'pagado');
gaffer.valorUnit = 150000;
const Lp = liquidarPersona(py, v, G());
ok('si después cambia la línea, lo pagado sigue siendo lo que se pagó', Lp.total === 120000 && Lp.vivo === 150000 && Lp.cambio);
DB.ui.tab = 'personal'; DB.ui.subPersonal = 'liquidacion'; render();
ok('y se avisa cuánto daría hoy', /hoy daría/.test(app.innerHTML) && /volverLiq\(/.test(app.innerHTML));
volverLiq(G().clave);
ok('marcado pagado por error: vuelve a aprobada, anotado', liqDe(py)[G().clave].estado === 'aprobado' && /deshizo/.test(JSON.stringify(liqDe(py)[G().clave].historial)));

console.log('\n--- 4. QUITAR UNA JORNADA NO DESORDENA LO DE OTRAS SOLAPAS ---');
py.comprobantes = [nuevoComprobante({ proveedor: 'Catering', importe: 1000, jornada: 3 }), nuevoComprobante({ proveedor: 'Remis', importe: 500, jornada: 2 })];
const P = pedidoDe(py); P.items.push(nuevoItemLuz({ nombre: 'Skypanel', cant: 1 })); P.items[0].jornadas = [1, 3];
quitarJornada(py, 2);
ok('el gasto de la J3 pasa a ser de la J2 (la misma fecha)', py.comprobantes[0].jornada === 2);
ok('el de la jornada quitada va adonde fueron sus planos', py.comprobantes[1].jornada === 1);
ok('las jornadas del pedido de luces también', JSON.stringify(P.items[0].jornadas) === '[1,2]');

console.log('\n--- 5. EL CALLSHEET NO PISA LO ESCRITO A MANO ---');
DB.ui.jornada = 1; DB.ui.tab = 'callsheet';
volcarHorarios(py, 1);
const wrapPlan = j1.wrap;
upJornada('wrap', '23:30');
volcarHorarios(py, 1);
ok('el wrap escrito a mano queda', j1.wrap === '23:30');
upJornada('wrap', '');
volcarHorarios(py, 1);
ok('borrado, vuelve a salir del plan', j1.wrap === wrapPlan && !!wrapPlan);

console.log('\n--- 6. EL ROL EQUIPO CARGA SUS GASTOS ---');
const u = (pr.usuarios || DB.usuarios || []).find(x => x.rol === 'equipo');
if (u) {
  DB.ui.usuarioId = u.id; DB.ui.tab = 'gastos'; DB.ui.subGasto = 'control';
  const vv = getV();
  render();
  ok('entra a Gastos aunque no vea un presupuesto', /cargarComprobante\(\)/.test(app.innerHTML), vv ? 've un presupuesto' : 'sin presupuesto');
  ok('sin presupuesto no aparecen el tablero ni las áreas', vv || !/setSubGasto\('control'\)/.test(app.innerHTML));
} else ok('hay un usuario de equipo en la semilla', false);

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
