/* Sub-proyectos: varios spots dentro de una campaña.
   ---------------------------------------------------------------------------
   El modelo NO es un presupuesto por spot. Es UNO donde cada línea dice de qué
   pieza es:  piezaId null = compartida por todo el proyecto; un id = propia.

   Lo que hay que probar y es todo el punto:
     - el general suma cada cosa UNA vez (el DF que hace los tres spots en una
       jornada se paga una jornada, no tres)
     - si un spot tiene algo que el otro no, queda sólo en ese y no se iguala
     - lo compartido se PRORRATEA para saber cuánto sale cada spot, pero eso
       es una imputación: la suma de los imputados da el total, no más
     - borrar un spot no borra su plata                                      */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const casi = (a, b, tol = 1) => Math.abs(a - b) < tol;

DB = dbVacia(); sembrar();
const pr = getPr(), py = getPy(), v = getV();
py.tipo = 'publicidad'; py.piezas = []; DB.ui.pieza = null;
/* presupuesto limpio, para contar sin ruido */
v.rubros.forEach(r => r.lineas = []);
const rubro = cod => v.rubros.find(r => r.codigo === cod);

console.log('--- 1. LOS TIPOS Y SU UNIDAD ---');
ok('publicidad se mide en Spots', unidadDe({tipo:'publicidad'}) === 'Spot');
ok('serie en Episodios', unidadDe({tipo:'serie'}) === 'Episodio');
ok('videoclip en Videos', unidadDe({tipo:'videoclip'}) === 'Video');
ok('redes en Piezas', unidadDe({tipo:'redes'}) === 'Pieza');
ok('en cine el desglose se mide en Escenas', unidadDesglose({tipo:'cine'}) === 'Escena');
ok('en publicidad el desglose se mide en Spots', unidadDesglose({tipo:'publicidad'}) === 'Spot');
ok('cine no propone varias piezas', TIPO('cine').varias === false);
ok('publicidad sí', TIPO('publicidad').varias === true);

console.log('\n--- 2. TRES SPOTS EN UNA CAMPAÑA ---');
DB.ui.proyectoId = py.id; DB.ui.versionId = v.id;
const s1 = addPieza('Spot Playa'), s2 = addPieza('Spot Ciudad'), s3 = addPieza();
ok('quedaron tres', piezasDe(py).length === 3);
ok('el que no tiene nombre se llama solo', nombrePieza(py, s3.id) === 'Spot 3',
  nombrePieza(py, s3.id));
ok('los numerados van 1,2,3', piezasDe(py).map(p => p.numero).join(',') === '1,2,3');

console.log('\n--- 3. LO COMPARTIDO SE CUENTA UNA SOLA VEZ ---');
/* el equipo hace los tres spots en la misma jornada: se paga una vez */
rubro('04').lineas.push(nuevaLinea({concepto:'Director de Fotografía', valorUnit:600000, dias:1}));
rubro('11').lineas.push(nuevaLinea({concepto:'Paquete cámara', valorUnit:900000, dias:1}));
/* y cada spot tiene lo suyo */
rubro('09').lineas.push(nuevaLinea({concepto:'Actriz — Playa', valorUnit:400000, piezaId:s1.id}));
rubro('06').lineas.push(nuevaLinea({concepto:'Perro amaestrado', valorUnit:250000, piezaId:s1.id}));
rubro('09').lineas.push(nuevaLinea({concepto:'Actor — Ciudad', valorUnit:300000, piezaId:s2.id}));
/* el spot 3 no tiene nada propio: es sólo el equipo compartido */

const G = calcular(v);
ok('el subtotal general es la suma de todo, una vez cada cosa',
  G.subtotal === 600000 + 900000 + 400000 + 250000 + 300000, fmt(G.subtotal));
ok('el DF NO se multiplicó por tres', G.subtotal < 600000 * 3 + 900000 * 3, fmt(G.subtotal));

const C = costoPorPieza(py, v);
console.log('    compartido ' + fmt(C.compartido) + ' · propio total ' + fmt(C.propioTotal));
C.filas.forEach(f => console.log('    ' + f.nombre.padEnd(14) +
  ' propio ' + String(Math.round(f.propio)).padStart(9) +
  ' + común ' + String(Math.round(f.compartido)).padStart(9) +
  ' = ' + String(Math.round(f.imputado)).padStart(10)));

