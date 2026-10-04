/* El desglosador para publicidad: un brief de un párrafo, unas pocas frases
   y un storyboard con texto (test/fixtures/publicidad-*.txt, inventados).
   Lo obvio tiene que salir: los bloques por lugar y momento, el elenco (con
   el menor y los extras con su cantidad), la cámara especial, los efectos,
   la post y los cutdowns; cada cosa con su evidencia y una línea propuesta.
   Y «Aplicar al presupuesto»: lo nuevo se crea, lo que ya está no se
   duplica (se actualiza si pide más) y se deshace.
   Uso: node test/run.js test/desglose-publicidad.js                         */
const fs = require('fs'), path = require('path');
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const fx = f => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8').replace(/\r\n/g, '\n').trim();
global.confirm = () => true;

const F = {brief: fx('publicidad-brief-un-parrafo.txt'), frases: fx('publicidad-pocas-frases.txt'), story: fx('publicidad-storyboard-con-texto.txt')};
ok('los ejemplos de la app son los mismos que los de las pruebas', EJEMPLOS_PUB.every(x => x.texto.trim() === F[x.k]));

const py = getPy();
const det = (A, cat) => A.grupos[cat].map(x => x.k);
const tiene = (A, cat, k) => det(A, cat).includes(k);
const linea = (P, re) => P.lineas.find(l => re.test(l.concepto));

console.log('\n--- 1. UN BRIEF DE UN PÁRRAFO (la SUV) ---');
importarGuion(F.brief);
let d = getD(), A = analizarDesglose(py), P = propuestaPresupuesto();
ok('sin encabezados: se corta por lugar y momento (ruta, auto, mirador, noche, packshot)', d.escenas.length === 5, d.escenas.map(e => e.locacion + '/' + e.momento).join(' | '));
ok('la ruta en hora dorada, exterior', d.escenas[0].locacion === 'RUTA' && d.escenas[0].momento === 'HORA DORADA' && d.escenas[0].intExt === 'EXT');
ok('dentro del auto es interior', d.escenas[1].locacion === 'AUTO' && d.escenas[1].intExt === 'INT');
ok('cae la noche: el bloque de la lluvia es de noche', d.escenas[3].momento === 'NOCHE', d.escenas[3].momento);
ok('el cierre es el packshot (no la última locación)', d.escenas[4].locacion === 'PACKSHOT');
ok('elenco: Laura principal, Tomi (8) menor', A.grupos.elenco.some(x => x.k === 'p:laura' && x.sub === 'Principal') && A.grupos.elenco.some(x => x.k === 'p:tomi' && x.menor),
  A.grupos.elenco.map(x => x.l + ':' + x.sub + (x.menor ? ':menor' : '')).join(', '));
ok('el título no es un personaje (SUV, Cumbre)', !d.escenas.some(e => e.personajes.some(p => /SUV|CUMBRE/.test(p))));
ok('diez ciclistas: extras × 10, confianza alta', A.grupos.elenco.some(x => x.k === 'x:ciclistas' && x.cantidad === 10 && x.conf === 'alta'));
ok('el menor arrastra chaperona y permiso', !!linea(P, /^Chaperona/) && !!linea(P, /^Permiso de trabajo de menores/));
ok('cámara especial: dron, car rig y alta velocidad', ['dron', 'carrig', 'altavel'].every(k => tiene(A, 'camara', k)), det(A, 'camara').join(','));
ok('Phantom con confianza alta (lo dice)', A.grupos.camara.find(x => x.k === 'altavel').conf === 'alta');
ok('efectos en set: lluvia (alta) y viento (media, «el viento le mueve el pelo»)', tiene(A, 'sfx', 'lluvia') && A.grupos.sfx.find(x => x.k === 'viento').conf === 'media');
ok('post: packshot 3D, motion graphics (logo animado), locución y música original', ['packshot3d', 'motion', 'locucion', 'musica'].every(k => tiene(A, 'post', k)), det(A, 'post').join(','));
ok('no confunde el packshot 3D con uno filmado', !tiene(A, 'post', 'packshot'));
ok('entregables: cutdowns de 15″ y 6″ y formatos para redes', ['cut15', 'cut6', 'redes'].every(k => tiene(A, 'entregas', k)), det(A, 'entregas').join(','));
const dron = A.grupos.camara.find(x => x.k === 'dron');
ok('cada cosa con su evidencia: la frase y el bloque', dron.evid[0].esc === '1' && /dron/i.test(dron.evid[0].frase), JSON.stringify(dron.evid[0]));
ok('y una línea propuesta en su rubro (dron → 11 alquiler + 04 piloto)', !!P.lineas.find(l => l.rubro === '11' && /drone/.test(l.concepto)) && !!P.lineas.find(l => l.rubro === '04' && /Piloto de Drone/.test(l.concepto)));
ok('el permiso de vía pública (la ruta)', !!linea(P, /vía pública/));
ok('ni el interior del auto ni el packshot son una locación para alquilar', !linea(P, /^Locación — (AUTO|PACKSHOT)/));
ok('el locutor no va al elenco del rodaje', !P.lineas.some(l => l.dep === 'elenco' && /LOCUTOR/.test(l.concepto)));
ok('puestas estimadas (aéreo, vehículo, detalle, packshot…)', A.puestas >= 6 && A.escenas[0].puestas.some(p => p.tipo === 'Aéreo'), A.puestas + ' puestas');

