/* Traer del catálogo al presupuesto, con buscador.
   ---------------------------------------------------------------------------
   Con 1.500 fichas la lista de "+ Persona / proveedor" era un scroll eterno.
   Pedido: una ventana de búsqueda por nombre o por rubro, y separar
   profesionales de proveedores.                                            */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const els = {};
global.document.getElementById = id => (els[id] ||= {innerHTML: '', textContent: '', value: '', style: {}, focus(){}});
const lista = () => els.pplista.innerHTML;
const filas = () => (lista().match(/class="ppfila/g) || []).length;

DB = dbVacia(); sembrar();
/* un catálogo del tamaño del de la casa */
const RUBROS = ['03','04','05','06','07','11','12','13'];
for(let i = 0; i < 1500; i++){
  const r = RUBROS[i % RUBROS.length];
  DB.catalogo.personas.push(nuevaPersona({nombre: `Persona Relleno ${i}`, funcion: (FUNCIONES[r]||[])[0] || 'X',
    rubro: r, tipo: ['11','12','13'].includes(r) ? 'proveedor' : 'persona', notas: i % 50 === 0 ? 'Callsheets: Proyecto Zeta (2021).' : ''}));
}
DB.catalogo.personas.push(nuevaPersona({nombre: 'Jorge Dumas', funcion: 'Director de Fotografía', rubro: '04', tarifaRef: 900000}));
DB.catalogo.personas.push(nuevaPersona({nombre: 'Ana Jorgelina Paz', funcion: 'Foquista (1° AC)', rubro: '04'}));
DB.catalogo.personas.push(nuevaPersona({nombre: 'Rental Jorge Hnos', funcion: 'Paquete cámara + ópticas', rubro: '11', tipo: 'proveedor'}));

const v = getV(), r04 = v.rubros.find(r => r.codigo === '04');
const antes = r04.lineas.length;

console.log('--- 1. LA VENTANA ---');
modal = null; pickPersona(r04.id);
ok('tiene buscador', /id="ppq"/.test(modal || '') && /Buscar por nombre, función o proyecto/.test(modal || ''));
ok('tiene Todos / Profesionales / Proveedores', /Profesionales/.test(modal) && /Proveedores/.test(modal));
ok('tiene el filtro de rubro, con cuántos hay', /id="pprubro"/.test(modal) && /04 · Fotografía y Cámara \(\d+\)/.test(modal));
ok('arranca en el rubro donde se está cargando', _pp.rubro === '04');
ok('no dibuja las 1.500 de una: como mucho 60', filas() === PP_MAX, filas() + ' filas');
ok('y dice cuántas coinciden', /coinciden · se ven los primeros 60/.test(els.ppcuenta.textContent), els.ppcuenta.textContent);

console.log('\n--- 2. BUSCAR ---');
ppFiltro('q', 'jorge');
ok('por nombre, dentro del rubro', /Jorge Dumas/.test(lista()) && /Ana Jorgelina Paz/.test(lista()) && !/Rental Jorge/.test(lista()));
ok('el que empieza con lo escrito va primero', lista().indexOf('Jorge Dumas') < lista().indexOf('Ana Jorgelina'));
ppFiltro('rubro', '');
ok('en todos los rubros aparece también el proveedor', /Rental Jorge Hnos/.test(lista()));
ppFiltro('tipo', 'proveedor');
ok('sólo proveedores', /Rental Jorge Hnos/.test(lista()) && !/Jorge Dumas/.test(lista()));
ppFiltro('tipo', 'persona');
ok('sólo profesionales', !/Rental Jorge/.test(lista()) && /Jorge Dumas/.test(lista()));
ppFiltro('tipo', ''); ppFiltro('q', 'dumas fotog');
ok('varias palabras: nombre y función a la vez', /Jorge Dumas/.test(lista()) && filas() === 1);
ppFiltro('q', 'zeta');
ok('por el proyecto de la nota', filas() > 0 && /Proyecto Zeta/.test(lista()));
ppFiltro('q', 'sin acentos fotografia'.split(' ').pop());
ok('sin acentos encuentra "Fotografía"', /Jorge Dumas/.test(lista()));
ppFiltro('rubro', '07'); ppFiltro('q', 'jorge dumas');
ok('si no hay nada en el rubro, lo dice', /Nada coincide con "jorge dumas" en este rubro/.test(lista()));
ok('y ofrece buscar en todos', /Buscar en todos los rubros/.test(lista()));

console.log('\n--- 3. AGREGAR ---');
ppFiltro('rubro', ''); ppFiltro('q', 'jorge dumas');
const jd = DB.catalogo.personas.find(p => p.nombre === 'Jorge Dumas');
ppAgregar(jd.id);
const l = r04.lineas[r04.lineas.length - 1];
ok('agrega la línea al rubro', r04.lineas.length === antes + 1 && l.refId === jd.id);
ok('con su tarifa', l.valorUnit === 900000 && l.valorOrigen === 'catalogo');
ok('la ventana sigue abierta y lo marca agregado', /✓ agregado/.test(lista()));
const ana = DB.catalogo.personas.find(p => p.nombre === 'Ana Jorgelina Paz');
ppAgregar(ana.id);
ok('se pueden traer varios seguidos', r04.lineas.length === antes + 2);
ok('el que no tiene tarifa entra con el convenio', r04.lineas[r04.lineas.length - 1].valorOrigen === 'sica');

console.log('\n--- 4. CATÁLOGO VACÍO ---');
DB.catalogo.personas = [];
modal = null; pickPersona(r04.id);
ok('lo dice y manda a cargar gente', /Catálogo vacío/.test(els.pplista.innerHTML));

console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
process.exitCode = fallos ? 1 : 0;
