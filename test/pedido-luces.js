/* Pedido de luces.
   ---------------------------------------------------------------------------
   Pedido: una solapa donde el segundo del director de fotografía arma el
   pedido de luces, con un catálogo de equipos y de rentals.               */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
let bajado = null;
global.URL.createObjectURL = b => { bajado = b; return 'blob:x'; };

DB = dbVacia(); sembrar();
const pr = getPr();
const py = nuevoProyecto({nombre: 'Spot Luces', tipo: 'publicidad'});
pr.proyectos.push(py);
DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;
const v = getV();
aplicarPlantilla(py, v, 'pub-chica', {jornadas: 2});
const d = getD();
d.jornadas = [nuevaJornada({numero: 1, fecha: '2026-10-14'}), nuevaJornada({numero: 2, fecha: '2026-10-15'})];

console.log('--- 1. EL CATÁLOGO DE EQUIPOS ---');
ok('más de 90 equipos', EQUIPOS_LUZ.length > 90, EQUIPOS_LUZ.length);
ok('claves únicas', new Set(EQUIPOS_LUZ.map(e => e.k)).size === EQUIPOS_LUZ.length);
ok('todas las categorías existen', EQUIPOS_LUZ.every(e => CATEGORIAS_LUZ.some(c => c.k === e.c)));
ok('las luces tienen consumo; el grip no', EQUIPOS_LUZ.filter(e => ['hmi','led','tung','fluo'].includes(e.c)).every(e => e.w > 0) && EQUIPOS_LUZ.filter(e => e.c === 'ctrl').every(e => e.w === 0));
ok('un 18K consume 18 kW y un SkyPanel S60 450 W', EQUIPO_LUZ('hmi-18k-fresnel').w === 18000 && EQUIPO_LUZ('arri-skypanel-s60-c').w === 450);
ok('los consumibles se compran, no se alquilan', EQUIPOS_LUZ.filter(e => e.c === 'cons').every(e => e.u === 'unidad'));
ok('todos los equipos de los pedidos base existen', Object.values(KITS_LUCES).every(k => k.items.every(([nom]) => EQUIPOS_LUZ.some(e => e.nombre === nom))),
  Object.values(KITS_LUCES).flatMap(k => k.items.filter(([nom]) => !EQUIPOS_LUZ.some(e => e.nombre === nom)).map(x => x[0])).join(','));

console.log('\n--- 2. ARMAR EL PEDIDO ---');
DB.ui.tab = 'luces'; render();
let h = app.innerHTML;
ok('la solapa "Pedido de luces" está en el menú', /setTab\('luces'\)/.test(h) && /Pedido de luces/.test(h));
ok('vacío, ofrece los pedidos base', /lzKit\('chico'\)/.test(h) && /lzKit\('grande'\)/.test(h));
lzKit('chico');
const P = pedidoDe(py);
ok('el pedido chico suma sus renglones', P.items.length === KITS_LUCES.chico.items.length, P.items.length);
const s60 = P.items.find(x => x.k === 'arri-skypanel-s60-c');
ok('con cantidad, categoría y consumo', s60.cant === 2 && s60.c === 'led' && s60.w === 450);
lzSumar(py, 'arri-skypanel-s60-c', 1);
ok('sumar lo que ya está suma cantidad, no duplica', s60.cant === 3 && P.items.filter(x => x.k === s60.k).length === 1);
const hmi = lzSumar(py, 'hmi-18k-fresnel', 1);
lzJornada(hmi.id, 1);
ok('el 18K sólo la jornada 2', JSON.stringify(jornadasDeItem(py, hmi)) === '[2]');
lzJornada(hmi.id, 1);
ok('volver a tildar todas deja "todas"', hmi.jornadas === null);
lzJornada(hmi.id, 1);

console.log('\n--- 3. POTENCIA ---');
let C = calcularPedido(py);
const j1 = C.porJornada.find(x => x.num === 1), j2 = C.porJornada.find(x => x.num === 2);
ok('la jornada 2 lleva 18 kW más que la 1', j2.w - j1.w === 18000, (j2.w - j1.w));
ok('generador sugerido para la 2 (>= carga/0,8×1,25)', j2.kva >= j2.w / 0.8 / 1000 * 1.25 && KVA_GENERADORES.includes(j2.kva), j2.kva + ' kVA para ' + j2.w + ' W');
ok('los amperes a 220', Math.round(j1.amp220) === Math.round(j1.w / 220));
ok('sin generador pedido, se marca', j2.kvaPedido === 0);
lzSumar(py, 'generador-66-kva', 1);
C = calcularPedido(py);
ok('con el generador pedido, se cuenta', C.porJornada[1].kvaPedido === 66);