console.log('\n--- 2. UNAS POCAS FRASES (el snack) ---');
importarGuion(F.frases);
d = getD(); A = analizarDesglose(py); P = propuestaPresupuesto();
ok('tres bloques: cocina, terraza y la placa final', d.escenas.length === 3 && d.escenas[0].locacion === 'COCINA' && d.escenas[1].locacion === 'TERRAZA' && d.escenas[2].locacion === 'PACKSHOT',
  d.escenas.map(e => e.locacion).join(' | '));
ok('tres amigos: elenco secundario × 3 (no extras)', A.grupos.elenco.some(x => x.k === 'g:amigos' && x.cantidad === 3 && x.sub === 'Secundarios'));
ok('una multitud: extras con cantidad estimada (confianza media)', A.grupos.elenco.some(x => x.k === 'x:multitud' && x.conf === 'media' && x.cantidad >= 20));
ok('slow motion = alta velocidad con confianza media; macro, alta', A.grupos.camara.find(x => x.k === 'altavel').conf === 'media' && A.grupos.camara.find(x => x.k === 'macro').conf === 'alta');
ok('con confianza media se propone sólo la cámara (sin el técnico)', !!linea(P, /alta velocidad/) && !linea(P, /Técnico de Phantom/));
ok('humo y fuegos artificiales (con permiso de pirotecnia)', tiene(A, 'sfx', 'humo') && tiene(A, 'sfx', 'piro') && !!linea(P, /Permiso especial de pirotecnia/));
ok('el crunch exagerado es diseño sonoro', tiene(A, 'post', 'sonoro'));
ok('el paquete en 3D y el claim animado', tiene(A, 'post', 'packshot3d') && tiene(A, 'post', 'motion'));
ok('20″ y 6″ para stories: cutdown de 6″ y redes', tiene(A, 'entregas', 'cut6') && tiene(A, 'entregas', 'redes') && !tiene(A, 'entregas', 'cut20'));

