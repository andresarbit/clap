/* Guiones de publicidad SIN encabezados: prosa, lista de planos y tabla VIDEO|AUDIO. */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const ver = (es) => es.forEach(e => console.log(
  `   ${String(e.numero).padStart(2)} ${e.intExt.padEnd(3)} ${e.locacion.padEnd(16)} ${e.momento.padEnd(9)} ${octavosATexto(e.octavos).padStart(4)}pg  ` +
  `[${e.personajes.join(', ') || '—'}]  ` +
  Object.entries(e.elementos).map(([k, v]) => DEPTO(k).l.split(' ')[0].toLowerCase() + ':' + v.join('/')).join(' ')));

/* ---------------------------------------------------- 1. prosa corrida */
const PROSA = `LAVANDINA X — 30"

Abrimos en una cocina soleada. Una MADRE limpia la mesada con un trapo.
Se la ve cansada pero tranquila.

Corte a: la HIJA entra corriendo con el perro embarrado y pisa todo el piso.

En el patio, de tarde, el perro sacude el barro contra la pared. La madre
mira por la ventana y se rie.

De noche, en la cocina otra vez, la mesada brilla. La madre apoya la botella
del producto sobre la mesada limpia.

MADRE: Listo.
`;
console.log('--- 1. PROSA CORRIDA (sin un solo INT/EXT) ---');
let RES = desglosar(PROSA);
ver(RES.escenas);
ok('modo párrafos', RES.modo === 'parrafos', RES.modo);
ok('4 bloques', RES.escenas.length === 4, RES.escenas.length);
ok('descarta el título de arriba', !RES.escenas.some(e => /LAVANDINA/.test(e.locacion)));
ok('infiere COCINA', RES.escenas[0].locacion === 'COCINA' && RES.escenas[0].intExt === 'INT',
  RES.escenas[0].locacion + '/' + RES.escenas[0].intExt);
ok('infiere PATIO como exterior', RES.escenas[2].locacion === 'PATIO' && RES.escenas[2].intExt === 'EXT',
  RES.escenas[2].locacion + '/' + RES.escenas[2].intExt);
ok('hereda la locación cuando el bloque no la nombra', RES.escenas[1].locacion === 'COCINA', RES.escenas[1].locacion);
ok('infiere TARDE', RES.escenas[2].momento === 'TARDE', RES.escenas[2].momento);
ok('infiere NOCHE', RES.escenas[3].momento === 'NOCHE', RES.escenas[3].momento);
ok('detecta MADRE', RES.escenas[0].personajes.includes('MADRE'), RES.escenas[0].personajes.join('|'));
ok('detecta HIJA', RES.escenas[1].personajes.includes('HIJA'), RES.escenas[1].personajes.join('|'));
ok('NO toma la locación como personaje', !RES.escenas.some(e => e.personajes.some(p => /COCINA|PATIO/.test(p))));
ok('detecta el perro', RES.escenas.some(e => (e.elementos.animales || []).includes('perro')));
ok('detecta la botella', RES.escenas.some(e => (e.elementos.utileria || []).includes('botella')));

/* ------------------------------------------------- 2. lista de planos */
const PLANOS = `Primer plano de unas zapatillas nuevas sobre el piso de un vestuario.

Plano general: un CHICO se las ata sentado en el banco.

Vemos la cancha vacia, de manana. El chico entra corriendo con la pelota.

Contraplano de la tribuna llena de GENTE gritando.

Cierre: el logo sobre fondo negro.
`;
console.log('\n--- 2. LISTA DE PLANOS ---');
RES = desglosar(PLANOS);
ver(RES.escenas);
ok('modo párrafos', RES.modo === 'parrafos', RES.modo);
ok('5 planos', RES.escenas.length === 5, RES.escenas.length);
ok('vestuario es interior', RES.escenas[0].intExt === 'INT', RES.escenas[0].intExt);
ok('cancha es exterior', RES.escenas[2].locacion === 'CANCHA' && RES.escenas[2].intExt === 'EXT',
  RES.escenas[2].locacion + '/' + RES.escenas[2].intExt);
ok('infiere MAÑANA', RES.escenas[2].momento === 'MAÑANA', RES.escenas[2].momento);
ok('detecta CHICO', RES.escenas[1].personajes.includes('CHICO'), RES.escenas[1].personajes.join('|'));
ok('detecta extras (GENTE)', RES.escenas[3].personajes.includes('GENTE') || (RES.escenas[3].elementos.extras || []).includes('gente'),
  RES.escenas[3].personajes.join('|') + ' / ' + (RES.escenas[3].elementos.extras || []).join(','));
