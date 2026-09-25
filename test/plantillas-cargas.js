/* Plantillas, cargas sociales, preproducción a 8 h, condiciones y catálogo.
   ---------------------------------------------------------------------------
   Lo que salió de revisar los presupuestos y callsheets reales de la casa:
     - arrancar desde una plantilla por tipo y escala, con la estructura real
     - el sueldo del convenio es BRUTO: faltaban las cargas sociales
     - la preproducción se paga por jornada de 8 h aunque el rodaje sea de 12
     - el pie del presupuesto (incluye / no incluye / pago / validez)
     - el catálogo se arma también desde planillas Excel y desde un catálogo
       ya preparado, con notas de con quién trabajó cada uno              */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const casi = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const form = campos => { global.document.querySelectorAll = s =>
  /\[name\]/.test(s) ? Object.entries(campos).map(([name, value]) => ({name, value})) : []; };
const lineas = v => v.rubros.flatMap(r => r.lineas.map(l => ({...l, r: r.codigo})));
const buscar = (v, concepto, etapa = null) => v.rubros.flatMap(r => r.lineas)
  .find(l => l.concepto === concepto && (l.etapa || null) === etapa);

console.log('--- 1. LAS PLANTILLAS ESTÁN BIEN ARMADAS ---');
ok('hay plantillas de publicidad en las cuatro escalas',
  ['pub-chica','pub-mediana','pub-grande','pub-super'].every(k => PLANTILLA(k)));
ok('y de videoclip, contenido, serie e institucional',
  ['videoclip','contenido','serie','institucional'].every(t => plantillasDe(t).length));
ok('de cine no hay (no había presupuestos de cine en la carpeta)', plantillasDe('cine').length === 0);
const fuera = [];
PLANTILLAS.forEach(pl => resolverPlantilla(pl, pl.jornadas).lineas.forEach(x => {
  if(!(FUNCIONES[x.r] || []).includes(x.c)) fuera.push(pl.k + ' ' + x.r + ':' + x.c); }));
ok('todas las líneas usan conceptos de la lista de funciones', !fuera.length, fuera.slice(0, 3).join(' | '));
ok('las funciones nuevas están (estudio por días, menores, camiones)',
  FUNCIONES['10'].includes('Estudio — pre-light') && FUNCIONES['09'].includes('Chaperona')
  && FUNCIONES['12'].includes('Horas extra de camiones'));

const tam = k => resolverPlantilla(PLANTILLA(k), PLANTILLA(k).jornadas);
ok('cada escala trae más que la anterior',
  tam('pub-chica').lineas.length < tam('pub-mediana').lineas.length
  && tam('pub-mediana').lineas.length < tam('pub-grande').lineas.length
  && tam('pub-grande').lineas.length < tam('pub-super').lineas.length,
  ['pub-chica','pub-mediana','pub-grande','pub-super'].map(k => tam(k).lineas.length).join(' < '));
const med = tam('pub-mediana').lineas;
const jpR = med.filter(x => x.c === 'Jefe de Producción' && x.etapa === 'rodaje');
const jpP = med.filter(x => x.c === 'Jefe de Producción' && x.etapa === 'prepro');
ok('la escala mayor REEMPLAZA la función, no la duplica', jpR.length === 1 && jpR[0].q === 1, 'q=' + (jpR[0] || {}).q);
ok('con los días de prepro de la mediana (5)', jpP.length === 1 && jpP[0].d === 5);
const eleG = tam('pub-grande').lineas.find(x => x.c === 'Eléctrico' && x.etapa === 'rodaje');
ok('pero "dos eléctricos más" SÍ suma: la grande tiene 4', eleG && eleG.q === 4, 'q=' + (eleG || {}).q);
const almM = med.find(x => x.c === 'Almuerzo');
ok('el catering va por cabeza del rodaje + agencia y cliente', almM && almM.q === tam('pub-mediana').cabezas && almM.q > 20,
  almM && almM.q + ' personas');
ok('los alquileres traen la referencia de precio en la nota',
  /USD/.test((med.find(x => x.c === 'Paquete cámara + ópticas') || {}).nota || ''));

