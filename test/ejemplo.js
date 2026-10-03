/* El proyecto de ejemplo de la app (sembrar(): Brisa — "Respirá"). Es el que
   ven las vistas por rol y del que salen los tutoriales: lo que dice
   docs/proyecto-de-ejemplo.md tiene que ser verdad acá.
   Uso: node test/run.js test/ejemplo.js                                     */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
global.confirm = () => true;
global.prompt = () => '';

DB = dbVacia(); sembrar();
const pr = getPr(), py = getPy();
const U = r => pr.usuarios.find(u => u.rol === r);
const como = r => { DB.ui.usuarioId = U(r).id; modal = null; };

console.log('--- 1. QUÉ ES ---');
ok('una sola productora y un solo proyecto', DB.productoras.length === 1 && pr.proyectos.length === 1);
ok('Productora Demo · Brisa · Faro Comunicación (todo inventado)', pr.nombre === 'Productora Demo' && /Brisa/.test(py.nombre) && /Brisa/.test(py.cliente) && py.agencia === 'Faro Comunicación');
ok('1 spot de 30″, el cutdown de 15″ y 3 piezas para redes', py.piezas.length === 5 && /30″/.test(py.piezas[0].nombre) && /15″/.test(py.piezas[1].nombre) && py.piezas.slice(2).every(p => /^Redes/.test(p.nombre)));
ok('los siete del equipo, uno por rol, todos en el proyecto', pr.usuarios.length === 7 && ORDEN_ROLES.every(r => U(r)) && pr.usuarios.every(u => py.invitados.includes(u.id)));
ok('los de siempre: Lucía jefa, Diego y Carla asistentes, Paula AD, Tomás PE, Marta administración, Sofía vestuario',
  U('produccion').nombre === 'Lucía Ferrer' && U('asistprod').nombre === 'Diego Sosa' && U('arte').nombre === 'Carla Méndez' && U('asistdir').nombre === 'Paula Ríos'
  && U('ejecutivo').nombre === 'Tomás Vidal' && U('admin').nombre === 'Marta Giles' && U('equipo').nombre === 'Sofía Roldán');

console.log('\n--- 2. EL PRESUPUESTO ---');
const [vCli, vReal, vRod] = py.versiones;
ok('tres versiones: Cliente, Real y la de rodaje (Producción)', vCli.nivel === 'cliente' && vReal.nivel === 'real' && vRod.nivel === 'produccion' && versionRodaje(py) === vRod);
const T = v => calcular(v).total;
ok('Cliente > Real > Rodaje (el colchón queda en el Real)', T(vCli) > T(vReal) && T(vReal) > T(vRod), [vCli, vReal, vRod].map(v => fmt(T(v))).join(' > '));
ok('una publicidad mediana: el total al cliente entre $ 90 y $ 170 millones', T(vCli) > 90e6 && T(vCli) < 170e6, fmt(T(vCli)));
ok('fee 15 %, contingencia 5 %, IVA 21 %', vCli.capas.fee === 15 && vCli.capas.contingencia === 5 && vCli.capas.iva === 21);
const crew = vRod.rubros.filter(r => RUBROS_CREW.includes(r.codigo)).flatMap(r => r.lineas.filter(l => !l.etapa && !NO_ES_PERSONA.test(l.concepto)).flatMap(l => Array(puestosDeLinea(l)).fill(l)));
ok('entre 25 y 32 personas en el equipo técnico', crew.length >= 25 && crew.length <= 32, crew.length);
const sica = vRod.rubros.flatMap(r => r.lineas).filter(l => l.valorOrigen === 'sica');
ok('los sueldos salen del convenio SICA (y están al día)', sica.length > 20 && sica.every(l => !(estadoSICA(l, py) || {}).desactualizado));
ok('la caja chica de producción: $ 700.000', (vRod.rubros.find(r => r.codigo === '03').lineas.find(l => l.concepto === 'Caja chica de producción') || {}).valorUnit === 700000);
ok('Carla es asistente de arte y Paula asistente de dirección, también en el presupuesto',
  vRod.rubros.find(r => r.codigo === '06').lineas.some(l => l.concepto === 'Asistente de Arte' && l.refId) && vRod.rubros.find(r => r.codigo === '02').lineas.some(l => /^Asistente de Dirección/.test(l.concepto)));
