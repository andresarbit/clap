/* Alta del equipo y liquidación.
   ---------------------------------------------------------------------------
   Pedido: al dar de alta al equipo, un botón que le pida a cada uno por
   WhatsApp que confirme los datos del seguro y su alias o CBU; y al cerrar,
   liquidar el pago de todos para pasárselo a administración.              */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const casi = (a, b, tol = 1) => Math.abs(a - b) <= tol;
let bajado = null;
global.URL.createObjectURL = b => { bajado = b; return 'blob:x'; };

DB = dbVacia(); sembrar();
const pr = getPr();
const py = nuevoProyecto({nombre: 'Spot Liquidación', tipo: 'publicidad'});
pr.proyectos.push(py);
DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;
const v = getV();
aplicarPlantilla(py, v, 'pub-chica', {jornadas: 1});
py.desglose.jornadas = [nuevaJornada({numero: 1, fecha: '2026-10-08'})];
const linea = (c, etapa = null) => v.rubros.flatMap(r => r.lineas).find(l => l.concepto === c && (l.etapa || null) === etapa);

/* gente del catálogo */
const jp = nuevaPersona({nombre: 'Laura Prueba', funcion: 'Jefe de Producción', rubro: '03', tel: '11 5555-1111',
  dni: '30111222', cuit: '27-30111222-4', fechaNac: '1985-03-02', alias: 'laura.prueba.mp', condicion: 'Monotributista'});
const df = nuevaPersona({nombre: 'Pablo Ejemplo', funcion: 'Director de Fotografía', rubro: '04', tel: '11 5555-2222',
  condicion: 'Responsable Inscripto'});
const prov = nuevaPersona({nombre: 'Rental Ficticio', funcion: 'Paquete de luces', rubro: '11', tipo: 'proveedor'});
DB.catalogo.personas.push(jp, df, prov);
linea('Jefe de Producción').refId = jp.id;
linea('Jefe de Producción', 'prepro').refId = jp.id;        /* la misma persona en prepro y rodaje */
linea('Director de Fotografía').refId = df.id;
/* el gaffer sin ficha: sólo con nombre en la lista de contactos */
py.contactos.porLinea['l:' + linea('Gaffer').id] = {nombre: 'Gustavo Sinficha', tel: '11 5555-3333'};

console.log('--- 1. QUIÉN ES EL EQUIPO ---');
const G = genteDelProyecto(py, v);
const de = nombre => G.find(g => g.nombre === nombre);
ok('la jefa de producción es UNA persona con sus dos líneas', de('Laura Prueba') && de('Laura Prueba').lineas.length === 2);
ok('el gaffer sin ficha también está', !!de('Gustavo Sinficha'));
ok('los alquileres y compras no son personas', !G.some(g => g.funciones.some(f => /Alquiler|Compras/.test(f))));
ok('el elenco sí', G.some(g => g.funciones.includes('Actor / Actriz Principal')));
const ad = G.filter(g => g.funciones.includes('Ayudante de Dirección (1° AD)'));
ok('un puesto sin nadie es una sola fila aunque tenga prepro y rodaje', ad.length === 1 && ad[0].lineas.length === 2 && faltaDe(ad[0]).sinAsignar);

console.log('\n--- 2. ALTA: QUÉ FALTA ---');
ok('la jefa está completa', faltaDe(de('Laura Prueba')).seguro.length === 0 && faltaDe(de('Laura Prueba')).pago.length === 0);
const fDF = faltaDe(de('Pablo Ejemplo'));
ok('al DF le falta DNI, CUIL, nacimiento y alias/CBU', ['DNI','CUIL','nacimiento'].every(x => fDF.seguro.includes(x)) && fDF.pago.length === 1);
ok('el gaffer no tiene ficha', faltaDe(de('Gustavo Sinficha')).sinFicha);