ok('detecta la pelota', RES.escenas.some(e => (e.elementos.utileria || []).includes('pelota')));
ok('detecta las zapatillas', RES.escenas.some(e => (e.elementos.vestuario || []).includes('zapatillas')));

/* --------------------------------------------- 3. tabla VIDEO | AUDIO */
const TABLA = `VIDEO\tAUDIO
Plano abierto de una oficina moderna. Un EJECUTIVO mira el celular.\tLOCUTOR: Todos los dias tomas decisiones.
Corte a un auto saliendo de la cochera.\tSFX: motor arrancando
El auto en la ruta, de noche, bajo la lluvia.\tLOCUTOR: Algunas te llevan mas lejos.
Packshot del producto.\tLOCUTOR: Marca X.
`;
console.log('\n--- 3. TABLA VIDEO | AUDIO (pegada de Word) ---');
RES = desglosar(TABLA);
ver(RES.escenas);
ok('aplana la tabla y no la lee como una sola escena', RES.escenas.length >= 3, RES.escenas.length + ' escenas');
ok('descarta el encabezado VIDEO/AUDIO', !RES.escenas.some(e => /^VIDEO$/i.test(e.texto.trim())));
ok('detecta OFICINA', RES.escenas.some(e => e.locacion === 'OFICINA'), RES.escenas.map(e => e.locacion).join('|'));
ok('detecta el auto', RES.escenas.some(e => (e.elementos.vehiculos || []).includes('auto')));
ok('detecta la lluvia', RES.escenas.some(e => (e.elementos.sfx || []).includes('lluvia')));
ok('detecta LOCUTOR', RES.escenas.some(e => e.personajes.includes('LOCUTOR')), RES.escenas.flatMap(e => e.personajes).join('|'));
ok('no toma SFX ni AUDIO como personaje', !RES.escenas.some(e => e.personajes.some(p => /SFX|AUDIO|VIDEO/.test(p))));

/* --------------------------------- 4. un solo párrafo largo, de corrido */
const CORRIDO = 'Abrimos en una plaza al amanecer. Un HOMBRE corre solo entre los arboles. ' +
  'Corte a: el mismo hombre, ahora en un gimnasio, levantando pesas frente al espejo. ' +
  'Vemos su cara transpirada en primer plano, la respiracion agitada, los ojos fijos. ' +
  'Pasamos a la calle, de noche, bajo la lluvia: sigue corriendo, ya sin esfuerzo. ' +
  'Cierre: el producto sobre fondo negro y el logo de la marca apareciendo despacio.';
console.log('\n--- 4. TODO DE CORRIDO, UN SOLO PARRAFO ---');
RES = desglosar(CORRIDO);
ver(RES.escenas);
ok('corta por las frases que abren plano', RES.escenas.length >= 4, RES.escenas.length + ' bloques');
ok('primera es la plaza', RES.escenas[0].locacion === 'PLAZA' && RES.escenas[0].intExt === 'EXT',
  RES.escenas[0].locacion + '/' + RES.escenas[0].intExt);
ok('infiere AMANECER', RES.escenas[0].momento === 'AMANECER', RES.escenas[0].momento);
ok('detecta el gimnasio', RES.escenas.some(e => e.locacion === 'GIMNASIO'), RES.escenas.map(e => e.locacion).join('|'));
ok('el momento se arrastra hasta que cambia', RES.escenas[RES.escenas.length - 1].momento === 'NOCHE',
  RES.escenas.map(e => e.momento).join('|'));

/* -------------------------------- 5. no romper lo que ya funcionaba */
console.log('\n--- 5. NO ROMPER LOS GUIONES CON ENCABEZADO ---');
const conEnc = desglosar(require('fs').readFileSync('D:/Cuadro/test/guion-ejemplo.txt', 'utf-8'));
ok('sigue usando los encabezados cuando existen', conEnc.modo === 'encabezados', conEnc.modo);
ok('mismas 4 escenas de siempre', conEnc.escenas.length === 4, conEnc.escenas.length);
ok('locaciones intactas', conEnc.escenas.map(e => e.locacion).join('|') === 'COCINA DEPARTAMENTO|CALLE DEL BARRIO|PLAZA|COCINA DEPARTAMENTO',
  conEnc.escenas.map(e => e.locacion).join('|'));
const pub = desglosar('PLANO 1 - COCINA - DIA\nUna madre limpia.\n\nPLANO 2 - EXT. PATIO - DIA\nEl perro entra.\n');
ok('los encabezados de publicidad siguen ganando', pub.modo === 'encabezados' && pub.escenas.length === 2, pub.modo);

