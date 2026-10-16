/* El presupuesto en dos bloques: PREPRODUCCIÓN (jornadas de 8 h) arriba y
   RODAJE abajo, con los rubros repetidos (cada uno con lo suyo). El rubro 01
   «Preproducción y Desarrollo» ya no existe: lo suyo es preproducción de
   Dirección (casting, storyboard, desarrollo) o de Producción (scouting,
   PPM, trámites), y los presupuestos de antes se reparten al abrir. Lo que
   sale (el Excel de la cotización, la vista del cliente, el CSV) también va
   en preproducción y rodaje.
   Uso: node test/run.js test/presupuesto-bloques.js                         */
(() => {
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const redondo = x => Math.round(x * 100) / 100;

console.log('--- 1. SIN RUBRO 01 ---');
ok('la lista no lo tiene', !RUBROS_BASE.some(r => r.codigo === '01') && numRubro('02') === '01' && numRubro('03') === '02' && numRubro('17') === '18');
ok('lo suyo está en Dirección y Producción', ['Casting', 'Storyboard', 'Honorarios de desarrollo'].every(x => FUNCIONES['02'].includes(x))
  && ['Scouting / búsqueda de locaciones', 'Pre Production Meeting (PPM)', 'Mensajería'].every(x => FUNCIONES['03'].includes(x)));
ok('el casting es de dirección', esFuncionPre('Casting') && FUNCIONES_PRE['02'].includes('Casting') && !FUNCIONES['03'].includes('Casting'));
ok('al importar: el scouting a producción y el casting a dirección, como preproducción',
  rubroDeConcepto('Scouting') === '03' && rubroDeConcepto('Casting') === '02' && esConceptoPre('Scouting de locaciones') && rubroDeConcepto('Storyboard') === '02');

DB = dbVacia(); sembrar();
const pr = getPr(), py = pr.proyectos[0], V = getV();
DB.ui.usuarioId = pr.usuarios.find(u => u.rol === 'ejecutivo').id;
const rb = c => V.rubros.find(r => r.codigo === c);
ok('Brisa no tiene rubro 01', !py.versiones.some(v => v.rubros.some(r => r.codigo === '01')));
ok('el scouting de Brisa es preproducción de producción', rb('03').lineas.some(l => /^Scouting/.test(l.concepto) && l.etapa === 'prepro' && n(l.valorUnit) > 0));
ok('el casting, de dirección', rb('02').lineas.some(l => l.concepto === 'Casting' && l.etapa === 'prepro'));

ok('el casting y el scouting no son gente del equipo (alta, liquidación)', !genteDelProyecto(py, V).some(g => g.funciones.some(f => /^(Casting|Scouting)/.test(f))));

console.log('--- 2. LOS BLOQUES ---');
let B = bloquesPresupuesto(V, null);
ok('arriba sólo las líneas de preproducción', B.pre.every(x => x.ls.every(l => l.etapa === 'prepro')) && B.pre.length > 0);
ok('abajo todo lo demás', B.rod.every(x => x.ls.every(l => l.etapa !== 'prepro')));
ok('el rodaje tiene todos los rubros', B.rod.length === V.rubros.length);
ok('en preproducción no se ven los rubros vacíos', B.pre.every(x => x.ls.length) && !B.pre.some(x => x.r.codigo === '11'));
ok('cada línea está una sola vez', B.pre.reduce((s, x) => s + x.ls.length, 0) + B.rod.reduce((s, x) => s + x.ls.length, 0) === V.rubros.reduce((s, r) => s + r.lineas.length, 0));
const R0 = calcular(V);
ok('pre + rodaje = las líneas del presupuesto', redondo(B.totPre + B.totRod) === redondo(R0.subtotalLineas), `${B.totPre} + ${B.totRod} = ${R0.subtotalLineas}`);
const x04 = r => B.pre.find(x => x.r === r), r04 = rb('04');
ok('y por rubro: lo de arriba más lo de abajo es el rubro', V.rubros.every(r => {
  const p = B.pre.find(x => x.r === r), d = B.rod.find(x => x.r === r);
  return redondo((p ? p.ls : []).concat(d ? d.ls : []).reduce((s, l) => s + totalLinea(l, V), 0)) === redondo(r.lineas.reduce((s, l) => s + totalLinea(l, V), 0)); }));

DB.ui.tab = 'presu'; DB.ui.vista = 'interna'; r04.abierto = true; render();
let h = app.innerHTML;
const hPre = h.slice(h.indexOf('bloque bl-pre'), h.indexOf('bloque bl-rod'));
ok('el bloque de preproducción va primero, con su subtotal', h.indexOf('bl-pre') < h.indexOf('bl-rod') && hPre.includes(fmt(B.totPre, V.monedaBase)));
ok('el de rodaje con el suyo', h.slice(h.indexOf('bloque bl-rod')).includes(fmt(B.totRod, V.monedaBase)));
ok('cámara está en los dos bloques', (h.match(/class="rubro[^"]*" data-r="04"/g) || []).length === 2);
ok('las acciones del rubro van una sola vez (en el rodaje)', !/delRubro\(/.test(hPre) && /delRubro\('[^']+'\)/.test(h.slice(h.indexOf('bloque bl-rod'))));
ok('arriba los botones cargan preproducción', hPre.includes(`addLinea('${r04.id}','pre')`) && hPre.includes(`pickFuncion('${r04.id}','pre')`) && hPre.includes(`pickPersona('${r04.id}','pre')`));
ok('el total del presupuesto no cambia', calcular(V).total === R0.total);

console.log('--- 3. AGREGAR RUBRO A PREPRODUCCIÓN ---');
ok('está el botón', hPre.includes('agregarRubroPre()'));
modal = null; agregarRubroPre();
ok('ofrece los rubros, menos Postproducción y los que ya están', /Agregar rubro a preproducción/.test(modal) && !modal.includes(`sumarRubroPre('${rb('14').id}')`)
  && modal.includes(`sumarRubroPre('${rb('11').id}')`) && !modal.includes(`sumarRubroPre('${r04.id}')`));
const r11 = rb('11'), nAntes = r11.lineas.length;
sumarRubroPre(r11.id);
B = bloquesPresupuesto(V, null);
ok('se ve vacío en preproducción', B.pre.some(x => x.r === r11 && !x.ls.length));
ok('sin tocar el presupuesto', r11.lineas.length === nAntes && DB.ui.preVacios.includes(r11.id));
render(); h = app.innerHTML;
ok('con sus botones', h.slice(h.indexOf('bloque bl-pre'), h.indexOf('bloque bl-rod')).includes(`addLinea('${r11.id}','pre')`));
addLinea(r11.id, 'pre');
const nueva = r11.lineas[r11.lineas.length - 1];
ok('«+ Línea» carga una de preproducción', nueva.etapa === 'prepro' && !DB.ui.preVacios.includes(r11.id));
B = bloquesPresupuesto(V, null);
ok('y el rubro se queda por lo que tiene', B.pre.some(x => x.r === r11 && x.ls.includes(nueva)));
delLinea(r11.id, nueva.id);
ok('sin nada vuelve a esconderse', !bloquesPresupuesto(V, null).pre.some(x => x.r === r11));

console.log('--- 4. CARGAR DESDE PREPRODUCCIÓN ---');
const E = escalaDelProyecto(py);
modal = null; pickFuncion(r04.id, 'pre');
ok('el catálogo muestra el convenio a 8 h', modal.includes('SICA ' + fmtC(cargoSICA('Director de Fotografía', E).j8)));
addFuncion(r04.id, 'Ayudante de cámara', 'pre');
const ay = r04.lineas[r04.lineas.length - 1];
ok('entra como preproducción, a 8 h', ay.etapa === 'prepro' && ay.valorUnit === cargoSICA('Ayudante de cámara', E).j8);
addFuncion(rb('02').id, 'Casting');
const cast = rb('02').lineas[rb('02').lineas.length - 1];
ok('el casting entra como preproducción aunque se elija desde el rodaje', cast.concepto === 'Casting' && cast.etapa === 'prepro');
modal = null; pickFuncion(rb('03').id);
ok('el catálogo de producción marca lo de preproducción', /pf-grupo">Preproducción/.test(modal) && modal.indexOf('Scouting') > modal.indexOf('pf-grupo">Preproducción'));
const pe = DB.catalogo.personas.find(p => p.funcion === 'Gaffer');
addPersona(rb('05').id, pe.id, 'pre');
const gpre = rb('05').lineas[rb('05').lineas.length - 1];
ok('una persona del catálogo en preproducción: convenio a 8 h', gpre.etapa === 'prepro' && gpre.refId === pe.id && gpre.valorUnit === cargoSICA('Gaffer', E).j8);

console.log('--- 5. LA ETAPA ---');
const paq = rb('11').lineas[0];
ok('el chip de etapa está en todos los rubros (también alquileres)', /etapa/.test(chipsContrato(paq, rb('11'), py)));
upLinea(rb('11').id, paq.id, 'etapa', 'prepro');
ok('pasarla a preproducción la sube de bloque', bloquesPresupuesto(V, null).pre.some(x => x.r === rb('11') && x.ls.includes(paq)));
upLinea(rb('11').id, paq.id, 'etapa', '');
ok('y volverla al rodaje la baja', !bloquesPresupuesto(V, null).pre.some(x => x.r === rb('11')));
const lp = rb('14').lineas[0];
ok('en postproducción no hay preproducción', !/value="prepro"/.test(chipsContrato(lp, rb('14'), py)));
upLinea(rb('14').id, lp.id, 'etapa', 'prepro');
ok('ni a mano', lp.etapa !== 'prepro');

console.log('--- 6. EL 01 DE LOS PRESUPUESTOS DE ANTES ---');
DB = dbVacia(); sembrarChico();
const py2 = getPy(), v2 = getV();
const r01 = {id: 'rb01viejo', codigo: '01', nombre: 'Preproducción y Desarrollo', aplicaFee: true, area: 'preproduccion', lineas: [], abierto: true};
const sc = nuevaLinea({concepto: 'Scouting / búsqueda de locaciones', unidad: 'global', valorUnit: 400000, area: 'preproduccion'}),
  ca = nuevaLinea({concepto: 'Casting', unidad: 'global', valorUnit: 500000, refId: 'pC'}),
  sb = nuevaLinea({concepto: 'Storyboard', unidad: 'global', valorUnit: 300000}),
  ofi = nuevaLinea({concepto: 'Alquiler de sala de reuniones', unidad: 'global', valorUnit: 90000});
r01.lineas = [sc, ca, sb, ofi];
v2.rubros.unshift(r01);
const c1 = nuevoComprobante({rubro: '01', subrubro: 'Casting', importe: 100000, lineaId: ca.id}),
  c2 = nuevoComprobante({rubro: '01', subrubro: 'Scouting / búsqueda de locaciones', importe: 50000, area: 'preproduccion'});
py2.comprobantes.push(c1, c2);
const antes = calcular(v2);
migrar();
const despues = calcular(v2), rr = c => v2.rubros.find(r => r.codigo === c);
ok('el total y el fee no cambian', redondo(antes.total) === redondo(despues.total) && redondo(antes.fee) === redondo(despues.fee), `${antes.total} → ${despues.total}`);
ok('el 01 se fue', !rr('01'));
ok('casting y storyboard a dirección', rr('02').lineas.includes(ca) && rr('02').lineas.includes(sb));
ok('scouting y lo demás a producción', rr('03').lineas.includes(sc) && rr('03').lineas.includes(ofi));
ok('todo como preproducción, con su persona', [sc, ca, sb, ofi].every(l => l.etapa === 'prepro') && ca.refId === 'pC');
ok('el área de preproducción pasa a la del rubro', sc.area === 'produccion');
ok('los gastos lo siguen: con línea y sin línea', c1.rubro === '02' && c2.rubro === '03');
const ids = JSON.stringify(v2.rubros.map(r => [r.codigo, r.lineas.map(l => l.id)]));
migrar();
ok('una sola vez', JSON.stringify(v2.rubros.map(r => [r.codigo, r.lineas.map(l => l.id)])) === ids && v2.rubro01Repartido === true);
/* un 01 sin fee: mudarlo cambiaría el total, así que se queda */
DB = dbVacia(); sembrarChico();
const v3 = getV(), r01b = {id: 'rb01b', codigo: '01', nombre: 'Preproducción y Desarrollo', aplicaFee: false, lineas: [nuevaLinea({concepto: 'Scouting', unidad: 'global', valorUnit: 400000})], abierto: true};
v3.rubros.unshift(r01b);
const t3 = calcular(v3).total;
migrar();
ok('un 01 con otro fee queda como estaba (y el total igual)', v3.rubros.includes(r01b) && calcular(v3).total === t3 && r01b.lineas[0].etapa === 'prepro');
ok('va primero y no se confunde con Dirección', v3.rubros[0] === r01b && numRubro('01') === 'PRE');
/* el que llega de la base con el 01 se reparte al ponerlo */
DB = dbVacia(); sembrarChico();
const py4 = getPy(), d = PARTES_PY.presupuesto.lee(py4);
d.versiones.forEach(x => { delete x.rubro01Repartido; x.rubros.unshift({id: 'rbX01', codigo: '01', nombre: 'Preproducción y Desarrollo', aplicaFee: true,
  lineas: [nuevaLinea({concepto: 'Casting', unidad: 'global', valorUnit: 100000})]}); });
PARTES_PY.presupuesto.pone(py4, JSON.parse(JSON.stringify(d)));
ok('al recibirlo de la base, se reparte', !getV().rubros.some(r => r.codigo === '01') && getV().rubros.find(r => r.codigo === '02').lineas.some(l => l.concepto === 'Casting' && l.etapa === 'prepro'));

console.log('--- 7. LO QUE SALE: EXCEL, CLIENTE Y CSV ---');
DB = dbVacia(); sembrar();
const prX = getPr(), pyX = prX.proyectos[1];                     /* Cumbre, en cotización */
DB.ui.usuarioId = prX.usuarios.find(u => u.rol === 'ejecutivo').id;
DB.ui.proyectoId = pyX.id;
const vB = baseDe(pyX); DB.ui.versionId = vB.id;
const RX = calcular(vB), SX = seccionesVersion(vB);
ok('las secciones: preproducción y rodaje', SX.length === 2 && SX[0].k === 'pre' && SX[1].k === 'rodaje' && SX[0].rubros.length > 0);
ok('pre + rodaje = las líneas, como antes', redondo(SX[0].total + SX[1].total) === redondo(RX.subtotalLineas), `${SX[0].total} + ${SX[1].total} vs ${RX.subtotalLineas}`);
ok('y cada sección es la suma de sus rubros', SX.every(x => redondo(x.rubros.reduce((a, y) => a + y.total, 0)) === redondo(x.total)));
const hojaB = hojasCotizacion(pyX).find(h => h.nombre === 'Base').filas;
const txt = c => c == null ? '' : typeof c === 'object' ? String(c.v ?? '') : String(c);
const iFila = re => hojaB.findIndex(f => f && f.some(c => re.test(txt(c))));
const val = re => { const fr = hojaB[iFila(re)]; return fr ? +txt(fr[7]) : NaN; };
ok('el Excel: PREPRODUCCIÓN primero, después RODAJE', iFila(/^PREPRODUCCIÓN · jornadas de 8 h$/) > 0 && iFila(/^PREPRODUCCIÓN/) < iFila(/^RODAJE$/));
ok('con el subtotal de cada sección', Math.abs(val(/^Subtotal preproducción$/) - SX[0].total) < 0.02 && Math.abs(val(/^Subtotal rodaje$/) - SX[1].total) < 0.02);
const filaL = hojaB[iFila(/^Líneas$/)];
ok('las líneas suman las dos secciones (fórmula) y dan lo mismo que antes', /^H\d+\+H\d+$/.test(filaL[7].f) && Math.abs(filaL[7].v - RX.subtotalLineas) < 0.02);
ok('los totales de siempre, iguales a la app', Math.abs(val(/^Costo directo$/) - RX.subtotal) < 0.02 && Math.abs(val(/^Fee de producción \(margen\)$/) - RX.fee) < 0.02
  && Math.abs(val(/^IVA$/) - RX.iva) < 0.02 && Math.abs(val(/^Total al cliente$/) - RX.total) < 0.02);
ok('con los números de rubro de la pantalla', hojaB.some(f => f && txt(f[0]) === numRubro('18') && txt(f[1]) === 'Grip'));
/* la vista del cliente (y el PDF) */
const hc = tablaCliente(vB, RX);
ok('el cliente ve las dos secciones con su subtotal', /class="csec"/.test(hc) && hc.indexOf('Preproducción') < hc.indexOf('Rodaje') && hc.includes(fmt(SX[0].total, vB.monedaBase)) && hc.includes(fmt(SX[1].total, vB.monedaBase)));
ok('y nada de más: sin líneas, sin fee', !/Director de Fotografía|Scouting/.test(hc) && !/\bfee\b/i.test(hc));
ok('las cargas sociales, al final como siempre', !RX.cargas || hc.lastIndexOf('Cargas sociales') > hc.lastIndexOf('csec'));
/* el CSV */
let csvX = ''; const _bX = bajar; bajar = (nm, c) => { csvX = c; }; expCSV(); bajar = _bX;
ok('el CSV tiene la etapa de cada línea', /"Etapa"/.test(csvX.split('\n')[0]) && /"Casting","Preproducción"/.test(csvX) && /"Rodaje"/.test(csvX));
/* una versión sin preproducción: sólo el rodaje, sin títulos de más */
DB = dbVacia(); sembrarChico();
const pyC = getPy(), vC = getV();
ok('sin preproducción: una sola sección', seccionesVersion(vC).length === 1 && seccionesVersion(vC)[0].k === 'rodaje');
const hojaC = hojasCotizacion(pyC)[1].filas;
ok('el Excel sale sin PREPRODUCCIÓN ni RODAJE', !hojaC.some(f => f && f.some(c => /^(PREPRODUCCIÓN|RODAJE)/.test(txt(c)))));
const fL = hojaC.find(f => f && txt(f[6]) === 'Líneas');
ok('y las líneas dan lo mismo', fL && Math.abs(fL[7].v - calcular(vC).subtotalLineas) < 0.02 && /^H\d+(\+H\d+)+$/.test(fL[7].f));
ok('el cliente lo ve como antes', !/csec/.test(tablaCliente(vC, calcular(vC))));
console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
})();