ok('lo compartido es el equipo', C.compartido === 1500000, fmt(C.compartido));
ok('Spot Playa tiene lo suyo', casi(C.filas[0].propio, 650000), fmt(C.filas[0].propio));
ok('Spot Ciudad tiene lo suyo', casi(C.filas[1].propio, 300000), fmt(C.filas[1].propio));
ok('Spot 3 no tiene nada propio', C.filas[2].propio === 0);
ok('el perro está SOLO en Playa',
  C.filas[1].propio === 300000 && C.filas[2].propio === 0);
ok('cada uno recibe un tercio de lo común',
  C.filas.every(f => casi(f.compartido, 500000)),
  C.filas.map(f => Math.round(f.compartido)).join(' / '));

const suma = C.filas.reduce((s, f) => s + f.imputado, 0);
ok('LA SUMA DE LOS IMPUTADOS DA EL SUBTOTAL, NO MAS',
  casi(suma, G.subtotal), fmt(suma) + ' vs ' + fmt(G.subtotal));
ok('y no infla nada', suma <= G.subtotal + 1);

console.log('\n--- 4. LA SOLAPA DE UN SPOT MUESTRA LO SUYO + LO COMUN ---');
const vPlaya = calcular(v, filtroPieza(s1.id));
ok('Playa ve su actriz y su perro y el equipo',
  vPlaya.subtotal === 650000 + 1500000, fmt(vPlaya.subtotal));
ok('pero NO ve el actor de Ciudad',
  !v.rubros.some(r => r.lineas.filter(filtroPieza(s1.id)).some(l => /Ciudad/.test(l.concepto))));
const vCiudad = calcular(v, filtroPieza(s2.id));
ok('Ciudad ve lo suyo y el equipo', vCiudad.subtotal === 300000 + 1500000, fmt(vCiudad.subtotal));
ok('y NO ve el perro',
  !v.rubros.some(r => r.lineas.filter(filtroPieza(s2.id)).some(l => /Perro/.test(l.concepto))));
ok('Spot 3 ve sólo el equipo', calcular(v, filtroPieza(s3.id)).subtotal === 1500000);

console.log('\n--- 5. EL PESO REPARTE DISTINTO SI HACE FALTA ---');
piezaDe(py, s1.id).peso = 2;      /* el de playa se lleva el doble del común */
const C2 = costoPorPieza(py, v);
ok('Playa se lleva la mitad', casi(C2.filas[0].compartido, 750000),
  fmt(C2.filas[0].compartido));
ok('los otros un cuarto cada uno',
  casi(C2.filas[1].compartido, 375000) && casi(C2.filas[2].compartido, 375000));
ok('la suma sigue dando el subtotal',
  casi(C2.filas.reduce((s, f) => s + f.imputado, 0), G.subtotal));
piezaDe(py, s1.id).peso = 1;

console.log('\n--- 6. LAS SOLAPAS EN PANTALLA ---');
DB.ui.tab = 'presu'; DB.ui.vista = 'interna'; DB.ui.pieza = null; render();
let h = app.innerHTML;
ok('hay solapa General', /pztab[^>]*>\s*<span>General/.test(h));
ok('y una por spot', /Spot Playa/.test(h) && /Spot Ciudad/.test(h) && /Spot 3/.test(h));
ok('con el botón de agregar spot', /addPiezaPreguntando\(\)/.test(h));
ok('dice "\\+ Spot", no "\\+ Pieza"', /\+ Spot/.test(h));
ok('en General se ve la tabla de cuánto sale cada uno', /Cuánto sale cada spot/i.test(h));
ok('explica que no se gasta de nuevo', /una sola vez/.test(h));

setPieza(s1.id); render(); h = app.innerHTML;
ok('parado en Playa lo dice', /Spot Playa/.test(h));
ok('muestra propio y parte de lo compartido',
  /Propio de spot/i.test(h) && /Parte de lo compartido/.test(h));
ok('avisa que lo compartido no se gasta de nuevo', /no se gasta de nuevo/.test(h));
ok('el total dice de qué spot es', /Totales — Spot Playa/.test(h));
ok('no se ve el actor del otro spot', !/Actor — Ciudad/.test(h));
ok('sí se ve el equipo compartido', /Director de Fotografía/.test(h));

console.log('\n--- 7. AGREGAR UNA LINEA PARADO EN UN SPOT ES DE ESE SPOT ---');
const antes = rubro('06').lineas.length;
addLinea(rubro('06').id);
const nueva = rubro('06').lineas[rubro('06').lineas.length - 1];
ok('se agregó', rubro('06').lineas.length === antes + 1);
ok('Y QUEDO EN EL SPOT DONDE ESTABA', nueva.piezaId === s1.id, String(nueva.piezaId));
rubro('06').lineas.pop();

