/* «No salió» guarda todo (nada se borra) y deja bajar la cotización: un
   Excel (.xlsx, el mismo armador que las rendiciones) con un Resumen que
   compara la base y los ejercicios con lo que cambia, una hoja por versión
   (rubros, líneas, subtotales como fórmulas, totales con el fee) y el
   desglose; y la cotización de la elegida para imprimir o pasar a PDF.
   Sólo el PE y Administración. Con el ejemplo de la app (Cumbre).
   Uso: node test/run.js test/cotizacion-bajar.js                             */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
global.confirm = () => true;

(async () => {
DB = dbVacia(); sembrar();
const pr = getPr(), py = pr.proyectos[1];
const U = r => pr.usuarios.find(u => u.rol === r);
const como = r => { DB.ui.usuarioId = U(r).id; modal = null; };
DB.ui.proyectoId = py.id;
como('ejecutivo');
/* los sugeridos, para que haya muchos ejercicios; y uno elegido */
generarSugeridos(py, {silencioso: true});
const e1 = familiaCotiz(py).find(v => v.nombre === '1 jornada con horas extra');
elegirEjercicio(e1.id);
const vs = familiaCotiz(py), base = baseDe(py);
const huella = () => JSON.stringify({vs: py.versiones.map(v => [v.id, v.nombre, calcular(v).total]), d: py.desglose.escenas.length, g: py.desglose.guion, eleg: py.elegidaId});
const antes = huella();

console.log('--- 1. NO SALIÓ: SE GUARDA TODO ---');
noSalio();
ok('la ventana ofrece bajar la cotización (tildado)', /name="bajar" checked/.test(modal) && /Bajar la cotización/.test(modal) && new RegExp(`los ${vs.length - 1} ejercicios`).test(modal));
const bajados = []; const bajarOrig = bajar; bajar = (nombre, contenido, tipo) => bajados.push({nombre, contenido, tipo});
confirmarNoSalio({motivo: 'Lo ganó otra productora (por precio)', bajar: true});
ok('queda «No salió» con el motivo', etapaDe(py) === 'nosalio' && py.noSalio.motivo === 'Lo ganó otra productora (por precio)');
ok('nada se borró: la base, los ejercicios, el desglose y la elegida', huella() === antes);
ok('al marcarlo se bajó el Excel', bajados.length === 1 && /^Cotizacion-Cumbre-Ruta-abierta-no-salio\.xlsx$/.test(bajados[0].nombre) && /spreadsheetml/.test(bajados[0].tipo), bajados[0] && bajados[0].nombre);
DB.ui.tab = 'resumen'; render();
let h = app.innerHTML;
ok('desde el resumen, cuando quieras: el Excel y el PDF de la elegida', /bajarCotizacion\(\)/.test(h) && /imprimirCotizacion\(\)/.test(h) && h.includes(`Cotización en PDF (${esc(e1.nombre)})`));
ok('dice que está guardado entero', /Queda guardado entero/.test(h) && /reabrirCotizacion\(\)/.test(h));
bajarCotizacion();
ok('«Bajar la cotización» otra vez', bajados.length === 2);
borrarEjercicio(vs[3].id);
ok('archivado no se borran ejercicios', py.versiones.includes(vs[3]));

console.log('\n--- 2. EL EXCEL ---');
const bytes = bajados[1].contenido;
const nombres = zipNombres(bytes);
ok('es un .xlsx de verdad', ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml'].every(x => nombres.includes(x)));
const wb = utf8(await zipEntrada(bytes, 'xl/workbook.xml'));
const hojas = [...wb.matchAll(/<sheet name="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'));
ok('un Resumen, una hoja por versión (la base y cada ejercicio) y el Desglose', hojas[0] === 'Resumen' && hojas[1] === 'Base' && hojas.length === vs.length + 2 && hojas[hojas.length - 1] === 'Desglose', hojas.join(' | '));
ok('los nombres de hoja entran en Excel (≤ 31, sin repetirse)', hojas.every(x => x.length <= 31) && new Set(hojas.map(x => x.toLowerCase())).size === hojas.length);
const leidas = await xlsxHojas(bytes);
const fila = (H, re) => H.filas.find(f => f && f.some(c => re.test(c || ''))) || [];
const R0 = leidas[0];
ok('el resumen: el proyecto, el cliente, que no salió y el motivo', fila(R0, /^Cliente$/)[1] === py.cliente && fila(R0, /^Etapa$/)[1] === 'No salió' && fila(R0, /^Motivo$/)[1] === 'Lo ganó otra productora (por precio)');
ok('…la que se presentó', fila(R0, /^La que se presentó$/)[1] === e1.nombre);
const enc = fila(R0, /^Contra la base$/);
ok('…la tabla que las compara: costo, fee, IVA, total, contra la base, jornadas, cámaras, lo que cambia y los avisos',
  ['Versión', 'Costo de producción', 'Fee', 'IVA', 'Total al cliente', 'Contra la base', 'Jornadas', 'Horas extra por jornada', 'Cámaras', 'Equipo técnico', 'Lo que cambia', 'Avisos'].every(t => enc.includes(t)), enc.join(' | '));
const col = t => enc.indexOf(t);
const filaDe = v => R0.filas.find(f => f && (f[0] === v.nombre || f[0] === v.nombre + ' (la que se presentó)'));
ok('…una fila por versión', vs.every(v => filaDe(v)));
const RB = calcular(base), RE = calcular(e1);
ok('…con los números (números de verdad, no texto)', Math.abs(+filaDe(base)[col('Total al cliente')] - RB.total) < 0.02 && Math.abs(+filaDe(e1)[col('Fee')] - RE.fee) < 0.02 && Math.abs(+filaDe(e1)[col('Costo de producción')] - (RE.subtotal + RE.contingencia)) < 0.02);
ok('…contra la base como porcentaje', Math.abs(+filaDe(e1)[col('Contra la base')] - Math.round((RE.total - RB.total) / RB.total * 1000) / 1000) < 1e-9 && /s="7"/.test(utf8(await zipEntrada(bytes, 'xl/worksheets/sheet1.xml'))));
ok('…lo que cambia, en palabras', filaDe(e1)[col('Lo que cambia')] === cambiosVsBase(py, e1).items.join(' · ') && filaDe(base)[col('Lo que cambia')] === 'Es la base');
const e4 = vs.find(v => v.nombre === '1 jornada con +4 h extra');
ok('…y los avisos (no entran las puestas con +4 h)', /No entran las puestas/.test(filaDe(e4)[col('Avisos')]));
ok('…la historia de la etapa', fila(R0, /^En cotización → No salió$/).length > 0);
const iE = vs.indexOf(e1) + 1, HE = leidas[iE];
ok('la hoja de un ejercicio: lo que cambia contra la base', fila(HE, /^Lo que cambia contra la base$/)[1] === cambiosVsBase(py, e1).items.join(' · '));
ok('…los rubros y sus líneas (las horas extra del convenio incluidas)', fila(HE, /^Dirección$/).length && fila(HE, /^Horas extra — Director de Fotografía$/).length && fila(HE, /^Director de Fotografía$/)[4] === '1');
const sh = utf8(await zipEntrada(bytes, `xl/worksheets/sheet${iE + 1}.xml`));
ok('…los subtotales son fórmulas', (sh.match(/<f>SUM\(H\d+:H\d+\)<\/f>/g) || []).length >= 10);
const T = t => +fila(HE, new RegExp('^' + t + '$'))[7];
ok('…y los totales: costo directo, contingencia, costo de producción, fee, IVA y total (con el margen)',
  Math.abs(T('Costo directo') - RE.subtotal) < 0.02 && Math.abs(T('Contingencia') - RE.contingencia) < 0.02 && Math.abs(T('Costo de producción') - (RE.subtotal + RE.contingencia)) < 0.02
  && Math.abs(T('Fee de producción \\(margen\\)') - RE.fee) < 0.02 && Math.abs(T('IVA') - RE.iva) < 0.02 && Math.abs(T('Total al cliente') - RE.total) < 0.02);
ok('…con las condiciones (el vehículo lo pone la marca)', fila(HE, /^No incluye$/).length && /lo provee el cliente/.test(fila(HE, /^No incluye$/)[1]));
const HD = leidas[leidas.length - 1];
ok('el desglose: las puestas, los bloques y lo detectado con su evidencia', fila(HD, /^Puestas$/)[1] === analizarDesglose(py).est.txt && fila(HD, /^RUTA$/).length && fila(HD, /^Dron$/).length && /dron/i.test(fila(HD, /^Dron$/)[3]));
const crcOk = (() => { const dv = new DataView(bytes.buffer); let p0 = 0, okk = true;
  while(dv.getUint32(p0, true) === 0x04034b50){ const tam = dv.getUint32(p0 + 18, true), nl = dv.getUint16(p0 + 26, true);
    if(crc32(bytes.subarray(p0 + 30 + nl, p0 + 30 + nl + tam)) !== dv.getUint32(p0 + 14, true)) okk = false; p0 += 30 + nl + tam; }
  return okk; })();
ok('cada parte con su CRC bien (Excel no la rechaza)', crcOk);
const txt = await xlsxATexto(bytes);
ok('la app lo vuelve a leer', /Cotización — Cumbre/.test(txt));

console.log('\n--- 3. EL PDF DE LA ELEGIDA ---');
let imprimio = 0; const printOrig = window.print; window.print = () => { imprimio++; };
const stOrig = setTimeout; global.setTimeout = f => { f(); return 0; };
imprimirCotizacion();
global.setTimeout = stOrig; window.print = printOrig;
ok('abre la cotización de la elegida y la manda a imprimir', DB.ui.tab === 'presu' && DB.ui.vista === 'cliente' && getV() === e1 && imprimio === 1);
ok('es la vista de la cotización (con el total de la elegida)', app.innerHTML.includes(fmt(RE.total, 'ARS')) && /resumen por rubro/.test(app.innerHTML));
DB.ui.vista = 'interna';

console.log('\n--- 4. SÓLO EL PE Y ADMINISTRACIÓN ---');
como('produccion');
const n0 = bajados.length; bajarCotizacion();
ok('el jefe no la baja (lleva el fee)', bajados.length === n0);
DB.ui.tab = 'resumen'; render();
ok('ni ve los botones', !/bajarCotizacion\(\)/.test(app.innerHTML) && !/imprimirCotizacion\(\)/.test(app.innerHTML));
como('admin');
bajarCotizacion();
ok('Administración sí', bajados.length === n0 + 1);

console.log('\n--- 5. REABRIR: TODO SIGUE AHÍ ---');
reabrirCotizacion();
ok('de vuelta en cotización, con todo', etapaDe(py) === 'cotizacion' && huella() === antes);
ok('y se puede bajar también mientras se cotiza (desde el resumen)', (() => { DB.ui.tab = 'resumen'; render(); return /bajarCotizacion\(\)/.test(app.innerHTML); })());
bajar = bajarOrig;

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
})();
