/* El flujo de pegar un guion: feedback en vivo, no perder el texto,
   y aceptar los encabezados del guion publicitario. */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

/* --- 1. el texto pegado no se pierde ------------------------------------- */
console.log('--- NO PERDER LO PEGADO ---');
DB.ui.tab = 'desglose';
const TXT = '1. INT. COCINA - DIA\n\nLucia toma mate.\n\nLUCIA\nHola.\n';
guionInput({ value: TXT });
ok('guionInput guarda en el modelo', getD().guion === TXT, getD().guion.length + ' chars');
render();
ok('sobrevive a un render', getD().guion === TXT);
ok('el textarea se re-dibuja con el texto', importadorHTML().includes('Lucia toma mate'));
/* y desglosar funciona aunque el textarea no exista (por ej. tras un redibujo) */
global.document.getElementById = () => null;
importarGuion();
ok('desglosa desde el modelo si no hay textarea', getD().escenas.length === 1, getD().escenas.length + ' escena');

/* --- 2. el cartel en vivo dice lo que pasa ------------------------------- */
console.log('\n--- CARTEL EN VIVO ---');
ok('vacío: invita a pegar', /Pegá el guion acá/.test(infoGuion('')));
const bien = infoGuion(TXT);
ok('con guion válido: cuenta escenas', /✓ 1 escena/.test(bien), bien.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
ok('con guion válido: dice qué hacer', /tocá .Desglosar/.test(bien));
const mal = infoGuion('Esto es un texto cualquiera\nsin ningun encabezado de escena.\n');
ok('sin encabezados: avisa el problema', /No encuentro encabezados/.test(mal));
ok('sin encabezados: explica cómo se escriben', /INT\.<\/b>|EXT\./.test(mal));
ok('sin encabezados: da un ejemplo concreto', /COCINA - DÍA/.test(mal));

/* --- 3. encabezados de guion publicitario -------------------------------- */
console.log('\n--- ENCABEZADOS DE PUBLICIDAD ---');
const casos = [
  ['ESCENA 1 - COCINA - DIA', 'ESCENA n', '1', 'COCINA', 'DIA'],
  ['ESCENA 2: PLAZA - NOCHE', 'ESCENA n con dos puntos', '2', 'PLAZA', 'NOCHE'],
  ['PLANO 3 - CALLE', 'PLANO n', '3', 'CALLE', 'DÍA'],
  ['TOMA 4 — OFICINA - TARDE', 'TOMA n', '4', 'OFICINA', 'TARDE'],
  ['SEC. 5 - RUTA - DIA', 'SEC. n', '5', 'RUTA', 'DIA'],
  ['SECUENCIA 6 - BAR', 'SECUENCIA n', '6', 'BAR', 'DÍA'],
  ['ESC 7 - EXT. PARQUE - DIA', 'ESC n con EXT adentro', '7', 'PARQUE', 'DIA'],
];
casos.forEach(([linea, etiqueta, num, loc, mom]) => {
  const es = parseGuion(linea + '\n\nAlguien hace algo.\n\nPEPE\nHola.\n');
  const e = es[0];
  ok(etiqueta, !!e && e.numero === num && e.locacion === loc && e.momento === mom,
    e ? `${e.numero} | ${e.intExt} | ${e.locacion} | ${e.momento}` : 'no detectó nada');
});
const conExt = parseGuion('ESC 7 - EXT. PARQUE - DIA\n\nCorre.\n');
ok('detecta EXT adentro del encabezado', conExt[0].intExt === 'EXT', conExt[0].intExt);
ok('sin INT/EXT arranca en INT', parseGuion('PLANO 3 - CALLE\n\nCamina.\n')[0].intExt === 'INT');

/* un guion publicitario entero */
const SPOT = `SPOT LAVANDINA 30"

PLANO 1 - COCINA - DIA
Una MADRE limpia la mesada con un trapo.

MADRE
Otra vez.

PLANO 2 - EXT. PATIO - DIA
El PERRO entra embarrado y pisa todo.

PLANO 3 - COCINA - DIA
La madre sonrie. Toma la botella.

MADRE
Listo.
`;
const spot = parseGuion(SPOT);
console.log('');
spot.forEach(e => console.log(`  ${e.numero} ${e.intExt.padEnd(3)} ${e.locacion.padEnd(12)} ${e.momento.padEnd(5)} ${octavosATexto(e.octavos)}pg  ${e.personajes.join(',')}`));
ok('spot: 3 planos', spot.length === 3, spot.length);
ok('spot: locaciones', spot.map(e => e.locacion).join('|') === 'COCINA|PATIO|COCINA', spot.map(e => e.locacion).join('|'));
ok('spot: detecta a MADRE', spot[0].personajes.includes('MADRE'));
ok('spot: detecta el perro', (spot[1].elementos.animales || []).includes('perro'));
ok('spot: detecta la botella', (spot[2].elementos.utileria || []).includes('botella'));

/* --- 4. corregir a mano lo que el parser puso mal ------------------------ */
console.log('\n--- CORRECCION A MANO ---');
getD().escenas = spot;
const e1 = spot[0];
cicloIE(e1.id); ok('click 1 en INT/EXT -> EXT', e1.intExt === 'EXT', e1.intExt);
cicloIE(e1.id); ok('click 2 -> INT/EXT', e1.intExt === 'INT/EXT', e1.intExt);
cicloIE(e1.id); ok('click 3 vuelve a INT', e1.intExt === 'INT', e1.intExt);
upEsc(e1.id, 'locacion', 'COCINA CASA FAMILIA');
ok('editar la locación', e1.locacion === 'COCINA CASA FAMILIA');
upEsc(e1.id, 'momento', 'NOCHE');
ok('cambiar el momento', e1.momento === 'NOCHE');
ok('el cambio de locación separa las jornadas',
  new Set(spot.map(e => e.locacion)).size === 3, [...new Set(spot.map(e => e.locacion))].join(' | '));

/* --- 5. nada toca el presupuesto sin confirmar --------------------------- */
console.log('\n--- EL PRESUPUESTO NO SE TOCA SOLO ---');
const antes = getV().rubros.reduce((s, r) => s + r.lineas.length, 0);
importarGuion(SPOT);
ok('desglosar no crea líneas de presupuesto',
  getV().rubros.reduce((s, r) => s + r.lineas.length, 0) === antes, antes + ' líneas antes y después');
ok('desglosar deja la solapa en el desglose', DB.ui.tab === 'desglose' && DB.ui.subDesglose === 'escenas');

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
