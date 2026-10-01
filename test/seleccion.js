/* Seleccionar varios planos y moverlos, ponerles puesta o borrarlos juntos.
   ---------------------------------------------------------------------------
   Pedido: "un cuadrado de selección en algún costado para borrar en
   cantidades o seleccionar en cantidades y mover bloques enteros".         */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
global.confirm = () => true;

DB = dbVacia(); sembrar();
const pr = getPr();
const py = nuevoProyecto({ nombre: 'Spot Sel', tipo: 'publicidad' }); pr.proyectos.push(py);
DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;
py.desglose = nuevoDesglose();
py.desglose.jornadas = [nuevaJornada({ numero: 1, fecha: '2026-10-08' }), nuevaJornada({ numero: 2, fecha: '2026-10-09' })];
const p = planDe(py);
sincronizarPlan(py);
const P = [];
for (let i = 1; i <= 8; i++) { const it = nuevoItemPlan({ tipo: 'plano', numero: String(i), desc: 'Cuadro ' + i, set: i <= 4 ? 'Cocina' : 'Calle' }); p.items.push(it); it.orden = i; P.push(it); }
const ids = xs => xs.map(x => x.id);
const nums = num => p.items.filter(x => x.jornada === num && x.tipo === 'plano').sort((a, b) => a.orden - b.orden).map(x => x.numero).join(',');

console.log('--- 1. LAS CASILLAS ---');
DB.ui.tab = 'plan'; DB.ui.jornada = null; render();
ok('cada cuadro del banco tiene su casilla', (app.innerHTML.match(/class="pl-carta[^"]*" data-pl="[^"]+">\s*<input type="checkbox" class="pl-selcb/g) || []).length === 8);
ok('con nombre para el lector de pantalla', /aria-label="Seleccionar el plano 3"/.test(app.innerHTML));
ok('sin nada marcado no hay barra', !/pl-selbar/.test(app.innerHTML));
plSelClick({}, P[0].id); plSelClick({}, P[2].id);
ok('marcar dos muestra la barra con la cuenta', /2 seleccionados/.test(app.innerHTML) && /Mover a…/.test(app.innerHTML));
ok('el cuadro marcado se ve marcado', (app.innerHTML.match(/pl-carta sel/g) || []).length === 2);
plSelClick({}, P[2].id);
ok('volver a tocar desmarca', _plSel.size === 1);
plSelNada();
ok('"Quitar selección" vacía todo', _plSel.size === 0 && !/pl-selbar/.test(app.innerHTML));

console.log('\n--- 2. UN GRUPO ENTERO ---');
plAgrupar('fondo');
ok('cada grupo tiene su casilla', /aria-label="Seleccionar todo Cocina"/.test(app.innerHTML));
plSelGrupo(ids(P.slice(0, 4)), true);
ok('marca la puesta/el fondo entero', _plSel.size === 4 && /4 seleccionados/.test(app.innerHTML));
ok('y la casilla del grupo queda tildada', /checked onchange="plSelGrupo/.test(app.innerHTML.replace(/\s+/g, ' ')));

console.log('\n--- 3. MOVER EL BLOQUE ---');
plSelMover('1');
ok('los 4 pasan a la jornada 1, en el mismo orden', nums(1) === '1,2,3,4', nums(1));
ok('y la selección se vacía', _plSel.size === 0);
plSelGrupo(ids(P.slice(4, 8)), true);
plMoverVarios(plSeleccion().map(x => x.id), 1, P[1].id);
ok('arrastrar el bloque antes del plano 2 los mete juntos ahí', nums(1) === '1,5,6,7,8,2,3,4', nums(1));
const ev = p.items.find(x => x.jornada === 1 && x.tipo === 'evento');
plSelGrupo([P[6].id, P[7].id, ev.id], true);
plSelMover('banco');
ok('al banco van los planos; el evento se queda en el día', P[6].jornada == null && P[7].jornada == null && ev.jornada === 1);
plSelNada();
plSelGrupo(ids([P[0], P[4]]), true);
plMoverVarios(plSeleccion().map(x => x.id), 2);
ok('soltar sobre otra jornada los manda al final de esa', nums(2) === '1,5' && nums(1) === '6,2,3,4', nums(1) + ' / ' + nums(2));

console.log('\n--- 4. PUESTA Y BORRAR ---');
plSelGrupo(ids([P[1], P[2]]), true);
global.prompt = () => 'b';
plSelPuesta();
ok('"Ponerles puesta" a todos de una', P[1].emplazamiento === 'B' && P[2].emplazamiento === 'B');
const antes = p.items.length;
plSelGrupo(ids([P[1], P[2]]), true);
plSelBorrar();
ok('"Borrar" saca los marcados (y nada más)', p.items.length === antes - 2 && !p.items.includes(P[1]) && p.items.includes(P[3]));
ok('el día se reacomoda', nums(1) === '6,4', nums(1));

console.log('\n--- 5. EN LA JORNADA ---');
DB.ui.jornada = 1; render();
ok('los renglones del día también tienen casilla', /aria-label="Seleccionar el plano 6"/.test(app.innerHTML));
ok('y "Seleccionar todo" del día', /plSelTodo\(1\)/.test(app.innerHTML));
plSelTodo(1);
ok('marca todo el día (planos y eventos)', _plSel.size === p.items.filter(x => x.jornada === 1).length);
plSelNada();

console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
