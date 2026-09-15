/* Sueldos del convenio SICA en el presupuesto.
   ---------------------------------------------------------------------------
   Lo que pidió Andrés: que la columna de sueldos de los trabajadores se
   complete sola con la escala salarial del SICA, según la escala de horas que
   maneje el proyecto, y que después se pueda editar.

   Lo que tiene que valer siempre, y por eso se prueba:
     - la escala es la de la FECHA DEL RODAJE, no la de hoy
     - con jornada de 12 h y extras al 50% da EXACTAMENTE la columna "12 h" del
       SICA: es la prueba de que el cálculo es el del convenio
     - lo escrito a mano no lo pisa nadie
     - cambiar las horas recalcula lo que vino del convenio, y sólo eso
     - "Asistente" solo no se adivina: hay tres en el convenio              */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const casi = (a, b, tol = 2) => Math.abs(a - b) <= tol;
const form = campos => { global.document.querySelectorAll = s =>
  /\[name\]/.test(s) ? Object.entries(campos).map(([name, value]) => ({name, value})) : []; };

console.log('--- 1. LAS ESCALAS Y SUS FECHAS ---');
ok('hay por lo menos dos escalas', ESCALAS_SICA.length >= 2, ESCALAS_SICA.map(e => e.nombre).join(' · '));
ok('ordenadas y sin pisarse', ESCALAS_SICA.every((e, i) => !i || e.desde > ESCALAS_SICA[i-1].hastaISO));
ok('todas con 41 cargos', ESCALAS_SICA.every(e => e.cargos.length === 41));
const ago = ESCALAS_SICA.find(e => e.nombre === 'Agosto 2026');
const oct = ESCALAS_SICA.find(e => e.nombre === 'Octubre 2026');
ok('está Agosto 2026', !!ago);
ok('está Octubre 2026', !!oct);
ok('15/09 usa Agosto', escalaSICA('2026-09-15').nombre === 'Agosto 2026');
ok('30/09 todavía Agosto', escalaSICA('2026-09-30').nombre === 'Agosto 2026');
ok('01/10 ya es Octubre', escalaSICA('2026-10-01').nombre === 'Octubre 2026');
const dic = escalaSICA('2026-12-10');
ok('diciembre usa la última', dic.nombre === 'Octubre 2026');
ok('y la marca vencida', dic.vencida === true);
ok('julio usa la primera, marcada futura', escalaSICA('2026-07-01').futura === true);
ok('Octubre paga más que Agosto',
  oct.cargos.every((c, i) => c.j8 > ago.cargos[i].j8), 'DF ' + fmt(ago.cargos[11].j8) + ' -> ' + fmt(oct.cargos[11].j8));

console.log('\n--- 2. EL CALCULO ES EL DEL CONVENIO ---');
const plano8  = nuevaConfigRodaje({horasJornada: 8});
const plano12 = nuevaConfigRodaje({horasJornada: 12});
let malos = [];
ESCALAS_SICA.forEach(E => E.cargos.forEach(c => {
  if(valorJornadaSICA(c, plano12) !== c.j12) malos.push(`${E.nombre} ${c.c}: ${valorJornadaSICA(c, plano12)} vs ${c.j12}`);
}));
ok('JORNADA 12 h AL 50% = COLUMNA "12 h" DEL SICA, al peso, en los 82 cargos', malos.length === 0,
  malos.length ? malos.slice(0, 2).join(' | ') : 'todos coinciden');
ok('jornada 8 h = columna 8 h', ESCALAS_SICA.every(E => E.cargos.every(c => valorJornadaSICA(c, plano8) === c.j8)));
ok('menos de 8 h cobra la jornada entera',
  valorJornadaSICA(oct.cargos[11], nuevaConfigRodaje({horasJornada: 6})) === oct.cargos[11].j8);
const df = oct.cargos[11];
const tramos12 = nuevaConfigRodaje({horasJornada: 12, tramosHE: TRAMOS_HE_ESCALADO.map(t => ({...t}))});
ok('con extras escalonadas cuesta más que con 50% plano',
  valorJornadaSICA(df, tramos12) > valorJornadaSICA(df, plano12),
  fmt(valorJornadaSICA(df, plano12)) + ' -> ' + fmt(valorJornadaSICA(df, tramos12)));