console.log('\n--- 2. APLICAR UNA PLANTILLA A UN PROYECTO NUEVO ---');
DB = dbVacia(); sembrar();
const pr = getPr();
const py = nuevoProyecto({nombre: 'Prueba plantilla', tipo: 'publicidad'});
py.desglose.jornadas = [nuevaJornada({numero: 1, fecha: '2026-10-08'})];
pr.proyectos.push(py);
const v = py.versiones[0];
let res = aplicarPlantilla(py, v, 'pub-mediana', {jornadas: 2});
ok('agrega las líneas', res.agregadas === lineas(v).length && res.agregadas > 60, res.agregadas + ' líneas');
ok('pone las jornadas del proyecto', py.jornadas === 2);
ok('y la jornada de 12 h, como en todas las planillas AICP', py.configRodaje.horasJornada === 12);
const E = escalaDelProyecto(py);
const cJP = cargoSICA('Jefe de Producción', E);
const jpRod = buscar(v, 'Jefe de Producción'), jpPre = buscar(v, 'Jefe de Producción', 'prepro');
ok('el jefe de producción de rodaje, a 12 h de convenio', jpRod && jpRod.valorUnit === cJP.j12, fmt(jpRod && jpRod.valorUnit));
ok('el de preproducción, a 8 h', jpPre && jpPre.valorUnit === cJP.j8 && jpPre.dias === 5, fmt(jpPre && jpPre.valorUnit));
ok('de la escala del rodaje (Octubre)', jpRod.sica && jpRod.sica.escala === 'Octubre 2026');
const cam = buscar(v, 'Paquete cámara + ópticas');
ok('lo que no es convenio queda en cero, con la nota', cam && cam.valorUnit === 0 && /USD/.test(cam.notas));
ok('el director va como honorario, sin convenio', contratoDe(buscar(v, 'Director'), v.rubros.find(r => r.codigo === '02')) === 'factura');
res = aplicarPlantilla(py, v, 'pub-mediana');
ok('aplicarla dos veces no duplica nada', res.agregadas === 0);
const r04 = v.rubros.find(r => r.codigo === '04');
buscar(v, 'Director de Fotografía').valorUnit = 999999; buscar(v, 'Director de Fotografía').valorOrigen = 'manual';
res = aplicarPlantilla(py, v, 'pub-grande');
ok('subir a grande agrega sólo lo que falta', res.agregadas > 0 && res.agregadas < 40, res.agregadas + ' nuevas');
ok('y no toca lo que alguien escribió a mano', buscar(v, 'Director de Fotografía').valorUnit === 999999);
ok('ni la jornada que ya estaba', py.configRodaje.horasJornada === 12 && py.jornadas === 2);

const pyS = nuevoProyecto({tipo: 'publicidad'}); aplicarPlantilla(pyS, pyS.versiones[0], 'pub-super');
ok('la súper crea sus 3 piezas', pyS.piezas.length === 3);
const pyT = nuevoProyecto({tipo: 'contenido'}); aplicarPlantilla(pyT, pyT.versiones[0], 'cont-tv');
ok('la de TV crea los 5 separadores', pyT.piezas.length === 5);
const pyC = nuevoProyecto({tipo: 'videoclip'}); aplicarPlantilla(pyC, pyC.versiones[0], 'clip-mediano');
ok('en videoclip el equipo va por fuera (factura, sin cargas)',
  calcular(pyC.versiones[0]).baseSica === 0 && lineas(pyC.versiones[0]).some(l => l.valorOrigen === 'sica'));

console.log('\n--- 3. PREPRODUCCIÓN A 8 H ---');
DB.ui.productoraId = pr.id; DB.ui.proyectoId = py.id; DB.ui.versionId = v.id;
const rb03 = v.rubros.find(r => r.codigo === '03');
const lp = buscar(v, 'Location Manager');
upLinea(rb03.id, lp.id, 'etapa', 'prepro');
const cLM = cargoSICA('Location Manager', E);
ok('pasar una línea a preproducción la recalcula a 8 h', lp.valorUnit === cLM.j8 && lp.etapa === 'prepro');
upLinea(rb03.id, lp.id, 'etapa', '');
ok('y volver a rodaje, a 12 h', lp.valorUnit === cLM.j12 && lp.etapa === null);
lp.valorUnit = 150000; lp.valorOrigen = 'manual';
upLinea(rb03.id, lp.id, 'etapa', 'prepro');
ok('un valor escrito a mano no se toca', lp.valorUnit === 150000);
DB.ui.proyectoId = py.id; DB.ui.versionId = v.id;
form({horasJornada: '10', horasScouting: '8', recargoHE: '50', minTurnaround: '12', telProduccion: ''});
saveCfgRodaje();
ok('cambiar a 10 h recalcula el rodaje', jpRod.valorUnit === valorJornadaSICA(cJP, py.configRodaje) && jpRod.valorUnit !== cJP.j12);
ok('pero la preproducción sigue en 8 h', jpPre.valorUnit === cJP.j8);
form({horasJornada: '12', horasScouting: '8', recargoHE: '50', minTurnaround: '12', telProduccion: ''});
saveCfgRodaje();

