/* El instructivo: que esté completo, que sea navegable y que no mienta. */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

console.log('--- 1. CONTENIDO ---');
console.log(GUIA.map((g, i) => `  ${i + 1}. ${g.t}`).join('\n'));
ok('tiene secciones', GUIA.length >= 8, GUIA.length);
ok('todas tienen título y contenido', GUIA.every(g => g.t && g.c && g.c.length > 200),
  GUIA.filter(g => !g.c || g.c.length <= 200).map(g => g.t).join(',') || 'todas');
ok('no hay títulos repetidos', new Set(GUIA.map(g => g.t)).size === GUIA.length);

/* los temas que tienen que estar sí o sí */
const todo = GUIA.map(g => g.t + ' ' + g.c).join(' ');
[['el orden de carga', /Productoras.*Equipo.*Desglose/s],
['presupuesto y capas', /fee.*contingencia.*IVA/is],
['multi-moneda', /d[óo]lares|moneda base/i],
['versiones', /Duplicar v\./],
['formatos que acepta', /PDF.*Word.*Final Draft/is],
['guion sin encabezados', /infiere/i],
['que el desglose no toca el presupuesto', /no toca el presupuesto/i],
['callsheet vs contactos', /dos documentos distintos/i],
['citaciones por WhatsApp', /WhatsApp/],
['que no manda solo', /lo mand[áa]s vos|No manda nada/i],
['horas extra y jornada base', /8 horas de jornada base|jornada base/i],
['el circuito de la factura', /revisa producci[óo]n.*aprueba/is],
['órdenes de compra', /no se cuenta dos veces/i],
['caja chica', /caja chica/i],
['la fórmula del disponible', /Disponible = presupuestado/],
['circuito de pago y comprobante', /Respaldo documental/i],
['roles', /acumulativos/i],
['que no es seguridad', /no es seguridad/i],
['dónde viven los datos', /en este navegador/i],
['el respaldo en JSON', /Exportar todo/],
['el límite de espacio', /5 MB/],
['lo que no hace', /No factura ni toca ARCA/i],
['PDF escaneado', /escaneado/i],
['que la escala vence', /vence/i],
].forEach(([l, re]) => ok('explica ' + l, re.test(todo)));

console.log('\n--- 2. NAVEGACION ---');
DB.ui.tab = 'guia';
let errs = [];
GUIA.forEach((g, i) => { try { setGuia(i); vistaGuia(); } catch (e) { errs.push(i + ': ' + e.message); } });
ok('render de todas las secciones', !errs.length, errs.join(' | ') || GUIA.length + ' ok');
setGuia(0);
let h = vistaGuia();
ok('la primera no tiene botón "anterior"', !/← /.test(h));
ok('la primera tiene "siguiente"', /→<\/button>/.test(h));
setGuia(GUIA.length - 1);
h = vistaGuia();
ok('la última no tiene "siguiente"', !/→<\/button>/.test(h));
ok('la última tiene "anterior"', /← /.test(h));
setGuia(3);
h = vistaGuia();
ok('el índice marca la sección activa', (h.match(/class="on"/g) || []).length === 1);
ok('el índice lista todas', (h.match(/class="guian"/g) || []).length === GUIA.length);

console.log('\n--- 3. NO DEPENDE DEL PROYECTO ---');
ok('se puede abrir sin productoras', (() => {
  const g = DB.productoras; DB.productoras = [];
  let r; try { DB.ui.tab = 'guia'; render(); r = true; } catch (e) { r = e.message; }
  DB.productoras = g; return r;
})() === true);
/* la tabla de roles se genera desde ROLES, así que si mañana cambia un permiso
   el instructivo no queda mintiendo */
const secRoles = GUIA.find(g => /Roles/.test(g.t)).c;
ok('la tabla de roles lista los 4 roles reales', ROLES.every(r => secRoles.includes(r.l)),
  ROLES.map(r => r.l).join(', '));
ok('y sus permisos reales', ROLES.every(r => r.puede.filter(x => x !== 'equipo').every(p => secRoles.includes(p))));

console.log('\n--- 4. LA SOLAPA ---');
/* TABS vive adentro de header(); se chequea sobre el HTML que produce */
const barra = header(getPr(), getPy(), getV());
ok('está en la barra', /setTab\('guia'\)/.test(barra),
  (barra.match(/setTab\('(\w+)'\)/g) || []).join(' · '));
ok('va segunda, después de Resumen',
  barra.indexOf("setTab('guia')") > barra.indexOf("setTab('resumen')") &&
  barra.indexOf("setTab('guia')") < barra.indexOf("setTab('presu')"));
ok('la solapa la muestra', (() => { setTab('guia'); return /Cómo se usa CLAP/.test(vistaGuia()); })());
errs = [];
['resumen', 'guia', 'presu', 'desglose', 'callsheet', 'rodaje', 'gastos', 'equipo', 'catalogo', 'config']
  .forEach(k => { try { setTab(k); } catch (e) { errs.push(k + ': ' + e.message); } });
ok('todas las solapas siguen andando', !errs.length, errs.join(' | ') || 'sin errores');

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
