/* =============================================================================
   FLUJO COMPLETO DE UNA PRODUCCION, de punta a punta.
   No prueba funciones sueltas: arranca con una productora vacía y recorre todo
   el trabajo real, verificando que los números aten en cada paso y que el dato
   cargado una vez aparezca en todos lados.
   ========================================================================== */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const paso = t => console.log('\n═══ ' + t + ' ' + '═'.repeat(Math.max(0, 62 - t.length)));

/* arrancamos de cero, sin la semilla */
DB = dbVacia();

/* ─────────────────────────────────────────── 1. la productora y el equipo */
paso('1. ALTA DE PRODUCTORA Y EQUIPO');
const pr = nuevaProductora({ nombre: 'Pampa Films', cuit: '30-71999888-7', jurisdiccion: 'CABA' });
DB.productoras = [pr]; DB.ui.productoraId = pr.id;
const mk = (nombre, rol, depto) => { const u = nuevoUsuario({ nombre, rol, depto, tel: '11 5555-' + (1000 + pr.usuarios.length), email: nombre.split(' ')[0].toLowerCase() + '@pampa.com' }); pr.usuarios.push(u); return u; };
const uArte = mk('Sofía Roldán', 'equipo', 'Arte');
const uProd = mk('Lucía Ferrer', 'produccion', 'Producción');
const uEjec = mk('Andrés Pereyra', 'ejecutivo', 'Producción');
const uAdm = mk('Marta Giles', 'admin', 'Administración');
DB.ui.usuarioId = uEjec.id;
ok('productora creada sin proyectos', pr.proyectos.length === 0);
ok('4 personas con sus roles', pr.usuarios.length === 4);
ok('la sesión es el ejecutivo', getUsuario().id === uEjec.id, getUsuario().nombre);

/* ────────────────────────────────────────────────────── 2. el proyecto */
paso('2. PROYECTO');
const py = nuevoProyecto({
  nombre: 'Spot Lavandina 40"', tipo: 'publicidad', cliente: 'Marca Z',
  agencia: 'Agencia W', producto: 'Lavandina', medios: 'Digital + TV', territorio: 'Argentina', plazo: '12 meses'
});
pr.proyectos.push(py); DB.ui.proyectoId = py.id;
const v = py.versiones[0]; DB.ui.versionId = v.id;
v.tc = 1420; v.tcNombre = 'MEP'; v.tcFecha = '2026-08-25';
Object.assign(v.capas, { fee: pr.feeDefault, contingencia: pr.contingenciaDefault, iva: pr.ivaDefault, iibb: pr.iibbDefault });
ok('el presupuesto arranca en cero', calcular(v).total === 0);
ok('trae los 17 rubros', v.rubros.length === 17, v.rubros.length);
ok('toma los defaults de la productora', v.capas.fee === 15 && v.capas.iva === 21);

/* ──────────────────────────────────────────── 3. guion sin encabezados */
paso('3. GUION (publicitario, sin un solo INT/EXT)');
const GUION = `LAVANDINA Z — "MUDANZA" 40"

Abrimos en una cocina vacia, de manana. Una MADRE joven termina de limpiar
la mesada con un trapo. El sol entra por la ventana sin cortinas.

Corte a: en el patio, de tarde, el PERRO entra embarrado y pisa todo el piso.
La HIJA lo mira y se rie.

Vemos la calle: el camion de mudanza esperando. Un FLETERO fuma apoyado en la puerta.

De noche, en la cocina otra vez, la mesada brilla. La madre apoya la botella
del producto sobre la mesada limpia.

MADRE: Listo.
`;
DB.ui.tab = 'desglose';
importarGuion(GUION);
const d = getD();
console.log(d.escenas.map(e => `    ${e.numero} ${e.intExt.padEnd(3)} ${e.locacion.padEnd(14)} ${e.momento.padEnd(8)} ${octavosATexto(e.octavos)}pg  [${e.personajes.join(',')}]`).join('\n'));
ok('lo desglosa igual sin encabezados', d.escenas.length === 4, d.escenas.length + ' bloques');
ok('avisa que infirió', d.modo === 'parrafos', d.modo);
ok('infiere locaciones', new Set(d.escenas.map(e => e.locacion)).size === 3,
  [...new Set(d.escenas.map(e => e.locacion))].join(' | '));
ok('detecta al elenco', ['MADRE', 'HIJA', 'FLETERO'].every(p => d.escenas.some(e => e.personajes.includes(p))),
  [...new Set(d.escenas.flatMap(e => e.personajes))].join(','));
ok('detecta el perro', d.escenas.some(e => (e.elementos.animales || []).includes('perro')));
ok('detecta el camión', d.escenas.some(e => (e.elementos.vehiculos || []).includes('camion')));

/* corregir a mano lo que el parser puso mal, como haría una persona */
const escCalle = d.escenas.find(e => /CALLE/.test(e.locacion));
if (escCalle && escCalle.intExt !== 'EXT') { cicloIE(escCalle.id); if (escCalle.intExt !== 'EXT') cicloIE(escCalle.id); }
ok('el INT/EXT se corrige con clicks', !escCalle || escCalle.intExt === 'EXT', escCalle?.intExt);

/* ──────────────────────────────────────────────── 4. plan de rodaje */
paso('4. PLAN DE RODAJE');
setPagJornada(0.25);
autoAgrupar();
console.log(d.jornadas.map(j => `    J${j.numero}: ` +
  d.escenas.filter(e => e.jornada === j.numero).map(e => e.numero + ' ' + e.locacion).join(' · ')).join('\n'));
