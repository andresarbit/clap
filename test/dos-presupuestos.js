/* Los dos presupuestos, y qué lleva IVA.
   ---------------------------------------------------------------------------
   De las notas de Willy:

     "Generalmente hay 2 presupuestos, el Real, que sólo lo tiene el productor
      y los dueños, y el que le pasan al jefe de producción, mucho más
      recortado. El jefe sólo accede al que le corresponde."

     "Hay que revisar en profundidad los lugares donde realiza cargas
      impositivas o el porcentaje de Fee, hay cosas que no llevan IVA."

   No se resuelve escondiendo líneas: son números distintos, así que son
   versiones distintas, y quién ve cuál lo decide el ROL.                     */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const casi = (a, b, tol = 1) => Math.abs(a - b) < tol;

DB = dbVacia(); sembrar();
const pr = getPr(), py = getPy();
const rolDe = k => pr.usuarios.find(u => u.rol === k);
const comoRol = k => { DB.ui.usuarioId = rolDe(k).id; return rolDe(k); };

console.log('--- 1. LOS TRES NIVELES ---');
ok('están los tres', NIVELES.map(x => x.k).join(',') === 'real,produccion,cliente');
ok('el Real es sólo de admin y ejecutivo',
  NIVEL('real').roles.join(',') === 'admin,ejecutivo');
ok('Producción lo ve también el jefe', NIVEL('produccion').roles.includes('produccion'));
ok('el de Cliente lo ve todo el mundo', NIVEL('cliente').roles.length === 4);
ok('una versión nueva nace como Producción', nuevaVersion().nivel === 'produccion');

console.log('\n--- 2. QUIEN VE QUE ---');
const vReal   = nuevaVersion({nombre:'Real', nivel:'real'});
const vProd   = nuevaVersion({nombre:'Producción', nivel:'produccion'});
const vCli    = nuevaVersion({nombre:'Cliente', nivel:'cliente'});
py.versiones = [vReal, vProd, vCli];

const ve = (rol, v) => veVersion(v, rolDe(rol));
ok('admin ve el Real', ve('admin', vReal));
ok('ejecutivo ve el Real', ve('ejecutivo', vReal));
ok('EL JEFE DE PRODUCCION NO VE EL REAL', !ve('produccion', vReal));
ok('equipo tampoco', !ve('equipo', vReal));
ok('el jefe SI ve el de Producción', ve('produccion', vProd));
ok('equipo NO ve el de Producción', !ve('equipo', vProd));
ok('todos ven el de Cliente',
  ['admin','ejecutivo','produccion','equipo'].every(r => ve(r, vCli)));

comoRol('produccion');
ok('el jefe ve dos versiones, no tres', versionesQueVeo(py).length === 2,
  versionesQueVeo(py).map(v => v.nombre).join(', '));
comoRol('equipo');
ok('el de equipo ve una', versionesQueVeo(py).length === 1,
  versionesQueVeo(py).map(v => v.nombre).join(', '));
comoRol('admin');
ok('admin ve las tres', versionesQueVeo(py).length === 3);

console.log('\n--- 3. NO SE PUEDE CAER EN EL REAL POR UN ID VIEJO ---');
DB.ui.versionId = vReal.id;
comoRol('produccion');
ok('getV() NO le devuelve el Real al jefe', getV().id !== vReal.id, getV().nombre);
ok('le devuelve una que sí puede ver', veVersion(getV()));
comoRol('admin');
DB.ui.versionId = vReal.id;
ok('a admin sí le devuelve el Real', getV().id === vReal.id);

console.log('\n--- 4. DERIVAR PRODUCCION DEL REAL ---');
comoRol('admin');
py.versiones = [vReal]; DB.ui.versionId = vReal.id;
const rb = c => getV().rubros.find(r => r.codigo === c);
rb('04').lineas.push(nuevaLinea({concepto:'Director de Fotografía', valorUnit:1000000}));
rb('11').lineas.push(nuevaLinea({concepto:'Paquete cámara', valorUnit:1000000}));
const subReal = calcular(getV()).subtotal;
ok('el Real suma 2.000.000', subReal === 2000000, fmt(subReal));

global.document.querySelectorAll = sel => /\[name\]/.test(sel)
  ? [{name:'nombre', value:'Real — Producción'}, {name:'recorte', value:'15'}] : [];
confirmarDerivar();

ok('se creó una versión nueva', py.versiones.length === 2);
const nueva = py.versiones[1];
ok('marcada como Producción', nueva.nivel === 'produccion', nueva.nivel);
ok('con el nombre que puse', nueva.nombre === 'Real — Producción');
ok('QUEDO 15% MAS ABAJO', casi(calcular(nueva).subtotal, subReal * 0.85),
  fmt(calcular(nueva).subtotal) + ' vs ' + fmt(subReal * 0.85));
ok('el jefe ve TODAS las líneas, no menos',
  nueva.rubros.reduce((s,r)=>s+r.lineas.length,0) ===
  vReal.rubros.reduce((s,r)=>s+r.lineas.length,0));