setPieza(null); render();
addLinea(rubro('06').id);
const nueva2 = rubro('06').lineas[rubro('06').lineas.length - 1];
ok('parado en General queda compartida', nueva2.piezaId === null);
rubro('06').lineas.pop();

console.log('\n--- 8. BORRAR UN SPOT NO BORRA SU PLATA ---');
const antesTotal = calcular(v).subtotal;
delPieza(s2.id);
ok('el spot ya no está', !piezaDe(py, s2.id));
ok('EL DINERO NO SE PERDIO', calcular(v).subtotal === antesTotal, fmt(calcular(v).subtotal));
const actor = v.rubros.flatMap(r => r.lineas).find(l => /Actor — Ciudad/.test(l.concepto));
ok('su línea quedó compartida', actor && actor.piezaId === null);
ok('quedan dos spots', piezasDe(py).length === 2);

console.log('\n--- 9. UN PROYECTO SIN PIEZAS SIGUE ANDANDO IGUAL ---');
const py2 = nuevoProyecto({nombre:'Corto simple', tipo:'cine'});
pr.proyectos.push(py2); DB.ui.proyectoId = py2.id;
DB.ui.versionId = py2.versiones[0].id; DB.ui.pieza = null;
const v2 = getV();
v2.rubros.find(r => r.codigo === '02').lineas.push(nuevaLinea({concepto:'Director', valorUnit:500000}));
ok('calcula igual que siempre', calcular(v2).subtotal === 500000);
ok('costoPorPieza no rompe sin piezas', costoPorPieza(py2, v2).filas.length === 0);
let rompio = null;
try{ DB.ui.tab='presu'; render(); }catch(e){ rompio = e.message; }
ok('la pantalla no rompe', rompio === null, rompio || '');
ok('en cine no ofrece agregar piezas', !/addPiezaPreguntando/.test(app.innerHTML));

console.log('\n--- 10. LA MIGRACION NO CAMBIA NINGUN TOTAL ---');
DB.ui.proyectoId = py.id; DB.ui.versionId = v.id;
const antesMigrar = calcular(getV()).total;
migrar();
ok('el total es el mismo después de migrar', calcular(getV()).total === antesMigrar,
  fmt(calcular(getV()).total));
ok('los proyectos viejos tienen array de piezas',
  pr.proyectos.every(p => Array.isArray(p.piezas)));

console.log('\n--- 11. EL DESGLOSE, POR SPOT ---');
const py3 = nuevoProyecto({nombre:'Campaña', tipo:'publicidad'});
pr.proyectos.push(py3);
DB.ui.proyectoId = py3.id; DB.ui.versionId = py3.versiones[0].id; DB.ui.pieza = null;
const a1 = addPieza('Spot A'), a2 = addPieza('Spot B');
const d3 = py3.desglose;
/* dos escenas del A, dos del B */
d3.escenas = [
  nuevaEscena({numero:'1', locacion:'Cocina', personajes:['MADRE'], piezaId:a1.id,
    elementos:{utileria:['torta'], vehiculos:['auto rojo']}}),
  nuevaEscena({numero:'2', locacion:'Cocina', personajes:['MADRE','NENE'], piezaId:a1.id,
    elementos:{utileria:['torta']}}),
  nuevaEscena({numero:'3', locacion:'Plaza', personajes:['NENE'], piezaId:a2.id,
    elementos:{utileria:['pelota'], animales:['perro']}}),
  nuevaEscena({numero:'4', locacion:'Plaza', personajes:['NENE'], piezaId:a2.id,
    elementos:{utileria:['pelota']}}),
];

DB.ui.tab = 'desglose'; DB.ui.subDesglose = 'escenas'; DB.ui.pieza = null; render();
h = app.innerHTML;
ok('BOTON "+ Spot" en el desglose', /addPiezaPreguntando/.test(h) && /\+ Spot/.test(h));
ok('y el de escena sigue estando', /addEscena\(\)/.test(h));
ok('barra con los dos spots', /Spot A/.test(h) && /Spot B/.test(h));
ok('dice cuántas escenas tiene cada uno', /2 escenas/.test(h));
ok('se ven las cuatro escenas', escenasVisibles(py3, d3).length === 4);

setPieza(a1.id);
ok('parado en Spot A se ven sólo sus dos', escenasVisibles(py3, d3).length === 2,
  escenasVisibles(py3, d3).map(e => e.numero).join(','));
