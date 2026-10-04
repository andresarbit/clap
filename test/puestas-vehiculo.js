/* Dos reglas de la cotización que dependen del criterio de quien cotiza:
   1. Las PUESTAS por jornada: en publicidad entran unas 6 a 8 (no 12), y las
      complicadas (exterior, vía pública, dron o car rig, cámara especial,
      efectos, menores, noche) pesan más que un interior simple. Con eso se
      sugieren las jornadas, con el porqué a la vista, y se corrige por
      proyecto (y por bloque).
   2. El VEHÍCULO DEL PRODUCTO: lo pone la marca (sin línea, dicho en las
      condiciones) o lo alquila la producción (alquiler, traslado, seguro y,
      con car rig, conductor). Sin decidir, queda marcado y no se aplica.
   Con el ejemplo de la app (Cumbre, en cotización) y textos inventados.
   Uso: node test/run.js test/puestas-vehiculo.js                             */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
global.confirm = () => true;

DB = dbVacia(); sembrar();
const pr = getPr(), py = pr.proyectos[1], brisa = pr.proyectos[0];
const U = r => pr.usuarios.find(u => u.rol === r);
const como = r => { DB.ui.usuarioId = U(r).id; modal = null; };
DB.ui.proyectoId = py.id; DB.ui.versionId = baseDe(py).id;
como('ejecutivo');

console.log('--- 1. LAS PUESTAS DE CUMBRE ---');
let A = analizarDesglose(py), E = A.est;
ok('por defecto 7 puestas por jornada (entre 6 y 8, no 12)', PUESTAS_JORNADA_DEF === 7 && E.ppj === 7);
ok('con el porqué: «6 puestas · 6 complejas (+2 en post) → 2 jornadas sugeridas»', E.txt === '6 puestas · 6 complejas (+2 en post) → 2 jornadas sugeridas', E.txt);
ok('dice cómo se cuenta', /a 7 puestas por jornada de 12 h/.test(E.porque) && /cuentan hasta el doble/.test(E.porque) && /packshot en 3D se hace en la post/.test(E.porque), E.porque);
const b1 = E.escenas[0];
ok('la ruta: exterior, vía pública y efectos; el aéreo suma el dron y el car rig, lo suyo', b1.puestas.every(p => p.peso === 2) && b1.puestas.some(p => p.factores.includes('dron')) && b1.puestas.some(p => p.factores.includes('car rig')) && b1.puestas[0].factores.includes('vía pública'),
  b1.puestas.map(p => p.tipo + ':' + p.factores.join('/')).join(' ; '));
ok('adentro del auto con el menor: pesa por el menor', E.escenas[1].puestas[0].factores.join() === 'menores' && E.escenas[1].puestas[0].peso === 1.5);
ok('de noche, con lluvia y Phantom: complejísima (el doble)', E.escenas[3].puestas[0].peso === 2 && ['noche', 'efectos', 'cámara especial'].every(f => E.escenas[3].puestas[0].factores.includes(f)));
ok('el packshot 3D no ocupa rodaje', E.escenas[4].enPost && E.escenas[4].peso === 0);
ok('equivale a 11 puestas simples → 2 jornadas', E.peso === 11 && E.jornadas === 2 && A.jornadasSug === 2);

console.log('\n--- 2. UN INTERIOR SIMPLE PESA MENOS ---');
const guardado = JSON.parse(JSON.stringify(py.desglose));
importarGuion('Una cocina de día. Una mujer prepara el desayuno y sonríe a cámara. Plano medio. Luego toma un café en el living.');
E = analizarDesglose(py).est;
ok('interiores sin complicaciones: tres cuartos cada una, una jornada', E.puestas >= 1 && E.complejas === 0 && E.simples === E.puestas && E.escenas.every(e => e.puestas.every(p => p.peso === 0.75)) && E.jornadas === 1, E.txt);
importarGuion('EXT. CALLE - NOCHE\n\nJuan corre bajo la lluvia por la avenida. Plano general desde un dron. Primer plano de Juan empapado.');
E = analizarDesglose(py).est;
ok('exterior de noche en la calle con lluvia: cada puesta cuenta doble', E.escenas[0].puestas.every(p => p.peso === 2), E.escenas[0].puestas.map(p => p.peso + ':' + p.factores.join('/')).join(' ; '));
py.desglose = guardado;

