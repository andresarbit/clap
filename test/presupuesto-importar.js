/* Importar un presupuesto en Excel.
   ---------------------------------------------------------------------------
   Pedido: en el presupuesto, un botón para subir un Excel de un presupuesto
   y que lo transcriba a la aplicación.

   El lector se armó y se probó contra 48 presupuestos reales de la casa (que
   no van al repo: tienen clientes y montos). Esta prueba usa uno inventado
   con las mismas trampas: carátula AICP con subtotales y capas, dos pisos
   de títulos (ESTIMADO | REAL), tarifas de referencia sin usar.           */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const fs = require('fs'), path = require('path');

console.log('--- 1. NÚMEROS Y CUENTAS ---');
ok('números de acá y de afuera', numeroDeCelda('1.234,50') === 1234.5 && numeroDeCelda('1,234.50') === 1234.5 && numeroDeCelda('48433.69') === 48433.69 && numeroDeCelda('$ 2.500') === 2500 && numeroDeCelda(12) === 12);
ok('un texto no es número', numeroDeCelda('A1') === null && numeroDeCelda('Director') === null);
const c1 = leerNumerosLinea([1, 2, 50000, 100000, 0, 0]);
ok('cantidad × días × valor = total', c1.cantidad === 1 && c1.dias === 2 && c1.valor === 50000 && c1.total === 100000);
const c2 = leerNumerosLinea([4, 4955, 12, 0, 0, 19820, 19820]);
ok('días × valor = total, salteando las horas', c2.dias === 4 && c2.valor === 4955 && c2.total === 19820);
ok('sin cuenta: el número suelto es el total (y se marca)', leerNumerosLinea([3500]).total === 3500 && leerNumerosLinea([3500]).sinCuenta);

console.log('\n--- 2. EL RUBRO DE CADA LÍNEA ---');
const r = t => rubroDeConcepto(t);
ok('puestos: producción, foto, eléctrica, dirección', r('Jefe de Producción') === '03' && r('Asist. cámara') === '04' && r('Op Hd') === '04' && r('gafer') === '05' && r('2do De Dirección') === '02');
ok('vestuario y maquillaje', r('Vestuarista') === '07' && r('Maquillaje y peinado') === '07' && r('Wardrobe Rental') === '07');
ok('alquileres', r('Cámara') === '11' && r('Lighting Rental') === '11' && r('Red One Mysterium x - Ultraprime') === '11');
ok('el camión de luces es equipamiento; las vans, transporte', r('Camión de luces y grip') === '11' && r('Vans') === '12');
ok('catering, permisos, seguridad, oficina', r('ALL MEALS: No. people x $/day x days') === '13' && r('Permits') === '10' && r('Security on Location') === '16' && r('Petty Cash') === '17');
ok('"Art Trucks" no es la ART (seguros)', r('Other Vehicles / Prod. & Art Trucks') !== '15');
ok('elenco', r('Actriz principal') === '09' && r('General Extras') === '09');

