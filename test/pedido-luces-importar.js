/* Pedido de luces: importar el pedido que manda el gaffer.
   ---------------------------------------------------------------------------
   Pedido: un box para tirar un Excel, un Word o un txt con el pedido, que
   CLAP lo interprete y lo arme.                                            */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const fs = require('fs'), path = require('path');
const archivo = (nombre) => { const b = fs.readFileSync(path.join(__dirname, 'fixtures', nombre));
  return {name: nombre, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), text: async () => b.toString('utf8')}; };

DB = dbVacia(); sembrar();
const pr = getPr();
const py = nuevoProyecto({nombre: 'Spot Importar', tipo: 'publicidad'});
pr.proyectos.push(py);
DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;
getD().jornadas = [nuevaJornada({numero: 1, fecha: '2026-10-14'}), nuevaJornada({numero: 2, fecha: '2026-10-15'})];
const nom = r => r.k ? EQUIPO_LUZ(r.k).nombre : null;

console.log('--- 1. CÓMO LO ESCRIBE UN GAFFER ---');
const casos = [
  ['2 x SkyPanel S60', 'Arri SkyPanel S60-C', 2],
  ['SKYPANEL S60-C x2', 'Arri SkyPanel S60-C', 2],
  ['1 18K', 'HMI 18K Fresnel', 1],
  ['HMI 18.000 W fresnel', 'HMI 18K Fresnel', 1],
  ['Par HMI 4kw (2)', 'HMI 4K Par', 2],
  ['HMI 1.200 W par', 'HMI 1.2K Par', 1],
  ['M18 x 3', 'Arri M18', 3],
  ['Kino 4x4 x2', 'Kino Flo 4 tubos 4\'', 2],
  ['Kino cortos 4 tubos', 'Kino Flo 4 tubos 2\'', 1],
  ['10 ceferinos', 'C-stand con brazo', 10],
  ['Arañas x6', 'C-stand con brazo', 6],
  ['6 banderas 60x90', 'Bandera 24x36', 6],
  ['4 banderas 40x60', 'Bandera 18x24', 4],
  ['Palio 12x12 con ultrabounce', 'Marco 12x12 con telas', 1],
  ['Tamiz 6x6', 'Marco 6x6 con telas', 1],
  ['Butterfly 12x12', 'Butterfly 12x12 armado', 1],
  ['1 globo chino', 'Chinese lantern 60 cm', 1],
  ['Titan kit 8 tubos x1', 'Astera Titan (kit 8 tubos)', 1],
  ['8 Titan', 'Astera Titan Tube', 8],
  ['Generador 66 kva', 'Generador 66 kVA', 1],
  ['grupo electrógeno 100 kva', 'Generador 110 kVA', 1],
  ['Honda EU30', 'Generador Honda EU30is (3 kVA)', 1],
  ['1 dimmer 2k', 'Dimmer 2K', 1],
  ['2 fresnel 2k', 'Fresnel 2K', 2],
  ['abierta 2000 w', 'Blonde 2K (abierta)', 1],
  ['Maxi brute', 'Maxi Brute 9 lámparas', 1],
  ['12 bolsas de arena', 'Saco de arena', 12],
  ['Huevera para S60 x2', 'Grilla (egg crate)', 2],
  ['Dolly con 6 tramos de vías', 'Rieles rectos (tramo)', 1],
  ['3 rollos de cinta', 'Cinta gaffer (rollo)', 3],
  ['CTO full x4', 'Gelatina CTO (pliego)', 4],
  ['Camión de luces', 'Camión de luces con chofer', 1],
  ['2 Aputure 600d', 'Aputure LS 600d Pro', 2],
  ['Joker 800 - 1', 'Joker 800', 1],
  ['575 par', 'HMI 575 Par', 1],
];
casos.forEach(([txt, esperado, cant]) => {
  const r = interpretarPedidoTexto([txt])[0];
  ok(`"${txt}" → ${esperado} × ${cant}`, r && nom(r) === esperado && r.cant === cant, r ? `${nom(r)} × ${r.cant}` : 'nada');
});
ok('"575 par" no es una cantidad de 575', interpretarPedidoTexto(['575 par'])[0].cant === 1);
const sj = interpretarPedidoTexto(['1 18K solo J2'])[0];
ok('"solo J2" marca la jornada', JSON.stringify(sj.jornadas) === '[2]');
ok('"J1 a J3" es un rango', JSON.stringify(interpretarPedidoTexto(['2 S60 J1 a J3'])[0].jornadas) === '[1,2,3]');
ok('"x 3 días" no es la jornada 3', interpretarPedidoTexto(['S60 x 3 dias'])[0].jornadas === null);
const relleno = interpretarPedidoTexto(['Pedido de luces', 'Proyecto: Spot', 'LED', 'Gracias!', '', '2 S60']);
ok('títulos, saludos y renglones vacíos no son pedido', relleno.length === 1 && nom(relleno[0]) === 'Arri SkyPanel S60-C');
const raro = interpretarPedidoTexto(['3 cosa rara que no existe'])[0];
ok('lo que no reconoce queda para elegir a mano, sin tildar', raro && raro.k === null && raro.cant === 3 && !raro.incluir);