render();
ok('la pantalla muestra Cocina y no Plaza',
  /Cocina/.test(app.innerHTML) && !/Plaza/.test(app.innerHTML));

console.log('\n--- 12. AGREGAR ESCENA PARADO EN UN SPOT ---');
const antesEsc = d3.escenas.length;
addEscena();
ok('se agregó', d3.escenas.length === antesEsc + 1);
ok('Y QUEDO EN EL SPOT DONDE ESTABA',
  d3.escenas[d3.escenas.length - 1].piezaId === a1.id);
d3.escenas.pop();
setPieza(null);

console.log('\n--- 13. LA REGLA: JUNTAR LO QUE SE REPITE, NO IGUALAR LO QUE NO ---');
const prop = propuestaPresupuesto();
const busca = re => prop.lineas.find(l => re.test(l.concepto) || re.test(l.nota||''));
const madre  = busca(/^MADRE$/);
const nene   = busca(/^NENE$/);
const torta  = busca(/torta/i);
const pelota = busca(/pelota/i);
const perro  = busca(/perro/i);
const cocina = busca(/Cocina/);
const plaza  = busca(/Plaza/);

ok('MADRE sale sólo en el Spot A -> es de A', madre && madre.piezaId === a1.id,
  madre && String(madre.piezaId));
ok('NENE sale en los DOS -> COMPARTIDO, una vez', nene && nene.piezaId === null);
ok('y NENE aparece una sola vez, no una por spot',
  prop.lineas.filter(l => l.concepto === 'NENE').length === 1);
ok('la torta es sólo de A', torta && torta.piezaId === a1.id);
ok('la pelota es sólo de B', pelota && pelota.piezaId === a2.id);
ok('el perro es sólo de B (A no lo tiene)', perro && perro.piezaId === a2.id);
ok('la locación Cocina es de A', cocina && cocina.piezaId === a1.id);
ok('la locación Plaza es de B', plaza && plaza.piezaId === a2.id);
ok('NO se igualó: A tiene torta y B no',
  !prop.lineas.some(l => /torta/i.test(l.concepto) && l.piezaId === a2.id));
ok('NO se igualó: B tiene perro y A no',
  !prop.lineas.some(l => /perro/i.test(l.concepto) && l.piezaId === a1.id));

console.log('\n--- 14. Y AL PASARLO AL PRESUPUESTO LLEGA ASI ---');
const v3 = getV();
v3.rubros.forEach(r => r.lineas = []);
prop.lineas.forEach(l => {
  const rb = v3.rubros.find(x => x.codigo === l.rubro); if(!rb) return;
  rb.lineas.push(nuevaLinea({concepto:l.concepto, cantidad:l.cantidad, dias:l.dias,
    unidad:l.unidad, valorUnit:100000, notas:l.nota, piezaId:l.piezaId || null}));
});
const lineasA = v3.rubros.flatMap(r => r.lineas).filter(l => l.piezaId === a1.id);
const lineasB = v3.rubros.flatMap(r => r.lineas).filter(l => l.piezaId === a2.id);
const comunes = v3.rubros.flatMap(r => r.lineas).filter(l => !l.piezaId);
console.log('    Spot A: ' + lineasA.map(l => l.concepto).join(' · '));
console.log('    Spot B: ' + lineasB.map(l => l.concepto).join(' · '));
console.log('    Común : ' + comunes.map(l => l.concepto).join(' · '));
ok('A y B tienen líneas propias distintas', lineasA.length > 0 && lineasB.length > 0);
ok('hay al menos una compartida (NENE)', comunes.some(l => l.concepto === 'NENE'));
const C3 = costoPorPieza(py3, v3);
ok('la suma de imputados da el subtotal, otra vez',
  casi(C3.filas.reduce((s, f) => s + f.imputado, 0), calcular(v3).subtotal),
  fmt(C3.filas.reduce((s, f) => s + f.imputado, 0)) + ' vs ' + fmt(calcular(v3).subtotal));
ok('A y B no dan lo mismo, porque no tienen lo mismo',
  C3.filas[0].propio !== C3.filas[1].propio,
  fmt(C3.filas[0].propio) + ' vs ' + fmt(C3.filas[1].propio));