console.log('\n--- 3. UN STORYBOARD CON TEXTO (la gaseosa) ---');
importarGuion(F.story);
d = getD(); A = analizarDesglose(py); P = propuestaPresupuesto();
ok('seis cuadros, seis bloques', d.escenas.length === 6, d.escenas.length);
ok('el texto del cuadro no es la locación: playa, exterior, de día', d.escenas[0].locacion === 'PLAYA' && d.escenas[0].intExt === 'EXT' && d.escenas[0].momento === 'DÍA', d.escenas[0].locacion);
ok('los cuadros siguientes siguen en la playa', d.escenas.slice(1, 5).every(e => e.locacion === 'PLAYA'), d.escenas.map(e => e.locacion).join('|'));
ok('«SUPER:» es texto en pantalla, no un supermercado', !d.escenas.some(e => e.locacion === 'SUPER'));
ok('el cuadro 5 es en hora dorada', d.escenas[4].momento === 'HORA DORADA');
ok('Martina (25) principal; bañistas a extras', A.grupos.elenco.some(x => x.k === 'p:martina' && x.sub === 'Principal') && A.grupos.elenco.some(x => x.k === 'x:banistas'));
ok('dron, steadicam y macro', ['dron', 'steadicam', 'macro'].every(k => tiene(A, 'camara', k)), det(A, 'camara').join(','));
ok('croma → composición en la post y el fondo en arte', !!P.lineas.find(l => l.rubro === '14' && /composici/.test(l.concepto)) && !!P.lineas.find(l => l.rubro === '06' && /croma/i.test(l.concepto)));
ok('el splash es un efecto de agua (alta)', A.grupos.sfx.find(x => x.k === 'agua').conf === 'alta');
ok('el packshot con logo animado es filmado (no 3D) + motion graphics', tiene(A, 'post', 'packshot') && !tiene(A, 'post', 'packshot3d') && tiene(A, 'post', 'motion'));
ok('el perro va a animales', A.grupos.vehiculos.some(x => x.k === 'dep:animales'));
ok('locución (off) y cutdowns de 15″ y 6″', tiene(A, 'post', 'locucion') && tiene(A, 'entregas', 'cut15') && tiene(A, 'entregas', 'cut6'));
ok('ninguna detección de confianza alta sin evidencia', ['camara', 'sfx', 'post', 'entregas'].every(c => A.grupos[c].every(x => x.evid.length && x.evid[0].frase)));

/* storyboard en imágenes sueltas: el nombre del archivo, si dice algo, es el texto del cuadro */
ok('el nombre del archivo como texto del cuadro', textoDeNombreArchivo('03-dron-sobre-la-ruta.jpg') === '3: dron sobre la ruta' && leerCaption(textoDeNombreArchivo('03-dron-sobre-la-ruta.jpg')).numero === '3');
ok('«IMG_1234.jpg» o «frame01.png» no dicen nada', textoDeNombreArchivo('IMG_1234.jpg') === '' && textoDeNombreArchivo('frame01.png') === '');
materialDesdeCuadros(py, ['01-plano-general-con-dron-de-la-playa.jpg', '02-macro-de-la-lata-en-camara-lenta.png'].map(f => ({img: '', texto: textoDeNombreArchivo(f)})), 'imágenes');
A = analizarDesglose(py);
ok('y se desglosa: dron y macro salen de los nombres', tiene(A, 'camara', 'dron') && tiene(A, 'camara', 'macro'), det(A, 'camara').join(','));

console.log('\n--- 4. PRECISIÓN: LO QUE NO ESTÁ NO SALE ---');
importarGuion('Una cocina de día. Una mujer prepara el desayuno y sonríe a cámara. Plano medio. Luego toma un café en el living.');
A = analizarDesglose(py);
ok('sin cámara especial, efectos ni post especial', !A.grupos.camara.length && !A.grupos.sfx.length && !A.grupos.post.length && !A.grupos.entregas.length,
  ['camara', 'sfx', 'post', 'entregas'].map(c => det(A, c).join(',')).join(' / '));
importarGuion('EXT. CALLE - DÍA\n\nDe golpe, Juan cruza la calle.');
ok('«de golpe» no es una escena de riesgo', !getD().escenas.some(e => (e.elementos.stunts || []).length));

console.log('\n--- 5. LA PANTALLA «PARA COTIZAR» ---');
importarGuion(F.brief);
DB.ui.tab = 'desglose'; DB.ui.subDesglose = 'cotizar'; render();
let h = app.innerHTML;
ok('agrupa por lo que piensa el que cotiza', ['Escenas y puestas', 'Elenco', 'Cámara especial', 'Efectos especiales en set', 'Postproducción y VFX', 'Versiones y entregables'].every(t => h.includes(t)));
ok('con la evidencia, la confianza y la línea propuesta', /«[^»]*dron[^»]*»/i.test(h) && /class="conf alta"/.test(h) && /class="conf media"/.test(h) && /Alquiler de drone/.test(h));
ok('y el botón para aplicar', /aPresupuesto\(\)/.test(h) && /Aplicar al presupuesto/.test(h));