/* --------------------------------------------------- 6. casos límite */
console.log('\n--- 6. CASOS LIMITE ---');
ok('texto vacío', desglosar('').escenas.length === 0 && desglosar('').modo === 'nada');
ok('una sola línea', desglosar('Un tipo camina por la calle.').modo === 'bloque',
  desglosar('Un tipo camina por la calle.').modo);
ok('sólo espacios', desglosar('   \n\n   \n').escenas.length === 0);
ok('sin lugar conocido no explota', (() => { const x = desglosar('Algo pasa.\n\nOtra cosa pasa.'); return x.escenas.every(e => e.locacion); })(),
  desglosar('Algo pasa.\n\nOtra cosa pasa.').escenas.map(e => e.locacion).join('|'));

/* ------------------------- 7. herramientas para corregir a mano ---------- */
console.log('\n--- 7. UNIR / DIVIDIR / AGREGAR / ELIMINAR ---');
DB.ui.tab = 'desglose';
importarGuion(PROSA);
let d = getD();
ok('quedó en modo párrafos', d.modo === 'parrafos', d.modo);
ok('el aviso aparece arriba de las escenas', /Este guion no ten/.test(vistaDesglose(getPy())));
ok('4 escenas', d.escenas.length === 4, d.escenas.length);

/* unir la 2 con la 1 */
const antesTxt = d.escenas[0].texto.length;
const persAntes = [...d.escenas[0].personajes, ...d.escenas[1].personajes];
unirEscena(d.escenas[1].id);
ok('unir deja 3 escenas', d.escenas.length === 3, d.escenas.length);
ok('unir junta los textos', d.escenas[0].texto.length > antesTxt);
ok('unir junta los personajes', persAntes.every(p => d.escenas[0].personajes.includes(p)),
  d.escenas[0].personajes.join('|'));
ok('unir junta los elementos', (d.escenas[0].elementos.animales || []).includes('perro'));
ok('unir renumera 1,2,3', d.escenas.map(e => e.numero).join(',') === '1,2,3', d.escenas.map(e => e.numero).join(','));
ok('no se puede unir la primera', (() => { const n = d.escenas.length; unirEscena(d.escenas[0].id); return d.escenas.length === n; })());

/* dividir */
const paraDividir = d.escenas[0];
const lineas = paraDividir.texto.split('\n').filter(x => x.trim());
ok('la escena a dividir tiene varias líneas', lineas.length >= 2, lineas.length + ' líneas');
const octAntes = paraDividir.octavos;
const corte = paraDividir.texto.split('\n').findIndex((l, i) => i > 0 && l.trim());
hacerDivision(paraDividir.id, corte);
d = getD();
ok('dividir deja 4 escenas', d.escenas.length === 4, d.escenas.length);
ok('la nueva escena hereda locación e INT/EXT', d.escenas[1].locacion === d.escenas[0].locacion &&
  d.escenas[1].intExt === d.escenas[0].intExt, d.escenas[1].locacion + '/' + d.escenas[1].intExt);
ok('las páginas se reparten, no se duplican', d.escenas[0].octavos + d.escenas[1].octavos <= octAntes + 1,
  d.escenas[0].octavos + ' + ' + d.escenas[1].octavos + ' vs ' + octAntes);
ok('la nueva re-detecta sus elementos', typeof d.escenas[1].elementos === 'object');

/* agregar y eliminar */
const n0 = d.escenas.length;
addEscena();
ok('agregar escena al final', d.escenas.length === n0 + 1 && d.escenas[n0].locacion === 'Sin locación');
delEscena(d.escenas[n0].id);
ok('eliminar escena', d.escenas.length === n0, d.escenas.length);

/* todo lo de aguas abajo sigue funcionando después de editar a mano */
const rr = resumenDesglose(d);
ok('el resumen sigue bien', rr.escenas === d.escenas.length && rr.octavos > 0,
  rr.escenas + ' escenas · ' + octavosATexto(rr.octavos) + ' pg');
autoAgrupar();
ok('el plan de rodaje sigue funcionando', d.escenas.every(e => e.jornada), d.jornadas.length + ' jornadas');
ok('el puente al presupuesto sigue funcionando', propuestaPresupuesto().lineas.length > 0,
  propuestaPresupuesto().lineas.length + ' líneas propuestas');
ok('el callsheet sigue funcionando',
  (() => { try { DB.ui.jornada = 1; armarCallsheet(getPy(), getV(), 1); return true; } catch (e) { return e.message; } })() === true);

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
