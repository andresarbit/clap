/* Del storyboard a un plan agrupado por puesta.
   ---------------------------------------------------------------------------
   Pedido de Andrés: al subir los cuadros, que se agrupen por puesta, tiro,
   personaje y fondo, y que el AD corrija sobre una base más amable. Algunos
   DF mandan la planta: opción de subirla.
   Sin IA se lee el texto de cada cuadro. Con la IA prendida (backend/
   funciones/clap-ia) también la imagen; acá la IA se simula.               */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

DB = dbVacia(); sembrar();
const pr = getPr();
const py = nuevoProyecto({ nombre: 'Spot Heladera', tipo: 'publicidad' }); pr.proyectos.push(py);
DB.ui.proyectoId = py.id; DB.ui.versionId = py.versiones[0].id;
const p = planDe(py);
const plano = (numero, desc, o = {}) => { const it = nuevoItemPlan({ tipo: 'plano', numero, desc, ...o }); p.items.push(it); it.orden = p.items.length; return it; };
const a1 = plano('1', 'PG cocina. Ana entra y abre la heladera', { set: 'Casa - Cocina' });
const a2 = plano('2', 'PP de Ana sonriendo', { set: 'Casa - Cocina', tamano: 'Primer plano' });
const a3 = plano('3', 'Contraplano: la heladera abierta, Ana de espaldas a cámara', { set: 'Casa - Cocina' });
const a4 = plano('4', 'Cenital de la mesa con el producto', { set: 'Casa - Cocina' });
const a5 = plano('5', 'PG calle, Ana sale con el producto', { set: 'Calle - Vereda', intExt: 'EXT' });
const a6 = plano('6', 'POV de Ana mirando la heladera', { set: 'Casa - Cocina' });
const a7 = plano('7', 'PM de Juan en la vereda', { set: 'Calle - Vereda', intExt: 'EXT', emplazamiento: 'Z' });

console.log('--- 1. EL TIRO, DESDE EL TEXTO ---');
ok('"Contraplano" y "de espaldas a cámara"', tiroDeTexto(a3.desc) === 'contra');
ok('"Cenital"', tiroDeTexto(a4.desc) === 'arriba');
ok('"POV"', tiroDeTexto(a6.desc) === 'pov');
ok('sin pista: vacío (no se inventa)', tiroDeTexto('PP de Ana sonriendo') === '');

console.log('\n--- 2. PROPONER PUESTAS ---');
const banco = p.items.filter(x => x.jornada == null);
proponerPuestas(banco);
ok('lo de frente en la cocina va junto (puesta A)', a1.emplazamiento === 'A' && a2.emplazamiento === 'A', [a1, a2].map(x => x.emplazamiento).join());
ok('la subjetiva va con lo de frente', a6.emplazamiento === 'A');
ok('el contraplano es otra puesta', a3.emplazamiento && a3.emplazamiento !== 'A', a3.emplazamiento);
ok('el cenital, otra', a4.emplazamiento && ![a1.emplazamiento, a3.emplazamiento].includes(a4.emplazamiento), a4.emplazamiento);
ok('la calle respeta la puesta que cargó el AD y suma ahí lo del mismo tiro', a7.emplazamiento === 'Z' && a5.emplazamiento === 'Z', a5.emplazamiento);
ok('el tiro queda anotado en el plano', a3.tiro === 'contra' && a4.tiro === 'arriba');
a2.emplazamiento = 'C';
ok('volver a proponer no pisa lo corregido a mano', proponerPuestas(banco) === 0 && a2.emplazamiento === 'C');