ok('10 h al 50%: 8 h + 2 extras', valorJornadaSICA(df, nuevaConfigRodaje({horasJornada: 10}))
  === Math.round(df.j8 + 2 * (df.j8 / 8) * 1.5));

console.log('\n--- 3. FUNCION DEL PRESUPUESTO -> CARGO ---');
const cargoDe = f => { const c = cargoSICA(f, oct); return c ? `${c.d} · ${c.c}` : null; };
[
  ['Director de Fotografía', 'Fotografía y Cámara · DIRECTOR/A DE FOTOGRAFIA'],
  ['Directora de Fotografía', 'Fotografía y Cámara · DIRECTOR/A DE FOTOGRAFIA'],
  ['Foquista (1° AC)', 'Fotografía y Cámara · ASISTENTE (FOQUISTA)'],
  ['2° Asistente de Cámara', 'Fotografía y Cámara · AYUDANTE'],
  ['Ayudante de Dirección (1° AD)', 'Dirección · ASISTENTE'],
  ['2° Ayudante de Dirección', 'Dirección · 1º AYUDANTE'],
  ['Jefa de Producción', 'Producción · JEFE/A'],
  ['Location Manager', 'Locaciones · JEFE/A'],
  ['Gaffer', 'Eléctrica e Iluminación · GAFFER'],
  ['Sonidista Directo', 'Sonido · SONIDISTA'],
  ['Director de Arte', 'Arte · DIRECCION DE ARTE'],
  ['Maquillador/a', 'Maquillaje y Peinado · MAQUILLADOR/A'],
  ['Montajista', 'Edición · EDITOR/A'],
].forEach(([f, esperado]) => ok(`"${f}"`, cargoDe(f) === esperado, cargoDe(f)));
ok('con el nombre de la persona atrás igual lo encuentra',
  cargoDe('Director de Fotografía — Martín Bevilacqua') === 'Fotografía y Cámara · DIRECTOR/A DE FOTOGRAFIA');
ok('"2° Asistente de Cámara" no cae en "Asistente de Cámara"', cargoDe('2° Asistente de Cámara') === 'Fotografía y Cámara · AYUDANTE');
ok('"Asistente" solo NO se adivina (hay tres)', cargoDe('Asistente') === null);
ok('el Director no es SICA', cargoDe('Director') === null);
ok('un alquiler no es SICA', cargoDe('Paquete de luces') === null);
ok('la elección a mano manda', cargoSICA('Cualquier cosa', oct, {d: 'Sonido', c: 'MICROFONISTA'}).c === 'MICROFONISTA');
ok('"no lleva convenio" también', cargoSICA('Gaffer', oct, 'ninguno') === null);

console.log('\n--- 4. SE COMPLETA SOLO AL AGREGAR ---');
DB = dbVacia(); sembrar();
const py = getPy(), v = getV();
py.configRodaje = nuevaConfigRodaje({horasJornada: 12});
py.desglose.jornadas = [nuevaJornada({numero: 1, fecha: '2026-10-08'})];   /* rodaje en octubre */
const rb = c => v.rubros.find(r => r.codigo === c);
const r04 = rb('04');
r04.lineas = [];
addFuncion(r04.id, 'Director de Fotografía');
let l = r04.lineas[0];
ok('la línea se creó', !!l);
ok('CON EL SUELDO DEL CONVENIO', l.valorUnit === valorJornadaSICA(df, py.configRodaje), fmt(l.valorUnit));
ok('de la escala de OCTUBRE (fecha del rodaje)', l.sica && l.sica.escala === 'Octubre 2026', l.sica && l.sica.escala);
ok('para jornada de 12 h', l.sica.horas === 12);
ok('marcada como del convenio', l.valorOrigen === 'sica');
ok('coincide AL PESO con la columna 12 h del PDF', l.valorUnit === df.j12, fmt(df.j12));

/* escribir la función a mano en una línea vacía también completa */
addLinea(r04.id);
const l2 = r04.lineas[r04.lineas.length - 1];
upLinea(r04.id, l2.id, 'concepto', 'Foquista');
ok('escribir "Foquista" completa el sueldo', l2.valorUnit === valorJornadaSICA(oct.cargos[13], py.configRodaje), fmt(l2.valorUnit));

