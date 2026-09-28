/* Cambiar la plantilla de un proyecto ya armado, desde "Proyecto".
   ---------------------------------------------------------------------------
   Pedido: si después se dan cuenta de que era otra escala u otro tipo, que
   no tengan que rehacer el proyecto, y que lo que se sostiene entre las dos
   plantillas quede cargado.                                                 */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const form = campos => { global.document.querySelectorAll = s =>
  /\[name\]/.test(s) ? Object.entries(campos).map(([name, value]) => ({name, value})) : []; };
const buscar = (v, c, etapa = null) => v.rubros.flatMap(r => r.lineas).find(l => l.concepto === c && (l.etapa || null) === etapa);
const todas = v => v.rubros.flatMap(r => r.lineas);

DB = dbVacia(); sembrar();
const pr = getPr();
const py = nuevoProyecto({nombre: 'Cambio de escala', tipo: 'publicidad'});
pr.proyectos.push(py);
DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;
const v = getV();
aplicarPlantilla(py, v, 'pub-mediana', {jornadas: 2});
const nMediana = todas(v).length;

console.log('--- 1. LO QUE CARGÓ LA GENTE ---');
const df = buscar(v, 'Director de Fotografía');
df.valorUnit = 1500000; df.valorOrigen = 'manual';                     /* valor escrito */
const cam = buscar(v, 'Paquete cámara + ópticas'); cam.valorUnit = 900000; cam.valorOrigen = 'manual';
const scr = buscar(v, 'Script / Continuista'); scr.cantidad = 1; scr.dias = 1;   /* le cambiaron los días */
const shoot = buscar(v, 'Shootingboard');                              /* intacta, no está en videoclip */
const muebles = buscar(v, 'Alquiler de muebles'); muebles.valorUnit = 50000; muebles.valorOrigen = 'manual';
const aMano = nuevaLinea({concepto: 'Grúa con cabeza caliente', unidad: 'jornada', valorUnit: 700000, valorOrigen: 'manual'});
v.rubros.find(r => r.codigo === '11').lineas.push(aMano);

console.log('\n--- 2. MEDIANA -> GRANDE ---');
const plan = planCambioPlantilla(py, v, 'pub-grande', 2);
ok('el plan: todo lo de la mediana está en la grande, nada se saca', plan.quitar.length === 0 && plan.mantener.length === nMediana, plan.mantener.length + ' se quedan');
ok('y agrega lo que tiene la grande de más', plan.agregar.length > 15, plan.agregar.length + ' nuevas');
const ele = buscar(v, 'Eléctrico');
ok('el eléctrico intacto va a tomar la cantidad de la grande', plan.ajustar.some(a => a.l === ele && a.q === 4));
modal = null; editProyecto(py.id);
ok('la ventana Proyecto ofrece cambiar la plantilla', /Plantilla del presupuesto/.test(modal || '') && /Hoy: <b>Publicidad · mediana/.test(modal || ''));
ok('con las del tipo del proyecto', /Publicidad · grande/.test(modal) && /Sin plantilla/.test(modal));
form({nombre: py.nombre, tipo: 'publicidad', cliente: '', agencia: '', producto: '', jornadas: '2',
  medios: 'Digital', territorio: 'Argentina', plazo: '12 meses', plantilla: 'pub-grande', plpy: py.id});
saveProyecto(py.id);
ok('queda como grande', py.plantilla === 'pub-grande');
ok('el DF sigue con su valor escrito', buscar(v, 'Director de Fotografía').valorUnit === 1500000);
ok('la cámara también', buscar(v, 'Paquete cámara + ópticas').valorUnit === 900000);
ok('el eléctrico pasó a 4', buscar(v, 'Eléctrico').cantidad === 4);
ok('el script con días cambiados a mano, igual', buscar(v, 'Script / Continuista').dias === 1);
ok('llegaron sonidista y microfonista', !!buscar(v, 'Sonidista Directo') && !!buscar(v, 'Microfonista'));
ok('lo agregado a mano sigue', todas(v).includes(aMano));
ok('nada duplicado', new Set(todas(v).map(l => l.concepto + '|' + (l.etapa || ''))).size === todas(v).length);

console.log('\n--- 3. PUBLICIDAD -> VIDEOCLIP (otro tipo) ---');
py.tipo = 'videoclip';
const antes = todas(v).length;
const plan2 = planCambioPlantilla(py, v, 'clip-mediano', 2);
ok('se sacarían sólo las intactas que el videoclip no tiene', plan2.quitar.every(q => lineaIntacta(q.l, q.l.dePlantilla)) && plan2.quitar.length > 0);
ok('las que tienen datos no', plan2.quedanConDatos.some(x => x.l === muebles));
const r = cambiarPlantilla(py, v, 'clip-mediano', {jornadas: 2});
ok('shootingboard (intacto, y el videoclip lo tiene) se queda', todas(v).includes(shoot));
ok('alquiler de muebles (con valor) se queda aunque el videoclip no lo tenga', todas(v).includes(muebles));
ok('el sonido directo intacto se fue', !buscar(v, 'Sonidista Directo'));
ok('el DF con su valor, igual', buscar(v, 'Director de Fotografía').valorUnit === 1500000);
ok('llegó lo del videoclip (playback)', !!buscar(v, 'Playback'));
ok('el equipo que queda pasa a ir por fuera, como en el videoclip', buscar(v, 'Gaffer').contrato === 'factura' && contratoDe(buscar(v, 'Gaffer'), v.rubros.find(r => r.codigo === '05')) === 'factura');
ok('lo agregado a mano, igual', todas(v).includes(aMano));
ok('cuenta lo que hizo', r.quitadas > 0 && r.agregadas > 0 && r.conDatos > 0 && r.mantenidas > 0,
  `${r.mantenidas} se quedan · ${r.agregadas} nuevas · ${r.quitadas} sacadas · ${r.conDatos} con datos`);

console.log('\n--- 4. SIN PLANTILLA ---');
const r3 = cambiarPlantilla(py, v, '', {jornadas: 2});
ok('saca lo intacto de la plantilla', r3.quitadas > 0 && py.plantilla === null);
ok('y deja todo lo que tiene datos', todas(v).includes(muebles) && buscar(v, 'Director de Fotografía').valorUnit === 1500000 && todas(v).includes(aMano));

console.log('\n--- 5. VISTA PREVIA EN LA VENTANA ---');
py.tipo = 'publicidad';
const txt = textoPlanPlantilla(py, v, 'pub-chica', 1);
ok('antes de guardar dice qué va a pasar', /Al guardar pasa a Publicidad · chica/.test(txt) && /Se quedan/.test(txt) && /Se agregan/.test(txt));
ok('sin cambio, no dice nada', textoPlanPlantilla(py, v, '', 1) === '');

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