console.log('\n--- 4. PRECIOS Y TOTALES ---');
P.items.forEach(it => { it.precio = 0; });
ok('sin precios, avisa cuántos faltan', calcularPedido(py).sinPrecio === P.items.length);
lzUp(s60.id, 'precio', '100000');
ok('precio por jornada × cantidad × jornadas', costoItemLuz(py, s60) === 100000 * 3 * 2);
lzUp(hmi.id, 'precio', '400000');
ok('el 18K de una sola jornada se cobra una', costoItemLuz(py, hmi) === 400000);
const cto = P.items.find(x => x.k === 'gelatina-cto-pliego');
lzUp(cto.id, 'precio', '15000');
ok('un consumible es cantidad × precio, sin jornadas', costoItemLuz(py, cto) === 15000 * cto.cant);
lzCampo('descuento', '30');
C = calcularPedido(py);
const sub = 600000 + 400000 + 15000 * cto.cant;
ok('subtotal', C.subtotal === sub, C.subtotal);
ok('30% de descuento y 21% de IVA', Math.round(C.descuento) === Math.round(sub * 0.3) && Math.round(C.iva) === Math.round(sub * 0.7 * 0.21));
ok('total', Math.round(C.total) === Math.round(sub * 0.7 * 1.21));
ok('el presupuesto de luces se compara (la plantilla tiene Paquete de luces)', C.presu >= 0);

console.log('\n--- 5. EL RENTAL Y SUS PRECIOS RECORDADOS ---');
lzSumarRental('Camauer');
const cam = DB.catalogo.personas.find(x => x.nombre === 'Camauer');
ok('sumar un rental lo crea como proveedor del rubro 11', cam && cam.tipo === 'proveedor' && cam.rubro === '11' && /camauer/.test(cam.notas));
ok('y queda elegido en el pedido', P.rentalId === cam.id);
lzSumarRental('Camauer');
ok('sumarlo otra vez no lo duplica', DB.catalogo.personas.filter(x => x.nombre === 'Camauer').length === 1);
lzUp(s60.id, 'precio', '95000');
ok('el precio queda recordado para ese rental', DB.tarifaLuces[cam.id]['arri-skypanel-s60-c'] === 95000);
/* otro proyecto, mismo rental: el precio viene solo */
const py2 = nuevoProyecto({nombre: 'Otro spot', tipo: 'publicidad'}); pr.proyectos.push(py2);
DB.ui.proyectoId = py2.id; DB.ui.versionId = py2.versiones[0].id;
lzRental(cam.id);
const s60b = lzSumar(py2, 'arri-skypanel-s60-c', 2);
ok('en otro pedido al mismo rental, el SkyPanel ya viene con precio', s60b.precio === 95000);
DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;

console.log('\n--- 6. MANDARLO, PASARLO AL PRESUPUESTO, BAJARLO ---');
lzCampo('armadoPor', 'Segundo de foto');
const txt = textoPedidoLuces(pr, py);
ok('el texto saluda y dice el proyecto', /pedido de luces de \*Spot Luces\*/.test(txt));
ok('trae las fechas', /mié 14\/10/.test(txt) && /jue 15\/10/.test(txt));
ok('agrupa por categoría', /\*LED\*/.test(txt) && /\*HMI\*/.test(txt));
ok('el 18K dice "sólo" su jornada', /1 × HMI 18K Fresnel \(sólo jue 15\/10\)/.test(txt), txt.split('\n').find(l => /18K/.test(l)));
ok('pide cotización y firma quien lo armó', /cotización/.test(txt) && /Segundo de foto$/.test(txt));
lzUp(P.items.find(x => x.k === 'generador-66-kva').id, 'precio', '250000');
const {lineas} = repartoPresupuesto(py);
ok('el reparto: luces, grip y generador por separado', lineas['Paquete de luces'] > 0 && 'Paquete de grip' in lineas && lineas['Grupo electrógeno'] === 250000 * 2 * 0.7);
ok('lo que no tiene precio no se pasa', !(lineas['Paquete de grip'] > 0));
lzAlPresupuesto();
const r11 = v.rubros.find(r => r.codigo === '11');
const lLuces = r11.lineas.find(l => l.concepto === 'Paquete de luces' && !l.piezaId);
ok('pasa al presupuesto: Paquete de luces por jornada × 2', lLuces && lLuces.dias === 2 && lLuces.valorUnit === Math.round(lineas['Paquete de luces'] / 2), lLuces && lLuces.valorUnit);
ok('y crea Grupo electrógeno si no estaba', r11.lineas.some(l => l.concepto === 'Grupo electrógeno'));
ok('después del pase, presupuestado = neto del pedido', Math.abs(calcularPedido(py).presu - calcularPedido(py).neto) < 5, calcularPedido(py).presu + ' vs ' + calcularPedido(py).neto);
lzCSV();
ok('baja la planilla', bajado && bajado.size > 200);

