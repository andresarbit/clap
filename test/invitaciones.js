/* El acceso es por proyecto, no por productora.

   La idea: un técnico trabaja para varias productoras y tiene sentido que las
   tenga todas anotadas. Pero anotarlas no puede darle acceso a nada, porque si
   no cualquiera se agrega y ve presupuestos ajenos. La puerta la abre la
   productora, invitándolo a un proyecto puntual.

   Administración y Productor Ejecutivo entran a todo sin invitación: son los
   que llevan la casa. */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

DB = dbVacia(); sembrar();
const PR = getPr();
const [uArte, uProd, uEjec, uAdmin] = PR.usuarios;

/* dos proyectos, para que haya de dónde elegir */
const py1 = getPy();
const py2 = nuevoProyecto({ nombre: 'Spot Invierno' });
PR.proyectos.push(py2);

console.log('--- 1. QUIEN VE TODO Y QUIEN NO ---');
ok('Administración ve todo sin invitación', veTodo(uAdmin));
ok('Productor Ejecutivo también', veTodo(uEjec));
ok('Producción no', !veTodo(uProd));
ok('Equipo tampoco', !veTodo(uArte));

console.log('\n--- 2. LOS DOS ROLES QUE MANEJAN TODO EL CIRCUITO ---');
[['cargar', true], ['revisar', true], ['aprobar', true], ['pagar', true]].forEach(([a, esp]) => {
  ok(`el Ejecutivo puede ${a}`, puede(uEjec, a) === esp);
});
ok('Administración también puede pagar', puede(uAdmin, 'pagar'));
ok('Producción sigue sin poder aprobar', !puede(uProd, 'aprobar'));
ok('Equipo sigue sólo cargando', puede(uArte, 'cargar') && !puede(uArte, 'revisar'));
ok('el rol lo dice en su descripción', /todo el circuito/i.test(ROL('ejecutivo').d), ROL('ejecutivo').d);

console.log('\n--- 3. SIN INVITACION NO SE ENTRA ---');
py1.invitados = []; py2.invitados = [];
ok('el admin entra igual a los dos', entraAlProyecto(py1, uAdmin) && entraAlProyecto(py2, uAdmin));
ok('el ejecutivo también', entraAlProyecto(py1, uEjec) && entraAlProyecto(py2, uEjec));
ok('el de arte no entra a ninguno', !entraAlProyecto(py1, uArte) && !entraAlProyecto(py2, uArte));
ok('y su lista de proyectos está vacía', proyectosDe(PR, uArte).length === 0);
ok('la del admin tiene los dos', proyectosDe(PR, uAdmin).length === 2);

console.log('\n--- 4. INVITAR ABRE UNA PUERTA, NO TODAS ---');
DB.ui.usuarioId = uAdmin.id;
invitar(py1.id, uArte.id, true);
ok('ahora entra al proyecto al que lo invitaron', entraAlProyecto(py1, uArte));
ok('pero NO al otro', !entraAlProyecto(py2, uArte));
ok('su lista tiene exactamente uno', proyectosDe(PR, uArte).length === 1,
  proyectosDe(PR, uArte).map(p => p.nombre).join(','));
ok('quedó anotado en el proyecto', py1.invitados.includes(uArte.id));
ok('invitarlo dos veces no lo duplica',
  (invitar(py1.id, uArte.id, true), py1.invitados.filter(i => i === uArte.id).length === 1));

console.log('\n--- 5. DESINVITAR CIERRA LA PUERTA ---');
invitar(py1.id, uArte.id, false);
ok('ya no entra', !entraAlProyecto(py1, uArte));
ok('y no quedó rastro en la lista', !py1.invitados.includes(uArte.id));

console.log('\n--- 6. VARIAS PRODUCTORAS EN EL PERFIL, SIN ACCESO A TODAS ---');
/* el mismo técnico, anotado en otra productora donde nadie lo invitó */
const pr2 = nuevaProductora({ nombre: 'Otra Productora' });
const yoEnPr2 = nuevoUsuario({ nombre: uArte.nombre, rol: 'equipo', depto: 'Arte' });
pr2.usuarios.push(yoEnPr2);
const pyAjeno = nuevoProyecto({ nombre: 'Campaña ajena' });
pyAjeno.invitados = [];
pr2.proyectos.push(pyAjeno);
DB.productoras.push(pr2);
ok('figura en la otra productora', pr2.usuarios.some(u => u.nombre === uArte.nombre));
ok('pero no ve ninguno de sus proyectos', proyectosDe(pr2, yoEnPr2).length === 0);
ok('el proyecto ajeno le queda cerrado', !entraAlProyecto(pyAjeno, yoEnPr2));

