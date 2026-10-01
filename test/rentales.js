/* Pedir a varios rentals, leer lo que contestan y repartir.
   ---------------------------------------------------------------------------
   Lo que contó un jefe de producción: los rentals no tienen nada al día en
   la web; contestan sobre el mismo pedido "OK" o "NO disponible", a veces
   con precio; y casi nunca alcanza uno solo (uno no tiene los accesorios de
   los LED, otro pocas Asteras, otro no tiene generador portátil).
   Las respuestas de abajo están escritas como contestan de verdad.         */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
global.navigator = { clipboard: { writeText: async () => {} } };

DB = dbVacia(); sembrar();
const pr = getPr();
const py = nuevoProyecto({ nombre: 'Spot Verano', tipo: 'publicidad' }); pr.proyectos.push(py);
DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;
py.desglose = nuevoDesglose();
py.desglose.jornadas = [nuevaJornada({ numero: 1, fecha: '2026-10-08' }), nuevaJornada({ numero: 2, fecha: '2026-10-09' })];
const K = nombre => EQUIPOS_LUZ.find(e => e.nombre === nombre).k;
const P = pedidoDe(py);
lzSumar(py, K('Arri SkyPanel S60-C'), 2);
const hmi = lzSumar(py, K('HMI 18K Fresnel'), 1); hmi.jornadas = [2];
lzSumar(py, K('Astera Titan (kit 8 tubos)'), 2);
lzSumar(py, K('C-stand con brazo'), 10);
lzSumar(py, K('Generador 20 kVA'), 1);
P.armadoPor = 'Juan (2° de foto)';
['Camauer', 'Seguí Rodando', 'RawCine'].forEach(lzSumarRental);
const R_ = nombre => rentalesCatalogo().find(r => r.nombre === nombre);
const cam = R_('Camauer'), seg = R_('Seguí Rodando'), raw = R_('RawCine');

console.log('--- 1. EL MAIL ---');
const orden = itemsParaMail(py);
const num = nombre => orden.findIndex(it => it.nombre === nombre) + 1;
const m = mailRental(pr, py, cam.id);
ok('va al mail del rental', m.para === 'camauer@camauer.com', m.para);
ok('el asunto dice proyecto y fechas', /Pedido de luces · Spot Verano · .*8\/10.*9\/10/.test(m.asunto), m.asunto);
ok('renglones numerados, con cantidad', new RegExp(`^${num('Arri SkyPanel S60-C')}\\. 2 × Arri SkyPanel S60-C$`, 'm').test(m.cuerpo), m.cuerpo.split('\n')[4]);
ok('el 18K dice que es sólo un día', /HMI 18K Fresnel \(sólo vie 9\/10\)/.test(m.cuerpo));
ok('pide contestar al lado de cada número', /contestar al lado de cada número/.test(m.cuerpo));
ok('firma quien lo armó', /Juan \(2° de foto\)$/.test(m.cuerpo));
ok('sin los asteriscos de WhatsApp', !/\*/.test(m.cuerpo));
DB.ui.mailCon = 'gmail';
ok('"Mandar mail" abre Gmail con todo cargado', /^https:\/\/mail\.google\.com\/mail\/\?view=cm&fs=1&to=camauer%40camauer\.com&su=Pedido/.test(linkMail(m)));
DB.ui.mailCon = 'mailto';
ok('o el programa de mail de la compu', /^mailto:camauer@camauer\.com\?subject=Pedido/.test(linkMail(m)) && /body=Hola/.test(linkMail(m)));
DB.ui.mailCon = 'gmail';

console.log('\n--- 2. LA SOLAPA ---');
DB.ui.tab = 'luces'; render();
ok('aparece "Pedir a rentals" con los del catálogo', /Pedir a rentals/.test(app.innerHTML) && /Camauer/.test(app.innerHTML));
[cam, seg, raw].forEach(r => lzPedirA(r.id, true));
render();
ok('un "Mandar mail" por rental tildado', (app.innerHTML.match(/>Mandar mail</g) || []).length === 3);
const mailRaw = raw.email; raw.email = ''; render();
ok('al que le falta el mail, lo dice (y no hay botón)', (app.innerHTML.match(/>Mandar mail</g) || []).length === 2 && /Falta el mail/.test(app.innerHTML));
raw.email = mailRaw;
lzMailRental(cam.id); lzMailRental(seg.id); lzMailRental(raw.id);
ok('queda marcado como enviado, con fecha', cotizDe(P)[cam.id].enviado === hoy());
ok('el pedido pasa a "Enviado al rental"', P.estado === 'enviado');
ok('se guarda qué número era cada renglón', cotizDe(P)[cam.id].numeros[num('HMI 18K Fresnel')] === hmi.id);

console.log('\n--- 3. LO QUE CONTESTAN ---');
const N = cotizDe(P)[cam.id].numeros;
const leer = txt => leerRespuestaRental(txt, orden, N).items;
const est = (L, nombre) => L[orden.find(it => it.nombre === nombre).id];

