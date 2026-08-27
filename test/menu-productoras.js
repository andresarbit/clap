/* El menú "Productora" de arriba, conectado a la base.
   ---------------------------------------------------------------------------
   Lo que estaba mal: el menú listaba `DB.productoras`, o sea lo que hubiera
   quedado en ESE navegador. Por eso a Willy le aparecía "Productora Demo" (la
   del ejemplo) y "Mi productora" (el nombre provisorio que pone el sistema
   cuando no puede leer el real), y no la productora de verdad.

   Ahora sale de la base:
     - las MIAS, con su nombre real
     - las que existen en la web y todavía no son mías, para sumarme
     - las que quedaron sólo en este navegador, marcadas aparte
   Y elegir una de "En la web" mueve mi ficha: eso es lo que conecta el menú
   con los trabajadores.                                                      */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

const TB = { organizacion: [], productora: [], usuario: [], catalogo_persona: [] };
let SEQ = 0, SESION = 'auth-a';
const nid = p => `${p}-${++SEQ}`;
const uuidFalso = () => `${(++SEQ+'').padStart(8,'0')}-0000-4000-8000-000000000000`;
const respu = (s, b) => ({ ok: s >= 200 && s < 300, status: s, statusText: 'x',
  text: async () => b === undefined ? '' : JSON.stringify(b) });

/* modo prueba puesto: todos entran derecho (es como va a estar la base) */
const misProductoras = () => TB.usuario
  .filter(u => u.auth_uid === SESION && u.activo && !u.pendiente
    && ['admin','ejecutivo'].includes(u.rol))
  .map(u => u.productora_id);

global.fetch = async (url, opts = {}) => {
  const u = String(url), met = opts.method || 'GET';
  const c = opts.body ? JSON.parse(opts.body) : null;
  if (u.includes('/auth/v1/settings')) return respu(200, { external: {} });
  if (u.includes('grant_type=password'))
    return respu(200, { access_token:'t', refresh_token:'r', expires_in:3600,
      user:{ id: SESION, email: c.email } });
  if (u.includes('/auth/v1/logout')) return respu(204);
  /* security definer: devuelve TODAS, sin filtrar por permisos */
  if (u.includes('/rpc/productoras_para_elegir'))
    return respu(200, TB.productora.map(p => ({ id: p.id, nombre: p.nombre })));
  if (u.includes('/rpc/productora_pide_aprobacion')) return respu(200, false);
  if (u.includes('/rpc/crear_mi_productora')) {
    let org = TB.organizacion[0];
    if (!org) { org = { id: uuidFalso() }; TB.organizacion.push(org); }
    const pr = { id: uuidFalso(), org_id: org.id, nombre: String(c.p_nombre).trim(),
      cuit: null, condicion_iva: null, jurisdiccion: null,
      fee_default: 15, contingencia_default: 5, iva_default: 21, iibb_default: 0 };
    TB.productora.push(pr);
    const mia = TB.usuario.find(x => x.auth_uid === SESION);
    if (mia) mia.productora_id = pr.id;      /* crear una me mueve a ella */
    else TB.usuario.push({ id: uuidFalso(), auth_uid: SESION, productora_id: pr.id,
      nombre: c.p_mi_nombre || 'Yo', rol: 'admin', email: SESION + '@x.com',
      activo: true, pendiente: false, alta_el: ++SEQ });
    return respu(200, pr.id);
  }
  if (u.includes('/rpc/guardar_mis_datos')) {
    const mia = TB.usuario.find(x => x.auth_uid === SESION);
    if (!mia) return respu(400, { message: 'Todavía no completaste tu alta' });
    if (c.p_nombre) mia.nombre = c.p_nombre;
    const pr = TB.productora.find(x => x.id === mia.productora_id) || {};
    let cat = TB.catalogo_persona.find(x => x.id === mia.catalogo_id);
    if (!cat) { cat = { id: uuidFalso(), org_id: pr.org_id, tipo:'persona', email: mia.email };
      TB.catalogo_persona.push(cat); }
    cat.nombre = c.p_nombre || cat.nombre; mia.catalogo_id = cat.id;
    return respu(200, cat.id);
  }

  const m = u.match(/\/rest\/v1\/(\w+)/); if (!m) return respu(404, {});
  const tabla = TB[m[1]]; if (!tabla) return respu(404, { message:'no existe' });

  if (met === 'POST') {
    const fila = { id: uuidFalso(), alta_el: ++SEQ, ...c };
    if (m[1] === 'usuario' && fila.auth_uid !== SESION)
      return respu(403, { message: 'row-level security policy' });
    if (m[1] === 'catalogo_persona') { const ya = tabla.find(x => x.id === c.id);
      if (ya) { Object.assign(ya, c); return respu(200, [ya]); }
      tabla.push(c); return respu(200, [c]); }
    tabla.push(fila); return respu(200, [fila]);
  }
  if (met === 'PATCH') {
    const eq = u.match(/[?&](\w+)=eq\.([^&]+)/);
    const o = tabla.filter(f => String(f[eq[1]]) === decodeURIComponent(eq[2]));
    o.forEach(f => Object.assign(f, c)); return respu(200, o);
  }
  let filas = tabla.slice();
  const mias = misProductoras();
  if (m[1] === 'productora') filas = filas.filter(f => mias.includes(f.id));   /* productora_mia */
  if (m[1] === 'usuario')    filas = filas.filter(f => mias.includes(f.productora_id) || f.auth_uid === SESION);
  [...u.matchAll(/[?&](\w+)=eq\.([^&]+)/g)].forEach(f => {
    filas = filas.filter(x => String(x[f[1]]) === decodeURIComponent(f[2])); });
  return respu(200, filas);
};