console.log('\n--- 7. LA GRILLA DE INVITACIONES ---');
DB.ui.usuarioId = uAdmin.id;
DB.ui.productoraId = PR.id;
let html = bloqueInvitaciones(PR);
ok('lista los proyectos', /Spot Verano/.test(html) && /Spot Invierno/.test(html));
ok('muestra a los que necesitan invitación', new RegExp(uArte.nombre.split(' ')[0]).test(html));
ok('no muestra a los que entran igual', !new RegExp(uAdmin.nombre.split(' ')[0]).test(html),
  'el admin no debe estar en la grilla');
ok('explica por qué no están', /entran a todo/i.test(html));
ok('tiene casillas para marcar', /type="checkbox"/.test(html));
ok('dice cuántos van invitados', /de \d+ invitados/.test(html));

console.log('\n--- 8. SOLO PUEDE INVITAR QUIEN LLEVA LA CASA ---');
DB.ui.usuarioId = uArte.id;
html = bloqueInvitaciones(PR);
ok('al de arte le aparecen deshabilitadas', /disabled/.test(html));
ok('y se lo dice', /Sólo Administración/.test(html));
DB.ui.usuarioId = uProd.id;
ok('a producción también', /disabled/.test(bloqueInvitaciones(PR)));
DB.ui.usuarioId = uEjec.id;
ok('al ejecutivo no', !/disabled/.test(bloqueInvitaciones(PR)));

console.log('\n--- 9. SI ME SACO DEL PROYECTO QUE ESTOY MIRANDO ---');
DB.ui.usuarioId = uAdmin.id;
invitar(py1.id, uProd.id, true);
invitar(py2.id, uProd.id, true);
DB.ui.usuarioId = uProd.id;
DB.ui.proyectoId = py1.id;
DB.ui.usuarioId = uAdmin.id;
invitar(py1.id, uProd.id, false);
DB.ui.usuarioId = uProd.id;
ok('le queda el otro proyecto', proyectosDe(PR, uProd).length === 1,
  proyectosDe(PR, uProd).map(p => p.nombre).join(','));

console.log('\n--- 10. NADIE PIERDE ACCESO AL ACTUALIZAR ---');
/* un proyecto viejo, de antes de que existieran las invitaciones */
const viejo = nuevoProyecto({ nombre: 'Proyecto de antes' });
delete viejo.invitados;
PR.proyectos.push(viejo);
migrar();
ok('al migrar se invita a todo el equipo que ya estaba',
  PR.usuarios.every(u => viejo.invitados.includes(u.id)), viejo.invitados.length + ' invitados');
ok('así que el de arte sigue entrando como antes', entraAlProyecto(viejo, uArte));
ok('y migrar de nuevo no lo cambia',
  (migrar(), viejo.invitados.filter(i => i === uArte.id).length === 1));

console.log('\n--- 11. EL SELECTOR DEL HEADER MUESTRA SOLO LO SUYO ---');
DB.ui.usuarioId = uArte.id;
DB.ui.proyectoId = viejo.id;
const cab = header(PR, getPy(), getV());
ok('el de arte ve el que le toca', /Proyecto de antes/.test(cab));
ok('y no ve Spot Invierno', !/Spot Invierno/.test(cab));
DB.ui.usuarioId = uAdmin.id;
ok('el admin los ve todos', /Spot Invierno/.test(header(PR, getPy(), getV())));

console.log('\n--- 12. TODO SIGUE RENDERIZANDO ---');
const rotas = [];
DB.ui.usuarioId = uArte.id;
['resumen', 'guia', 'presu', 'desglose', 'callsheet', 'rodaje', 'gastos', 'equipo', 'catalogo', 'config']
  .forEach(k => { try { setTab(k); } catch (e) { rotas.push(k + ': ' + e.message); } });
DB.ui.usuarioId = uAdmin.id;
['resumen', 'presu', 'gastos', 'equipo']
  .forEach(k => { try { setTab(k); } catch (e) { rotas.push('admin/' + k + ': ' + e.message); } });
ok('ninguna vista se rompió', rotas.length === 0, rotas.slice(0, 3).join(' | ') || 'todas OK');

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