console.log('\n--- 3. EL MENSAJE ---');
const msg = textoPedidoDatos(pr, py, de('Laura Prueba'));
ok('saluda, dice productora, proyecto y función', /^Hola Laura!/.test(msg) && msg.includes(pr.nombre) && msg.includes('Spot Liquidación') && msg.includes('Jefe de Producción'));
ok('trae lo que ya tenemos, para confirmar', msg.includes('30111222') && msg.includes('02/03/1985') && msg.includes('laura.prueba.mp'));
ok('y pide que conteste OK', /respondé OK/.test(msg));
ok('lo que falta va con guion', /DNI: —/.test(textoPedidoDatos(pr, py, de('Pablo Ejemplo'))));
DB.ui.tab = 'personal'; DB.ui.subPersonal = 'alta'; render();
let h = app.innerHTML;
ok('las solapas "Altas y seguro" (antes de rodar) y "Liquidación" (después) existen', /setTab\('personal:alta'\)/.test(h) && /setTab\('personal:liquidacion'\)/.test(h) && /Altas y seguro/.test(h) && />Liquidación</.test(h));
setTab('personal:liquidacion');
ok('"Liquidación" abre la misma pantalla en su parte', DB.ui.tab === 'personal' && DB.ui.subPersonal === 'liquidacion');
setTab('personal:alta');
ok('la tabla muestra lo que falta', /falta DNI, CUIL, nacimiento/.test(h) && /sin ficha/.test(h));
ok('cada uno con su WhatsApp y el mensaje escrito', /wa\.me\/5491155552222\?text=/.test(h));
ok('botón para pedírselo a todos los que les falta', /Pedir datos por WhatsApp \(\d+\)/.test(h));
modal = null; pedirDatosTodos();
ok('el pedido masivo lista a los que les falta algo', /Pablo Ejemplo/.test(modal || '') && /Gustavo Sinficha/.test(modal || '') && !/Laura Prueba/.test(modal || ''));
ok('y avisa que el envío automático se conecta después', CANAL_WHATSAPP.modo === 'manual' && /conecte su número de WhatsApp/.test(modal || ''));
marcarPedido(de('Pablo Ejemplo').clave);
ok('queda anotado que se le pidió', altaDe(py)[de('Pablo Ejemplo').clave].pedidoEl === hoy());
crearFichaDe(de('Gustavo Sinficha').clave);
const gus = DB.catalogo.personas.find(p => p.nombre === 'Gustavo Sinficha');
ok('"crear ficha" la crea con su teléfono y enlaza la línea', gus && gus.tel === '11 5555-3333' && linea('Gaffer').refId === gus.id);
ok('a los puestos sin nadie no se les pide nada', !/Ayudante de Dirección/.test(modal || ''));
const adG = genteDelProyecto(py, v).find(g => g.funciones.includes('Ayudante de Dirección (1° AD)'));
const eva = nuevaPersona({nombre: 'Eva Asignada', funcion: 'Ayudante de Dirección (1° AD)', rubro: '02', tel: '11 5555-4444'});
DB.catalogo.personas.push(eva);
modal = null; asignarPuesto(adG.clave);
ok('"Asignar" abre el buscador del catálogo', /id="ppq"/.test(modal || '') && _pp && _pp.asignar === adG.clave);
ppAgregar(eva.id);
ok('y deja a la persona en las dos líneas del puesto', adG.lineas.every(({l}) => l.refId === eva.id));
ok('sin agregar líneas nuevas', v.rubros.find(r => r.codigo === '02').lineas.filter(l => /Ayudante de Dirección \(1/.test(l.concepto)).length === 2);
bajarAltaSeguro();
ok('planilla para el seguro', bajado && true);

console.log('\n--- 4. LIQUIDACIÓN ---');
const cfg = py.configRodaje;
const j1 = py.desglose.jornadas[0]; j1.parte ||= nuevoParte();
j1.parte.fichadas['l:' + linea('Jefe de Producción').id] = {entrada: '07:00', salida: '21:00'};   /* 14 h: 2 extra con 12 h */
const G2 = genteDelProyecto(py, v);
const laura = G2.find(g => g.nombre === 'Laura Prueba');
const L = liquidarPersona(py, v, laura);
const esperadoBase = totalLinea(linea('Jefe de Producción'), v) + totalLinea(linea('Jefe de Producción', 'prepro'), v);
ok('presupuesto: prepro + rodaje juntos', casi(L.base, esperadoBase), fmt(L.base));
ok('horas extra desde el parte', L.heHoras === 2 && L.he > 0, `${L.heHoras} h · ${fmt(L.he)}`);
ok('se paga con recibo de sueldo (va por convenio)', L.comprobante === 'Recibo de sueldo (SICA)');
upLiq(laura.clave, 'ajuste', '-100000'); upLiq(laura.clave, 'notaAjuste', 'adelanto');
const L2 = liquidarPersona(py, v, laura);
ok('un adelanto se descuenta del total', casi(L2.total, L.base + L.he - 100000));
const pab = G2.find(g => g.nombre === 'Pablo Ejemplo');
linea('Director de Fotografía').comprobante = 'facA';
ok('el DF responsable inscripto factura A', liquidarPersona(py, v, pab).comprobante === 'Factura A');

console.log('\n--- 5. EL CIRCUITO ---');
ok('arranca en borrador', L2.estado === 'borrador');
avanzarLiq(laura.clave);
ok('producción revisa', liqDe(py)[laura.clave].estado === 'revisado');
upLiq(laura.clave, 'ajuste', '-50000');
ok('si cambia el monto, vuelve a borrador', liqDe(py)[laura.clave].estado === 'borrador');
avanzarLiqTodos('borrador');
ok('"revisar todas" pasa todas', G2.every(g => (liqDe(py)[g.clave] || {}).estado === 'revisado'));
avanzarLiqTodos('revisado');
ok('"aprobar las revisadas"', G2.every(g => liqDe(py)[g.clave].estado === 'aprobado'));
avanzarLiq(laura.clave);
ok('administración marca pagado, con fecha', liqDe(py)[laura.clave].estado === 'pagado' && liqDe(py)[laura.clave].pagadoEl === hoy());
ok('cada paso queda firmado', liqDe(py)[laura.clave].historial.length >= 4);
DB.ui.subPersonal = 'liquidacion'; render(); h = app.innerHTML;
ok('pantalla: total, pagado y falta pagar', /A liquidar/.test(h) && /Pagado/.test(h) && /Falta pagar/.test(h));
ok('avisa quién no tiene alias ni CBU', /sin alias ni CBU/.test(h));
bajado = null; bajarLiquidacion();
ok('se baja para administración', !!bajado);

console.log('\n--- 6. PERMISOS ---');
const ue = pr.usuarios.find(u => u.rol === 'equipo');
DB.ui.usuarioId = ue && ue.id;
if(ue){ DB.ui.tab = 'personal'; DB.ui.subPersonal = 'liquidacion'; render(); ok('el equipo no ve la liquidación (va a su panel)', !/avanzarLiq/.test(app.innerHTML) && DB.ui.tab === 'resumen' && /Tus tareas/.test(app.innerHTML)); }
const up = pr.usuarios.find(u => u.rol === 'produccion');
if(up){ DB.ui.usuarioId = up.id;
  ok('producción puede revisar pero no pagar', puedeLiq('revisar') && !puedeLiq('pagar')); }

console.log('\n--- 7. CBU COMPARTIDO ---');
_catCbu = false;
ok('sin la columna, el CBU no se manda', !('cbu' in catHaciaServidor({...jp, cbu: '0000003100012345678901'}, 'org')));
_catCbu = true;
ok('con la columna, sí', catHaciaServidor({...jp, cbu: '0000003100012345678901'}, 'org').cbu === '0000003100012345678901');
ok('y se lee al bajar', catDesdeServidor({id: 'x', nombre: 'A', cbu: '123'}).cbu === '123');
modal = null; editPersona(jp.id);
ok('la ficha tiene alias y CBU por separado', /name="alias"/.test(modal || '') && /name="cbu"/.test(modal || ''));

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