ok('reparte las escenas en jornadas', d.escenas.every(e => e.jornada), d.jornadas.length + ' jornadas');
ok('agrupa por locación', (() => {
  const porLoc = {}; d.escenas.forEach(e => (porLoc[e.locacion] ||= new Set()).add(e.jornada));
  return Object.values(porLoc).filter(s => s.size > 1).length <= 1;
})(), 'como mucho una locación partida');

/* ───────────────────────────────────── 5. del desglose al presupuesto */
paso('5. DESGLOSE → PRESUPUESTO');
const prop = propuestaPresupuesto();
console.log(prop.lineas.map(l => `    ${l.rubro} ${String(l.cantidad)}x${String(l.dias).padEnd(2)} ${l.concepto}`).join('\n'));
const antesLineas = v.rubros.reduce((s, r) => s + r.lineas.length, 0);
ok('el presupuesto está vacío antes', antesLineas === 0);
/* crear todas las líneas propuestas */
prop.lineas.forEach(l => {
  const rb = v.rubros.find(r => r.codigo === l.rubro);
  rb.lineas.push(nuevaLinea({ concepto: l.concepto, cantidad: l.cantidad, dias: l.dias, unidad: l.unidad, valorUnit: 0, notas: l.nota }));
});
py.jornadas = prop.jornadas;
ok('crea una línea por propuesta', v.rubros.reduce((s, r) => s + r.lineas.length, 0) === prop.lineas.length,
  prop.lineas.length + ' líneas');
ok('una línea por personaje, sin el perro', prop.lineas.filter(l => l.dep === 'elenco').length === 3,
  prop.lineas.filter(l => l.dep === 'elenco').map(l => l.concepto).join(', '));
ok('el perro va a Animales, no a elenco',
  !prop.lineas.some(l => l.dep === 'elenco' && /PERRO/i.test(l.concepto)) &&
  prop.lineas.some(l => /Animales/.test(l.concepto)));
ok('una línea por locación', prop.lineas.filter(l => l.dep === 'locacion').length === 3);
ok('todas arrancan en cero', v.rubros.every(r => r.lineas.every(l => l.valorUnit === 0)));
ok('el proyecto queda con las jornadas del plan', py.jornadas === d.jornadas.length, py.jornadas);

/* ───────────────────────────────── 6. cargar el crew y los valores */
paso('6. CREW Y VALORES');
const df = nuevaPersona({ nombre: 'Martín Bevilacqua', funcion: 'Director de Fotografía', rubro: '04', tarifaRef: 973242, condicion: 'Monotributista', cuit: '20-28456789-3', tel: '11 5555-2001', email: 'martin@df.com' });
DB.catalogo.personas.push(df);
ok('el catálogo trae el piso de convenio', sicaDe('Director de Fotografía', '04').j8 === 973242);
const r04 = v.rubros.find(r => r.codigo === '04');
r04.lineas.push(nuevaLinea({ concepto: 'Director de Fotografía', refId: df.id, valorUnit: 1100000, dias: 2 }));
const r02 = v.rubros.find(r => r.codigo === '02');
r02.lineas.push(nuevaLinea({ concepto: 'Director', valorUnit: 900000, dias: 2 }));
const r03 = v.rubros.find(r => r.codigo === '03');
r03.lineas.push(nuevaLinea({ concepto: 'Jefa de Producción', valorUnit: 600000, dias: 3 }));
/* elenco en dólares, como suele pasar en publicidad */
const r09 = v.rubros.find(r => r.codigo === '09');
r09.lineas.find(l => l.concepto === 'MADRE').valorUnit = 1500;
r09.lineas.find(l => l.concepto === 'MADRE').moneda = 'USD';
/* equipamiento y catering */
const r11 = v.rubros.find(r => r.codigo === '11');
r11.lineas.push(nuevaLinea({ concepto: 'Paquete cámara + ópticas', valorUnit: 900000, dias: 2 }));
const r13 = v.rubros.find(r => r.codigo === '13');
r13.lineas.push(nuevaLinea({ concepto: 'Almuerzo', cantidad: 30, dias: 2, valorUnit: 14000 }));

const PRESU = calcular(v);
console.log(`    subtotal ${fmt(PRESU.subtotal)} · fee ${fmt(PRESU.fee)} · conting. ${fmt(PRESU.contingencia)} · IVA ${fmt(PRESU.iva)}`);
console.log(`    TOTAL ${fmt(PRESU.total)}  (${fmt(conv(PRESU.total, 'ARS', 'USD', v.tc), 'USD')})`);
ok('el presupuesto da un número', PRESU.total > 0, fmt(PRESU.total));
ok('el dólar del elenco se convierte', PRESU.porRubro.find(x => x.codigo === '09').total >= 1500 * 1420,
  fmt(PRESU.porRubro.find(x => x.codigo === '09').total));
ok('el fee excluye elenco', Math.abs(PRESU.baseFee - (PRESU.subtotal - totalRubro(r09, v))) < 1);
ok('total = neto + IVA', Math.abs(PRESU.total - PRESU.neto * (1 + v.capas.iva / 100)) < 0.01);

/* ─────────────────────────────────────────────────── 7. el callsheet */
paso('7. CALLSHEET');
DB.ui.jornada = 1;
const CS = armarCallsheet(py, v, 1);
console.log(`    J1: ${CS.escenas.length} escenas · ${octavosATexto(CS.octavos)} pg · ${CS.locaciones.join(', ')}`);
console.log(`    crew: ${CS.crew.length} · elenco: ${CS.elenco.map(e => e.personaje).join(', ')}`);
ok('las escenas salen del guion', CS.escenas.every(e => e.jornada === 1));
ok('el crew sale del presupuesto', CS.crew.length > 0, CS.crew.length + ' líneas de rubros 02-08');
ok('el DF llega con su teléfono del catálogo',
  CS.crew.some(c => c.nombre === 'Martín Bevilacqua' && c.tel === '11 5555-2001'));