ok('el Real quedó intacto', calcular(vReal).subtotal === subReal);
nueva.rubros[0].lineas.forEach(l => l.valorUnit = 1);
ok('editar la de Producción no toca el Real', calcular(vReal).subtotal === subReal);
nueva.rubros.find(r=>r.codigo==='04').lineas[0].valorUnit = 850000;

console.log('\n--- 5. EL COLCHON, Y SOLO PARA QUIEN CORRESPONDE ---');
DB.ui.tab = 'presu'; DB.ui.vista = 'interna'; DB.ui.versionId = vReal.id;
comoRol('admin'); render();
ok('admin ve el panel Real vs Producción', /Real vs Producción/.test(app.innerHTML));
ok('con el colchón', /Colchón/.test(app.innerHTML));
comoRol('produccion'); render();
ok('EL JEFE NO VE EL COLCHON', !/Real vs Producción/.test(app.innerHTML));
ok('ni el nombre de la versión Real en el selector',
  !/>Real · Real/.test(app.innerHTML));
comoRol('admin');

/* si el de producción quedara por encima del real, hay que gritarlo */
nueva.rubros.find(r=>r.codigo==='04').lineas[0].valorUnit = 9000000;
DB.ui.versionId = vReal.id; render();
ok('avisa si Producción supera al Real', /por encima/.test(app.innerHTML));
nueva.rubros.find(r=>r.codigo==='04').lineas[0].valorUnit = 850000;

console.log('\n--- 6. EL BOTON DE DERIVAR ---');
DB.ui.versionId = vReal.id; render();
ok('en el Real ofrece "→ Producción"', /derivarProduccion\(\)/.test(app.innerHTML));
DB.ui.versionId = nueva.id; render();
ok('en el de Producción no lo ofrece', !/derivarProduccion\(\)/.test(app.innerHTML));
comoRol('produccion'); DB.ui.versionId = nueva.id; render();
ok('y el jefe nunca lo ve', !/derivarProduccion\(\)/.test(app.innerHTML));
comoRol('admin');

console.log('\n--- 7. LO QUE NO LLEVA IVA ---');
const v7 = nuevaVersion({nombre:'IVA', nivel:'real'});
py.versiones.push(v7); DB.ui.versionId = v7.id;
v7.capas = {fee:0, contingencia:0, iibb:0, iva:21};
const r7 = c => v7.rubros.find(r => r.codigo === c);
ok('el rubro de Seguros nace exento', r7('15').aplicaIva === false);
r7('04').lineas.push(nuevaLinea({concepto:'DF', valorUnit:1000000}));
r7('15').lineas.push(nuevaLinea({concepto:'Seguro de AP', valorUnit:500000}));

const R7 = calcular(v7);
ok('el subtotal suma todo', R7.subtotal === 1500000, fmt(R7.subtotal));
ok('reconoce lo exento', R7.exento === 500000, fmt(R7.exento));
ok('la base imponible deja afuera el seguro', R7.baseIva === 1000000, fmt(R7.baseIva));
ok('EL IVA SALE SOLO DE LO GRAVADO', R7.iva === 210000, fmt(R7.iva));
ok('y NO del total', R7.iva !== 1500000 * 0.21, 'sería ' + fmt(1500000 * 0.21));
ok('el total cierra', R7.total === 1500000 + 210000, fmt(R7.total));

/* el fee y la contingencia sí van gravados */
v7.capas.fee = 10;
const R7b = calcular(v7);
ok('el fee entra en la base imponible',
  casi(R7b.baseIva, R7b.neto - 500000), fmt(R7b.baseIva));
v7.capas.fee = 0;

console.log('\n--- 8. SE PUEDE CAMBIAR A MANO ---');
upRubro(r7('15').id, 'aplicaIva', true);
ok('marcar gravado sube el IVA', calcular(v7).iva === 1500000 * 0.21,
  fmt(calcular(v7).iva));
upRubro(r7('15').id, 'aplicaIva', false);
ok('volver a exento lo baja', calcular(v7).iva === 210000);
upRubro(r7('04').id, 'aplicaFee', false);
ok('también se puede sacar del fee', r7('04').aplicaFee === false);
upRubro(r7('04').id, 'aplicaFee', true);

DB.ui.tab = 'presu'; r7('15').abierto = true; render();
ok('el rubro exento se marca en pantalla', /s\/IVA/.test(app.innerHTML));
ok('y el panel muestra lo exento', /Exento de IVA/.test(app.innerHTML));
ok('con los botones para cambiarlo', /upRubro\(/.test(app.innerHTML));

console.log('\n--- 9. LA MIGRACION NO ROMPE LO QUE YA HABIA ---');
DB = dbVacia(); sembrar();
const vAntes = getV(); delete vAntes.nivel;
const totalAntes = calcular(vAntes).total;
migrar();
ok('las versiones viejas quedan como Producción', getV().nivel === 'produccion');
ok('el total no cambió', calcular(getV()).total === totalAntes, fmt(calcular(getV()).total));
ok('el jefe de producción las sigue viendo', veVersion(getV(), rolDe('produccion')));

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