console.log('\n--- 3. SE CORRIGE POR PROYECTO Y POR BLOQUE ---');
setPuestasJornada('4');
E = analizarDesglose(py).est;
ok('a 4 puestas por jornada: 11 / 4 → 3 jornadas', E.ppj === 4 && E.jornadas === 3 && py.desglose.puestasPorJornada === 4, E.txt);
ok('viaja con el desglose (la parte «plan» que se sincroniza)', PARTES_PY.plan.lee(py).desglose.puestasPorJornada === 4);
setPuestasJornada('');
ok('vacío vuelve a 7', analizarDesglose(py).est.ppj === 7);
const e3 = py.desglose.escenas[2];
upPuestasBloque(e3.id, '4');
E = analizarDesglose(py).est;
ok('el mirador corregido a mano: 4 puestas (con su peso)', E.escenas[2].puestas.length === 4 && E.escenas[2].manual && E.escenas[2].peso === 6 && E.puestas === 9, E.txt);
upPuestasBloque(e3.id, String(puestasDeEscena(e3).length));
ok('volver al número detectado borra la corrección', !('puestasManual' in e3) && analizarDesglose(py).est.puestas === 6);

console.log('\n--- 4. DONDE SE SUGIEREN JORNADAS ---');
ok('«Aplicar al presupuesto» propone 2 jornadas (por puestas, no por páginas)', propuestaPresupuesto().jornadas === 2, propuestaPresupuesto().jornadas);
aPresupuesto();
ok('y en la ventana dice por qué', /Poner el proyecto en <b>2 jornadas<\/b>/.test(modal) && /6 puestas · 6 complejas/.test(modal));
modal = null;
DB.ui.tab = 'desglose'; DB.ui.subDesglose = 'cotizar'; render();
let h = app.innerHTML;
ok('«Para cotizar»: el resumen, el porqué y las puestas por jornada para editar', h.includes('6 puestas · 6 complejas (+2 en post) → 2 jornadas sugeridas') && /setPuestasJornada\(this.value\)/.test(h) && /upPuestasBloque\(/.test(h));
ok('cada puesta con lo que la complica', /class="pu-f">exterior, vía pública, efectos, dron</.test(h));
ok('arriba del desglose: puestas y jornadas estimadas', /Puestas est\. · 2 jornadas/.test(h));
DB.ui.tab = 'resumen'; render();
ok('en el resumen de la cotización', /6 puestas · 6 complejas \(\+2 en post\) → 2 jornadas sugeridas/.test(app.innerHTML));
const tipo = py.tipo; py.tipo = 'cine';
ok('en ficción se sigue contando por páginas', propuestaPresupuesto().jornadas === resumenDesglose(py.desglose).jornadasEstimadas);
py.tipo = tipo;

console.log('\n--- 5. EL VEHÍCULO DEL PRODUCTO: LO PONE LA MARCA (Cumbre) ---');
let P = propuestaPresupuesto();
ok('lo detecta: el producto es una SUV y sale en cámara', P.producto && P.producto.k === 'vehiculo' && P.producto.que === 'SUV Cumbre' && P.producto.conRig);
ok('en Cumbre lo pone la marca: ninguna línea de vehículo', P.producto.decision === 'marca' && !P.lineas.some(l => /veh[ií]culo|^Vehículos —/i.test(l.concepto)), P.lineas.filter(l => /veh/i.test(l.concepto)).map(l => l.concepto).join(' / '));
ok('y en las condiciones de la cotización', /El vehículo del producto \(SUV Cumbre\) lo provee el cliente\./.test(baseDe(py).condiciones.noIncluye));
DB.ui.tab = 'presu'; DB.ui.vista = 'cliente'; render();
ok('se ve en la cotización para el cliente', /lo provee el cliente/.test(app.innerHTML));
DB.ui.vista = 'interna';
ok('Brisa (agua mineral) no tiene vehículo del producto', !productoDelCliente(brisa));

console.log('\n--- 6. SIN DECIDIR: MARCADO, Y NO SE APLICA ---');
py.productoCliente = {};
P = propuestaPresupuesto();
ok('sin decidir: el producto queda aparte, sin líneas', P.producto && P.producto.decision === null && !P.lineas.some(l => l.dep === 'producto'));
aPresupuesto();
ok('la ventana lo pregunta arriba, con las dos opciones', /Falta decidir:/.test(modal) && /Lo pone la marca/.test(modal) && /Lo alquila la producción/.test(modal) && /prod-caja falta/.test(modal));
ok('y no deja aplicar hasta decidir', /onclick="confirmarAPresupuesto\(\)" disabled/.test(modal) && /Primero decidí quién pone el vehículo/.test(modal));
const tt = []; const toastOrig = toast; toast = (m, o) => tt.push({m, o});
const v = getV(), cuenta = () => v.rubros.reduce((s, r) => s + r.lineas.length, 0), n0 = cuenta();
ok('ni tocando el botón', confirmarAPresupuesto() === null && cuenta() === n0 && tt.some(t => /Primero decidí/.test(t.m)));
toast = toastOrig;
DB.ui.tab = 'desglose'; DB.ui.subDesglose = 'cotizar'; render();
h = app.innerHTML;
ok('«Para cotizar» lo marca', /det-falta/.test(h) && /falta decidir quién pone el vehículo del producto/.test(h) && /decidirProducto\('vehiculo','marca','desglose'\)/.test(h));

console.log('\n--- 7. LO ALQUILA LA PRODUCCIÓN ---');
aPresupuesto();
decidirProducto('vehiculo', 'produccion', 'aplicar');
ok('decidir en la ventana la rearma con las líneas', py.productoCliente.vehiculo === 'produccion' && /Alquiler del vehículo del producto — SUV Cumbre/.test(modal) && !/confirmarAPresupuesto\(\)" disabled/.test(modal));
P = propuestaPresupuesto();
const L = re => P.lineas.find(l => re.test(l.concepto));
ok('alquiler (12, por jornada), traslado en batea (12), seguro (15) y conductor de precisión por el car rig (12)',
  L(/^Alquiler del vehículo del producto/) && L(/^Alquiler del vehículo/).rubro === '12' && L(/^Alquiler del vehículo/).unidad === 'jornada'
  && L(/^Traslado del vehículo/).rubro === '12' && L(/^Seguro del vehículo/).rubro === '15' && L(/^Conductor de precisión/).rubro === '12',
  P.lineas.filter(l => l.dep === 'producto').map(l => l.rubro + ' ' + l.concepto).join(' / '));
const res = confirmarAPresupuesto(P.lineas.map((l, i) => ({i})).filter(m => P.lineas[m.i].dep === 'producto'));
ok('aplicadas: cuatro líneas nuevas', res.creadas === 4 && v.rubros.find(r => r.codigo === '15').lineas.some(l => l.concepto === 'Seguro del vehículo del producto'));
ok('y la aclaración de la marca sale de las condiciones', !/lo provee el cliente/.test(v.condiciones.noIncluye));
ok('aplicar de nuevo no las duplica', propuestaPresupuesto().lineas.filter(l => l.dep === 'producto').every(l => l.ya));
decidirProducto('vehiculo', 'marca');
const P2 = propuestaPresupuesto();
confirmarAPresupuesto(P2.lineas.map((l, i) => ({i})).filter(m => !P2.lineas[m.i].ya));
ok('si después lo pone la marca, vuelve a las condiciones (y las líneas quedan para que las saques vos)', /El vehículo del producto \(SUV Cumbre\) lo provee el cliente\./.test(v.condiciones.noIncluye));
ok('la decisión viaja con el presupuesto', PARTES_PY.presupuesto.lee(py).cotiz.productoCliente.vehiculo === 'marca' && (() => { const x = {versiones: []}; PARTES_PY.presupuesto.pone(x, PARTES_PY.presupuesto.lee(py)); return x.productoCliente.vehiculo === 'marca'; })());
como('asistprod');
decidirProducto('vehiculo', 'produccion');
ok('los asistentes no lo deciden', py.productoCliente.vehiculo === 'marca');

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