ok('el elenco sale de las escenas del día', CS.elenco.every(p => p.escenas.length));

/* datos que no salen de ningún lado */
upJornada('fecha', '2026-09-14'); upJornada('citacion', '07:00'); upJornada('wrap', '19:00');
upJornada('hospital.nombre', 'Hospital Fernández'); upJornada('hospital.tel', '011 4808-2600');
upDireccion(CS.locaciones[0], 'direccion', 'Av. Corrientes 1234');
const j1 = d.jornadas.find(x => x.numero === 1);
ok('guarda los datos de la jornada', j1.fecha === '2026-09-14' && j1.hospital.nombre === 'Hospital Fernández');

/* ──────────────────────────────────────── 8. contactos y citaciones */
paso('8. CONTACTOS Y CITACIONES');
const C = armarContactos(py, v);
ok('la lista de contactos se arma sola', C.total > 0, C.total + ' contactos en ' + C.grupos.length + ' grupos');
ok('el DF viene completo del catálogo',
  C.grupos.flatMap(g => g.filas).some(f => f.nombre === 'Martín Bevilacqua' && f.email === 'martin@df.com'));
/* cargar un contacto a mano y ver que viaje */
const lineaDir = r02.lineas[0];
upContacto('l:' + lineaDir.id, 'nombre', 'Ana Suárez');
upContacto('l:' + lineaDir.id, 'tel', '11 5555-3001');
upContacto('l:' + lineaDir.id, 'email', 'ana@directora.com');
const CS2 = armarCallsheet(py, v, 1);
ok('lo cargado en contactos llega al callsheet',
  CS2.crew.some(c => c.nombre === 'Ana Suárez' && c.email === 'ana@directora.com'));

const { gente } = gentePorJornada(py, v, 1);
upCitacion(gente[0].clave, 'citacion', '06:30');
const txtCit = textoCitacion(pr, py, j1, CS2, gente.find(g => g.clave === gente[0].clave), cfgActual());
ok('la citación trae todo lo necesario',
  ['Spot Lavandina', 'Jornada 1', '06:30', 'Av. Corrientes 1234', 'Hospital Fernández', 'Pampa Films']
    .every(x => txtCit.includes(x)), txtCit.split('\n')[0]);
ok('el teléfono se normaliza para WhatsApp', telWhatsapp('11 5555-2001') === '5491155552001',
  telWhatsapp('11 5555-2001'));
marcarTodos(true);
ok('se marcan como citados', Object.values(j1.parte.citados).filter(Boolean).length === gente.length,
  gente.length + ' personas');

/* ───────────────────────────────────────── 9. el día de rodaje */
paso('9. PARTE DE RODAJE Y HORAS EXTRA');
const cfg = cfgActual();
ok('jornada base del convenio', cfg.horasJornada === 8 && cfg.recargoHE === 50,
  cfg.horasJornada + 'h · +' + cfg.recargoHE + '%');
upParte('primeraToma', '08:30'); upParte('comidaIn', '13:00'); upParte('comidaOut', '14:00');
upParte('ultimaToma', '20:30'); upParte('wrap', '21:00');
d.escenas.filter(e => e.jornada === 1).forEach(e => toggleFilmada(e.id, true));
ficharTodos('entrada'); ficharTodos('salida');
/* el DF se quedó de más */
const claveDF = gente.find(g => /Fotograf/.test(g.rol))?.clave;
if (claveDF) upFichada(claveDF, 'salida', '23:30');
const hDF = claveDF ? horasDe(claveDF, j1, cfg, gente.find(g => g.clave === claveDF).valorJornada, 'ARS') : null;
console.log(`    día: citación ${j1.citacion} → wrap ${j1.parte.wrap} · ${fmtHoras(lapso(j1.citacion, j1.parte.wrap))} de set`);
if (hDF) console.log(`    DF: ${hDF.entrada}→${hDF.salida} = ${fmtHoras(hDF.netos)} netas · ${fmtHoras(hDF.extra)} extras · ${fmt(hDF.costoHE)}`);
ok('marca las escenas filmadas', j1.parte.filmadas.length === CS.escenas.length);
ok('ficha a todos', gente.every(g => j1.parte.fichadas[g.clave]?.salida));
if (hDF) {
  ok('calcula las horas netas descontando comida', hDF.netos === lapso('07:00', '23:30') - 60,
    fmtHoras(hDF.netos));
  ok('las extras salen sobre la jornada base', hDF.extra === hDF.netos - cfg.horasJornada * 60, fmtHoras(hDF.extra));
  ok('el costo usa el valor de su línea del presupuesto', hDF.valorHora === 1100000 / 8, hDF.valorHora);
}
const HE = horasProyecto(py, v, cfg);
ok('acumula las extras del rodaje', HE.totalARS > 0, fmtHoras(HE.totalExtra) + ' · ' + fmt(HE.totalARS));

/* ═════════════════ 10. EL FLUJO DE FACTURACION, con áreas ═════════════════ */
paso('10. FACTURACION · NAFTA DE ARTE vs NAFTA DE PRODUCCION');
DB.ui.usuarioId = uEjec.id;
/* una OC por el paquete de cámara */
const oc = nuevaOC({
  numero: proximoNumeroOC(py), rubro: '11', subrubro: 'Paquete cámara + ópticas',
  area: 'camara', proveedor: 'Rental Sur', importe: 1800000, condicion: '50% anticipo'
});
py.ocs.push(oc); emitirOC(oc.id);
ok('la OC emitida compromete', comprometidoDeOC(py, oc, 'ARS', v.tc) === 1800000);