console.log('\n--- 6. APLICAR AL PRESUPUESTO: SIN DUPLICAR, ACTUALIZANDO, CON DESHACER ---');
const v = getV();
const cuenta = () => v.rubros.reduce((s, r) => s + r.lineas.length, 0);
const antes = cuenta(), totalAntes = calcular(v).total;
P = propuestaPresupuesto();
aPresupuesto();
ok('la lista viene toda tildada', (modal.match(/data-i="\d+" checked/g) || []).length === P.lineas.filter(l => !(l.ya && !l.cambia)).length);
ok('con la cantidad y los días para corregir', /data-q="\d+"/.test(modal) && /data-d="\d+"/.test(modal));
const iCic = P.lineas.findIndex(l => /^Extras — ciclistas/.test(l.concepto));
/* todo, pero los ciclistas en 8 en vez de 10 */
let res = confirmarAPresupuesto(P.lineas.map((l, i) => ({i, cantidad: i === iCic ? 8 : null, dias: null})));
const nuevas = P.lineas.filter(l => !l.ya).length;
ok('crea las líneas nuevas', cuenta() === antes + nuevas && res.creadas === nuevas, `${antes} -> ${cuenta()} (${nuevas} nuevas)`);
ok('con la cantidad corregida', v.rubros.find(r => r.codigo === '09').lineas.find(l => /^Extras — ciclistas/.test(l.concepto)).cantidad === 8);
const P2 = propuestaPresupuesto();
ok('la segunda vez todo «ya está»', P2.lineas.every(l => l.ya), P2.lineas.filter(l => !l.ya).map(l => l.concepto).join(' / '));
ok('los ciclistas (8 en el presupuesto, el desglose pide 10) se proponen actualizar', !!P2.lineas.find(l => /ciclistas/.test(l.concepto) && l.cambia && l.cambia.cantidad[0] === 8 && l.cambia.cantidad[1] === 10));
const n2 = cuenta();
res = confirmarAPresupuesto(P2.lineas.map((l, i) => ({i})));
ok('aplicar de nuevo no duplica nada', cuenta() === n2 && res.creadas === 0, cuenta() + ' líneas');
ok('pero actualiza lo que pide más', res.actualizadas === 1 && v.rubros.find(r => r.codigo === '09').lineas.find(l => /^Extras — ciclistas/.test(l.concepto)).cantidad === 10);
/* lo que alguien subió a mano no se baja */
const cic = v.rubros.find(r => r.codigo === '09').lineas.find(l => /^Extras — ciclistas/.test(l.concepto)); cic.cantidad = 14;
const P3 = propuestaPresupuesto();
confirmarAPresupuesto(P3.lineas.map((l, i) => ({i})));
ok('lo que se subió a mano no se baja', cic.cantidad === 14);
/* deshacer: el aviso trae la función */
const conDeshacer = [];
const toastOrig = toast; toast = (m, o) => { if(o && o.fn) conDeshacer.push(o.fn); };
const antesDeshacer = cuenta();
importarGuion(F.frases);
const P4 = propuestaPresupuesto();
confirmarAPresupuesto(P4.lineas.map((l, i) => ({i})));
const despues = cuenta();
conDeshacer[conDeshacer.length - 1]();
toast = toastOrig;
ok('Deshacer deja el presupuesto como estaba', getV().rubros.reduce((s, r) => s + r.lineas.length, 0) === antesDeshacer && despues > antesDeshacer, `${antesDeshacer} -> ${despues} -> ${getV().rubros.reduce((s, r) => s + r.lineas.length, 0)}`);
ok('nada se tocó del presupuesto sólo por desglosar', (() => { const c = cuenta(); importarGuion(F.story); return cuenta() === c; })());

console.log('\n--- 7. EL GUION DE FICCIÓN SIGUE ANDANDO ---');
importarGuion('1. INT. COCINA - NOCHE\n\nANA (40) lava los platos.\n\nANA\n¿Quién es?\n\n2. EXT. CALLE - DÍA\n\nPEDRO corre.\n\nPEDRO\n¡Esperá!');
d = getD();
ok('encabezados, momento y personajes con diálogo', d.modo === 'encabezados' && d.escenas.length === 2 && d.escenas[0].momento === 'NOCHE' && d.escenas[0].personajes.includes('ANA') && d.escenas[1].personajes.includes('PEDRO'));

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
