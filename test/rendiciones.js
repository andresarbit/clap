/* Rendiciones: la plata que le dan a un asistente para trabajar y lo que
   rinde. El fondo lo da el jefe (o Administración); el asistente sube los
   tickets, completa las filas (CLAP pre-llena lo que lee del QR de AFIP, del
   PDF o de la foto) y la manda; el jefe la devuelve con un comentario o la
   eleva; Administración la cierra. Cada uno ve y toca sólo lo suyo. Y los
   permisos que se corrigieron de paso: órdenes de compra, comprobantes
   ajenos y el menú Datos.                                                  */
(async () => {
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
global.confirm = () => true;
const clon = x => JSON.parse(JSON.stringify(x));

DB = dbVacia(); sembrarChico();
const pr = getPr(), py = getPy();
const quien = rol => pr.usuarios.find(u => u.rol === rol);
const como = rol => { DB.ui.usuarioId = quien(rol).id; modal = null; };
const diego = quien('asistprod'), carla = quien('arte'), lucia = quien('produccion'), marta = quien('admin');
const fondo = py.cajas.find(cj => cj.responsable === diego.id);
const totalPresu = () => { const R = calcular(getV()); return [fmt(R.total, getV().monedaBase), fmt(R.subtotal + R.contingencia, getV().monedaBase)]; };
como('ejecutivo'); const [TOTAL, COSTO] = totalPresu();
const MONTOS_RUBROS = getV().rubros.map(r => totalRubro(r, getV())).filter(x => x > 0).map(x => fmt(x));

console.log('--- 1. LOS NÚMEROS DE LA RENDICIÓN ---');
let T = totalesRend(py, fondo);
ok('el ejemplo: $ 150.000 entregados y 5 tickets', T.entregado === 150000 && T.cant === 5, fmt(T.entregado) + ' · ' + T.cant);
ok('rendido = suma de los tickets', T.gastado === 42000 + 3450 + 18500 + 24300 + 50000, fmt(T.gastado));
ok('saldo a devolver = entregado − rendido', T.saldo === 150000 - 138250 && saldoTxt(T.saldo) === 'A devolver', fmt(T.saldo));
ok('agrupa por rubro, en orden', T.rubros.map(r => r.codigo).join(',') === '03,12,13', T.rubros.map(r => r.codigo + ':' + r.total).join(' '));
ok('los subtotales suman el total', T.rubros.reduce((s, r) => s + r.total, 0) === T.gastado);
ok('cuenta con y sin comprobante', T.cantCon === 4 && T.cantSin === 1, T.cantCon + ' con · ' + T.cantSin + ' sin');
ok('el período va del primer al último movimiento', T.desde === hoyMas(-4) && T.hasta === hoyMas(-2), periodoTxt(T));
ok('una caja vieja (sin circuito) se lee como borrador; una rendida, como cerrada',
  estadoRend(nuevaCaja()) === 'borrador' && estadoRend(nuevaCaja({estado: 'rendida'})) === 'cerrada');
ok('leer el estado no le agrega nada a la caja', (() => { const c = nuevaCaja(); estadoRend(c); totalesRend(py, c); return !('rendicion' in c); })());
const sinRubro = nuevoComprobante({cajaId: 'x', importe: 0, fecha: ''}); sinRubro.fecha = '';
ok('una fila vacía dice qué le falta', faltaEnGasto(sinRubro).join(',') === 'fecha,proveedor,rubro,tipo,importe', faltaEnGasto(sinRubro).join(','));
ok('una factura sin número también', faltaEnGasto({fecha: hoy(), proveedor: 'X', rubro: '03', tipo: 'facA', importe: 10}).join(',') === 'numero');

console.log('\n--- 2. QUIÉN VE QUÉ ---');
como('asistprod');
ok('el asistente ve su rendición', veRend(fondo) && rendMia(fondo));
ok('y no la puede cambiar mientras la tiene el jefe', !cargaRend(fondo));
DB.ui.tab = 'gastos'; DB.ui.subGasto = 'rend'; DB.ui.rendId = null; render();
let h = app.innerHTML;
ok('en Gastos → Rendiciones ve "Mis rendiciones"', /Mis rendiciones/.test(h) && h.includes(esc(fondo.nombre)));
ok('no ve el total del presupuesto ni el costo', !h.includes(TOTAL) && !h.includes(COSTO), TOTAL + ' / ' + COSTO);
ok('no puede dar fondos', !/editCaja\(\)/.test(h));
abrirRend(fondo.id); h = app.innerHTML;
ok('abre la rendición: planilla, tickets y charla', /La planilla, por rubro/.test(h) && /Charla/.test(h) && /verAdjuntoRend/.test(h));
ok('el link directo abre esa rendición', hashDeUI() === '#/gastos/rend/r-' + fondo.id, hashDeUI());
DB.ui.rendId = null; aplicarHash('#/gastos/rend/r-' + fondo.id);
ok('y vuelve a abrirla desde el link', DB.ui.subGasto === 'rend' && DB.ui.rendId === fondo.id);
ok('ni ahí ve montos del presupuesto', !h.includes(TOTAL) && !h.includes(COSTO) && !MONTOS_RUBROS.some(x => h.includes(x)));
ok('ni el rubro con su plata: sólo nombres', /03 · Equipo de Producción/.test(h));
ok('sin botones para elevar ni cerrar', !/elevarRend\(/.test(h) && !/rendirCaja\(/.test(h));
como('arte');
ok('Carla (arte) no ve la rendición de Diego', !veRend(fondo));
DB.ui.rendId = fondo.id; render(); h = app.innerHTML;
ok('aunque tenga el link: ve sólo las suyas', /Mis rendiciones/.test(h) && !h.includes(esc(fondo.nombre)) && /No tenés plata para rendir/.test(h));
editCaja(); ok('y no se abre un fondo para ella misma', modal === null);
como('produccion'); DB.ui.rendId = null; setTab('resumen'); h = app.innerHTML;
ok('el jefe tiene la bandeja en su panel', /Rendiciones para revisar/.test(h) && /abrirRend\('/.test(h) && h.includes(esc(diego.nombre)));
ok('y en los pendientes', /1<\/span><span>rendición para revisar/.test(h));
DB.ui.subGasto = 'rend'; setTab('gastos'); h = app.innerHTML;
ok('en Gastos ve todas, con filtros por persona y estado', /Todas las personas/.test(h) && /Todos los estados/.test(h) && /setFRend\('persona'/.test(h));
setFRend('persona', carla.id); ok('filtra por persona', /Ninguna con ese filtro/.test(app.innerHTML));
setFRend('persona', ''); setFRend('estado', 'enviada'); ok('filtra por estado', app.innerHTML.includes(esc(diego.nombre)));
DB.ui.fRend = null;

console.log('\n--- 3. EL CIRCUITO ---');
como('produccion'); abrirRend(fondo.id); h = app.innerHTML;
ok('el jefe puede elevar o devolver', /elevarRend\('/.test(h) && /devolverRend\('/.test(h));
ok('pero no cambiar los gastos', !cargaRend(fondo) && !/upGastoRend\(/.test(h));
global.prompt = () => '';
devolverRend(fondo.id); ok('devolver sin comentario no se puede', estadoRend(fondo) === 'enviada');
global.prompt = () => 'Falta el ticket del peaje de vuelta';
devolverRend(fondo.id);
ok('la devuelve con comentario: queda observada', estadoRend(fondo) === 'observada');
let p = firmaRend(fondo, 'observada');
ok('el paso queda firmado: quién, rol, cuándo y el comentario', p && p.quien === lucia.nombre && p.rol === 'produccion' && /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(p.cuando) && /peaje/.test(p.nota));
comentarRend(fondo.id, '¿El changarín te firmó algo?');
como('asistprod');
ok('el asistente puede corregir', cargaRend(fondo));
abrirRend(fondo.id); h = app.innerHTML;
ok('ve el comentario del jefe y la charla', /Falta el ticket del peaje de vuelta/.test(h) && /changarín te firmó/.test(h));
ok('y puede editar las filas', /upGastoRend\('/.test(h) && /subirArchivosRend\('/.test(h));
comentarRend(fondo.id, 'No, le pagué en mano. Agrego el peaje.');
const nuevo = nuevoGastoRend(fondo);
upGastoRend(nuevo.id, 'fecha', hoyMas(-2));
upGastoRend(nuevo.id, 'proveedor', 'Autopista del Sol (ejemplo)');
ok('elige el proveedor y el rubro sale del último gasto con él', nuevo.rubro === '12' && nuevo.area === 'produccion', nuevo.rubro + ' / ' + nuevo.area);
upGastoRend(nuevo.id, 'tipo', 'ticket'); upGastoRend(nuevo.id, 'importe', '3.450');
ok('el importe acepta "3.450" (miles)', nuevo.importe === 3450);
upGastoRend(nuevo.id, 'importe', '3450,50'); ok('y "3450,50" (centavos)', nuevo.importe === 3450.5);
upGastoRend(nuevo.id, 'importe', '3450');
T = totalesRend(py, fondo);
ok('la planilla se actualiza', T.cant === 6 && T.gastado === 141700, fmt(T.gastado));
const charlaDiego = clon(charlaRend(fondo));
enviarRend(fondo.id);
ok('la reenvía al jefe', estadoRend(fondo) === 'enviada' && pasosRend(fondo).filter(x => x.a === 'enviada').length === 2);
ok('deshacer la vuelve atrás', (toastAccion(), estadoRend(fondo) === 'observada'));
enviarRend(fondo.id);
ok('y otra vez mandada', estadoRend(fondo) === 'enviada');
como('arte'); comentarRend(fondo.id, 'colado');
ok('alguien de afuera no comenta', charlaRend(fondo).length === charlaDiego.length);
como('produccion');
ok('el jefe no la puede cerrar', !cierraRend());
elevarRend(fondo.id);
ok('la eleva a Administración: queda aprobada', estadoRend(fondo) === 'aprobada');
ok('y sus gastos quedan revisados', totalesRend(py, fondo).comprobantes.every(c => c.estado === 'revisado'));
rendirCaja(fondo.id); ok('no abre el cierre (lo cierra Administración)', modal === null);
como('admin'); setTab('resumen'); h = app.innerHTML;
ok('a Administración le aparece para cerrar', /rendición para cerrar/.test(h));
abrirRend(fondo.id); h = app.innerHTML;
ok('con el botón de cerrar', /rendirCaja\('/.test(h));
rendirCaja(fondo.id); ok('el cierre dice cuánto le sobró, con el monto puesto para la devolución', modal && /Le sobró/.test(modal) && /lo devuelve/.test(modal) && modal.includes(fmt(150000 - 141700)) && /name="monto" value="8300"/.test(modal) && /name="fecha"/.test(modal));
ok('al cerrar no pregunta cómo lo devuelve (efectivo o transferencia): sólo el monto y la fecha', !/name="circuito"/.test(modal) && !/Cómo lo devolvió|efectivo|transferencia/i.test(modal));
global.document.querySelectorAll = sel => String(sel).includes('[name]') ? [{name: 'notas', value: 'Devolvió en efectivo'}] : [];
confirmarRendicion(fondo.id);
global.document.querySelectorAll = () => [];
ok('cerrada: devolvió el saldo', estadoRend(fondo) === 'cerrada' && fondo.devuelto === 8300 && fondo.estado === 'rendida', fmt(fondo.devuelto));
ok('los gastos quedan pagados con el fondo', totalesRend(py, fondo).comprobantes.every(c => c.estado === 'pagado' && c.historial[c.historial.length - 1].usuario === marta.nombre));
ok('el tablero lo cuenta como pagado', resumenPlata(py, getV()).pagado >= 141700);
ok('las firmas de la carátula: rindió, revisó, recibió', firmaRend(fondo, 'enviada').quien === diego.nombre && firmaRend(fondo, 'aprobada').quien === lucia.nombre && firmaRend(fondo, 'cerrada').quien === marta.nombre);
como('asistprod');
ok('cerrada, ya nadie la cambia', !cargaRend(fondo));

console.log('\n--- 4. EL EXCEL ---');
como('asistprod');
const bytes = xlsxRendicion(py, fondo);
const nombres = zipNombres(bytes);
ok('es un .xlsx: un ZIP con las partes de Excel', ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet3.xml'].every(x => nombres.includes(x)), nombres.join(' '));
const wb = utf8(await zipEntrada(bytes, 'xl/workbook.xml'));
ok('con tres hojas: Carátula, Por rubro y Detalle', /name="Carátula"/.test(wb) && /name="Por rubro"/.test(wb) && /name="Detalle"/.test(wb));
const txt = await xlsxATexto(bytes);
ok('la app lo vuelve a leer', /Rendición de gastos/.test(txt) && txt.includes(diego.nombre) && /Estación de servicio Ruta 2/.test(txt), txt.slice(0, 80).replace(/\n/g, ' / '));
const h2 = utf8(await zipEntrada(bytes, 'xl/worksheets/sheet2.xml'));
ok('los importes son números', /<v>42000<\/v>/.test(h2) && /<v>141700<\/v>/.test(h2));
ok('los subtotales son fórmulas (se puede seguir editando)', /<f>SUM\(H\d+:H\d+\)<\/f>/.test(h2) && /<f>H\d+-H\d+<\/f>/.test(h2));
ok('las fechas son fechas', new RegExp(`<c r="B\\d+" s="3"><v>${serialFecha(hoyMas(-4))}</v>`).test(h2));
const h1 = utf8(await zipEntrada(bytes, 'xl/worksheets/sheet1.xml'));
ok('la carátula tiene fondo, rendido, saldo y firmas', ['Fondo recibido', 'Total rendido', 'Saldo a devolver', 'Con comprobante', 'Sin comprobante', 'Rindió', 'Revisó (jefe de producción)', 'Recibió (administración)'].every(x => h1.includes(x)) && h1.includes(marta.nombre));
ok('no lleva nada del presupuesto', !txt.includes(TOTAL.replace(/\D/g, '')));
const crcOk = (() => { const dv = new DataView(bytes.buffer); let p0 = 0, okk = true;
  while(dv.getUint32(p0, true) === 0x04034b50){ const tam = dv.getUint32(p0 + 18, true), nl = dv.getUint16(p0 + 26, true);
    if(crc32(bytes.subarray(p0 + 30 + nl, p0 + 30 + nl + tam)) !== dv.getUint32(p0 + 14, true)) okk = false; p0 += 30 + nl + tam; }
  return okk; })();
ok('cada parte con su CRC bien (si no, Excel la rechaza)', crcOk);

console.log('\n--- 5. EL PDF PARA IMPRIMIR ---');
const imp = rendImpresionHTML(py, fondo);
ok('carátula con firmas, planilla y los tickets pegados', /Rendición de gastos/.test(imp) && /Planilla por rubro/.test(imp) && /ri-pegado/.test(imp) && (imp.match(/class="ri-firma"/g) || []).length === 3);
ok('los tickets de a cuatro por hoja', (imp.match(/class="ri-hoja ri-tk"/g) || []).length === Math.ceil(totalesRend(py, fondo).comprobantes.filter(c => c.adjunto).length / 4));
imprimirRend(fondo.id); ok('abrir la vista para imprimir no rompe', true);

console.log('\n--- 6. DOS PERSONAS A LA VEZ ---');
DB = dbVacia(); sembrarChico();
const py2 = getPy(), pr2 = getPr(), d2 = pr2.usuarios.find(u => u.rol === 'asistprod');
const f2 = py2.cajas.find(cj => cj.responsable === d2.id);
f2.rendicion.estado = 'enviada';
const B = clon(PARTES_PY.gastos.lee(py2));
/* en la compu del jefe: comenta y la devuelve */
DB.ui.usuarioId = pr2.usuarios.find(u => u.rol === 'produccion').id;
global.prompt = () => 'Revisá el peaje';
devolverRend(f2.id); comentarRend(f2.id, 'Te la devuelvo por el peaje');
const S = clon(PARTES_PY.gastos.lee(py2));
/* en la compu del asistente (sobre la versión de antes): había comentado y arreglado un importe */
const L = clon(B);
const lf = L.cajas.find(c => c.id === f2.id);
lf.rendicion.charla.push({id: 'rm-diego', quienId: d2.id, quien: d2.nombre, rol: 'asistprod', cuando: hoy() + ' 10:00', texto: 'Mando el peaje que faltaba', gastoId: null});
const peaje = L.comprobantes.find(c => c.cajaId === f2.id && c.tipo === 'ticket' && c.importe === 3450); peaje.numero = '0003-00981299';
L.comprobantes.push({...clon(peaje), id: 'cp-nuevo', importe: 3450, numero: '0003-00981300'});
const M = fusionar3(B, L, S);
const mf = M.cajas.find(c => c.id === f2.id);
ok('queda la devolución del jefe', mf.rendicion.estado === 'observada' && mf.rendicion.pasos.some(x => x.a === 'observada'));
ok('quedan los comentarios de los dos', mf.rendicion.charla.some(m => m.id === 'rm-diego') && mf.rendicion.charla.some(m => /devuelvo por el peaje/.test(m.texto)), mf.rendicion.charla.length + ' comentarios');
ok('queda el número que corrigió el asistente', M.comprobantes.find(c => c.id === peaje.id).numero === '0003-00981299');
ok('y el gasto que sumó', M.comprobantes.some(c => c.id === 'cp-nuevo'));
ok('mientras "compras" no llegó a la base, las OC siguen viajando también en los gastos (no se pierde ninguna)', ocsEnGastos(py2) && PARTES_PY.gastos.lee(py2).ocs.length === py2.ocs.length);
SYNC[py2.id] = {compras: {v: 1, h: canon(PARTES_PY.compras.lee(py2))}};
ok('cuando ya está, las OC viajan sólo en "compras"', !('ocs' in PARTES_PY.gastos.lee(py2)) && PARTES_PY.compras.lee(py2).ocs.length === py2.ocs.length);
ok('el asistente no lee "compras"; el jefe sí', !puedeParte('compras', false, d2) && puedeParte('compras', true, pr2.usuarios.find(u => u.rol === 'produccion')));
ok('quien ve la plata adopta las OC que quedaron en "gastos" de antes', (() => {
  DB.ui.usuarioId = pr2.usuarios.find(u => u.rol === 'admin').id;
  const viejas = clon(py2.ocs); py2.ocs = [];
  PARTES_PY.gastos.pone(py2, {comprobantes: py2.comprobantes, cajas: py2.cajas, cheques: py2.cheques, ocs: viejas});
  return py2.ocs.length === viejas.length; })());

console.log('\n--- 7. LEER EL COMPROBANTE ---');
ok('CUIT: valida el dígito verificador', cuitValido('30-71234567-1') && cuitValido('20334445551') && !cuitValido('30-71234567-2') && !cuitValido('123'));
const qrJson = {ver: 1, fecha: '2026-09-28', cuit: 30712345671, ptoVta: 12, tipoCmp: 6, nroCmp: 4521, importe: 42000.5, moneda: 'PES', ctz: 1, tipoDocRec: 99, nroDocRec: 0, tipoCodAut: 'E', codAut: 76123456789012};
const qrUrl = 'https://www.afip.gob.ar/fe/qr/?p=' + Buffer.from(JSON.stringify(qrJson)).toString('base64');
let q = leerQrAfip(qrUrl);
ok('el QR de AFIP: fecha, CUIT, tipo, número e importe exactos', q && q.fecha === '2026-09-28' && q.cuit === '30-71234567-1' && q.tipo === 'facBC' && q.numero === '00012-00004521' && q.importe === 42000.5 && q.moneda === 'ARS', JSON.stringify(q));
q = leerQrAfip('https://www.afip.gob.ar/fe/qr/?p=' + encodeURIComponent(Buffer.from(JSON.stringify({...qrJson, tipoCmp: 1, moneda: 'DOL'})).toString('base64').replace(/=+$/, '')));
ok('también sin relleno, url-encoded, Factura A en dólares', q && q.tipo === 'facA' && q.moneda === 'USD');
ok('Factura C → B/C · tique → ticket · nota de crédito marcada', leerQrAfip(qrUrl.replace(/p=.*/, 'p=' + Buffer.from(JSON.stringify({...qrJson, tipoCmp: 11})).toString('base64'))).tipo === 'facBC'
  && TIPO_AFIP[83] === 'ticket' && leerQrAfip(qrUrl.replace(/p=.*/, 'p=' + Buffer.from(JSON.stringify({...qrJson, tipoCmp: 8})).toString('base64'))).notaCredito);
ok('un QR que no es de AFIP no se toma', leerQrAfip('https://example.com/?p=abc') === null && leerQrAfip('basura') === null);
const pdfTexto = `ORIGINAL
FACTURA
B
COD. 006
Razón Social: Ferretería del Centro (ejemplo)       Punto de Venta: 00002   Comp. Nro: 00001877
Domicilio Comercial: Av. Siempreviva 742            Fecha de Emisión: 29/09/2026
CUIT: 20334445551
Ingresos Brutos: 20334445551    Fecha de Inicio de Actividades: 01/03/2015
CUIT: 30709998885   Apellido y Nombre / Razón Social: Productora Demo
Subtotal: $ 18.500,00
Importe Otros Tributos: $ 0,00
Importe Total: $ 18.500,00
CAE N°: 76123456789012   Fecha de Vto. de CAE: 09/10/2026`;
let t = parsearTextoComprobante(pdfTexto, {excluirCuit: '30-70999888-5'});
ok('PDF digital: CUIT del que emite, fecha de emisión, Factura B, número y total', t.cuit === '20-33444555-1' && t.fecha === '2026-09-29' && t.tipo === 'facBC' && t.numero === '00002-00001877' && t.importe === 18500, JSON.stringify(t));
ok('y la razón social', t.proveedor === 'Ferretería del Centro (ejemplo)', t.proveedor);
const ocr = `PANADERIA LA ESPIGA
C.U.I.T. 30-71555666-5
TIQUE N° 0001-00045210
Fecha 28/09/26  Hora 08:12
2 x Medialunas      2.400,00
Cafe con leche x6  21.900,00
SUBTOTAL           24.3OO,00
T0TAL $            24.300,00
Consumidor Final`;
t = parsearTextoComprobante(ocr);
ok('foto de un ticket: tolera la O por 0, toma el TOTAL y no el subtotal', t.cuit === '30-71555666-5' && t.fecha === '2026-09-28' && t.tipo === 'ticket' && t.numero === '00001-00045210' && t.importe === 24300, JSON.stringify(t));
t = parsearTextoComprobante('Gracias por su compra\nTOTAL\n$ 1.234,50');
ok('el total en la línea de abajo', t.importe === 1234.5, t.importe);
ok('un CUIT con el dígito mal no se toma', parsearTextoComprobante('CUIT 30-71234567-2 TOTAL 100').cuit === '');
ok('sin la palabra total no inventa el importe', parsearTextoComprobante('Varios 1.500,00\nOtros 200').importe === 0);
['$ 12.345,67|12345.67', '12,345.67|12345.67', '1.234.567|1234567', '12,5|12.5', '1234|1234', '-1.000,00|-1000'].forEach(x => {
  const [a, b] = x.split('|'); if(parseImporte(a) !== +b) ok(`parseImporte("${a}")`, false, String(parseImporte(a))); });
ok('los importes en formato de acá y de afuera', true);
DB = dbVacia(); sembrarChico();
const py3 = getPy(), d3 = getPr().usuarios.find(u => u.rol === 'asistprod');
DB.ui.usuarioId = d3.id;
const f3 = py3.cajas.find(cj => cj.responsable === d3.id); f3.rendicion.estado = 'borrador';
const g = nuevoGastoRend(f3);
aplicarReconocido(g.id, {...leerQrAfip(qrUrl)});
ok('lo leído llena la fila y queda "a confirmar"', g.fecha === '2026-09-28' && g.importe === 42000.5 && (g.aConfirmar || []).includes('importe') && (g.aConfirmar || []).includes('fecha'), (g.aConfirmar || []).join(','));
ok('el CUIT conocido trae el proveedor y el rubro de la última vez', g.proveedor === 'Estación de servicio Ruta 2 (ejemplo)' && g.rubro === '12', g.proveedor + ' / ' + g.rubro);
upGastoRend(g.id, 'importe', '42000');
ok('corregir un campo lo saca de "a confirmar"', !(g.aConfirmar || []).includes('importe') && g.importe === 42000);
const g2 = nuevoGastoRend(f3); g2.importe = 999;
aplicarReconocido(g2.id, {importe: 5, fuente: 'foto'});
ok('lo que ya escribió alguien no se pisa', g2.importe === 999);
confirmarFilaRend(g.id); ok('confirmar la fila limpia lo amarillo', !g.aConfirmar);

console.log('\n--- 8. LOS ARCHIVOS: FOTOS DE TODO TIPO Y PDF ---');
global.FileReader = class { readAsDataURL(f){ this.result = `data:${f.type || 'application/octet-stream'};base64,` + Buffer.from(f._b || 'x').toString('base64'); setTimeout(() => this.onload(), 0); } };
const archivo = (name, type, size) => ({name, type, size, _b: '%PDF-1.4 ejemplo'});
achicarImagen = () => Promise.reject(new Error('El archivo no es una imagen que pueda abrir'));
let r = await leerAdjunto(archivo('factura.pdf', 'application/pdf', 30000));
ok('un PDF se guarda tal cual (antes: "no es una imagen")', r.adjunto && r.adjunto.tipo === 'application/pdf' && /^data:application\/pdf;base64,/.test(r.adjunto.dataUrl) && !r.aviso);
r = await leerAdjunto(archivo('IMG_0042.HEIC', 'image/heic', 400000));
ok('una foto HEIC del iPhone que el navegador no abre: se guarda el original', r.adjunto && r.adjunto.dataUrl && r.adjunto.nombre === 'IMG_0042.HEIC' && !r.aviso);
r = await leerAdjunto(archivo('escaneo.pdf', 'application/pdf', 9 * 1048576));
ok('uno que no entra: la fila igual, sin el archivo, y un aviso claro', r.adjunto && r.adjunto.sinArchivo && !r.adjunto.dataUrl && /no entra en el lugar que queda/.test(r.aviso), r.aviso);
/* el navegador abre JPG y PNG; HEIC en Windows, no */
achicarImagen = f => /heic/i.test(f.name) ? Promise.reject(new Error('no la abre')) : Promise.resolve({nombre: 'ticket.jpg', tipo: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,AAAA', bytes: 3, w: 10, h: 20});
r = await leerAdjunto(archivo('ticket.png', 'image/png', 900000));
ok('una foto que sí abre se achica, como siempre', r.adjunto.tipo === 'image/jpeg' && r.adjunto.w === 10);
ok('el comprobante acepta PDF y cualquier imagen, con botones aparte para la cámara', (() => {
  DB.ui.usuarioId = d3.id; cargarComprobante(); const m = modal; cerrar();
  return /accept="image\/\*,application\/pdf/.test(m) && /capture="environment"/.test(m) && /Subir archivo/.test(m) && /Sacar foto/.test(m); })());
reconocerComprobante = async () => {};
const antesN = totalesRend(py3, f3).cant;
await subirArchivosRend(f3.id, [archivo('a.pdf', 'application/pdf', 20000), archivo('b.HEIC', 'image/heic', 20000), archivo('c.jpg', 'image/jpeg', 20000)]);
ok('subir varios: una fila por archivo, en la rendición', totalesRend(py3, f3).cant === antesN + 3);
const vistos = totalesRend(py3, f3).comprobantes.slice(-3).map(c => miniAdj(c.adjunto));
ok('miniaturas: PDF con su ícono, la foto con la foto', /PDF/.test(vistos[0]) && /HEIC/.test(vistos[1]) && /<img/.test(vistos[2]), vistos.join(' | '));

console.log('\n--- 9. ÓRDENES DE COMPRA, COMPROBANTES AJENOS Y EL MENÚ DATOS ---');
DB = dbVacia(); sembrarChico();
const pr4 = getPr(), py4 = getPy(), oc = py4.ocs[0];
['equipo', 'arte', 'asistprod'].forEach(rol => {
  DB.ui.usuarioId = pr4.usuarios.find(u => u.rol === rol).id; modal = null;
  DB.ui.tab = 'gastos'; DB.ui.subGasto = 'oc'; render(); let hh = app.innerHTML;
  ok(`${ROL(rol).l}: sin la solapa de órdenes de compra ni su importe`, !/setSubGasto\('oc'\)/.test(hh) && !/editOC\(/.test(hh) && !hh.includes(fmt(oc.importe)));
  editOC(); ok(`${ROL(rol).l}: no crea órdenes de compra`, modal === null);
  const n0 = py4.ocs.length; delOC(oc.id); ok(`${ROL(rol).l}: no las borra`, py4.ocs.length === n0);
  DB.ui.subGasto = 'todos'; render(); hh = app.innerHTML;
  const ajenos = py4.comprobantes.filter(c => c.cargadoPor !== DB.ui.usuarioId);
  ok(`${ROL(rol).l}: no ve comprobantes ajenos ni sus totales`, !ajenos.some(c => c.proveedor && hh.includes(esc(c.proveedor))) && !hh.includes(fmt(448000)) && !hh.includes(fmt(300000)));
  cargarComprobante(); ok(`${ROL(rol).l}: al cargar un comprobante no le ofrece OC`, !/Contra qué orden de compra/.test(modal || '')); modal = null;
  DB.ui.subGasto = 'rend'; render(); hh = app.innerHTML;
  ok(`${ROL(rol).l}: no da fondos, no anota adelantos, no cierra`, !/editCaja\(/.test(hh) && !/addAdelanto\(/.test(hh) && !/rendirCaja\(/.test(hh));
  const cj = py4.cajas[0], n1 = cj.adelantos.length; addAdelanto(cj.id); saveAdelanto(cj.id);
  ok(`${ROL(rol).l}: un adelanto no entra`, cj.adelantos.length === n1 && modal === null);
  menuDatos(); const m = modal; modal = null;
  ok(`${ROL(rol).l}: el menú Datos sólo conecta (no exporta ni importa ni borra)`, /menuNube()/.test(m) && !/Supabase/.test(m) && !/expJSON\(\)/.test(m) && !/impJSON/.test(m) && !/resetDB\(\)/.test(m) && !/expCSV\(\)/.test(m));
  let bajo = 0; const _b = bajar; bajar = () => { bajo++; }; expJSON(); bajar = _b;
  ok(`${ROL(rol).l}: y "Exportar todo" no baja nada`, bajo === 0);
});
DB.ui.usuarioId = pr4.usuarios.find(u => u.rol === 'produccion').id; modal = null;
menuDatos(); let m = modal; modal = null;
ok('el jefe baja el presupuesto, pero no el respaldo completo (lleva el fee)', /expCSV\(\)/.test(m) && !/expJSON\(\)/.test(m) && !/resetDB\(\)/.test(m));
DB.ui.tab = 'gastos'; DB.ui.subGasto = 'oc'; render();
ok('el jefe sigue manejando las órdenes de compra', /editOC\(/.test(app.innerHTML) && app.innerHTML.includes(fmt(oc.importe)));
DB.ui.usuarioId = pr4.usuarios.find(u => u.rol === 'admin').id;
menuDatos(); m = modal; modal = null;
ok('Administración tiene todo: exportar, importar, borrar', /expJSON\(\)/.test(m) && /impJSON/.test(m) && /resetDB\(\)/.test(m) && /expCSV\(\)/.test(m));
DB.ui.subGasto = 'todos'; render();
ok('y ve todos los comprobantes', app.innerHTML.includes(fmt(448000)));

console.log('\n--- 10. EL FONDO SALE DEL PRESUPUESTO ---');
DB = dbVacia(); sembrarChico();
const pr5 = getPr(), py5 = getPy(), v5 = versionRodaje(py5);
const U5 = rol => pr5.usuarios.find(u => u.rol === rol);
const como5 = rol => { DB.ui.usuarioId = U5(rol).id; modal = null; };
const diego5 = U5('asistprod'), carla5 = U5('arte'), sofia5 = U5('equipo'), lucia5 = U5('produccion'), marta5 = U5('admin');
const formu = o => { global.document.querySelectorAll = sel => String(sel).includes('[name]') ? Object.entries(o).map(([name, value]) => ({name, value})) : []; };
const sinFormu = () => { global.document.querySelectorAll = () => []; };
const r03 = v5.rubros.find(r => r.codigo === '03');
/* el ejemplo ya trae la caja chica de producción en el 03 (como las vistas por rol), y el fondo de Diego sale de ahí */
const lcaja = r03.lineas.find(l => l.concepto === 'Caja chica de producción');
const fEj = py5.cajas.find(c => c.responsable === diego5.id);
ok('el ejemplo trae la caja chica de producción en el 03, de $ 300.000, con el fondo de Diego colgado',
  !!lcaja && totalLinea(lcaja, v5) === 300000 && fEj.lineaId === lcaja.id && fEj.adelantos.every(a => a.lineaId === lcaja.id) && fondosDeLinea(py5, lcaja.id).entregado === 150000);
/* para que las cuentas de esta sección arranquen de cero, el fondo de ejemplo se descuelga de la línea */
fEj.lineaId = null; fEj.adelantos.forEach(a => { delete a.lineaId; });
/* otro asistente de producción de la productora, que NO está en este proyecto */
const ana = nuevoUsuario({nombre: 'Ana Fuera (ejemplo)', rol: 'asistprod'}); pr5.usuarios.push(ana);
como5('produccion');
ok('la caja chica es una línea de fondos; las demás no', esLineaFondo(lcaja) && !esLineaFondo(r03.lineas[0]) && lineasFondo(py5).length === 1);
const P0 = resumenPlata(py5, v5), f0 = P0.filas.find(f => f.codigo === '03'), f12_0 = P0.filas.find(f => f.codigo === '12');
DB.ui.tab = 'presu'; DB.ui.vista = 'interna'; render(); h = app.innerHTML;
ok('en el presupuesto, la línea de caja chica tiene 💵 Dar fondo (y ninguna otra)', h.includes(`darFondo('${lcaja.id}')`) && (h.match(/darFondo\('/g) || []).length === 1);
darFondo(lcaja.id); let m5 = modal;
ok('el diálogo pide cuánto, la fecha y a quién', /name="monto"/.test(m5) && /name="fecha"/.test(m5) && /name="persona"/.test(m5));
ok('y no cómo se entrega (efectivo o transferencia): sólo el monto', !/name="circuito"/.test(m5) && !/Cómo se entrega|efectivo|transferencia/i.test(m5));
const selPersona = m5.split('name="persona"')[1].split('</select>')[0];
ok('A quién: los asistentes de producción del proyecto y, abajo, los de arte', /Asistentes de producción[\s\S]*Diego Sosa[\s\S]*Asistentes de arte[\s\S]*Carla Méndez/.test(selPersona));
ok('nadie más: ni el equipo, ni el jefe, ni quien no está en el proyecto', !/Sofía|Lucía|Marta|Tomás|Paula|Ana Fuera/.test(selPersona), selPersona.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
ok('la línea viene elegida', new RegExp(`value="${lcaja.id}" selected`).test(m5));
/* otro proyecto, otra gente: el dropdown es por proyecto */
const pyOtro = nuevoProyecto({nombre: 'Otro proyecto (ejemplo)'}); pyOtro.invitados = [lucia5.id, carla5.id];
ok('en otro proyecto, sólo los asistentes de ese proyecto', (() => { const A = asistentesParaFondo(pyOtro, pr5); return A.prod.length === 0 && A.arte.length === 1 && A.arte[0].id === carla5.id; })());
formu({lineaId: lcaja.id, persona: diego5.id, monto: '100000', fecha: hoy(), nota: 'Para la jornada 1'});
guardarFondo(''); sinFormu();
const fd5 = py5.cajas.find(c => c.lineaId === lcaja.id && c.responsable === diego5.id);
ok('le abre un fondo a Diego, colgado de la línea', fd5 && fd5.adelantos.length === 1 && fd5.adelantos[0].lineaId === lcaja.id && fd5.adelantos[0].importe === 100000 && estadoRend(fd5) === 'borrador');
formu({lineaId: lcaja.id, persona: diego5.id, monto: '50000', fecha: hoy(), nota: ''});
guardarFondo(''); sinFormu();
ok('si ya tiene uno abierto de esa línea, se le suma (no abre otro)', py5.cajas.filter(c => c.lineaId === lcaja.id && c.responsable === diego5.id).length === 1 && saldoCaja(py5, fd5).entregado === 150000);
ok('la entrega guarda el monto, la fecha y quién la dio (no cómo)', fd5.adelantos.every(a => !('circuito' in a)) && fd5.adelantos[1].fecha === hoy() && fd5.adelantos[1].entregadoPor === lucia5.id);
formu({lineaId: lcaja.id, persona: carla5.id, monto: '60000', fecha: hoy(), nota: ''});
guardarFondo(''); sinFormu();
const fc5 = py5.cajas.find(c => c.lineaId === lcaja.id && c.responsable === carla5.id);
formu({lineaId: lcaja.id, persona: sofia5.id, monto: '1000', fecha: hoy(), nota: ''});
guardarFondo(''); sinFormu();
ok('a alguien que no es asistente no se le da (aunque fuerce el formulario)', !py5.cajas.some(c => c.lineaId === lcaja.id && c.responsable === sofia5.id));
let FL = fondosDeLinea(py5, lcaja.id);
ok('la línea suma: $ 210.000 a 2 personas', FL.entregado === 210000 && FL.personas.length === 2, fmt(FL.entregado));
render(); h = app.innerHTML;
ok('y lo muestra en el presupuesto, con la lista', /Fondos entregados/.test(h) && h.includes(fmt(210000)) && /2 personas/.test(h) && h.includes(`abrirRend('${fd5.id}')`) && h.includes(`abrirRend('${fc5.id}')`));
let P1 = resumenPlata(py5, v5), f1 = P1.filas.find(f => f.codigo === '03');
ok('en el tablero, lo entregado queda comprometido hasta que se rinda', f1.comp - f0.comp === 210000 && f1.real === f0.real, fmt(f1.comp - f0.comp));
como5('asistprod');
const tk5 = nuevoGastoRend(fd5, {fecha: hoy(), proveedor: 'Estación de prueba', rubro: '12', tipo: 'ticket', importe: 40000, concepto: 'Nafta'});
P1 = resumenPlata(py5, v5); f1 = P1.filas.find(f => f.codigo === '03');
const f12 = P1.filas.find(f => f.codigo === '12');
ok('lo rendido pasa de comprometido a real, en la línea del fondo', f1.comp - f0.comp === 170000 && f1.real - f0.real === 40000);
ok('y el ticket no se cuenta dos veces en su rubro', f12.real === f12_0.real);
ok('el "Actual" de la línea es lo rendido', realPorLinea(py5, v5).porLinea[lcaja.id] === 40000);
ok('el asistente ve su plata (la que le dieron), no la del presupuesto', (() => { DB.ui.tab = 'gastos'; DB.ui.subGasto = 'rend'; DB.ui.rendId = null; render(); const hh = app.innerHTML;
  return hh.includes(fmt(150000)) && !hh.includes(fmt(300000)) && !/darFondo\(/.test(hh); })());
darFondo(lcaja.id); ok('y no da fondos', modal === null);
como5('arte'); darFondo(lcaja.id); ok('arte tampoco', modal === null);
como5('produccion'); DB.ui.tab = 'gastos'; DB.ui.subGasto = 'rend'; DB.ui.rendId = null; render(); h = app.innerHTML;
ok('en Rendiciones, el jefe tiene el atajo, que abre el mismo diálogo', h.includes('darFondo()') && !h.includes('editCaja()'));
darFondo(); ok('con la línea de caja chica elegida', modal && new RegExp(`value="${lcaja.id}" selected`).test(modal) && /guardarFondo\(/.test(modal));
editCaja(); ok('el "dar un fondo" de antes lleva al mismo lugar', modal && /Dar un fondo para rendir/.test(modal) && /guardarFondo\(/.test(modal));
addAdelanto(fd5.id); ok('"+ Más plata" también: suma a ese fondo, desde su línea', modal && /Más plata para Diego/.test(modal) && /guardarFondo\('/.test(modal) && modal.includes(fd5.id)); modal = null;
cargarComprobante(); ok('al cargar un retiro, se puede marcar como fondo de producción', /name="esFondo"/.test(modal) && /fondo de producción/.test(modal)); modal = null;
formu({esFondo: 'si', importe: '25000', fecha: hoy(), lineaId: lcaja.id, concepto: 'Retiro del banco', rubro: '03'});
const nCbtes = py5.comprobantes.length;
saveComprobante(''); sinFormu();
ok('y en vez de un gasto, abre "Dar fondo" con el monto', py5.comprobantes.length === nCbtes && modal && /name="monto" value="25000"/.test(modal) && /Dar un fondo para rendir/.test(modal)); modal = null;
/* una línea cualquiera, marcada como fondo desde el diálogo */
const lAsist = r03.lineas.find(l => l.concepto === 'Asistente de Producción');
formu({lineaId: lAsist.id, persona: carla5.id, monto: '5000', fecha: hoy(), nota: ''});
guardarFondo(''); sinFormu();
ok('el jefe puede usar otra línea: queda marcada como fondo', lAsist.fondo === true && esLineaFondo(lAsist) && py5.cajas.some(c => c.lineaId === lAsist.id && c.responsable === carla5.id));
ok('deshacer lo vuelve atrás (y la línea deja de ser de fondos)', (toastAccion(), !esLineaFondo(lAsist) && !py5.cajas.some(c => c.lineaId === lAsist.id)));
/* sin línea de fondos: la crea */
DB = dbVacia(); sembrarChico(); DB.ui.usuarioId = getPr().usuarios.find(u => u.rol === 'produccion').id; modal = null;
(() => { const r = versionRodaje(getPy()).rubros.find(x => x.codigo === '03'); r.lineas = r.lineas.filter(l => !esLineaFondo(l)); getPy().cajas.forEach(c => { c.lineaId = null; }); })();
darFondo(); ok('si el presupuesto no tiene caja chica, la ofrece agregar', modal && /value="__nueva" selected/.test(modal)); modal = null;
formu({lineaId: '__nueva', persona: getPr().usuarios.find(u => u.rol === 'asistprod').id, monto: '20000', fecha: hoy()});
guardarFondo(''); sinFormu();
ok('y al dar el fondo la agrega en el 03 y cuelga el fondo de ahí', (() => { const l = lineasFondo(getPy())[0]; return l && l.r.codigo === '03' && /Caja chica/.test(l.l.concepto) && getPy().cajas.some(c => c.lineaId === l.l.id); })());

console.log('\n--- 11. AL CERRAR: LO QUE DEVUELVE ---');
DB = dbVacia(); sembrarChico();
/* volvemos al proyecto de la sección 10 */
DB.productoras = [pr5]; DB.ui.productoraId = pr5.id; DB.ui.proyectoId = py5.id; DB.ui.versionId = v5.id;
como5('asistprod'); enviarRend(fd5.id);
ok('Diego (asistente de producción) la manda directo al jefe', estadoRend(fd5) === 'enviada');
como5('produccion'); elevarRend(fd5.id); ok('el jefe la eleva', estadoRend(fd5) === 'aprobada');
como5('admin'); rendirCaja(fd5.id); m5 = modal;
ok('al cerrar: "Le sobró $ 110.000: lo devuelve", con el monto puesto', /Le sobró <b>\$ 110\.000<\/b>: lo devuelve/.test(m5) && /name="monto" value="110000"/.test(m5), (m5 || '').match(/Le sobró[^.]*/)?.[0]);
ok('con la fecha, sin preguntar cómo lo devolvió', /name="fecha"/.test(m5) && !/name="circuito"/.test(m5) && !/Cómo lo devolvió/.test(m5));
formu({monto: '100000', fecha: '2026-10-02', notas: ''});
confirmarRendicion(fd5.id); sinFormu();
ok('el cierre anota cuánto devolvió, cuándo y quién (no cómo)', fd5.cierre && fd5.cierre.devuelto === 100000 && fd5.devuelto === 100000 && fd5.cierre.fecha === '2026-10-02' && !('circuito' in fd5.cierre) && fd5.cierre.quien === marta5.nombre, JSON.stringify(fd5.cierre));
ok('devolvió menos de lo que le sobraba: faltan $ 10.000', faltanteRend(py5, fd5) === 10000);
P1 = resumenPlata(py5, v5); f1 = P1.filas.find(f => f.codigo === '03');
ok('lo devuelto no es gasto: queda gastado lo entregado menos lo devuelto', f1.real - f0.real === 150000 - 100000, fmt(f1.real - f0.real));
ok('y deja de estar comprometido (queda el fondo de Carla)', f1.comp - f0.comp === 60000, fmt(f1.comp - f0.comp));
ok('la línea del presupuesto también', realPorLinea(py5, v5).porLinea[lcaja.id] === 50000 && fondosDeLinea(py5, lcaja.id).devuelto === 100000);
ok('el tablero lo cuenta como pagado', f1.pagado - f0.pagado === 50000);
DB.ui.tab = 'presu'; render(); ok('en el presupuesto: "devolvieron"', /devolvieron/.test(app.innerHTML) && app.innerHTML.includes(fmt(100000)));
abrirRend(fd5.id); h = app.innerHTML;
ok('en la rendición se ve la devolución (sin el medio)', /Devolvió \$ 100\.000 el 02\/10\/2026/.test(h) && !/transferencia|en efectivo/i.test(h) && /lo anotó Marta Giles/.test(h) && /Faltan \$ 10\.000/.test(h));
DB.ui.rendId = null; render(); h = app.innerHTML;
ok('y en la lista de todas (sin el medio)', /Devuelto/.test(h) && /Devolvió \$ 100\.000</.test(h) && h.includes('02/10/2026') && !/transferencia/i.test(h));
const car5 = hojasRendicion(py5, fd5)[0].filas.map(f => f.map(c => c && typeof c === 'object' ? (c.v ?? c.fecha ?? '') : c).join(' | ')).join('\n');
ok('en la carátula del Excel: devolvió, cuándo, y lo gastado de verdad (sin el medio)', /^Devolvió \| 100000 \| 2026-10-02$/m.test(car5) && !/Transferencia|Efectivo/i.test(car5) && /Gastado de verdad \| 50000/.test(car5) && /Faltante \(no volvió\) \| 10000/.test(car5), car5.split('\n').filter(l => /Devol|Gastado|Falt/.test(l)).join(' / '));
const imp5 = rendImpresionHTML(py5, fd5);
ok('y en la del PDF', /Devolvió · 02\/10\/2026</.test(imp5) && !/transferencia|efectivo/i.test(imp5) && imp5.includes(fmt(100000)) && /gastado de verdad/.test(imp5));
/* gastó de más: se le reintegra */
como5('produccion');
formu({lineaId: lcaja.id, persona: diego5.id, monto: '10000', fecha: hoy()}); guardarFondo(''); sinFormu();
const fd6 = py5.cajas.find(c => c.lineaId === lcaja.id && c.responsable === diego5.id && c.id !== fd5.id);
ok('como el anterior ya se cerró, le abre otro fondo', !!fd6 && fd6 !== fd5);
como5('asistprod'); nuevoGastoRend(fd6, {fecha: hoy(), proveedor: 'Remís de prueba', rubro: '12', tipo: 'reciboS', importe: 15000, concepto: 'Traslado'});
enviarRend(fd6.id); como5('produccion'); elevarRend(fd6.id); como5('admin'); rendirCaja(fd6.id);
ok('si gastó de más: "Gastó $ 5.000 de más: hay que reintegrárselo"', /Gastó <b>\$ 5\.000<\/b> de más: hay que reintegrárselo/.test(modal) && /Cuánto se le reintegra/.test(modal));
formu({monto: '5000', fecha: hoy(), notas: ''}); confirmarRendicion(fd6.id); sinFormu();
ok('el reintegro queda anotado y es gasto', fd6.reintegro === 5000 && plataFondo(py5, fd6).real === 15000 && !faltanteRend(py5, fd6));

console.log('\n--- 12. ARTE PASA POR PRODUCCIÓN ---');
como5('arte'); abrirRend(fc5.id); h = app.innerHTML;
ok('Carla la manda "a producción", no al jefe', /Mandar a producción/.test(h) && !/Mandar al jefe/.test(h));
nuevoGastoRend(fc5, {fecha: hoy(), proveedor: 'Pinturería de prueba', rubro: '06', tipo: 'ticket', importe: 22000, concepto: 'Pintura'});
enviarRend(fc5.id);
ok('queda "En producción"', estadoRend(fc5) === 'aProduccion' && EST_REND.aProduccion.l === 'En producción');
como5('admin');
ok('Administración no la recibe: ni en su bandeja ni en sus pendientes', !esperaDe(fc5) && (setTab('resumen'), !app.innerHTML.includes(`abrirRend('${fc5.id}')`)));
elevarRend(fc5.id); rendirCaja(fc5.id);
ok('ni la puede elevar ni cerrar', estadoRend(fc5) === 'aProduccion' && modal === null);
como5('ejecutivo'); elevarRend(fc5.id); ok('el PE tampoco la eleva (es del jefe)', estadoRend(fc5) === 'aProduccion');
como5('asistprod'); setTab('resumen'); h = app.innerHTML;
ok('el asistente de producción la tiene en su panel: "Rendiciones de arte para revisar"', /Rendiciones de arte para revisar/.test(h) && h.includes(`abrirRend('${fc5.id}')`) && h.includes('Carla Méndez'));
DB.ui.tab = 'gastos'; DB.ui.subGasto = 'rend'; DB.ui.rendId = null; render(); h = app.innerHTML;
ok('y en Gastos → Rendiciones, arriba de las suyas', /Rendiciones de arte para revisar/.test(h) && /Mis rendiciones/.test(h) && h.indexOf('Rendiciones de arte') < h.indexOf('Mis rendiciones'));
abrirRend(fc5.id); h = app.innerHTML;
ok('la abre: puede pasársela al jefe o devolverla, no elevarla', /pasarJefeRend\('/.test(h) && /devolverRend\('/.test(h) && !/elevarRend\('/.test(h) && !/upGastoRend\(/.test(h));
ok('ve los montos de la rendición (no los del presupuesto)', h.includes(fmt(60000)) && h.includes(fmt(22000)) && !h.includes(fmt(300000)));
comentarRend(fc5.id, 'Falta el ticket de la cinta');
global.prompt = () => 'Sumá el ticket de la cinta';
devolverRend(fc5.id);
ok('se la devuelve a Carla con un comentario', estadoRend(fc5) === 'observada' && firmaRend(fc5, 'observada').quien === diego5.nombre);
como5('arte'); enviarRend(fc5.id); ok('Carla corrige y la reenvía a producción', estadoRend(fc5) === 'aProduccion');
como5('asistprod'); elevarRend(fc5.id); ok('el asistente no la eleva', estadoRend(fc5) === 'aProduccion');
pasarJefeRend(fc5.id);
ok('"Pasar al jefe": queda enviada, firmada por Diego', estadoRend(fc5) === 'enviada' && firmaProd(fc5).quien === diego5.nombre);
como5('admin'); ok('Administración sigue sin recibirla', !esperaDe(fc5)); elevarRend(fc5.id); ok('ni la eleva', estadoRend(fc5) === 'enviada');
como5('produccion'); setTab('resumen');
ok('el jefe la tiene para revisar', esperaDe(fc5) && app.innerHTML.includes(`abrirRend('${fc5.id}')`));
abrirRend(fc5.id); ok('y ve quién de producción se la pasó', /Diego Sosa la revisó y te la pasó/.test(app.innerHTML));
elevarRend(fc5.id); ok('el jefe la eleva', estadoRend(fc5) === 'aprobada');
como5('admin'); ok('recién ahí le llega a Administración', esperaDe(fc5));
rendirCaja(fc5.id); formu({monto: String(saldoCaja(py5, fc5).saldo), fecha: hoy(), notas: ''}); confirmarRendicion(fc5.id); sinFormu();
ok('y la cierra con la devolución', estadoRend(fc5) === 'cerrada' && fc5.devuelto === 60000 - 22000);
const car6 = hojasRendicion(py5, fc5)[0].filas.map(f => f.map(c => c && typeof c === 'object' ? (c.v ?? '') : c).join(' | ')).join('\n');
ok('las firmas: rindió Carla, revisó Diego (producción), revisó el jefe, recibió Administración', /Rindió \| Carla Méndez/.test(car6) && /Revisó \(asistente de producción\) \| Diego Sosa/.test(car6) && /Revisó \(jefe de producción\) \| Lucía Ferrer/.test(car6) && /Recibió \(administración\) \| Marta Giles/.test(car6));
ok('en el PDF, cuatro firmas', (rendImpresionHTML(py5, fc5).match(/class="ri-firma"/g) || []).length === 4);
/* mientras está en producción, el jefe la ve pero no la toca: primero el asistente */
como5('produccion'); formu({lineaId: lcaja.id, persona: carla5.id, monto: '8000', fecha: hoy()}); guardarFondo(''); sinFormu();
const fc6 = py5.cajas.find(c => c.responsable === carla5.id && estadoRend(c) === 'borrador' && c.lineaId === lcaja.id);
como5('arte'); nuevoGastoRend(fc6, {fecha: hoy(), proveedor: 'Kiosco de prueba', rubro: '06', tipo: 'ticket', importe: 3000, concepto: 'Cinta'}); enviarRend(fc6.id);
como5('produccion'); abrirRend(fc6.id); h = app.innerHTML;
ok('el jefe la ve en producción (con sus gastos), pero sin botones: primero la chequea el asistente', h.includes(fmt(3000)) && !/elevarRend\('/.test(h) && !/devolverRend\('/.test(h) && /primero la chequea el asistente de producción/.test(h) && !esperaDe(fc6));
elevarRend(fc6.id); global.prompt = () => 'no'; devolverRend(fc6.id);
ok('y no la puede elevar ni devolver salteándolo', estadoRend(fc6) === 'aProduccion');
/* si el proyecto no tiene asistente de producción, el jefe la toma directo */
py5.invitados = py5.invitados.filter(id => id !== diego5.id);
abrirRend(fc6.id);
ok('sin asistente de producción en el proyecto, el jefe la revisa directo y la eleva', !hayAsistProd(py5) && esperaDe(fc6) && /elevarRend\('/.test(app.innerHTML) && /no tiene asistente de producción/.test(app.innerHTML) && (elevarRend(fc6.id), estadoRend(fc6) === 'aprobada'));
py5.invitados.push(diego5.id);
/* un gasto suelto de arte */
const suelto = nuevoComprobante({rubro: '06', proveedor: 'Telas de prueba', importe: 9000, tipo: 'facBC', cargadoPor: carla5.id, estado: 'cargado',
  historial: [{de: null, a: 'cargado', accion: 'cargar', usuario: carla5.nombre, usuarioId: carla5.id, rol: 'arte', fecha: hoy(), nota: ''}]});
py5.comprobantes.push(suelto);
ok('un gasto suelto de arte: Administración y el PE no lo reciben', accionesDe(suelto, marta5).length === 0 && accionesDe(suelto, U5('ejecutivo')).length === 0);
ok('el asistente de producción se lo pasa al jefe (o lo devuelve)', accionesDe(suelto, diego5).join() === 'pasar,rechazar');
ok('el jefe lo ve, pero no lo revisa ni lo rechaza hasta que el asistente se lo pase', accionesDe(suelto, lucia5).length === 0);
como5('asistprod'); DB.ui.tab = 'gastos'; DB.ui.subGasto = 'bandeja'; render();
ok('le aparece en su bandeja', app.innerHTML.includes(`accionComprobante('${suelto.id}','pasar')`));
accionComprobante(suelto.id, 'pasar');
ok('"Pasar al jefe" lo deja visto por producción', suelto.vistoProd && suelto.vistoProd.quien === diego5.nombre && suelto.estado === 'cargado' && accionesDe(suelto, diego5).length === 0);
ok('y el jefe lo revisa', accionesDe(suelto, lucia5).includes('revisar'));

console.log('\n--- 13. LOS GASTOS DE LOS DEMÁS NO VIAJAN ---');
const sbFetchReal = sbFetch, llamadas = [];
sbFetch = async (ruta, o) => { llamadas.push(ruta);
  if(ruta.includes('rpc/leer_gastos')) return {version: 7, cambiado_nombre: 'Lucía', datos: {comprobantes: [{id: 'mio', cargadoPor: diego5.id}], cajas: [], cheques: []}};
  return [{parte: 'gastos', version: 7, datos: {comprobantes: [{id: 'ajeno'}, {id: 'mio'}]}}, {parte: 'tareas', version: 1, datos: {tareas: []}}]; };
como5('asistprod'); _leerGastos = null;
let filas5 = await sbPartes(py5.id, true);
ok('a un asistente, los gastos le llegan por leer_gastos (filtrados por la base)', llamadas.some(x => /rpc\/leer_gastos/.test(x)) && filas5.find(f => f.parte === 'gastos').filtrada === true && !JSON.stringify(filas5).includes('ajeno'));
ok('y no manda órdenes de compra', !('ocs' in PARTES_PY.gastos.lee(py5)));
como5('produccion'); llamadas.length = 0;
filas5 = await sbPartes(py5.id, true);
ok('al jefe le llegan enteros, de la tabla', !llamadas.some(x => /leer_gastos/.test(x)) && JSON.stringify(filas5).includes('ajeno'));
sbFetch = async ruta => { if(ruta.includes('leer_gastos')) { const e = new Error('No encontré eso en el servidor.'); e.status = 404; throw e; }
  return [{parte: 'gastos', version: 3, datos: {comprobantes: []}}]; };
como5('asistprod'); _leerGastos = null;
filas5 = await sbPartes(py5.id, true);
ok('con la base vieja (sin el SQL nuevo), se lee como antes', filas5.length === 1 && !filas5[0].filtrada && _leerGastos === false);
sbFetch = sbFetchReal; _leerGastos = null;

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
})().catch(e => { console.log('FALLA error: ' + e.stack); });