/* la nafta: mismo subrubro, distintas áreas */
const nafta = (area, importe, quien, extra = {}) => {
  const c = nuevoComprobante({
    rubro: '12', subrubro: 'Combustible', area, importe,
    proveedor: 'YPF Ruta 8', tipo: 'facBC', circuito: 'efectivo',
    cargadoPor: quien.id, estado: 'cargado', ...extra
  });
  c.historial = [{ de: null, a: 'cargado', accion: 'cargar', usuario: quien.nombre, usuarioId: quien.id, rol: quien.rol, fecha: hoy(), nota: '' }];
  py.comprobantes.push(c); return c;
};
const naftaArte = nafta('arte', 45000, uArte);
const naftaProd = nafta('produccion', 78000, uProd);
const naftaCam = nafta('camara', 32000, uProd);
ok('mismo rubro y subrubro para las tres', [naftaArte, naftaProd, naftaCam].every(c => c.rubro === '12' && c.subrubro === 'Combustible'));
ok('pero cada una con su área', [naftaArte.area, naftaProd.area, naftaCam.area].join(',') === 'arte,produccion,camara');

const A = resumenAreas(py, v);
const comb = A.cruce['Combustible'];
console.log('    Combustible ' + fmt(comb.total) + ' repartido:');
Object.entries(comb.areas).forEach(([a, val]) => console.log(`      ${areaLbl(a).padEnd(22)} ${fmt(val)}`));
ok('la nafta suma bien en total', comb.total === 155000, fmt(comb.total));
ok('arte tiene la suya', comb.areas.arte === 45000, fmt(comb.areas.arte));
ok('producción la suya', comb.areas.produccion === 78000, fmt(comb.areas.produccion));
ok('cámara la suya', comb.areas.camara === 32000, fmt(comb.areas.camara));
ok('el reparto suma el total', Object.values(comb.areas).reduce((s, x) => s + x, 0) === comb.total);
ok('aparece como concepto repartido entre áreas',
  A.repartidos.some(([k]) => k === 'Combustible'), A.repartidos.map(([k]) => k).join(', '));
/* el rubro 12 las junta a todas */
const P0 = resumenPlata(py, v);
ok('el rubro 12 las junta a todas', P0.filas.find(f => f.codigo === '12').real === 155000,
  fmt(P0.filas.find(f => f.codigo === '12').real));

/* ── los rubros transversales enteros, no sólo la nafta ─────────────────── */
console.log('\n    Rubros transversales: ' + RUBROS_BASE.filter(r => r.transversal).map(r => r.codigo).join(', '));
ok('sólo alquileres y transporte son transversales',
  RUBROS_BASE.filter(r => r.transversal).map(r => r.codigo).join(',') === '11,12',
  RUBROS_BASE.filter(r => r.transversal).map(r => r.nombre.split(',')[0]).join(' · '));
ok('viajes es transversal', esTransversal('12'));
ok('alquileres es transversal', esTransversal('11'));
/* el catering NO lo gasta un departamento: se gasta por jornada */
ok('catering NO es transversal', !esTransversal('13'));
ok('catering es un área en sí mismo', areaDeRubro('13') === 'catering', areaDeRubro('13'));
ok('catering se mide por jornada', esPorJornada('13'));
ok('seguridad también se mide por jornada', esPorJornada('16'));
ok('los viajes NO se miden por jornada', !esPorJornada('12'));
ok('dirección NO es transversal', !esTransversal('02'));
ok('cada rubro no transversal tiene su área',
  RUBROS_BASE.filter(r => !r.transversal).every(r => r.area),
  RUBROS_BASE.filter(r => !r.transversal && !r.area).map(r => r.codigo).join(',') || 'todos');

/* el mismo gasto cruzado, en varios rubros a la vez */
const gasto = (rubro, sub, area, importe, quien = uProd) => {
  const c = nuevoComprobante({
    rubro, subrubro: sub, area, importe, proveedor: 'Varios', tipo: 'facBC',
    circuito: 'transferencia', cargadoPor: quien.id, estado: 'cargado'
  });
  c.historial = [{ de: null, a: 'cargado', accion: 'cargar', usuario: quien.nombre, usuarioId: quien.id, rol: quien.rol, fecha: hoy(), nota: '' }];
  py.comprobantes.push(c); return c;
};
/* viajes: arte viaja a comprar, cámara viaja con el equipo */
gasto('12', 'Pasajes aéreos', 'arte', 180000);
gasto('12', 'Pasajes aéreos', 'camara', 240000);
gasto('12', 'Hotel', 'arte', 95000);
gasto('12', 'Hotel', 'camara', 130000);
/* alquileres: cada área alquila lo suyo */
gasto('11', 'Alquiler de vehículo', 'arte', 120000);
gasto('11', 'Alquiler de vehículo', 'produccion', 90000);
/* varios de administración */
gasto('17', 'Comisiones bancarias', 'admin', 15000);

const M = matrizRubroArea(py, v);
console.log('\n    MATRIZ RUBRO × ÁREA');
const cols = [...M.areas.map(a => a.k), ...(M.haySin ? ['__sin'] : [])];
console.log('    ' + 'rubro'.padEnd(26) + cols.map(c => (c === '__sin' ? 'sin área' : areaLbl(c)).slice(0, 11).padStart(13)).join('') + 'TOTAL'.padStart(13));
M.rubros.forEach(r => console.log('    ' + (r.codigo + ' ' + r.nombre).slice(0, 25).padEnd(26) +
  cols.map(c => { const x = (M.celda[r.codigo] || {})[c] || 0; return (x ? Math.round(x).toLocaleString('es-AR') : '·').padStart(13); }).join('') +
  Math.round(M.totRubro[r.codigo] || 0).toLocaleString('es-AR').padStart(13)));