const conectar = async mail => { sbOlvidar(); SB.url='https://x.supabase.co'; SB.anon='a';
  sbGuardar(); await sbLogin(mail,'secreto123'); SB.orgId = null; };
const cargarForm = campos => { global.document.querySelectorAll = s =>
  /\[name\]/.test(s) ? Object.entries(campos).map(([name,value])=>({name,value})) : []; };
const navegadorNuevo = () => { DB = dbVacia(); sembrar(); _miFicha=null; _miProductora=null;
  _todasLasProductoras=[]; };
/* el <select> de arriba, como texto */
const menuArriba = () => { const m = app.innerHTML.match(/<label>Productora<\/label>[\s\S]*?<\/select>/);
  return m ? m[0] : ''; };

(async () => {
  /* --- 1. Andrés arma dos productoras ----------------------------------- */
  console.log('--- 1. HAY PRODUCTORAS EN LA BASE ---');
  navegadorNuevo();
  SESION='auth-a'; await conectar('andres@x.com');
  cargarForm({ nombre:'Andrés', tel:'', productoraId:'__nueva',
    productoraNombre:'Neto Films', rol:'admin', area:'produccion' });
  await confirmarAlta();
  ok('creó Neto Films', TB.productora.length===1, TB.productora[0].nombre);
  await crearProductoraEnLaWebConNombre('Millanisima');
  ok('y creó Millanisima', TB.productora.length===2,
    TB.productora.map(p=>p.nombre).join(' · '));

  /* --- 2. el menú muestra las de la base, con su nombre real ------------ */
  console.log('\n--- 2. EL MENU SALE DE LA BASE ---');
  await sincronizarProductoras(); render();
  let menu = menuArriba();
  ok('aparece Neto Films', /Neto Films/.test(menu));
  ok('aparece Millanisima', /Millanisima/.test(menu));
  ok('NO dice "Mi productora"', !/Mi productora/.test(menu), menu.slice(0,200));
  ok('la Demo del ejemplo queda aparte',
    /Sólo en esta computadora[\s\S]*?Productora Demo/.test(menu));
  ok('ofrece crear una nueva', /__nueva/.test(menu));

  /* --- 3. Willy, en otra máquina, VE las productoras de la web ---------- */
  console.log('\n--- 3. WILLY VE LAS PRODUCTORAS QUE HAY EN LA WEB ---');
  navegadorNuevo();
  SESION='auth-w'; await conectar('santyno@gmail.com');
  _prodsElegibles = await sbProductorasParaElegir();
  ok('la lista del alta trae las dos', _prodsElegibles.length===2,
    _prodsElegibles.map(p=>p.nombre).join(' · '));
  cargarForm({ nombre:'Willy De Rose', tel:'11 4444-2222',
    productoraId: TB.productora[0].id, productoraNombre:'', rol:'admin', area:'produccion' });
  await confirmarAlta();
  await sincronizarProductoras(); render();
  menu = menuArriba();
  ok('en su menú está SU productora con nombre real', /Neto Films/.test(menu));
  ok('y la otra, para sumarse', /En la web[\s\S]*?Millanisima/.test(menu), );
  ok('la otra va con prefijo sumar:', /value="sumar:/.test(menu));
  ok('sigue sin decir "Mi productora"', !/>Mi productora</.test(menu));

  /* --- 4. sumarse a la otra desde el menú -------------------------------- */
  console.log('\n--- 4. ELEGIR UNA DE "EN LA WEB" ME SUMA ---');
  const milla = TB.productora.find(p=>p.nombre==='Millanisima');
  await selProductora('sumar:' + milla.id);
  const wf = await sbMiFicha();
  ok('mi ficha se mudó a Millanisima', wf.productora_id === milla.id);
  ok('y sigo siendo yo', wf.nombre === 'Willy De Rose', wf.nombre);
  ok('la app quedó parada en esa productora', DB.ui.productoraId === milla.id);
  await sincronizarProductoras(); render();
  ok('el menú ahora la muestra como mía', /Neto Films|Millanisima/.test(menuArriba()));
  ok('y aparece seleccionada',
    new RegExp('value="'+milla.id+'" selected').test(menuArriba()));

  /* --- 5. cambiar y agregar desde "Mis datos" ---------------------------- */
  console.log('\n--- 5. DESDE MIS DATOS ---');
  _miFicha = await sbMiFicha();
  modal = null; await editarMiFicha();
  ok('la pantalla abre', /Mis datos/.test(modal||''));
  ok('tiene el selector de productora', /id="miprod"/.test(modal||''));
  ok('lista las dos', /Neto Films/.test(modal) && /Millanisima/.test(modal));
  ok('muestra la mía elegida',
    new RegExp('value="'+milla.id+'"[^>]*selected').test(modal));
  ok('y el botón de agregar', /Agregar productora/.test(modal));
  ok('explica qué hace', /Cambiarla mueve tu ficha/.test(modal));

  const neto = TB.productora.find(p=>p.nombre==='Neto Films');
  await cambiarMiProductora(neto.id);
  const wf2 = await sbMiFicha();
  ok('cambiar desde Mis datos me mueve', wf2.productora_id === neto.id);
  ok('y la pantalla se vuelve a abrir', /Mis datos/.test(modal||''));

  /* --- 6. sin sesión, el menú no inventa nada --------------------------- */
  console.log('\n--- 6. SIN SESION ---');
  SB.access=null; SB.user=null; render();
  menu = menuArriba();
  ok('no ofrece crear en la web', !/__nueva/.test(menu));
  ok('ni productoras ajenas', !/sumar:/.test(menu));
  ok('pero sigue mostrando lo local', /Productora Demo/.test(menu));

  console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
  process.exitCode = fallos ? 1 : 0;
})();

/* crearProductoraEnLaWeb() usa prompt(); acá se le pasa el nombre directo */
async function crearProductoraEnLaWebConNombre(nombre){
  const viejo = global.prompt; global.prompt = () => nombre;
  try{ await crearProductoraEnLaWeb(); } finally { global.prompt = viejo; }
}