console.log('\n--- 15. EL PRESUPUESTO GENERAL: TODO SUMADO, UNA VEZ ---');
DB.ui.proyectoId = py.id; DB.ui.versionId = v.id; DB.ui.pieza = null;
DB.ui.tab = 'presu'; DB.ui.vista = 'interna';
const vg = getV();
const todasLasLineas = vg.rubros.flatMap(r => r.lineas);
const sumaManual = todasLasLineas.reduce((s, l) => s + totalLinea(l, vg), 0);
ok('el general incluye TODAS las líneas', calcular(vg).subtotal === sumaManual,
  fmt(calcular(vg).subtotal) + ' = ' + todasLasLineas.length + ' líneas');
ok('las propias de cada spot están adentro',
  todasLasLineas.some(l => l.piezaId) && todasLasLineas.some(l => !l.piezaId));
vg.rubros.forEach(r => { if(r.lineas.length) r.abierto = true; });
render();
const hg = app.innerHTML;
ok('en pantalla se ven las de todos los spots',
  /Actriz — Playa/.test(hg) && /Actor — Ciudad/.test(hg) && /Director de Fotografía/.test(hg));
ok('cada línea dice de qué spot es', /Compartida/.test(hg) && /pz-si/.test(hg));

console.log('\n--- 16. LO QUE SE ENTREGA: CLIENTE, PDF Y CSV ---');
DB.ui.vista = 'cliente'; render();
const hc = app.innerHTML;
ok('vista cliente trae el desglose por spot', /Cuánto sale cada spot/i.test(hc));
ok('con propio, común e imputado',
  /Propio/.test(hc) && /Parte de lo común/.test(hc) && /Imputado/.test(hc));