console.log('    ' + 'TOTAL POR ÁREA'.padEnd(26) +
  cols.map(c => Math.round(M.totArea[c] || 0).toLocaleString('es-AR').padStart(13)).join('') +
  Math.round(M.total).toLocaleString('es-AR').padStart(13));

ok('la matriz cruza rubros con áreas', M.rubros.length > 1 && M.areas.length > 1,
  M.rubros.length + ' rubros × ' + M.areas.length + ' áreas');
/* viajes repartido */
ok('viajes se abre por área', Object.keys(M.celda['12']).length >= 3,
  Object.entries(M.celda['12']).map(([a, x]) => areaLbl(a) + ' ' + fmt(x)).join(' · '));
ok('arte suma su nafta + sus viajes + su hotel + su alquiler',
  M.celda['12'].arte === 45000 + 180000 + 95000 && M.celda['11'].arte === 120000,
  'viajes ' + fmt(M.celda['12'].arte) + ' · alquileres ' + fmt(M.celda['11'].arte));
/* los totales tienen que cerrar por las dos vías */
const sumaFilas = M.rubros.reduce((s, r) => s + (M.totRubro[r.codigo] || 0), 0);
const sumaCols = cols.reduce((s, c) => s + (M.totArea[c] || 0), 0);
ok('la suma por filas = la suma por columnas', Math.abs(sumaFilas - sumaCols) < 1,
  fmt(sumaFilas) + ' vs ' + fmt(sumaCols));
ok('y las dos dan el total de la matriz', Math.abs(sumaFilas - M.total) < 1, fmt(M.total));
ok('cada celda suma sus comprobantes', (() => {
  const cbs = py.comprobantes.filter(c => c.estado !== 'rechazado' && c.rubro === '12' && c.area === 'arte');
  return Math.abs(M.celda['12'].arte - cbs.reduce((s, c) => s + n(c.importe), 0)) < 1;
})());
/* ── el presupuesto también se abre por área ─────────────────────────── */
console.log('');
/* etiquetar algunas líneas del presupuesto con su área */
v.rubros.find(r => r.codigo === '12').lineas.forEach(l => { l.area = 'produccion'; });
v.rubros.find(r => r.codigo === '11').lineas.forEach(l => { l.area = 'camara'; });
const MP = matrizRubroArea(py, v);
ok('el presupuesto se abre por área', Object.keys(MP.celdaP).length > 0,
  Object.keys(MP.celdaP).sort().join(', '));
ok('la línea etiquetada va a su área', (MP.celdaP['11'] || {}).camara > 0,
  fmt((MP.celdaP['11'] || {}).camara || 0));
/* una línea de un rubro NO transversal sin área se deduce del rubro */
ok('sin área, un rubro no transversal se deduce', (MP.celdaP['02'] || {}).direccion > 0,
  'dirección ' + fmt((MP.celdaP['02'] || {}).direccion || 0));
ok('el catering cae solo en su área, no en "sin área"',
  (MP.celdaP['13'] || {}).catering > 0 && !(MP.celdaP['13'] || {}).__sin,
  'catering ' + fmt((MP.celdaP['13'] || {}).catering || 0));
/* dejar una línea transversal sin área para probar el aviso */
v.rubros.find(r => r.codigo === '11').lineas.push(nuevaLinea({ concepto: 'Grúa', valorUnit: 300000 }));
const MP2 = matrizRubroArea(py, v);
ok('avisa de las líneas de presupuesto sin área en transversales', MP2.huecosPresu === 1,
  MP2.huecosPresu + ' líneas');
v.rubros.find(r => r.codigo === '11').lineas.pop();
/* el presupuestado por área tiene que sumar el subtotal del presupuesto */
const sumaPresuAreas = Object.values(MP.totAreaP).reduce((s, x) => s + x, 0);
ok('el presupuestado por área suma el subtotal del presupuesto',
  Math.abs(sumaPresuAreas - calcular(v).subtotal) < 1,
  fmt(sumaPresuAreas) + ' vs ' + fmt(calcular(v).subtotal));
ok('y por filas da lo mismo',
  Math.abs(MP.rubros.reduce((s, r) => s + (MP.totRubroP[r.codigo] || 0), 0) - sumaPresuAreas) < 1);
/* ahora sí se puede comparar presupuestado contra real POR AREA */
const dispCamara = (MP.totAreaP.camara || 0) - (MP.totArea.camara || 0);
console.log(`    cámara: presupuestado ${fmt(MP.totAreaP.camara || 0)} · real ${fmt(MP.totArea.camara || 0)} · disponible ${fmt(dispCamara)}`);
ok('se puede comparar presupuestado vs real por área',
  MP.totAreaP.camara > 0 && MP.totArea.camara > 0, 'las dos puntas cargadas');

/* el total del área tiene que ser lo mismo que da resumenAreas */
const A2 = resumenAreas(py, v);
ok('el total de arte coincide con la vista por área',
  Math.abs(M.totArea.arte - A2.porArea.arte) < 1, fmt(M.totArea.arte));