console.log('\n--- 3. AGRUPAR EL BANCO ---');
const g = c => gruposDePlanos(banco, c).map(x => x.titulo + ':' + x.planos.map(y => y.numero).join(''));
ok('por puesta', g('puesta').includes('Casa - Cocina · puesta A:16'), g('puesta').join(' | '));
ok('por fondo', g('fondo').join(' | ') === 'Casa - Cocina:12346 | Calle - Vereda:57', g('fondo').join(' | '));
ok('por tiro', g('tiro').some(x => x.startsWith('Contraplano:3')) && g('tiro').some(x => x.startsWith('Cenital / aéreo:4')), g('tiro').join(' | '));
ok('por personaje (de la descripción, sin tocar el elenco)', g('personaje').some(x => x.startsWith('Ana:')) && g('personaje').some(x => x.startsWith('Juan:7')) && !a1.elenco, g('personaje').join(' | '));
DB.ui.tab = 'plan'; DB.ui.jornada = null; py.desglose = nuevoDesglose(); render();
ok('el banco ofrece agrupar y proponer puestas', /Agrupar por/.test(app.innerHTML) && /plProponerPuestas\(null\)/.test(app.innerHTML));
plAgrupar('fondo');
ok('agrupado, con un título por grupo', /class="pl-grupo">[^]*?Casa - Cocina<\/label>/.test(app.innerHTML) && /class="pl-grupo">[^]*?Calle - Vereda<\/label>/.test(app.innerHTML));
ok('sin IA prendida, no aparece el botón de IA', !/plLeerCuadrosIA/.test(app.innerHTML));

console.log('\n--- 4. LA PLANTA ---');
py.desglose.jornadas = [nuevaJornada({ numero: 1, fecha: '2026-10-08' })];
banco.forEach(x => meterEnJornada(py, x, 1));
DB.ui.jornada = 1; render();
ok('la jornada ofrece subir la planta (opcional)', /Planta de cámara/.test(app.innerHTML) && /Subir planta/.test(app.innerHTML));
ok('el día ofrece proponer puestas y acomodar', /plProponerPuestas\(1\)/.test(app.innerHTML) && /Acomodar por puesta/.test(app.innerHTML));
p.plantas = [{ id: 'pt1', jornada: 1, nombre: 'Planta cocina', img: 'data:image/jpeg;base64,AAAA' }];
render();
ok('subida, se ve en la jornada y sale impresa', /alt="Planta Planta cocina"/.test(app.innerHTML) && !/pl-plantas noprint/.test(app.innerHTML));
plVerPlanta('pt1');
ok('se abre grande', /Planta de cámara/.test(modal) || /Planta cocina/.test(modal));
plBorrarPlanta('pt1');
ok('y se puede quitar', !p.plantas.length);
cerrar();
acomodarPorEmplazamiento(py, 1);
const enOrden = p.items.filter(x => x.jornada === 1 && x.tipo === 'plano').sort((x, y) => x.orden - y.orden).map(x => x.numero + x.emplazamiento).join(',');
ok('acomodar por puesta junta cada puesta de la cocina, de lo abierto a lo cerrado', /^1A,6A,/.test(enOrden) && enOrden.indexOf('3B') > enOrden.indexOf('6A'), enOrden);