/* a) Camauer contesta número por número, con precio */
const a = leer(`Hola Juan, te paso:
${num('Arri SkyPanel S60-C')} OK $65.000
${num('HMI 18K Fresnel')} NO
${num('Astera Titan (kit 8 tubos)')} tenemos 1
${num('C-stand con brazo')} ok 4500 c/u
${num('Generador 20 kVA')} no tenemos
Saludos!`);
ok('a) "OK $65.000" -> OK con precio', est(a, 'Arri SkyPanel S60-C').estado === 'ok' && est(a, 'Arri SkyPanel S60-C').precio === 65000, JSON.stringify(est(a, 'Arri SkyPanel S60-C')));
ok('a) "NO" -> no tiene', est(a, 'HMI 18K Fresnel').estado === 'no');
ok('a) "tenemos 1" de 2 -> parcial, 1', est(a, 'Astera Titan (kit 8 tubos)').estado === 'parcial' && est(a, 'Astera Titan (kit 8 tubos)').cant === 1);
ok('a) "ok 4500 c/u"', est(a, 'C-stand con brazo').estado === 'ok' && est(a, 'C-stand con brazo').precio === 4500);
ok('a) "no tenemos"', est(a, 'Generador 20 kVA').estado === 'no');

/* b) Seguí contesta en el mismo mail, abajo de cada renglón citado */
const b = leer(`Juan, abajo te marco.

El mar, 6 oct 2026 a las 10:12, Juan <juan@x.com> escribió:
> Hola! ¿Cómo va?
> Te paso el pedido de luces para Spot Verano (Productora Demo).
> Jornadas: jue 8/10, vie 9/10
>
> ${num('Arri SkyPanel S60-C')}. 2 × Arri SkyPanel S60-C
no, solo tenemos los S30
> ${num('HMI 18K Fresnel')}. 1 × HMI 18K Fresnel (sólo vie 9/10)
ok, $ 180.000 x día
> ${num('Astera Titan (kit 8 tubos)')}. 2 × Astera Titan (kit 8 tubos)
OK 230.000
> ${num('C-stand con brazo')}. 10 × C-stand con brazo
ok
> ${num('Generador 20 kVA')}. 1 × Generador 20 kVA
✓ 95.000
> ¿Me confirmás disponibilidad y precio por jornada?`);
ok('b) respuesta abajo de cada renglón citado', est(b, 'HMI 18K Fresnel').estado === 'ok' && est(b, 'HMI 18K Fresnel').precio === 180000, JSON.stringify(est(b, 'HMI 18K Fresnel')));
ok('b) "no, solo tenemos los S30" -> no tiene', est(b, 'Arri SkyPanel S60-C').estado === 'no', JSON.stringify(est(b, 'Arri SkyPanel S60-C')));
ok('b) el "18K" del nombre no es un precio', est(b, 'Arri SkyPanel S60-C').precio === 0);
ok('b) "OK 230.000" y "✓ 95.000"', est(b, 'Astera Titan (kit 8 tubos)').precio === 230000 && est(b, 'Generador 20 kVA').estado === 'ok' && est(b, 'Generador 20 kVA').precio === 95000);
ok('b) la nota guarda lo que escribieron', /S30/.test(est(b, 'Arri SkyPanel S60-C').nota));

/* c) RawCine contesta arriba, en una frase, con el pedido citado abajo */
const cL = leerRespuestaRental(`Va todo, salvo las asteras que las tenemos alquiladas esa semana.
Total $ 850.000 + IVA

El mar, 6 oct 2026, Juan escribió:
> ${num('Arri SkyPanel S60-C')}. 2 × Arri SkyPanel S60-C
> ${num('HMI 18K Fresnel')}. 1 × HMI 18K Fresnel (sólo vie 9/10)
> ${num('Astera Titan (kit 8 tubos)')}. 2 × Astera Titan (kit 8 tubos)`, orden, N);
ok('c) "Va todo, salvo las asteras" -> todo OK…', est(cL.items, 'Arri SkyPanel S60-C').estado === 'ok' && est(cL.items, 'Generador 20 kVA').estado === 'ok');
ok('c) …menos las Asteras', est(cL.items, 'Astera Titan (kit 8 tubos)').estado === 'no', JSON.stringify(est(cL.items, 'Astera Titan (kit 8 tubos)')));
ok('c) toma el total', cL.total === 850000, cL.total);

/* d) el pedido devuelto en un Word, con lo que tienen escrito al lado */
const d = leer(`PEDIDO SPOT VERANO
2 × Arri SkyPanel S60-C      DISPONIBLE
1 × HMI 18K Fresnel   NO DISPONIBLE
2 × Astera Titan (kit 8 tubos)   OK
10 × C-stand con brazo  OK
1 × Generador 20 kVA   SIN STOCK`);
ok('d) sin números, por el nombre del equipo', est(d, 'Arri SkyPanel S60-C').estado === 'ok' && est(d, 'HMI 18K Fresnel').estado === 'no' && est(d, 'Generador 20 kVA').estado === 'no',
  ['Arri SkyPanel S60-C', 'HMI 18K Fresnel', 'Generador 20 kVA'].map(x => est(d, x).estado).join(','));