/* el área es obligatoria en los transversales */
console.log('');
let alertado = null; const _alert = global.alert; global.alert = m => alertado = m;
global.document.querySelectorAll = sel => String(sel).includes('[name]')
  ? [{ name: 'rubro', value: '12' }, { name: 'subrubro', value: 'Hotel' }, { name: 'area', value: '' },
  { name: 'importe', value: '50000' }, { name: 'moneda', value: 'ARS' }] : [];
const antesN = py.comprobantes.length;
saveComprobante('');
global.alert = _alert;
ok('no deja guardar un transversal sin área', py.comprobantes.length === antesN && !!alertado,
  (alertado || '').split('\n')[0]);
/* pero sí uno no transversal */
alertado = null; global.alert = m => alertado = m;
global.document.querySelectorAll = sel => String(sel).includes('[name]')
  ? [{ name: 'rubro', value: '02' }, { name: 'subrubro', value: 'Director' }, { name: 'area', value: '' },
  { name: 'importe', value: '50000' }, { name: 'moneda', value: 'ARS' }] : [];
saveComprobante('');
global.alert = _alert;
ok('un rubro no transversal sí se puede guardar sin área', py.comprobantes.length === antesN + 1 && !alertado);
py.comprobantes.pop();

/* y detecta los huecos que quedaron */
const huerfano = gasto('11', 'Grúa', '', 60000);
huerfano.area = '';
const M2 = matrizRubroArea(py, v);
ok('detecta transversales sin área', M2.huecos === 1 && M2.huecosMonto === 60000,
  M2.huecos + ' por ' + fmt(M2.huecosMonto));
py.comprobantes = py.comprobantes.filter(c => c.id !== huerfano.id);

/* ── el catering se mide por jornada, no por área ──────────────────────── */
console.log('');
const cateringJ = (jornada, imp) => {
  const c = nuevoComprobante({ rubro: '13', subrubro: 'Almuerzo', area: 'catering', jornada,
    importe: imp, proveedor: 'Catering La Mesa', tipo: 'facBC', cargadoPor: uProd.id, estado: 'cargado' });
  c.historial = [{ de: null, a: 'cargado', accion: 'cargar', usuario: uProd.nombre, usuarioId: uProd.id, rol: 'produccion', fecha: hoy(), nota: '' }];
  py.comprobantes.push(c); return c;
};
cateringJ(1, 420000); cateringJ(2, 385000); cateringJ(3, 410000);
const J = resumenJornadas(py, v);
console.log('    COSTO POR JORNADA');
console.log('    ' + 'jornada'.padEnd(12) + 'catering'.padStart(12) + 'seguridad'.padStart(12) +
  'otros'.padStart(12) + 'total'.padStart(13) + 'p/ cabeza'.padStart(12));
J.filas.filter(f => f.total).forEach(f => console.log('    ' + ('J' + f.numero).padEnd(12) +
  Math.round(f.porRubro['13']).toLocaleString('es-AR').padStart(12) +
  Math.round(f.porRubro['16']).toLocaleString('es-AR').padStart(12) +
  Math.round(f.otros).toLocaleString('es-AR').padStart(12) +
  Math.round(f.total).toLocaleString('es-AR').padStart(13) +
  (f.porCabeza ? Math.round(f.porCabeza).toLocaleString('es-AR') : '—').padStart(12)));
ok('separa el gasto por jornada', J.filas.filter(f => f.total).length === 3,
  J.filas.filter(f => f.total).length + ' jornadas con movimiento');
ok('el catering de cada día va a su jornada',
  J.filas[0].porRubro['13'] === 420000 && J.filas[1].porRubro['13'] === 385000,
  fmt(J.filas[0].porRubro['13']) + ' · ' + fmt(J.filas[1].porRubro['13']));
ok('calcula el catering por cabeza', J.filas[0].porCabeza > 0,
  fmt(J.filas[0].porCabeza) + ' por persona · ' + J.filas[0].cabezas + ' citadas');
ok('el por cabeza es el catering dividido la gente',
  Math.abs(J.filas[0].porCabeza - J.filas[0].porRubro['13'] / J.filas[0].cabezas) < 1);
ok('el total por jornada suma catering + lo demás',
  J.filas.every(f => Math.abs(f.total - (f.especificos + f.otros)) < 1));
/* uno sin jornada tiene que quedar marcado */
const sinJ = cateringJ(null, 90000); sinJ.jornada = null;
const J2 = resumenJornadas(py, v);
ok('detecta catering sin jornada', J2.sinJornada === 1 && J2.sinJornadaMonto === 90000,
  J2.sinJornada + ' por ' + fmt(J2.sinJornadaMonto));
py.comprobantes = py.comprobantes.filter(c => c.id !== sinJ.id);
/* y el catering NO se reparte entre departamentos */
const MC = matrizRubroArea(py, v);
ok('el catering queda entero en su área',
  Object.keys(MC.celda['13']).length === 1 && Object.keys(MC.celda['13'])[0] === 'catering',
  Object.keys(MC.celda['13']).join(', '));

/* filtrar por área, que es lo que hace administración */
DB.ui.fGasto = { rubro: '', estado: '', q: '', area: 'arte' };
const soloArte = py.comprobantes.filter(c => c.area === 'arte');
ok('se puede filtrar por área', soloArte.length === 4,
  soloArte.length + ' de arte: ' + soloArte.map(c => c.subrubro).join(', '));
ok('y suman lo que dice la matriz',
  soloArte.reduce((s, c) => s + c.importe, 0) === M.totArea.arte, fmt(M.totArea.arte));
DB.ui.fGasto = { rubro: '12', estado: '', q: '', area: '' };
const soloViajes = py.comprobantes.filter(c => c.rubro === '12');
ok('y por rubro, que trae las de todas las áreas', soloViajes.length === 7,
  soloViajes.length + ' en viajes, de ' + new Set(soloViajes.map(c => c.area)).size + ' áreas');
