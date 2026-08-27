/* El tipo de cambio se escribe arriba, a mano, y recalcula todo.
   Es el número que más se toca: en una semana el dólar se mueve tres veces y
   hay que reexpresar el presupuesto entero. Antes vivía escondido adentro del
   modal de Versión. */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

DB = dbVacia(); sembrar();
DB.ui.tab = 'presu'; DB.ui.vista = 'interna';
const v = getV();

console.log('--- 1. ESTA ARRIBA Y SE PUEDE ESCRIBIR ---');
render();
let p = app.innerHTML;
ok('la caja del TC está en la cabecera', /class="tcbox"/.test(p));
ok('el valor es un campo editable', /class="tcval"[^>]*value="1420"/.test(p));
ok('la cotización es un desplegable', /tcsel[\s\S]{0,400}?MEP/.test(p));
ok('están las cotizaciones que se usan',
  ['Oficial', 'MEP', 'CCL', 'Blue'].every(c => p.includes('>' + c + '<')));
ok('la fecha también se edita', /class="tcfec"[^>]*type="date"/.test(p));
ok('dice cuál es la moneda base', /Base ARS/.test(p));

console.log('\n--- 2. CAMBIARLO REEXPRESA EL PRESUPUESTO ---');
const antes = calcular(v).total;
const elenco = v.rubros.find(r => r.codigo === '09');
const buyout = elenco.lineas.find(l => l.moneda === 'USD');
const buyAntes = totalLinea(buyout, v);
ok('hay líneas en USD para reexpresar', !!buyout, buyout.valorUnit + ' USD');

upTC('tc', 1600);
ok('el TC quedó en 1600', n(getV().tc) === 1600, String(getV().tc));
const buyDespues = totalLinea(buyout, getV());
ok('la línea en USD subió sola', buyDespues === buyout.valorUnit * 1600, String(Math.round(buyDespues)));
ok('proporción exacta 1600/1420',
  Math.abs(buyDespues / buyAntes - 1600 / 1420) < 1e-9);
ok('el total del presupuesto subió', calcular(getV()).total > antes,
  Math.round(antes) + ' -> ' + Math.round(calcular(getV()).total));
ok('las líneas en ARS no se movieron',
  totalLinea(v.rubros.find(r => r.codigo === '13').lineas[0], getV()) === 448000);

console.log('\n--- 3. LA FECHA NO PUEDE QUEDAR MINTIENDO ---');
getV().tcFecha = '2020-01-01';
upTC('tc', 1700);
ok('un TC nuevo se sella con la fecha de hoy', getV().tcFecha === hoy(), getV().tcFecha);
getV().tcFecha = '2020-01-01';
upTC('tc', 1700);                                   /* mismo valor, no cambia */
ok('reescribir el mismo valor no toca la fecha', getV().tcFecha === '2020-01-01', getV().tcFecha);
upTC('tcFecha', '2026-08-20');
ok('la fecha se puede poner a mano', getV().tcFecha === '2026-08-20');

console.log('\n--- 4. UN CERO NO PUEDE VACIAR EL PRESUPUESTO ---');
const previo = n(getV().tc);
upTC('tc', 0);
ok('rechaza el cero', n(getV().tc) === previo, String(getV().tc));
upTC('tc', -5);
ok('rechaza un negativo', n(getV().tc) === previo, String(getV().tc));
upTC('tc', '');
ok('rechaza el campo vacío', n(getV().tc) === previo, String(getV().tc));
ok('el total sigue en pie', calcular(getV()).total > 0);

console.log('\n--- 5. LA COTIZACION ---');
upTC('tcNombre', 'CCL');
ok('se puede cambiar a CCL', getV().tcNombre === 'CCL');
render();
ok('y se ve elegida', /tcsel[\s\S]{0,400}?<option selected>CCL/.test(app.innerHTML)
  || /<option selected>CCL<\/option>/.test(app.innerHTML));

console.log('\n--- 6. AL CLIENTE NO SE LE MUESTRA EDITABLE ---');
setVista('cliente'); render();
const pc = app.innerHTML;
ok('en vista cliente no hay campos del TC', !/class="tcval"/.test(pc));
ok('pero el TC se sigue informando', /TC CCL/.test(pc), '1700');
setVista('interna');

console.log('\n--- 8. CADA VERSION TIENE EL SUYO ---');
upTC('tc', 1555);
duplicarVersion();
upTC('tc', 2000);
const py = getPy();
ok('la v2 quedó en 2000', n(py.versiones[1].tc) === 2000, String(py.versiones[1].tc));
ok('la v1 conserva el suyo', n(py.versiones[0].tc) === 1555, String(py.versiones[0].tc));

/* `guardar()` escribe con 120ms de retraso para no serializar la base entera
   en cada tecla, así que acá hay que esperarlo. */
setTimeout(() => {
  console.log('\n--- 7. QUEDA GUARDADO ---');
  const guardado = JSON.parse(localStorage.getItem('clap.db.v1') || '{}');
  const vs = guardado.productoras?.[0]?.proyectos?.[0]?.versiones || [];
  ok('el TC de la v1 se persiste', vs[0] && n(vs[0].tc) === 1555, vs[0] && String(vs[0].tc));
  ok('y el de la v2 también', vs[1] && n(vs[1].tc) === 2000, vs[1] && String(vs[1].tc));

  console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
  process.exitCode = fallos ? 1 : 0;
}, 300);
