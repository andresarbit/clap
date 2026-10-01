/* Desglose: el material de la agencia (guion, guion técnico, storyboard).
   ---------------------------------------------------------------------------
   Pedido: que el desglose reciba el guion, el guion de publicidad o el
   storyboard de la agencia (que ahora hacen con IA), sacar lo que no se usa
   y dejarlo listo.                                                          */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const fs = require('fs'), path = require('path');
const archivo = nombre => { const b = fs.readFileSync(path.join(__dirname, 'fixtures', nombre));
  return {name: nombre, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), text: async () => b.toString('utf8')}; };

DB = dbVacia(); sembrar();
const pr = getPr();
const py = nuevoProyecto({nombre: 'Spot Material', tipo: 'publicidad'});
pr.proyectos.push(py);
DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;
const d = getD();

console.log('--- 1. EL TEXTO DE CADA CUADRO DEL PDF ---');
/* página de 600 × 400 en grilla 3 × 2: cada pedazo de texto con su posición
   (y medida desde abajo, como en un PDF) */
const items = [
  {str: 'Frame 1: Casa al amanecer,', transform: [1,0,0,1, 20, 260]}, {str: 'plano general.', transform: [1,0,0,1, 20, 248]},
  {str: 'Frame 2: Ana en la cocina.', transform: [1,0,0,1, 220, 260]},
  {str: 'Frame 4: Ana en el jardín.', transform: [1,0,0,1, 20, 60]},
  {str: 'Frame 6: Packshot.', transform: [1,0,0,1, 420, 60]},
];
const T = textoPorCelda(items, 600, 400, 3, 2);
ok('seis celdas', T.length === 6);
ok('el texto de dos renglones queda junto en su cuadro', T[0] === 'Frame 1: Casa al amanecer,\nplano general.', JSON.stringify(T[0]));
ok('cada texto en su celda (arriba al medio, abajo a la izquierda, abajo a la derecha)', T[1] === 'Frame 2: Ana en la cocina.' && T[3] === 'Frame 4: Ana en el jardín.' && T[5] === 'Frame 6: Packshot.');
ok('la celda sin texto queda vacía', T[2] === '' && T[4] === '');
ok('"Frame 3: …" → número 3', JSON.stringify(leerCaption('Frame 3: Ana sonríe')) === '{"numero":"3","desc":"Ana sonríe"}');
ok('"12. …" y "Cuadro 4A - …"', leerCaption('12. Detalle').numero === '12' && leerCaption('Cuadro 4A - Logo').numero === '4A');
ok('un texto sin número queda entero', leerCaption('Ana abre la puerta').numero === '' && leerCaption('3 amigas en la playa').numero === '');

console.log('\n--- 2. DE LAS DESCRIPCIONES AL DESGLOSE ---');
const caps = ['Exterior de una casa al amanecer, plano general con dron.', 'Ana abre la puerta de la cocina y entra con el\nperro.',
  'Primer plano de Ana preparando el mate, luz de mañana.', 'Detalle de la yerba cayendo en el mate, camara lenta.',
  'Ana sale al jardin y se sienta en una reposera.', 'El auto del padre llega por la\ncalle de tierra.',
  'Interior del auto, el padre saluda por la ventanilla.', 'Ana y el padre comparten el mate en la galeria, atardecer.'];
const E = escenasDeDescripciones(caps.map(t => ({texto: t})), null);
ok('una escena por cuadro', E.length === 8);
ok('locación e INT/EXT del texto', E[0].locacion === 'CASA' && E[0].intExt === 'EXT' && E[1].locacion === 'COCINA' && E[1].intExt === 'INT');
ok('la calle aunque venga en otro renglón', E[5].locacion === 'CALLE' && E[5].intExt === 'EXT', E[5].locacion);
ok('"interior del auto" es la locación AUTO', E[6].locacion === 'AUTO' && E[6].intExt === 'INT');
ok('lo que no dice dónde sigue en el lugar anterior', E[3].locacion === 'COCINA');
ok('el momento sigue y cambia (amanecer, mañana, atardecer)', E[0].momento === 'AMANECER' && E[2].momento === 'MAÑANA' && E[7].momento === 'ATARDECER');
ok('Ana (escrita en minúscula, como en un board) es personaje', E[1].personajes.includes('ANA') && E[2].personajes.includes('ANA'));
ok('"el padre" también', E[5].personajes.includes('PADRE') && E[7].personajes.join() === 'ANA,PADRE', E[7].personajes.join());
ok('"Exterior" o "Primer" no son personajes', !E.some(e => e.personajes.some(p => /EXTERIOR|PRIMER|DETALLE|INTERIOR/.test(p))));
ok('elementos del diccionario: dron, perro, mate, auto', (E[0].elementos.equipo || []).includes('dron') && (E[1].elementos.animales || []).includes('perro') &&
  (E[2].elementos.utileria || []).includes('mate') && (E[5].elementos.vehiculos || []).includes('auto'));
ok('"cámara lenta" es equipo y la "cámara" no es utilería', (E[3].elementos.equipo || []).includes('camara lenta') && !(E[3].elementos.utileria || []).includes('camara'),
  JSON.stringify(E[3].elementos));