ok('cruzar rubro Y área da la celda de la matriz',
  py.comprobantes.filter(c => c.rubro === '12' && c.area === 'arte')
    .reduce((s, c) => s + c.importe, 0) === M.celda['12'].arte, fmt(M.celda['12'].arte));
limpiarFiltros();

/* ─────────────────────────── 11. el circuito de una factura entera */
paso('11. EL CIRCUITO, PASO POR PASO');
const fac = nuevoComprobante({
  rubro: '11', subrubro: 'Paquete cámara + ópticas', area: 'camara',
  proveedor: 'Rental Sur', cuit: '30-70111222-3', tipo: 'facA', numero: '0001-00009911',
  importe: 900000, circuito: 'transferencia', ocId: oc.id, cargadoPor: uProd.id
});
fac.historial = [{ de: null, a: 'cargado', accion: 'cargar', usuario: uProd.nombre, usuarioId: uProd.id, rol: uProd.rol, fecha: hoy(), nota: '' }];
py.comprobantes.push(fac);
ok('arte NO puede mover lo que no le toca', accionesDe(fac, uArte).length === 0);
ok('producción la ve para revisar', accionesDe(fac, uProd).includes('revisar'));
DB.ui.usuarioId = uProd.id; moverComprobante(fac.id, 'revisar');
ok('pasa a revisado', fac.estado === 'revisado');
ok('el ejecutivo NO puede pagar', !accionesDe(fac, uEjec).includes('pagar'));
DB.ui.usuarioId = uEjec.id; moverComprobante(fac.id, 'aprobar');
DB.ui.usuarioId = uAdm.id; moverComprobante(fac.id, 'pagar');
ok('llega a pagado', fac.estado === 'pagado');
console.log('    ' + fac.historial.map(h => `${EST(h.a).l}/${h.usuario.split(' ')[0]}`).join(' → '));
ok('el recorrido tiene los 4 pasos', fac.historial.length === 4,
  fac.historial.map(h => EST(h.a).l).join(' → '));
ok('cada paso lo firma el rol que corresponde',
  fac.historial.map(h => h.rol).join(',') === 'produccion,produccion,ejecutivo,admin',
  fac.historial.map(h => h.rol).join(','));
/* Lucía cargó y además revisó: no se bloquea, pero el detalle lo marca */
ok('marca cuando alguien firma lo que cargó', /firmó lo suyo/.test(
  (() => { modal = null; verComprobante(fac.id); const h = modal; cerrar(); return h; })()));
ok('la OC baja lo facturado', comprometidoDeOC(py, oc, 'ARS', v.tc) === 900000,
  fmt(comprometidoDeOC(py, oc, 'ARS', v.tc)) + ' (1.800.000 − 900.000)');

/* rechazo */
const malo = nuevoComprobante({ rubro: '06', subrubro: 'Compras de arte', area: 'arte', importe: 999000, cargadoPor: uArte.id });
malo.historial = [{ de: null, a: 'cargado', accion: 'cargar', usuario: uArte.nombre, usuarioId: uArte.id, rol: 'equipo', fecha: hoy(), nota: '' }];
py.comprobantes.push(malo);
DB.ui.usuarioId = uProd.id; moverComprobante(malo.id, 'rechazar', 'No estaba autorizado');
ok('lo rechazado guarda el motivo', malo.estado === 'rechazado' && malo.historial[1].nota === 'No estaba autorizado');
ok('lo rechazado NO suma al gasto',
  !resumenPlata(py, v).filas.find(f => f.codigo === '06').real, 'rubro 06 en cero');

/* ───────────────────────────────────────────── 12. caja chica */
paso('12. CAJA CHICA Y RENDICION');
const caja = nuevaCaja({ nombre: 'Caja de arte J1', responsable: uArte.id, jornada: 1 });
py.cajas.push(caja);
caja.adelantos.push({ id: uid('ad'), fecha: hoy(), importe: 150000, circuito: 'efectivo', entregadoPor: uProd.id });
/* los gastos de arte salen de la caja */
[['Compras de arte', 38000, 'facBC'], ['Utilero', 22000, 'ninguno']].forEach(([sub, imp, tipo]) => {
  const c = nuevoComprobante({ rubro: '06', subrubro: sub, area: 'arte', importe: imp, tipo, circuito: 'efectivo', cajaId: caja.id, cargadoPor: uArte.id });
  c.historial = [{ de: null, a: 'cargado', accion: 'cargar', usuario: uArte.nombre, usuarioId: uArte.id, rol: 'equipo', fecha: hoy(), nota: '' }];
  py.comprobantes.push(c);
});
const sc = saldoCaja(py, caja);
console.log(`    entregado ${fmt(sc.entregado)} · gastado ${fmt(sc.gastado)} · saldo ${fmt(sc.saldo)} · sin comprobante ${fmt(sc.sinComprobante)}`);
ok('la caja lleva el saldo', sc.saldo === 150000 - 60000, fmt(sc.saldo));
ok('marca lo que no tiene comprobante', sc.sinComprobante === 22000, fmt(sc.sinComprobante));
DB.ui.usuarioId = uAdm.id;
global.document.querySelectorAll = sel => String(sel).includes('[name]') ? [{ name: 'notas', value: 'Devolvió en efectivo' }] : [];
confirmarRendicion(caja.id);
ok('rendida, con lo que devuelve', caja.estado === 'rendida' && caja.devuelto === 90000, fmt(caja.devuelto));