(async () => {
  console.log('\n--- 3. EL ARCHIVO ---');
  const H = await xlsxHojas(new Uint8Array(fs.readFileSync(path.join(__dirname, 'fixtures', 'presupuesto-prueba.xlsx'))));
  const L = lineasDePresupuesto(H);
  const de = c => L.find(x => x.concepto === c);
  const suma = L.reduce((s, x) => s + x.total, 0);
  ok('13 líneas presupuestadas', L.length === 13, L.map(x => x.concepto).join(' | '));
  ok('el total leído es el del detalle: 1.370.000', suma === 1370000, suma);
  ok('la carátula (subtotales por categoría, mark up, IVA) no entra', !L.some(x => /Costos de|Trabajo del|Mark Up|IVA|Sub-Total/i.test(x.concepto)));
  ok('las tarifas sin usar (cantidad 0, total 0) no entran', !de('Runner') && !de('Grúa'));
  ok('la columna REAL no se suma', de('Jefe de Producción').total === 150000);
  ok('cantidad, días y valor de sus columnas', de('Catering').cantidad === 30 && de('Catering').dias === 2 && de('Catering').valor === 2500);
  ok('cada una con su rubro', de('Jefe de Producción').rubro === '03' && de('Director de Fotografía').rubro === '04' && de('Gaffer').rubro === '05' &&
    de('Cámara').rubro === '11' && de('Vans').rubro === '12' && de('Catering').rubro === '13' && de('Actriz principal').rubro === '09', JSON.stringify(L.map(x => x.concepto + ':' + x.rubro)));
  ok('la sección de donde viene', de('Gaffer').seccion === 'Rodaje');
  const ref = subtotalDelArchivo(H)[0];
  ok('el total del archivo para comparar: costos directos', ref && ref.n === 1370000 && /Direct/.test(ref.rot), JSON.stringify(ref));

  console.log('\n--- 4. CARGARLO AL PRESUPUESTO ---');
  DB = dbVacia(); sembrar();
  const pr = getPr();
  const py = nuevoProyecto({nombre: 'Spot Importado', tipo: 'publicidad'}); pr.proyectos.push(py);
  DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;
  const v = getV();
  DB.ui.tab = 'presu'; render();
  ok('el presupuesto vacío ofrece importar un Excel', /importarPresupuesto\(\)/.test(app.innerHTML) && /Importar un presupuesto en Excel/.test(app.innerHTML));
  importarPresupuesto(); ok('la ventana para soltar el archivo abre', /Soltá el Excel acá/.test(modal));
  revisarPresupuestoImportado(L, 'presupuesto-prueba.xlsx', ref);
  ok('la revisión muestra total leído y el del archivo al 100%', /total leído/.test(modal) && /100%/.test(modal) && /coincide con el del archivo/.test(modal));
  ok('agrupado por rubro', /Equipo de Producción/.test(modal) && /Fotografía y Cámara/.test(modal));
  _impP.lineas.find(x => x.concepto === 'Vans').incluir = false;
  confirmarImportarPresupuesto();
  const lineas = v.rubros.flatMap(rb => rb.lineas.map(l => ({...l, rb: rb.codigo})));
  ok('se cargaron 12 (una destildada)', lineas.length === 12, lineas.length);
  const jp = lineas.find(l => l.concepto === 'Jefe de Producción');
  ok('con cantidad, días y valor', jp && jp.rb === '03' && jp.cantidad === 1 && jp.dias === 5 && jp.valorUnit === 30000);
  ok('anotada de dónde salió', /Importado de presupuesto-prueba\.xlsx/.test(jp.notas));
  const R0 = calcular(v);
  ok('el subtotal de CLAP es el del archivo menos lo destildado', Math.round(R0.subtotalLineas) === 1370000 - 48000, R0.subtotalLineas);
  /* reemplazar */
  revisarPresupuestoImportado(L, 'presupuesto-prueba.xlsx', ref);
  _impP.modo = 'reemplazar';
  global.document.querySelectorAll = q => /toast/.test(q) ? [] : [{name: 'modo', value: 'reemplazar'}, {name: 'moneda', value: 'ARS'}];
  global.confirm = () => true;
  confirmarImportarPresupuesto();
  global.document.querySelectorAll = () => [];
  ok('reemplazar deja sólo las del archivo', v.rubros.flatMap(rb => rb.lineas).length === 13);
  /* sin rubro: no deja cargar */
  revisarPresupuestoImportado([{concepto: 'Cosa rara', cantidad: 1, dias: 1, valor: 100, total: 100, rubro: null, seccion: ''}], 'x.xlsx', null);
  const antes = v.rubros.flatMap(rb => rb.lineas).length;
  confirmarImportarPresupuesto();
  ok('una línea sin rubro no se carga hasta que se elija', v.rubros.flatMap(rb => rb.lineas).length === antes && !!_impP);

  console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
})().catch(e => { console.log('FALLA excepción: ' + e.stack); console.log('\n>>> 1 FALLA(S)'); });