console.log('\n--- 2. ARCHIVOS ---');
(async () => {
  const X = await interpretarArchivoPedido(archivo('pedido-luces-prueba.xlsx'));
  ok('Excel: usa las columnas Cant y Equipo (8 renglones, sin título ni total)', X.length === 8, X.map(r => r.texto).join(' | '));
  ok('Excel: cantidades de la columna', X[0].cant === 2 && X[3].cant === 10 && nom(X[3]) === 'C-stand con brazo');
  ok('Excel: la columna Jornadas', JSON.stringify(X[1].jornadas) === '[2]' && nom(X[1]) === 'HMI 18K Fresnel');
  ok('Excel: lo raro queda para elegir', X[7].k === null && X[7].cant === 3);
  const W = await interpretarArchivoPedido(archivo('pedido-luces-prueba.docx'));
  ok('Word: lee los renglones del pedido (6)', W.length === 6, W.map(r => nom(r) || r.texto).join(' | '));
  ok('Word: 2 Aputure 600d, M18 sólo J1, kit Titan', nom(W[0]) === 'Aputure LS 600d Pro' && W[0].cant === 2 &&
    nom(W[1]) === 'Arri M18' && JSON.stringify(W[1].jornadas) === '[1]' && nom(W[2]) === 'Astera Titan (kit 8 tubos)');
  const T = interpretarPedidoFilas(filasDeTexto('Cantidad\tEquipo\n2\tS60\n4\tbanderas 60x90'));
  ok('pegado desde Excel (con tabulaciones)', T.length === 2 && T[1].cant === 4 && nom(T[1]) === 'Bandera 24x36');

  console.log('\n--- 3. SUMARLO AL PEDIDO ---');
  lzSumar(py, 'arri-skypanel-s60-c', 1);
  lzRevisarImportado(X, 'pedido-luces-prueba.xlsx');
  ok('la revisión muestra lo entendido y lo que falta elegir', /Lo que entendí del pedido/.test(String(typeof modal === 'string' ? modal : '')) && /para elegir a mano/.test(modal));
  lzSumarImportado();
  const P = pedidoDe(py);
  const de = k => P.items.find(x => x.k === k);
  ok('el S60 que ya estaba suma la cantidad (1 + 2)', de('arri-skypanel-s60-c').cant === 3);
  ok('el 18K entra sólo para la jornada 2', JSON.stringify(de('hmi-18k-fresnel').jornadas) === '[2]');
  ok('10 C-stands, 6 banderas, el marco y el generador', de('c-stand-con-brazo').cant === 10 && de('bandera-24x36').cant === 6 && de('marco-12x12-con-telas') && de('generador-66-kva'));
  ok('lo no reconocido no se suma', P.items.length === 7, P.items.length);
  /* una fila corregida a mano en la revisión */
  _lzImp = interpretarPedidoTexto(['3 cosa rara que no existe']); _lzImp[0].k = 'floppy-4x4'; _lzImp[0].incluir = true;
  lzSumarImportado();
  ok('lo elegido a mano en la revisión se suma', de('floppy-4x4') && de('floppy-4x4').cant === 3);
  DB.ui.tab = 'luces'; render();
  ok('la caja para soltar el pedido está en la solapa', /Soltá acá el pedido del gaffer/.test(app.innerHTML) && /lzSoltarPedido/.test(app.innerHTML));
  try { lzPegarPedido(); cerrar(); ok('pegar como texto abre', true); } catch (e) { ok('pegar como texto abre', false, e.message); }

  console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
})().catch(e => { console.log('FALLA excepción: ' + e.stack); console.log('\n>>> 1 FALLA(S)'); });