console.log('\n--- 4. CARGAS SOCIALES ---');
let R0 = calcular(v);
ok('con 0% no cambia nada', R0.cargas === 0 && R0.subtotal === R0.subtotalLineas);
ok('pero sabe cuánto es sueldo de convenio', R0.baseSica > 0, fmt(R0.baseSica));
v.capas.cargas = 51;
let R1 = calcular(v);
ok('51% sobre los sueldos de convenio', casi(R1.cargas, R0.baseSica * 0.51), fmt(R1.cargas));
ok('entran en el costo directo', casi(R1.subtotal, R0.subtotalLineas + R1.cargas));
ok('y llevan fee, como el sueldo', casi(R1.fee - R0.fee, R1.cargas * v.capas.fee / 100));
ok('aparecen como renglón propio en el resumen por rubro',
  R1.porRubro.some(r => r.codigo === 'CS' && casi(r.total, R1.cargas)));
ok('los renglones siguen sumando el costo directo', casi(R1.porRubro.reduce((s, r) => s + r.total, 0), R1.subtotal));
const cam2 = buscar(v, 'Director de Fotografía');
cam2.comprobante = 'facBC';
ok('el que factura no lleva cargas', calcular(v).baseSica < R1.baseSica);
cam2.comprobante = ''; cam2.contrato = 'factura';
ok('marcarlo "factura" a mano, tampoco', casi(calcular(v).baseSica, R1.baseSica - totalLinea(cam2, v)));
cam2.contrato = null;
const r09 = v.rubros.find(r => r.codigo === '09');
const act = buscar(v, 'Actor / Actriz Principal'); act.valorUnit = 500000;
const buy = buscar(v, 'Buyout / Cesión de derechos'); buy.valorUnit = 300000;
v.capas.cargasElenco = 41;
const R2c = calcular(v);
ok('el actor lleva las cargas de la AAA', contratoDe(act, r09) === 'aaa');
ok('el buyout no', contratoDe(buy, r09) === 'factura');
ok('41% sobre los cachets', casi(R2c.cargasElenco, R2c.baseAAA * 0.41) && R2c.baseAAA >= 500000, fmt(R2c.cargasElenco));
ok('la chaperona del elenco es convenio SICA, no AAA', contratoDe(nuevaLinea({concepto: 'Chaperona'}), r09) === 'sica');
py.piezas = [nuevaPieza({numero: 1}), nuevaPieza({numero: 2})];
buscar(v, 'Actor / Actriz Principal').piezaId = py.piezas[0].id;
const CP = costoPorPieza(py, v);
ok('por pieza: lo imputado sigue sumando el costo directo, con cargas',
  casi(CP.filas.reduce((s, f) => s + f.imputado, 0), calcular(v).subtotal, 2));
py.piezas = [];
buscar(v, 'Actor / Actriz Principal').piezaId = null;