ok('un adicional aprobado y uno propuesto', adicionalesDe(py).filter(a => a.estado === 'aprobado').length === 1 && adicionalesDe(py).filter(a => a.estado === 'propuesto').length === 1);
const A = avisosPlanPresupuesto(py, vRod);
ok('el plan contra el presupuesto: un "se pasa", un "falta" y un "sobra"', A.length === 3 && ['pasa', 'falta', 'sobra'].every(k => A.some(x => x.k === k)), A.map(x => x.k + ': ' + x.t).join(' | '));
ok('...los extras, el VFX del packshot y la jornada de más de Nico', A.some(x => /Extras: el plan necesita 10 y el presupuesto paga 8/.test(x.t)) && A.some(x => /VFX/.test(x.t)) && A.some(x => /^Nico/.test(x.t)));

console.log('\n--- 3. EL GUION, EL PLAN Y EL CALLSHEET ---');
const d = py.desglose;
ok('el desglose es el guion del spot (4 escenas, el mismo de "Probar con un guion de ejemplo")', d.guion === GUION_DEMO && d.escenas.length === 4);
ok('el nene es menor: aparece el permiso', tagsDelProyecto(py).some(t => t.k === 'menores'));
ok('dos jornadas: la J1 fue ayer (exterior), la J2 es pasado mañana (interior)', d.jornadas.length === 2 && d.jornadas[0].fecha === hoyMas(-1) && d.jornadas[1].fecha === hoyMas(2));
d.jornadas.forEach(j => { const D = calcularDia(py, j.numero);
  ok(`J${j.numero}: citación 06:30, almuerzo 12:30, wrap 19:30, sin avisos`, j.citacion === '06:30' && D.comida && aHora(D.comida.inicio) === '12:30' && aHora(D.fin) === '19:30' && !D.avisos.length,
    `${aHora(D.inicio)} · ${D.comida ? aHora(D.comida.inicio) : '—'} · ${aHora(D.fin)} · ${D.avisos.map(a => a.txt).join(' | ')}`);
  ok(`J${j.numero}: el sol de Buenos Aires para esa fecha`, /^0[5-7]:\d\d$/.test(j.amanecer) && /^(18|19|20):\d\d$/.test(j.atardecer), j.amanecer + ' / ' + j.atardecer); });
ok('los planos de la J1 están filmados y los de la J2 pendientes', planDe(py).items.filter(x => x.jornada === 1 && x.tipo === 'plano').every(x => x.estado === 'filmado') && planDe(py).items.filter(x => x.jornada === 2 && x.tipo === 'plano').every(x => x.estado === 'pendiente'));
const C2 = gentePorJornada(py, vRod, 2), j2 = d.jornadas[1];
const horas = new Set(C2.gente.map(g => horaCitada(j2, g.clave)));
ok('citaciones con horas distintas (producción, eléctrica, maquillaje, elenco)', horas.size >= 4, [...horas].sort().join(' '));
ok('el callsheet con las direcciones en Buenos Aires', Object.values(j2.direcciones).some(x => /Martínez/.test(x.direccion)) && Object.values(d.jornadas[0].direcciones).some(x => /CABA/.test(x.direccion)));
ok('las confirmaciones de la J2: uno no puede y una tiene la hora vieja', C2.gente.some(g => estadoConfirmacion(j2, g.clave).k === 'nopuede') && C2.gente.some(g => estadoConfirmacion(j2, g.clave).k === 'vieja'));
const HE = horasProyecto(py, vRod, py.configRodaje);
ok('la J1 terminó tarde: hay horas extra', HE.jornadas[0].extra > 0 && HE.totalARS > 0, fmtHoras(HE.jornadas[0].extra) + ' · ' + fmt(HE.totalARS));
ok('el pedido de luces, cotizado con Rental Sur', pedidoDe(py).estado === 'cotizado' && pedidoDe(py).rental === 'Rental Sur' && pedidoDe(py).items.length > 20);

console.log('\n--- 4. LA GENTE: ALTAS, TAREAS Y LIQUIDACIÓN ---');
const G = genteDelProyecto(py, vRod), gq = nm => G.find(g => g.nombre === nm);
ok('altas con datos que faltan (Nico: alias; Sofía: nacimiento y alias; Mateo: CUIL y alias)',
  faltaDe(gq('Nico Ferraro')).pago.length && faltaDe(gq('Sofía Roldán')).seguro.includes('nacimiento') && faltaDe(gq('Mateo Lanza')).seguro.includes('CUIL'));