ok('y aclara que lo común se factura una vez', /se facturan una sola vez/.test(hc));
ok('sigue estando el resumen por rubro', /resumen por rubro/i.test(hc));
DB.ui.vista = 'interna'; render();
ok('el panel por spot sale en el PDF (no es noprint)',
  !/card noprint"><h3>Cuánto sale/.test(app.innerHTML));

let csv = null; const _bajar = bajar; bajar = (nom, c) => csv = c; expCSV(); bajar = _bajar;
const cab = csv.split('\n')[0];
ok('el CSV tiene columna de Spot', /"Spot"/.test(cab), cab.slice(0, 95));
ok('y cada línea dice el suyo', /"Spot Playa"/.test(csv) && /"Compartida"/.test(csv));
ok('el CSV trae el cuadro por spot al pie', /CUÁNTO SALE CADA SPOT/.test(csv));
ok('con la aclaración de que lo común va una vez', /figura UNA vez/.test(csv));

/* --- 17. EL BOTON DE SPOT, ANTES DE TENER GUION -------------------------
   Acá estaba el bug que reportó: sin escenas, vistaDesglose devolvía SOLO el
   importador, así que el botón "+ Spot" no aparecía nunca — justo cuando más
   se necesita, que es al arrancar la campaña.                              */
console.log('\n--- 17. "+ SPOT" ANTES DE CARGAR NINGUN GUION ---');
const pyV = nuevoProyecto({nombre:'Campaña vacía', tipo:'publicidad'});
pr.proyectos.push(pyV);
DB.ui.proyectoId = pyV.id; DB.ui.versionId = pyV.versiones[0].id;
DB.ui.pieza = null; DB.ui.tab = 'desglose'; DB.ui.subDesglose = 'escenas';
ok('el proyecto arranca sin escenas', pyV.desglose.escenas.length === 0);
render();
let hv = app.innerHTML;
ok('BOTON "+ Spot" VISIBLE SIN GUION', /addPiezaPreguntando\(\)/.test(hv));
ok('dice "+ Spot"', /\+ Spot/.test(hv));
ok('y el importador sigue estando', /Desglosar/.test(hv) && /gtxt/.test(hv));
ok('explica para qué sirve', /cada uno lleva su presupuesto/i.test(hv));

/* al agregar uno, la barra pasa a mostrarlo */
const pv1 = addPieza('Spot Uno'); render(); hv = app.innerHTML;
ok('el spot aparece en la barra', /Spot Uno/.test(hv));
ok('y el botón sigue para agregar más', /addPiezaPreguntando\(\)/.test(hv));
ok('el importador no se fue', /gtxt/.test(hv));

/* en cine no se ofrece, porque no aplica */
pyV.tipo = 'cine'; render();
ok('en cine no ofrece agregar piezas', !/addPiezaPreguntando/.test(app.innerHTML));
pyV.tipo = 'publicidad';

console.log('\n--- 18. UN ARCHIVO CON VARIOS GUIONES ---');
const docTresSpots = [
  'SPOT 1', '',
  'INT. COCINA - DÍA', '', 'LUCÍA prepara un mate.', '',
  'EXT. JARDÍN - DÍA', '', 'El PERRO corre.', '',
  'SPOT 2', '',
  'INT. OFICINA - DÍA', '', 'MARTÍN mira la pantalla.', '',
  'SPOT 3', '',
  'EXT. PLAYA - ATARDECER', '', 'LUCÍA camina por la orilla.', ''
].join('\n');

const partes = partirGuiones(docTresSpots);
ok('RECONOCE QUE HAY TRES GUIONES', partes.length === 3, partes.length + ' encontrados');
ok('con sus títulos', partes.map(g => g.titulo).join(' · '), partes.map(g => g.titulo).join(' · '));
ok('el primero tiene dos escenas', desglosar(partes[0].texto).escenas.length === 2);
ok('el segundo una', desglosar(partes[1].texto).escenas.length === 1);
ok('el tercero una', desglosar(partes[2].texto).escenas.length === 1);
ok('no se pierde texto', partes.every(g => g.texto.trim().length > 20));

/* también corta por título con duración */
const porDuracion = partirGuiones([
  'VERANO 30"', '', 'INT. CASA - DÍA', '', 'Alguien entra.', '',
  'VERANO 15"', '', 'EXT. CALLE - DÍA', '', 'Alguien sale.', ''
].join('\n'));
ok('corta también por título con duración', porDuracion.length === 2,
  porDuracion.map(g => g.titulo).join(' · '));

/* un guion solo NO se parte: no inventa cortes */
const unoSolo = partirGuiones([
  'INT. COCINA - DÍA', '', 'LUCÍA prepara un mate.', '',
  'EXT. CALLE - NOCHE', '', 'Camina.', ''
].join('\n'));
ok('un guion solo queda entero', unoSolo.length === 1);
ok('un encabezado de escena NO se confunde con título de guion',
  partirGuiones('INT. COCINA - DÍA\n\nAlgo pasa.\n\nEXT. CALLE - DÍA\n\nOtra cosa.').length === 1);

console.log('\n--- 19. Y SE CONVIERTEN EN UN SPOT CADA UNO ---');
DB.ui.proyectoId = pyV.id; DB.ui.versionId = pyV.versiones[0].id;
pyV.piezas = []; pyV.desglose.escenas = []; DB.ui.pieza = null;
const guiones = partes.map((g, i) => ({titulo: g.titulo, texto: g.texto,
  archivo: 'campaña.pdf', escenas: desglosar(g.texto).escenas.length, i}));
_guionesPendientes = guiones;
global.document.querySelectorAll = sel => /data-g/.test(sel)
  ? guiones.map(g => ({checked:true, dataset:{g:String(g.i)}})) : [];
crearPiezasDeGuiones();

ok('SE CREARON TRES SPOTS', piezasDe(pyV).length === 3,
  piezasDe(pyV).map(p => nombrePieza(pyV, p.id)).join(' · '));
ok('con el título del guion', /SPOT 1/i.test(nombrePieza(pyV, piezasDe(pyV)[0].id)));
ok('entraron las cuatro escenas', pyV.desglose.escenas.length === 4,
  pyV.desglose.escenas.length + '');
const porPieza = piezasDe(pyV).map(p => pyV.desglose.escenas.filter(e => e.piezaId === p.id).length);
ok('repartidas 2 / 1 / 1', porPieza.join(',') === '2,1,1', porPieza.join(','));
ok('ninguna quedó sin spot', pyV.desglose.escenas.every(e => e.piezaId));
ok('ninguna escena quedó sin número', pyV.desglose.escenas.every(e => e.numero));
ok('el guion quedó guardado', /SPOT 1/.test(pyV.desglose.guion));

DB.ui.tab = 'desglose'; DB.ui.pieza = null; render();
ok('la barra muestra los tres', piezasDe(pyV).every(p =>
  app.innerHTML.includes(esc(nombrePieza(pyV, p.id)))));
setPieza(piezasDe(pyV)[0].id);
ok('parado en el primero se ven sus dos escenas',
  escenasVisibles(pyV, pyV.desglose).length === 2);
setPieza(null);

console.log('\n--- 20. LOS SPOTS SE VEN EN EL RESUMEN ---');
DB.ui.tab = 'resumen'; render();
const hr = app.innerHTML;
ok('la lista de proyectos muestra los spots de cada uno', /pypzchip/.test(hr));
ok('con sus nombres', piezasDe(pyV).some(p => hr.includes(esc(nombrePieza(pyV, p.id)))));

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