/* ═════════════════════════ 13. TODO TIENE QUE ATAR ═════════════════════════ */
paso('13. EL TABLERO CIERRA');
const P = resumenPlata(py, v);
console.log('    ' + 'RUBRO'.padEnd(32) + 'PRESU'.padStart(13) + 'COMPROM'.padStart(12) + 'REAL'.padStart(12) + 'DISPON'.padStart(13));
P.filas.filter(f => f.presu || f.comp || f.real).forEach(f => console.log('    ' +
  (f.codigo + ' ' + f.nombre).slice(0, 31).padEnd(32) +
  Math.round(f.presu).toLocaleString('es-AR').padStart(13) +
  Math.round(f.comp).toLocaleString('es-AR').padStart(12) +
  Math.round(f.real).toLocaleString('es-AR').padStart(12) +
  Math.round(f.disponible).toLocaleString('es-AR').padStart(13)));
console.log('    ' + 'TOTAL'.padEnd(32) + Math.round(P.presu).toLocaleString('es-AR').padStart(13) +
  Math.round(P.comp).toLocaleString('es-AR').padStart(12) +
  Math.round(P.real).toLocaleString('es-AR').padStart(12) +
  Math.round(P.disponible).toLocaleString('es-AR').padStart(13));

const cs = py.comprobantes.filter(c => c.estado !== 'rechazado');
const sumaCbtes = cs.reduce((s, c) => s + conv(n(c.importe), c.moneda, 'ARS', v.tc), 0);
ok('el real del tablero = la suma de los comprobantes', Math.abs(P.real - sumaCbtes) < 1,
  fmt(P.real) + ' vs ' + fmt(sumaCbtes));
ok('disponible = presupuestado − comprometido − real',
  Math.abs(P.disponible - (P.presu - P.comp - P.real)) < 1);
ok('el presupuestado del tablero = el subtotal del presupuesto',
  Math.abs(P.presu - calcular(v).subtotal) < 1, fmt(P.presu));
ok('el gasto por área suma lo mismo que el total real',
  Math.abs(resumenAreas(py, v).total - P.real) < 1,
  fmt(resumenAreas(py, v).total) + ' vs ' + fmt(P.real));
ok('lo pagado es parte de lo real', P.pagado <= P.real && P.pagado > 0, fmt(P.pagado));
ok('la caja rendida ya no figura como abierta', getCajas().filter(c => c.estado === 'abierta').length === 0);

/* ────────────────────────────────────── 14. la portada lo refleja */
paso('14. LA PORTADA');
DB.ui.usuarioId = uEjec.id;
const html = vistaResumen(pr, py, v);
ok('muestra el proyecto', html.includes(esc(py.nombre)));
ok('muestra el disponible', html.includes(fmt(P.disponible, 'ARS')));
ok('lista pendientes reales', /Esperan algo/.test(html));
ok('avisa de rubros pasados si los hay',
  P.filas.some(f => f.disponible < 0) === /pasados de presupuesto/.test(html));

/* ─────────────────────────────── 15. todo renderiza al final */
paso('15. TODAS LAS PANTALLAS, CON DATOS REALES');
const errs = [];
['resumen', 'guia', 'presu', 'desglose', 'callsheet', 'rodaje', 'gastos', 'equipo', 'catalogo', 'config']
  .forEach(k => { try { setTab(k); } catch (e) { errs.push(k + ': ' + e.message); } });
['bandeja', 'todos', 'oc', 'caja', 'areas', 'control'].forEach(k => {
  try { setTab('gastos'); setSubGasto(k); } catch (e) { errs.push('gastos/' + k + ': ' + e.message); }
});
['escenas', 'deptos', 'plan'].forEach(k => { try { setTab('desglose'); setSub(k); } catch (e) { errs.push('desglose/' + k + ': ' + e.message); } });
['hoja', 'contactos'].forEach(k => { try { setTab('callsheet'); setSubCall(k); } catch (e) { errs.push('callsheet/' + k + ': ' + e.message); } });
['citaciones', 'parte', 'horas'].forEach(k => { try { setTab('rodaje'); setSubRodaje(k); } catch (e) { errs.push('rodaje/' + k + ': ' + e.message); } });
['gente', 'sica'].forEach(k => { try { setTab('catalogo'); setSubCat(k); } catch (e) { errs.push('catalogo/' + k + ': ' + e.message); } });
ok('las 24 vistas renderizan', !errs.length, errs.join(' | ') || '24 vistas sin error');

/* y sobrevive a guardar y recargar */
localStorage.setItem(KEY, JSON.stringify(DB));
const crudo = JSON.parse(localStorage.getItem(KEY));
ok('todo el proyecto persiste', (() => {
  const p2 = crudo.productoras[0].proyectos[0];
  return p2.comprobantes.length === py.comprobantes.length &&
    p2.ocs.length === 1 && p2.cajas.length === 1 &&
    p2.desglose.escenas.length === 4 && crudo.productoras[0].usuarios.length === 4;
})(), Math.round(JSON.stringify(DB).length / 1024) + ' KB');
const cbtesArte = crudo.productoras[0].proyectos[0].comprobantes.filter(c => c.area === 'arte');
ok('las áreas persisten', cbtesArte.length === 7,
  cbtesArte.length + ' de arte: ' + [...new Set(cbtesArte.map(c => c.rubro))].sort().join(', '));
ok('y siguen separadas por área tras recargar',
  crudo.productoras[0].proyectos[0].comprobantes.filter(c => c.subrubro === 'Combustible')
    .map(c => c.area).sort().join(',') === 'arte,camara,produccion');

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> FLUJO COMPLETO OK'));
process.exitCode = fallos ? 1 : 0;