/* sin fecha de rodaje se usa hoy */
const pyHoy = nuevoProyecto({nombre: 'Sin fecha'}); pyHoy.configRodaje = nuevaConfigRodaje({horasJornada: 8});
ok('sin fecha de rodaje usa la escala de hoy', escalaDelProyecto(pyHoy).nombre === escalaSICA().nombre, escalaSICA().nombre);

console.log('\n--- 5. LO ESCRITO A MANO NO SE PISA ---');
upLinea(r04.id, l.id, 'valorUnit', '1500000');
ok('editar lo marca manual', l.valorOrigen === 'manual');
ok('y queda el valor escrito', l.valorUnit === 1500000);
aplicarSICA(py, v, {actualizar: true});
ok('actualizar todo NO lo toca', l.valorUnit === 1500000);
upLinea(r04.id, l.id, 'valorUnit', '900000');
ok('si queda por debajo del piso se avisa', estadoSICA(l, py).debajo === true, 'convenio ' + fmt(estadoSICA(l, py).valor));
upLinea(r04.id, l.id, 'valorUnit', '0');
ok('borrarlo lo devuelve al convenio', l.valorOrigen === 'sica' && l.valorUnit === valorJornadaSICA(df, py.configRodaje), fmt(l.valorUnit));

console.log('\n--- 6. CAMBIAR LAS HORAS RECALCULA LO DEL CONVENIO ---');
upLinea(r04.id, l2.id, 'valorUnit', '555555');           /* el foquista queda a mano */
const antesDF = l.valorUnit;
form({horasJornada: '10', horasScouting: '8', recargoHE: '50', he_hasta_0: '', he_recargo_0: '50',
  minTurnaround: '12', telProduccion: ''});
saveCfgRodaje();
ok('el DF (del convenio) se recalculó a 10 h', l.valorUnit === valorJornadaSICA(df, nuevaConfigRodaje({horasJornada: 10})),
  fmt(antesDF) + ' -> ' + fmt(l.valorUnit));
ok('bajó, porque son menos horas', l.valorUnit < antesDF);
ok('el foquista (a mano) NO se tocó', l2.valorUnit === 555555);
ok('y dice que es jornada de 10 h', l.sica.horas === 10);

console.log('\n--- 7. CAMBIA LA FECHA DEL RODAJE ---');
py.desglose.jornadas[0].fecha = '2026-09-10';            /* se adelantó a septiembre */
ok('la línea queda desactualizada (sigue con octubre)', estadoSICA(l, py).desactualizado === true);
ok('el resumen la cuenta', resumenSICA(py, v).desactualizadas >= 1);
actualizarTodoSICA();
ok('actualizar la pone con AGOSTO', l.sica.escala === 'Agosto 2026' && l.valorUnit === valorJornadaSICA(ago.cargos[11], py.configRodaje),
  fmt(l.valorUnit));
ok('ya no está desactualizada', estadoSICA(l, py).desactualizado === false);

console.log('\n--- 8. LO QUE NO LLEVA CONVENIO ---');
const lUsd = nuevaLinea({concepto: 'Gaffer', moneda: 'USD'});
ok('en dólares no se completa', autocompletarSICA(lUsd, py) === false);
const lGlob = nuevaLinea({concepto: 'Gaffer', unidad: 'global'});
ok('con unidad global no se completa', autocompletarSICA(lGlob, py) === false);
const lAlq = nuevaLinea({concepto: 'Paquete de luces'});
ok('un alquiler no se completa', autocompletarSICA(lAlq, py) === false);
const lFee = nuevaLinea({concepto: 'Gaffer', sicaRef: 'ninguno'});
ok('marcada "no lleva convenio" no se completa', autocompletarSICA(lFee, py) === false);

console.log('\n--- 9. PERSONAS DEL CATALOGO ---');
const conTarifa = nuevaPersona({nombre: 'Diego', funcion: 'Gaffer', rubro: '05', tarifaRef: 700000});
const sinTarifa = nuevaPersona({nombre: 'Ana', funcion: 'Gaffer', rubro: '05', tarifaRef: 0});
DB.catalogo.personas.push(conTarifa, sinTarifa);
const r05 = rb('05'); r05.lineas = [];
addPersona(r05.id, conTarifa.id);
ok('con tarifa: manda la tarifa de la persona', r05.lineas[0].valorUnit === 700000 && r05.lineas[0].valorOrigen === 'catalogo');
addPersona(r05.id, sinTarifa.id);
ok('sin tarifa: de base el convenio', r05.lineas[1].valorOrigen === 'sica' && r05.lineas[1].valorUnit > 0, fmt(r05.lineas[1].valorUnit));