const ta = tareasDe(py), deDiego = ta.filter(t => t.asignadoA === U('asistprod').id && t.estado !== 'hecha').map(t => t.titulo).join(' | ');
ok('las tareas de Diego: el motorhome (vencida), el generador para vestuario y los agarres de grip', /motorhome/i.test(deDiego) && /Generador para vestuario/.test(deDiego) && /agarres/.test(deDiego) && ta.some(t => /motorhome/i.test(t.titulo) && tareaVencida(t)));
ok('cada uno tiene alguna (también Lucía, para ella misma)', ['asistprod', 'arte', 'asistdir', 'equipo', 'produccion'].every(r => ta.some(t => t.asignadoA === U(r).id)));
const L = liqDe(py);
ok('liquidación: revisadas y aprobadas', Object.values(L).some(x => x.estado === 'revisado') && Object.values(L).some(x => x.estado === 'aprobado'));

console.log('\n--- 5. LA PLATA ---');
const cs = py.comprobantes, est = k => cs.filter(c => c.estado === k && !c.cajaId).length;
ok('comprobantes en cada estado (cargado, revisado, aprobado, pagado, rechazado)', ['cargado', 'revisado', 'aprobado', 'pagado', 'rechazado'].every(k => est(k) > 0), ['cargado', 'revisado', 'aprobado', 'pagado', 'rechazado'].map(k => k + ' ' + est(k)).join(', '));
ok('una orden de compra emitida', py.ocs.length === 1 && py.ocs[0].estado === 'emitida');
ok('cheques de garantía: pedido, aprobado y entregado', ['pedido', 'aprobado', 'entregado'].every(k => py.cheques.some(c => c.estado === k)));
const rend = r => py.cajas.filter(cj => cj.responsable === U(r).id).map(estadoRend).sort().join(',');
ok('las rendiciones de Diego: una cerrada y una enviada a la jefa', rend('asistprod') === 'cerrada,enviada', rend('asistprod'));
ok('las de Carla: una aprobada (la cierra Marta) y una en producción (la chequea Diego)', rend('arte') === 'aProduccion,aprobada', rend('arte'));
ok('los fondos salen de la caja chica: $ 600.000 entregados', fondosDeLinea(py, py.cajas[0].lineaId).entregado === 600000, fmt(fondosDeLinea(py, py.cajas[0].lineaId).entregado));

console.log('\n--- 6. CADA ROL, CADA PANTALLA ---');
const errores = [];
ORDEN_ROLES.forEach(r => { como(r);
  ['resumen', 'presu', 'desglose', 'plan', 'luces', 'callsheet', 'rodaje', 'gastos', 'personal', 'catalogo', 'equipo', 'config', 'guia'].forEach(k => {
    if(k !== 'personal' && !puedeSolapa(k)) return;
    try { DB.ui.tab = k; render(); if(!app.innerHTML) errores.push(r + '/' + k + ' vacía'); } catch (e) { errores.push(r + '/' + k + ': ' + e.message); } });
  ['bandeja', 'todos', 'control', 'rend', 'oc', 'cheques'].forEach(s => { try { DB.ui.tab = 'gastos'; DB.ui.subGasto = s; render(); } catch (e) { errores.push(r + '/gastos/' + s + ': ' + e.message); } });
  ['citaciones', 'parte', 'horas'].forEach(s => { try { DB.ui.tab = 'rodaje'; DB.ui.subRodaje = s; render(); } catch (e) { errores.push(r + '/rodaje/' + s + ': ' + e.message); } });
});
ok('todas las pantallas de todos los roles se dibujan sin errores', !errores.length, errores.slice(0, 5).join(' | '));
ok('y abrirlas no cambia el plan (siguen los 3 avisos y el wrap a las 19:30)', avisosPlanPresupuesto(py, vRod).length === 3 && d.jornadas.every(j => aHora(calcularDia(py, j.numero).fin) === '19:30'),
  avisosPlanPresupuesto(py, vRod).map(x => x.t).join(' | '));
como('asistprod'); setTab('resumen');
ok('Diego ve en su panel la rendición de Carla para chequear', /Rendiciones de arte para revisar/.test(app.innerHTML) && app.innerHTML.includes('Carla Méndez'));
como('produccion'); setTab('resumen');
ok('Lucía tiene para revisar la rendición de Diego (y no la de Carla, que todavía no pasó)', getCajas().filter(cj => esperaDe(cj)).map(cj => nombreUsuario(cj.responsable)).join() === 'Diego Sosa');
como('admin'); setTab('resumen');
ok('Marta tiene para cerrar la de Carla (ya elevada)', getCajas().some(cj => esperaDe(cj) && estadoRend(cj) === 'aprobada' && cj.responsable === U('arte').id) && !getCajas().some(cj => esperaDe(cj) && estadoRend(cj) === 'aProduccion'));

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
process.exitCode = fallos ? 1 : 0;