console.log('\n--- 5. EN PANTALLA ---');
pr.proyectos = pr.proyectos.filter(p => p !== py); pr.proyectos.push(py);
DB.ui.productoraId = pr.id; DB.ui.proyectoId = py.id; DB.ui.versionId = v.id;
DB.ui.tab = 'presu'; DB.ui.vista = 'interna'; render();
let h = app.innerHTML;
ok('totales: renglón de cargas SICA con su base', /Cargas sociales SICA/.test(h) && /de sueldos de convenio/.test(h));
ok('y el de la AAA', /Cargas del elenco \(AAA\)/.test(h));
ok('cada línea del equipo muestra etapa y contratación', /et-prepro/.test(h) && /ct-sica/.test(h) && /Convenio SICA · auto/.test(h));
ok('las notas de referencia se ven', /lnota/.test(h) && /Ref\. 2010/.test(h));
ok('botón para sumar líneas de una plantilla', /elegirPlantilla\(\)/.test(h));
v.capas.cargas = 0; render(); h = app.innerHTML;
ok('sin cargas: el aviso rojo en la barra del convenio', /Faltan las cargas sociales/.test(h));
ok('y la marca en el total', /sin cargar/.test(h));
v.capas.cargas = 51;
DB.ui.vista = 'cliente'; render(); h = app.innerHTML;
ok('al cliente: las cargas como renglón del resumen', /Cargas sociales del equipo \(SICA\)/.test(h));
ok('sin el % editable ni los chips internos', !/upCapa\('cargas'/.test(h) && !/ct-sica/.test(h));
DB.ui.vista = 'interna';

console.log('\n--- 6. CONDICIONES PARA EL CLIENTE ---');
ok('una versión nueva las trae vacías', Object.values(nuevaVersion().condiciones).every(x => x === ''));
render(); h = app.innerHTML;
ok('en la interna se pueden escribir', /Condiciones para el cliente/.test(h) && /upCondicion\('incluye'/.test(h));
DB.ui.vista = 'cliente'; render();
ok('vacías, al cliente no le aparece nada', !/>Condiciones</.test(app.innerHTML));
DB.ui.vista = 'interna';
completarCondiciones();
ok('"completar con las típicas" llena las cuatro', COND_CAMPOS.every(x => v.condiciones[x.k].length > 10));
ok('con los derechos del proyecto', v.condiciones.incluye.includes(py.territorio) && v.condiciones.incluye.includes(py.plazo));
ok('y la validez atada al tipo de cambio', v.condiciones.validez.includes(fmtC(v.tc)));
v.condiciones.pago = 'Contado.'; completarCondiciones();
ok('lo que ya estaba escrito no se pisa', v.condiciones.pago === 'Contado.');
DB.ui.vista = 'cliente'; render(); h = app.innerHTML;
ok('al cliente le salen', />Condiciones</.test(h) && /No incluye/.test(h) && /Contado\./.test(h));
DB.ui.vista = 'interna';

console.log('\n--- 7. PROYECTO NUEVO DESDE EL FORMULARIO ---');
modal = null; editProyecto();
ok('el formulario ofrece plantillas del tipo', /Arrancar el presupuesto con/.test(modal || '') && /Publicidad · mediana/.test(modal || ''));
ok('y las de otros tipos, plegadas', /Ver las de otros tipos/.test(modal || ''));
form({nombre: 'Desde formulario', tipo: 'publicidad', cliente: 'X', agencia: '', producto: '',
  jornadas: '3', medios: 'Digital', territorio: 'Argentina', plazo: '12 meses', plantilla: 'pub-grande'});
const antes = pr.proyectos.length;
saveProyecto('');
const nuevo = pr.proyectos[pr.proyectos.length - 1];
ok('se crea el proyecto', pr.proyectos.length === antes + 1 && nuevo.nombre === 'Desde formulario');
ok('con las líneas de la plantilla', lineas(nuevo.versiones[0]).length > 90, lineas(nuevo.versiones[0]).length + ' líneas');
ok('las 3 jornadas del formulario', nuevo.jornadas === 3 && buscar(nuevo.versiones[0], 'Paquete de luces').dias === 3);
ok('y hereda las cargas del último presupuesto de la casa', nuevo.versiones[0].capas.cargas === 51 && nuevo.versiones[0].capas.cargasElenco === 41);
render();
ok('un presupuesto vacío invita a elegir plantilla',
  tarjetaVacia(nuevoProyecto()).includes('Elegir plantilla'));

console.log('\n--- 8. MIGRACIÓN ---');
const viejo = dbVacia(); DB = viejo; sembrar();
getV().capas = {fee: 15, contingencia: 5, iibb: 0, iva: 21}; delete getV().condiciones;
const tot = calcular(getV()).total;
migrar();
ok('versión vieja: cargas en 0 y condiciones vacías', getV().capas.cargas === 0 && !!getV().condiciones);
ok('y el total no cambia', calcular(getV()).total === tot, fmt(tot));
ok('el ejemplo sigue dando $12.291.906', Math.round(calcular(getV()).total) === 12291906, fmt(calcular(getV()).total));

console.log('\n--- 9. CATÁLOGO: EXCEL Y CATÁLOGO PREPARADO ---');
(async () => {
  const bytes = new Uint8Array(require('fs').readFileSync(require('path').join(__dirname || 'test', 'fixtures', 'callsheet-prueba.xlsx')));
  const txt = await xlsxATexto(bytes);
  ok('lee un callsheet .xlsx', /Ana Prueba/.test(txt) && /Rental Ficticio/.test(txt));
  const lin = txt.split('\n');
  const deAna = lin.find(x => x.includes('Ana Prueba'));
  ok('la tabla de la derecha NO se pega a la de la izquierda', deAna && !deAna.includes('Rental'), deAna);
  ok('el teléfono guardado como número también sale', /1155550005/.test(txt));
  const cs = unificarContactos(extraerContactos(txt, 'prueba.xlsx'));
  const ana = cs.find(c => c.nombre === 'Ana Prueba');
  ok('saca a la persona con su mail y su teléfono', ana && ana.email === 'ana.prueba@ejemplo.com' && /5555-0001/.test(ana.tel));
  ok('y su función', ana && /Asistente de Direcci/.test(ana.funcion));
  const rent = cs.find(c => /Rental Ficticio/.test(c.nombre));
  ok('el proveedor sale aparte con SU teléfono', rent && /4444-0001/.test(rent.tel));
  let err = '';
  try{ await archivoATexto({name: 'viejo.xls', arrayBuffer: async () => new Uint8Array([0xD0, 0xCF, 0x11, 0xE0]).buffer}); }
  catch(e){ err = e.message; }
  ok('un .xls viejo avisa cómo convertirlo', /guardalo como \.xlsx/.test(err));

  DB = dbVacia(); sembrar();
  const prep = catalogoPreparado({clap: 'catalogo', personas: [
    {nombre: 'Zoe Inventada', funcion: 'Gaffer', rubro: '05', tipo: 'persona', tel: '11 5000-0000',
     email: 'ZOE@EJEMPLO.COM', notas: 'Proyecto A (2026) · Proyecto B (2021)'},
    {nombre: 'Luces Ficticias SA', funcion: 'Paquete de luces', rubro: '11', tipo: 'proveedor', tel: '11 4000-0000'},
    {nombre: 'Martín Bevilacqua', funcion: 'Director de Fotografía', rubro: '04'},
  ]}, 'catalogo.json');
  ok('lee un catálogo preparado', prep.length === 3 && prep[0].email === 'zoe@ejemplo.com');
  err = ''; try{ catalogoPreparado({foo: 1}, 'x.json'); }catch(e){ err = e.message; }
  ok('uno que no es de CLAP se rechaza con un mensaje claro', /no es un catálogo de CLAP/.test(err));
  _candidatos = unificarContactos(prep).map((c, i) => ({...c, i, ya: yaEnCatalogo(c)}));
  ok('reconoce al que ya está en el catálogo', _candidatos.find(c => c.nombre === 'Martín Bevilacqua').ya);
  global.document.querySelectorAll = s => /input\[data-c\]/.test(s)
    ? _candidatos.filter(c => !c.ya).map(c => ({checked: true, dataset: {c: String(c.i)}})) : [];
  const n0 = DB.catalogo.personas.length;
  importarCandidatos();
  const zoe = DB.catalogo.personas.find(p => p.nombre === 'Zoe Inventada');
  ok('importa sólo los nuevos', DB.catalogo.personas.length === n0 + 2);
  ok('con sus notas', zoe && zoe.notas === 'Proyecto A (2026) · Proyecto B (2021)');
  ok('el técnico con tarifa de referencia del convenio', zoe && zoe.tarifaRef > 0);
  const luz = DB.catalogo.personas.find(p => p.nombre === 'Luces Ficticias SA');
  ok('el proveedor como proveedor, sin tarifa inventada', luz && luz.tipo === 'proveedor' && luz.tarifaRef === 0);
  DB.ui.tab = 'catalogo'; DB.ui.subCat = 'gente'; DB.ui.fCat = {q: 'proyecto b', rubro: '', tipo: '', desde: '', hasta: '', soloLibres: false};
  render();
  ok('se puede buscar por las notas (por proyecto)', /Zoe Inventada/.test(app.innerHTML) && !/Luces Ficticias/.test(app.innerHTML));
  _catNotas = false;
  ok('sin la columna en la base, las notas no se mandan', !('notas' in catHaciaServidor(zoe, 'org')));
  _catNotas = true;
  ok('con la columna, sí', catHaciaServidor(zoe, 'org').notas === 'Proyecto A (2026) · Proyecto B (2021)');
  ok('y al bajar se leen', catDesdeServidor({id: 'x', nombre: 'A', notas: 'n'}).notas === 'n');

  console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
  process.exitCode = fallos ? 1 : 0;
})();