ok('d) nada inventado: el C-stand OK sin precio', est(d, 'C-stand con brazo').estado === 'ok' && est(d, 'C-stand con brazo').precio === 0);

/* e) lo que no se entiende queda "sin respuesta", no adivinado */
const e = leer(`Te llamo en un rato y lo vemos`);
ok('e) una respuesta vaga deja todo "sin respuesta"', orden.every(it => e[it.id].estado === '?'));

console.log('\n--- 4. GUARDAR LAS RESPUESTAS ---');
const guardarResp = (r, L) => { _lzResp = { id: r.id, items: L.items || L, total: L.total || 0 }; lzRespuestaGuardar(); };
guardarResp(cam, { items: a, total: 0 });
guardarResp(seg, { items: b, total: 0 });
guardarResp(raw, cL);
ok('cada rental queda "respondió"', [cam, seg, raw].every(r => cotizDe(P)[r.id].respondio === hoy()));
ok('el pedido pasa a "Cotizado"', P.estado === 'cotizado');
ok('los precios quedan guardados por rental para la próxima', DB.tarifaLuces[cam.id][K('Arri SkyPanel S60-C')] === 65000);
const h = DB.historialLuces.filter(x => x.equipo === 'HMI 18K Fresnel');
ok('y en el historial, con fecha y proyecto', h.length === 1 && h[0].precio === 180000 && h[0].fecha === hoy() && h[0].proyecto === 'Spot Verano' && h[0].rental === 'Seguí Rodando');

console.log('\n--- 5. QUIÉN PONE QUÉ ---');
let x = proponerReparto(py, 'menos');
const va = nombre => { const it = P.items.find(i => i.nombre === nombre); return it.rentalId ? rentalPorId(it.rentalId).nombre : null; };
ok('menos rentals: RawCine, que tiene casi todo, se lleva lo suyo', va('Arri SkyPanel S60-C') === 'RawCine' && va('HMI 18K Fresnel') === 'RawCine' && va('Generador 20 kVA') === 'RawCine',
  ['Arri SkyPanel S60-C', 'HMI 18K Fresnel', 'Generador 20 kVA'].map(va).join(','));
ok('las Asteras van con el que las tiene (Seguí)', va('Astera Titan (kit 8 tubos)') === 'Seguí Rodando');
ok('dos rentals en total', x.rentals.length === 2 && x.faltan.length === 0);
ok('el precio cotizado pasa al renglón', P.items.find(i => i.nombre === 'Astera Titan (kit 8 tubos)').precio === 230000);
x = proponerReparto(py, 'barato');
ok('más barato: el C-stand va con quien lo cotizó', va('C-stand con brazo') === 'Camauer', va('C-stand con brazo'));
ok('el 18K con el único que le puso precio', va('HMI 18K Fresnel') === 'Seguí Rodando');

/* si nadie lo tiene, se avisa */
const it6 = lzSumar(py, K('Generador 66 kVA'), 1);
cotizDe(P)[cam.id].items[it6.id] = { estado: 'no' }; cotizDe(P)[seg.id].items[it6.id] = { estado: 'no' }; cotizDe(P)[raw.id].items[it6.id] = { estado: '?' };
x = proponerReparto(py, 'menos');
ok('lo que nadie tiene queda "sin conseguir"', x.faltan.some(i => i.id === it6.id) && !it6.rentalId);
render();
ok('la tabla lo marca', /nadie lo tiene/.test(app.innerHTML) && /Sin conseguir/.test(app.innerHTML));
ok('un botón "Confirmar por mail" por rental elegido', (app.innerHTML.match(/Confirmar por mail/g) || []).length === x.rentals.length);

console.log('\n--- 6. CONFIRMAR ---');
const conf = mailRental(pr, py, seg.id, 'confirmar');
const deSeg = P.items.filter(i => i.rentalId === seg.id);
ok('el mail de confirmación lleva sólo lo de ese rental', deSeg.length > 0 && deSeg.every(i => conf.cuerpo.includes(i.nombre)) &&
  !P.items.filter(i => i.rentalId !== seg.id).some(i => conf.cuerpo.includes('× ' + i.nombre)), conf.cuerpo.split('\n').slice(4, 8).join(' | '));
ok('con el precio que pusieron', /HMI 18K Fresnel.*\$ 180\.000/.test(conf.cuerpo) || !deSeg.some(i => i.nombre === 'HMI 18K Fresnel'));
ok('asunto de confirmación', /^Confirmación de luces/.test(conf.asunto));
lzConfirmarRental(seg.id);
ok('queda confirmado con fecha', cotizDe(P)[seg.id].confirmado === hoy());

console.log('\n--- 7. CORREGIR EL MAIL DEL RENTAL ---');
lzMailDe(raw.id, 'pedidos@rawcine.com.ar');
ok('se corrige en el catálogo y queda para la próxima', R_('RawCine').email === 'pedidos@rawcine.com.ar' && mailRental(pr, py, raw.id).para === 'pedidos@rawcine.com.ar');

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