(async () => {
  console.log('\n--- 5. CON LA IA (simulada) ---');
  /* sin función en la base: queda apagada y no rompe nada */
  SB.url = 'https://x.supabase.co'; SB.anon = 'a'; SB.access = 'tok'; SB.user = { id: 'u1', email: 'a@x.com' }; SB.expira = Date.now() + 3600e3;
  let pedidos = [];
  global.fetch = async (url, o) => { pedidos.push({ url: String(url), body: o && o.body ? JSON.parse(o.body) : null });
    return { ok: false, status: 404, text: async () => '{"message":"not found"}' }; };
  await iaCargarEstado();
  ok('sin la función: apagada, sin error', _ia && _ia.activa === false);
  ok('la página le pide a SU base, nunca a la IA directo', pedidos.some(x => x.url === 'https://x.supabase.co/functions/v1/clap-ia') && !pedidos.some(x => /anthropic|openai/.test(x.url)), pedidos.map(x => x.url).join(' '));
  ok('y no manda ninguna clave de IA', !pedidos.some(x => JSON.stringify(x).match(/sk-ant|x-api-key/i)));

  /* prendida */
  const otraPy = nuevoProyecto({ nombre: 'Spot 2', tipo: 'publicidad' }); pr.proyectos.push(otraPy); DB.ui.proyectoId = otraPy.id;
  const p2 = planDe(otraPy);
  const c1 = nuevoItemPlan({ tipo: 'plano', numero: '1', img: 'data:image/jpeg;base64,AAA', desc: '' }); p2.items.push(c1);
  const c2 = nuevoItemPlan({ tipo: 'plano', numero: '2', img: 'data:image/jpeg;base64,BBB', desc: '', set: 'Living' }); p2.items.push(c2);
  global.fetch = async (url, o) => { const b = JSON.parse(o.body); pedidos.push({ url: String(url), body: b });
    if (b.tarea === 'estado') return { ok: true, status: 200, text: async () => '{"activa":true,"usados":3,"tope":300}' };
    if (b.tarea === 'storyboard') return { ok: true, status: 200, text: async () => JSON.stringify({ cuadros: [
      { n: '1', fondo: 'Cocina', tiro: 'frente', personajes: ['Ana'], tamano: 'Plano general', intExt: 'INT', luz: 'dia', puesta: 'A' },
      { n: '2', fondo: 'Cocina', tiro: 'contra', personajes: ['Ana', 'Juan'], tamano: 'Plano inventado', puesta: 'B' }] }) };
    return { ok: false, status: 400, text: async () => '{}' }; };
  await iaCargarEstado();
  ok('con la función y la clave: prendida', iaActiva());
  DB.ui.jornada = null; render();
  ok('aparece "Leer los cuadros con IA" en el banco', /plLeerCuadrosIA\(\)/.test(app.innerHTML));
  pedidos = [];
  await plLeerCuadrosIA();
  const env = pedidos.find(x => x.body.tarea === 'storyboard');
  ok('manda los cuadros con su imagen', env && env.body.cuadros.length === 2 && env.body.cuadros[0].img.startsWith('data:image'));
  ok('completa lo vacío: fondo, tiro, personajes, tamaño', c1.set === 'Cocina' && c1.tiro === 'frente' && c1.elenco === 'Ana' && c1.tamano === 'Plano general' && c1.emplazamiento === 'A');
  ok('no pisa lo que estaba (el set "Living")', c2.set === 'Living');
  ok('lo que no reconoce no lo carga (tamaño inventado)', c2.tamano === '');
  ok('el contraplano queda en otra puesta', c2.tiro === 'contra' && c2.emplazamiento === 'B');

  /* la respuesta de un rental, por IA */
  const ped = pedidoDe(otraPy);
  const it1 = lzSumar(otraPy, EQUIPOS_LUZ.find(e => e.nombre === 'Arri SkyPanel S60-C').k, 2);
  const it2 = lzSumar(otraPy, EQUIPOS_LUZ.find(e => e.nombre === 'HMI 18K Fresnel').k, 1);
  lzSumarRental('Camauer'); const cam = rentalesCatalogo().find(r => r.nombre === 'Camauer');
  _lzResp = { id: cam.id };
  global.document.querySelectorAll = q => /\[name\]/.test(q) ? [{ name: 'respuesta', value: 'Te confirmo que el sky sí, el 18k lo tenemos en otra peli' }] : [];
  const orden = itemsParaMail(otraPy);
  global.fetch = async (url, o) => { const b = JSON.parse(o.body); pedidos.push({ url: String(url), body: b });
    return { ok: true, status: 200, text: async () => JSON.stringify({ items: [
      { n: orden.indexOf(it1) + 1, estado: 'ok', precio: 65000, nota: 'el sky sí' },
      { n: orden.indexOf(it2) + 1, estado: 'no', nota: 'en otra peli' }], total: 0 }) }; };
  await lzRespuestaIA();
  global.document.querySelectorAll = () => [];
  ok('la IA marca OK y NO donde las reglas no llegan', _lzResp.items[it1.id].estado === 'ok' && _lzResp.items[it1.id].precio === 65000 && _lzResp.items[it2.id].estado === 'no');
  ok('y se revisa antes de guardar', /Lo que contestó Camauer/.test(modal));

  console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
})().catch(e => { console.log('FALLA excepción: ' + e.stack); console.log('\n>>> 1 FALLA(S)'); });