console.log('\n--- 7. LA PANTALLA ---');
DB.ui.tab = 'luces'; render(); h = app.innerHTML;
ok('tabla por categoría', /Grip · banderas, marcos y telas/.test(h) && /lz-tab/.test(h));
ok('jornadas como botones', /lzJornada\(/.test(h) && /J2/.test(h));
ok('potencia y generador sugerido', /Generador sugerido/.test(h) && /kVA/.test(h));
ok('totales con el presupuestado', /Presupuestado/.test(h) && /Diferencia/.test(h));
ok('rentals para sumar (los que faltan)', /Rentals de luces y grip/.test(h) && !/lzSumarRental\('Camauer'\)/.test(h));
const errs = [];
['lzAgregar', 'lzEnviar'].forEach(f => { try { eval(f + '()'); cerrar(); } catch (e) { errs.push(f + ': ' + e.message); } });
try { lzEditar(s60.id); cerrar(); } catch (e) { errs.push('editar: ' + e.message); }
_lz = {q: 'skypanel', c: ''};
ok('el buscador encuentra los SkyPanel', lzResultados().length === 4, lzResultados().map(e => e.nombre).join(','));
_lz = {q: '18k', c: ''};
ok('y "18k"', lzResultados().some(e => e.nombre === 'HMI 18K Fresnel'));
_lz = {q: '', c: 'elec'};
ok('filtra por categoría', lzResultados().every(e => e.c === 'elec'));
ok('los modales abren', !errs.length, errs.join(' | '));
DB.catalogo.personas.push(nuevaPersona({nombre: 'Cámaras & Luces', tipo: 'proveedor', rubro: '11', funcion: 'Equipos de cámara'}));
render();
ok('"Cámaras & Luces" del catálogo es el mismo "Cámaras y Luces" (no lo vuelve a ofrecer)', !/lzSumarRental\('Cámaras y Luces'\)/.test(app.innerHTML) && /lzSumarRental\('Alfavision'\)/.test(app.innerHTML));
console.log('\n--- 8. PRECIOS PUBLICADOS (BABYLON Y CAMAUER) ---');
const faltanRef = Object.keys(PRECIOS_REF_LUZ).filter(nom => !EQUIPOS_LUZ.some(e => e.nombre === nom));
ok('cada precio publicado corresponde a un equipo del catálogo', !faltanRef.length, faltanRef.join(','));
ok('valores de la lista de Babylon (oct. 2026)', PRECIOS_REF_LUZ['Arri SkyPanel S60-C'].bab === 128000 && PRECIOS_REF_LUZ['Arri M40'].bab === 240000 && PRECIOS_REF_LUZ['Generador 110 kVA'].bab === 400000);
ok('valores de Camauer', PRECIOS_REF_LUZ['HMI 12K Par'].cam === 450000 && PRECIOS_REF_LUZ['Arri SkyPanel S60-C'].cam === 160000);
ok('Babylon y Camauer figuran como rentals que publican precios', RENTALS_LUCES.find(r => r.nombre === 'Estudios Babylon').precios === 'bab' && RENTALS_LUCES.find(r => r.nombre === 'Camauer').precios === 'cam');
const py4 = nuevoProyecto({nombre: 'Spot Babylon', tipo: 'publicidad'}); pr.proyectos.push(py4);
DB.ui.proyectoId = py4.id; DB.ui.versionId = py4.versiones[0].id;
lzSumarRental('Estudios Babylon');
const bab = DB.catalogo.personas.find(x => x.nombre === 'Estudios Babylon');
ok('sumado al catálogo con su contacto publicado', bab && bab.tel === '11 5150-0024' && bab.email === 'info@estudiosbabylon.com.ar');
const P4 = pedidoDe(py4);
ok('y elegido en el pedido', P4.rentalId === bab.id);
const m40 = lzSumar(py4, 'arri-m40', 1);
ok('con Babylon elegido, el M40 entra a su precio de lista', m40.precio === 240000);
const s12 = lzSumar(py4, 'hmi-12k-par', 1);
ok('lo que Babylon no publica queda sin precio (no se inventa)', s12.precio === 0);
lzCompletarPrecios('min');
ok('"el más barato publicado" completa el 12K con el de Camauer', s12.precio === 450000);
ok('y no pisa los que ya tenían precio', m40.precio === 240000);
ok('la referencia se ve en el renglón', /Babylon \$ 240\.000 · Camauer \$ 210\.000/.test(textoRef(EQUIPO_LUZ('arri-m40'))), textoRef(EQUIPO_LUZ('arri-m40')));
DB.ui.tab = 'luces'; render();
ok('la pantalla cita las fuentes', /babylon-rental-lista-precios\.pdf/.test(app.innerHTML) && /alquilerdecamaras/.test(app.innerHTML));
ok('generador sugerido usa los tamaños que se alquilan', generadorPara(4000) === 6.5 && generadorPara(30000) === 66 && generadorPara(60000) === 110, [generadorPara(4000), generadorPara(30000), generadorPara(60000)].join(','));
DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;

/* sin jornadas cargadas se cuenta una */
const py3 = nuevoProyecto({nombre: 'Sin jornadas'});
ok('sin jornadas, el pedido cuenta una', jornadasDeLuces(py3).length === 1);

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
