/* La revisión de UX de octubre de 2026 (docs/revision-ux-octubre-2026.md):
   lo que se arregló, para que no vuelva. Con el proyecto de ejemplo de la
   app (Brisa — "Respirá"), que es el que ven las vistas por rol.
   Uso: node test/run.js test/revision-ux.js                                 */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
global.confirm = () => true;
global.prompt = () => '';

DB = dbVacia(); sembrar();
const pr = getPr(), py = getPy();
const U = r => pr.usuarios.find(u => u.rol === r);
const como = r => { DB.ui.usuarioId = U(r).id; modal = null; DB.ui.rendId = null; };
const pantalla = (tab, sub) => { DB.ui.tab = tab; if (sub) DB.ui.subGasto = sub; render(); return app.innerHTML; };

console.log('--- 1. EL JEFE NO VE NADA QUE SALGA DEL FEE ---');
como('produccion');
let h = pantalla('presu');
const vr = getV(), R0 = calcular(vr);
ok('las solapas de las piezas muestran el costo de producción, no el total con fee e IVA',
  h.includes(fmt(R0.subtotal + R0.contingencia, vr.monedaBase)) && !h.includes(fmt(R0.total, vr.monedaBase)), fmt(R0.total, vr.monedaBase));
const pz = py.piezas[0], Rp = calcular(vr, filtroPieza(pz.id));
ok('ni el total de cada pieza', !h.includes(fmt(Rp.total, vr.monedaBase)) && h.includes(fmt(Rp.subtotal + Rp.contingencia, vr.monedaBase)));
como('ejecutivo'); h = pantalla('presu');
ok('el PE sí ve el total en las solapas', h.includes(fmt(calcular(getV()).total, getV().monedaBase)));