console.log('\n--- 10. EN PANTALLA ---');
DB.ui.tab = 'presu'; DB.ui.vista = 'interna'; r04.abierto = true; render();
let h = app.innerHTML;
ok('está la barra del convenio', /Convenio SICA · /.test(h));
ok('dice qué escala y por qué', /rodaje 10\/09\/2026/.test(h), (h.match(/Convenio SICA · [^<]*/) || [''])[0]);
ok('la línea del convenio muestra su chip', /sica-ok/.test(h) && /DIRECTOR\/A DE FOTOGRAFIA/.test(h));
ok('la línea a mano muestra la referencia', /sica-ref|sica-bajo/.test(h));
ok('link a ver la escala', /setSubCat\('sica'\)/.test(h));
DB.ui.vista = 'cliente'; render();
ok('al cliente NO se le muestra', !/Convenio SICA · /.test(app.innerHTML));
DB.ui.vista = 'interna';

modal = null; elegirCargoSICA(r04.id, l.id);
ok('el selector de cargos abre', /Cargo del convenio/.test(modal || ''));
ok('muestra lo que cobra cada uno con la jornada del proyecto', /jornada de\s*<b>10 h<\/b>/.test(modal || ''));
ok('ofrece "no lleva convenio"', /No lleva convenio/.test(modal || ''));
const iMicro = _cargosPicker.findIndex(c => c.c === 'MICROFONISTA');
setCargoSICA(r04.id, l.id, iMicro);
ok('elegir otro cargo lo aplica', l.sica.c === 'MICROFONISTA' && l.valorOrigen === 'sica');
ok('y queda guardado en la línea', l.sicaRef && l.sicaRef.c === 'MICROFONISTA');
setCargoSICA(r04.id, l.id, 'ninguno');
ok('"no lleva convenio" saca el sueldo del convenio', l.sicaRef === 'ninguno' && !(l.valorUnit > 0));

/* aviso de escala vencida */
py.desglose.jornadas[0].fecha = '2027-03-01';
render();
ok('si el rodaje cae después de la última escala, lo avisa', /No hay escala publicada para la fecha del rodaje/.test(app.innerHTML));

/* el selector de funciones muestra el MISMO número que después se carga */
py.desglose.jornadas[0].fecha = '2026-10-08';
modal = null; pickFuncion(r04.id);
const esperadoDF = valorJornadaSICA(cargoSICA('Director de Fotografía', escalaDelProyecto(py)), py.configRodaje);
ok('el selector de funciones muestra el valor que se va a cargar',
  (modal || '').includes('SICA ' + fmtC(esperadoDF)), 'SICA ' + fmtC(esperadoDF));
ok('y el foquista también tiene su valor', /Foquista \(1° AC\)<\/span>\s*<span class="sica"/.test(modal || ''));
cerrar();

console.log('\n--- 11. EL TARIFARIO ---');
DB.ui.tab = 'catalogo'; DB.ui.subCat = 'sica'; DB.ui.escalaSICA = null; render();
h = app.innerHTML;
ok('muestra las escalas publicadas', ESCALAS_SICA.every(e => h.includes(e.nombre)));
ok('con link al PDF oficial', /sicacine\.org\.ar\/docs\/Escala%20Salarial%20Publicidad/.test(h));
ok('con jornada del proyecto cuando no es 8 ni 12', /Tu jornada \(10 h\)/.test(h));

console.log('\n--- 12. NO LE CAMBIA NADA A LO QUE YA ESTABA ---');
DB = dbVacia(); sembrar();
const totalAntes = calcular(getV()).total;
render(); DB.ui.tab = 'presu'; render();
ok('el presupuesto del ejemplo da lo mismo', calcular(getV()).total === totalAntes, fmt(totalAntes));
ok('ninguna línea vieja se marcó como del convenio',
  getV().rubros.every(r => r.lineas.every(x => x.valorOrigen !== 'sica')));

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