console.log('\n--- 3. STORYBOARD: CUADROS AL PLAN Y AL DESGLOSE ---');
const cuadros = caps.map((t, i) => ({img: 'data:image/jpeg;base64,xx', texto: `Frame ${i + 1}: ${t}`}));
materialDesdeCuadros(py, cuadros, 'board.pdf');
const planos = planDe(py).items.filter(x => x.tipo === 'plano');
ok('8 planos al banco del plan, con su imagen', planos.length === 8 && planos.every(x => x.jornada === null && x.img));
ok('con el número y la descripción del cuadro', planos[1].numero === '2' && /Ana abre la puerta/.test(planos[1].desc));
ok('el tamaño y el movimiento salen de la descripción', planos[0].tamano === 'Plano general' && planos[0].movimiento === 'Dron' && planos[3].movimiento === 'Cámara lenta / alta velocidad');
ok('el set es la locación de su bloque', planos[1].set === 'COCINA');
ok('8 bloques en el desglose', d.escenas.length === 8 && d.modo === 'storyboard');
ok('cada plano enlazado a su bloque', planos.every(x => d.escenas.some(e => e.id === x.escenaId)));
const sinTexto = [{img: 'data:image/jpeg;base64,yy', texto: ''}];
materialDesdeCuadros(py, sinTexto, 'imagen.jpg');
ok('un cuadro sin texto va al plan y no al desglose', planDe(py).items.filter(x => x.tipo === 'plano').length === 9 && d.escenas.length === 8);

console.log('\n--- 4. GUION TÉCNICO EN EXCEL ---');
(async () => {
  const py2 = nuevoProyecto({nombre: 'Spot Excel', tipo: 'publicidad'}); pr.proyectos.push(py2);
  DB.ui.proyectoId = py2.id; DB.ui.versionId = py2.versiones[0].id;
  await materialDesdeXlsx(py2, archivo('guion-tecnico-prueba.xlsx'));
  const d2 = getD(), pl2 = planDe(py2).items.filter(x => x.tipo === 'plano');
  ok('un bloque y un plano por renglón (5)', d2.escenas.length === 5 && pl2.length === 5, d2.escenas.length + ' / ' + pl2.length);
  ok('la locación de la columna Locación', d2.escenas[0].locacion === 'CASA - FRENTE' && d2.escenas[2].locacion === 'CASA - COCINA');
  ok('INT/EXT y momento de sus columnas', d2.escenas[0].intExt === 'EXT' && d2.escenas[0].momento === 'AMANECER' && d2.escenas[2].intExt === 'INT');
  ok('el elenco de la columna Elenco', d2.escenas[1].personajes.includes('ANA') && d2.escenas[1].personajes.includes('PERRO'));
  ok('el plano con su tamaño y enlazado', pl2[0].tamano === 'Plano general' && pl2[0].escenaId === d2.escenas[0].id);
  ok('modo guion técnico, con su aviso', d2.modo === 'tecnico' && /guion técnico/.test(avisoModoHTML(d2)));

  console.log('\n--- 5. LO QUE SE SACÓ Y LO QUE SE ARREGLÓ ---');
  DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;
  DB.ui.tab = 'desglose'; DB.ui.subDesglose = 'escenas'; render();
  let h = app.innerHTML;
  ok('la caja para soltar el material está arriba de los bloques', /Soltá acá lo que mandó la agencia/.test(h) && /soltarMaterial/.test(h));
  ok('en publicidad se cuentan bloques y planos, no páginas', /Bloques/.test(h) && /Planos en el plan/.test(h) && !/>Páginas</.test(h));
  ok('sin selector de jornada en cada escena (eso es del plan)', !/setJornada\(/.test(h));
  ok('sin "pg" en publicidad', !/class="epg"/.test(h));
  ok('"Re-detectar" pasó al menú del guion', !/onclick="reDetectar\(\)"/.test(h));
  const pc = nuevoProyecto({nombre: 'Largo', tipo: 'cine'}); pr.proyectos.push(pc);
  DB.ui.proyectoId = pc.id; DB.ui.versionId = pc.versiones[0].id;
  importarGuion('1. INT. COCINA - DÍA\n\nLUCÍA revuelve un mate.\n\nLUCÍA\nHace calor.\n\n2. EXT. CALLE - NOCHE\n\nUn auto pasa.');
  render(); h = app.innerHTML;
  ok('en cine siguen las páginas y los octavos', />Páginas</.test(h) && /class="epg"/.test(h) && /Escenas/.test(h));

  /* borrar el desglose no borra las jornadas */
  getD().jornadas = [normalizarJornada(nuevaJornada({numero: 1, fecha: '2026-10-20', citacion: '06:30'}))];
  getD().jornadas[0].hospital.nombre = 'Hospital Fernández';
  global.confirm = () => true;
  borrarDesglose();
  ok('borrar el desglose conserva las jornadas y su callsheet', getD().escenas.length === 0 && getD().jornadas.length === 1 &&
    getD().jornadas[0].hospital.nombre === 'Hospital Fernández');

  /* al presupuesto: no duplicar */
  DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;
  const v = getV();
  let P1 = propuestaPresupuesto();
  ok('la primera vez no hay nada repetido', P1.lineas.length > 0 && P1.lineas.every(l => !l.ya));
  aPresupuesto();
  global.document.querySelectorAll = q => /checkbox/.test(q) ? P1.lineas.map((l, i) => ({checked: true, dataset: {i: String(i)}})) : [];
  confirmarAPresupuesto();
  global.document.querySelectorAll = () => [];
  const P2 = propuestaPresupuesto();
  ok('la segunda vez todo figura como "ya está"', P2.lineas.every(l => l.ya), P2.lineas.filter(l => !l.ya).map(l => l.concepto).join(','));
  aPresupuesto();
  ok('y el modal lo avisa y las deja destildadas', /ya están en el presupuesto/.test(modal) && !/data-i="0" checked/.test(modal));

  console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
})().catch(e => { console.log('FALLA excepción: ' + e.stack); console.log('\n>>> 1 FALLA(S)'); });