console.log('\n--- 2. LOS AVISOS DEL PLAN: EL NÚMERO COINCIDE CON LAS TARJETAS ---');
const A = avisosPlanPresupuesto(py, versionRodaje(py));
como('produccion'); DB.ui.subPlan = 'presu'; h = pantalla('plan');
const tarjetas = (h.match(/class="pl-av pl-av-/g) || []).length;
ok('la solapa dice tantos como tarjetas muestra', h.includes(`Contra el presupuesto · ${tarjetas}`) && tarjetas === A.length, tarjetas + ' tarjetas');
h = pantalla('resumen');
ok('y el resumen del jefe, lo mismo', h.includes(`<span class="pendn">${A.length}</span><span>avisos del plan contra el presupuesto`));

console.log('\n--- 3. ARMAR EL DÍA: EL ALMUERZO EN LA MITAD, NO A LAS 4 HORAS ---');
const copia = JSON.parse(JSON.stringify(planDe(py).items));
armarDia(py, 2);
const D2 = calcularDia(py, 2), alm = D2.filas.find(f => f.it && f.it.clase === 'almuerzo');
ok('J2 armada: el almuerzo entre las 12 y las 13 (la citación es 06:30)', alm && alm.inicio >= 12 * 60 && alm.inicio <= 13 * 60, alm ? aHora(alm.inicio) : 'sin almuerzo');
ok('y no se pasa de las horas hasta la comida', alm && alm.inicio - D2.inicio <= (n(planDe(py).horasHastaComida) || 6) * 60);
planDe(py).items = copia;

console.log('\n--- 4. RENDICIONES: EL MISMO TICKET DOS VECES SE AVISA ---');
const diego = U('asistprod');
como('produccion');
const cj = nuevaCaja({nombre: 'Prueba', responsable: diego.id}); cj.adelantos.push({id: uid('ad'), fecha: hoy(), importe: 50000});
py.cajas.push(cj);
como('asistprod');
const g1 = nuevoGastoRend(cj, {fecha: hoy(), proveedor: 'Ferretería', rubro: '03', tipo: 'facBC', numero: '0003-00012345', importe: 12500});
const g2 = nuevoGastoRend(cj, {fecha: hoy(), proveedor: 'Ferretería El Tornillo', rubro: '03', tipo: 'facBC', numero: '00003-00012345', importe: 12500});
const g3 = nuevoGastoRend(cj, {fecha: hoy(), proveedor: 'Kiosco', rubro: '13', tipo: 'ticket', numero: '', importe: 800});
let rep = repetidosRend(totalesRend(py, cj).comprobantes);
ok('mismo número de factura: el segundo se marca igual al primero', rep[g2.id] === 1 && !rep[g1.id] && !rep[g3.id], JSON.stringify(rep));
const g4 = nuevoGastoRend(cj, {fecha: hoy(), proveedor: 'kiosco ', rubro: '13', tipo: 'ninguno', importe: 800});
rep = repetidosRend(totalesRend(py, cj).comprobantes);
ok('mismo importe, fecha y proveedor, también', rep[g4.id] === 3);
abrirRend(cj.id); h = app.innerHTML;
ok('en la fila: ¿Repetido? y con cuál', /¿Repetido\? Es igual al ticket 1/.test(h));
let pregunta = '';
global.confirm = m => { pregunta = m; return false; };
enviarRend(cj.id);
ok('al mandar, la pregunta lo dice', /parecen? repetidos?/.test(pregunta), pregunta.split('\n').slice(-3).join(' | '));
global.confirm = () => true;
ok('los tickets de ejemplo no se marcan como repetidos', py.cajas.filter(x => x !== cj).every(x => !Object.keys(repetidosRend(totalesRend(py, x).comprobantes)).length));
py.cajas = py.cajas.filter(x => x !== cj); py.comprobantes = py.comprobantes.filter(c => c.cajaId !== cj.id);

console.log('\n--- 5. UN COMPROBANTE RECHAZADO DICE POR QUÉ Y QUÉ HACER ---');
como('equipo');
const taxi = getComprobantes().find(c => c.estado === 'rechazado' && c.cargadoPor === U('equipo').id);
ok('el motivo sale del historial', motivoRechazo(taxi) && /Sin ticket/.test(motivoRechazo(taxi).nota) && motivoRechazo(taxi).quien === 'Diego Sosa');
h = pantalla('gastos', 'bandeja');
ok('en su lista: quién lo rechazó, por qué y qué hacer', /Lo rechazó Diego Sosa: «Sin ticket/.test(h) && /cargalo de nuevo/.test(h));
ok('y "cargados", no "para vos" (no le espera nada)', />cargados</.test(h) && !/>para vos</.test(h));
h = pantalla('resumen');
ok('en su panel también, con el motivo', /rechazado por Diego Sosa/.test(h) && /Sin ticket no se puede pagar/.test(h));

console.log('\n--- 6. CARGAR UN COMPROBANTE: LA FOTO PRIMERO ---');
como('asistprod'); DB.ui.tab = 'gastos'; render(); cargarComprobante(); h = modal;
ok('"Sacar foto" está antes que el rubro (en el celu se ve sin bajar)', h.indexOf('Sacar foto') > 0 && h.indexOf('Sacar foto') < h.indexOf('name="rubro"'));
ok('y avisa que CLAP lee el archivo', /CLAP lee lo que puede/.test(h) && /id="cleer"/.test(h));
cerrar();

console.log('\n--- 7. TEXTOS ---');
como('asistprod'); h = pantalla('resumen');
ok('el lavadero de Sofía (vestuario) es "del equipo", no "de arte"', /comprobante suelto del equipo para revisar/.test(h));
ok('lo que el asistente tiene que revisar va pegado a sus tareas, antes que sus comprobantes', h.indexOf('Rendiciones de arte para revisar') > 0 && h.indexOf('Rendiciones de arte para revisar') < h.indexOf('Tus comprobantes'));
const j2 = py.desglose.jornadas.find(j => j.numero === 2);
const vieja = (j2.citaciones || {}); const claves = Object.keys(vieja);
ok('"Re-citar al que cambió" (no "a el")', !/a el que cambió/.test(clap()) && /'al que cambió'/.test(clap()));
como('produccion'); h = pantalla('luces');
ok('el pedido de luces dice si el total es con o sin IVA, y el neto', /total (con|sin) IVA/.test(h) && /Neto, sin IVA/.test(h));
h = pantalla('resumen');
ok('el jefe ve primero lo que espera algo de él (antes que el tipo de cambio)', h.indexOf('Esperan algo') > 0 && h.indexOf('Esperan algo') < h.indexOf('Tipo de cambio'));
h = pantalla('gastos', 'rend');
ok('las rendiciones: "en mano, sin cerrar" (ya rendidas no es "sin rendir")', /en mano, sin cerrar/.test(h));

console.log('\n--- 8. DAR UN FONDO Y CERRAR: SÓLO EL MONTO A LA VISTA ---');
darFondo(); h = modal;
ok('la fecha va plegada, con hoy puesto', /<details class="f-fecha">/.test(h) && h.includes(`value="${hoy()}"`));
cerrar();
como('admin');
const aprob = py.cajas.find(x => estadoRend(x) === 'aprobada');
rendirCaja(aprob.id); h = modal;
ok('al cerrar la rendición, igual', /<details class="f-fecha">/.test(h) && /Cuánto devolvió/.test(h));
cerrar();

console.log('\n--- 9. DESGLOSE → PRESUPUESTO EN EL EJEMPLO ---');
como('produccion');
const P = propuestaPresupuesto();
ok('lo que ya está (aunque se llame distinto) viene destildado y dice con qué línea', P.lineas.filter(l => l.dep === 'elenco' || l.dep === 'locacion').every(l => l.ya && l.parecida), P.lineas.filter(l => !l.ya).map(l => l.concepto).join(' / '));
ok('el menor y la vía pública aparecen (y ya están cubiertos)', P.lineas.some(l => l.dep === 'tag' && /menor/.test(l.concepto) && l.ya) && P.lineas.some(l => l.dep === 'tag' && /vía pública/.test(l.concepto) && l.ya));
ok('sin avisos nuevos en el plan por eso', avisosPlanPresupuesto(py, versionRodaje(py)).length === 3);

console.log('\n--- 10. INVITAR Y PERMISOS, EN CASTELLANO ---');
como('produccion'); invitarAlProyecto(); h = modal;
ok('el jefe invita a su equipo: arranca en asistente de producción', /<option value="asistprod" selected/.test(h));
cerrar(); h = pantalla('equipo');
ok('"Puede": repartir tareas y pedir cheques, no las claves internas', /repartir tareas/.test(h) && /pedir cheques/.test(h) && !/· tareas</.test(h));

function clap(){ return require('fs').readFileSync(require('path').join(__dirname, '..', 'clap.html'), 'utf8'); }

console.log(fallos ? `\n>>> ${fallos} FALLAS` : '\n>>> TODO OK');
