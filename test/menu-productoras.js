/* El menú "Productora" de arriba, conectado a la base.
   ---------------------------------------------------------------------------
   Lo que estaba mal: el menú listaba `DB.productoras`, o sea lo que hubiera
   quedado en ESE navegador. Por eso a Willy le aparecía "Productora Demo" (la
   del ejemplo) y "Mi productora" (el nombre provisorio que pone el sistema
   cuando no puede leer el real), y no la productora de verdad.

   Ahora sale de la base:
     - las MIAS, con su nombre real
     - las que quedaron sólo en este navegador, marcadas aparte
   Las ajenas NO se listan: con CLAP privado (backend/privado.sql) a una
   productora se entra con una invitación, no eligiéndola de una lista.      */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

const TB = { organizacion: [], productora: [], usuario: [], catalogo_persona: [], invitacion: [] };
let SEQ = 0, SESION = 'auth-a';
const nid = p => `${p}-${++SEQ}`;
const uuidFalso = () => `${(++SEQ+'').padStart(8,'0')}-0000-4000-8000-000000000000`;
const respu = (s, b) => ({ ok: s >= 200 && s < 300, status: s, statusText: 'x',
  text: async () => b === undefined ? '' : JSON.stringify(b) });

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
  /* privado.sql: sólo las mías */
  if (u.includes('/rpc/productoras_para_elegir'))
    return respu(200, TB.productora.filter(p => TB.usuario.some(x => x.auth_uid === SESION && x.productora_id === p.id))
      .map(p => ({ id: p.id, nombre: p.nombre })));
  if (u.includes('/rpc/aceptar_invitacion')) {
    const inv = TB.invitacion.find(x => x.token === c.p_token);
    if (!inv) return respu(400, { message: 'Ese link de invitación no existe' });
    let yo = TB.usuario.find(x => x.auth_uid === SESION && x.productora_id === inv.productora_id);
    if (!yo) { yo = { id: uuidFalso(), auth_uid: SESION, productora_id: inv.productora_id,
      nombre: c.p_nombre || 'Invitado', rol: inv.rol, email: SESION + '@x.com',
      activo: true, pendiente: false, alta_el: ++SEQ }; TB.usuario.push(yo); }
    return respu(200, { productora_id: inv.productora_id, proyecto_id: null, rol: yo.rol });
  }
  if (u.includes('/rpc/productora_pide_aprobacion')) return respu(200, false);
  if (u.includes('/rpc/crear_mi_productora')) {
    let org = TB.organizacion[0];
    if (!org) { org = { id: uuidFalso() }; TB.organizacion.push(org); }
    const pr = { id: uuidFalso(), org_id: org.id, nombre: String(c.p_nombre).trim(),
      cuit: null, condicion_iva: null, jurisdiccion: null,
      fee_default: 15, contingencia_default: 5, iva_default: 21, iibb_default: 0 };
    TB.productora.push(pr);
    /* una ficha nueva por productora: crear otra no me saca de la anterior */
    TB.usuario.push({ id: uuidFalso(), auth_uid: SESION, productora_id: pr.id,
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
    if (m[1] === 'usuario')       /* privado.sql: no hay alta propia */
      return respu(403, { message: 'new row violates row-level security policy' });
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
  cargarForm({ nombre:'Andrés', tel:'', productoraNombre:'Neto Films', area:'produccion' });
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

  /* --- 3. Willy, en otra máquina: sin invitación no ve ninguna ----------- */
  console.log('\n--- 3. WILLY NO VE LAS AJENAS: ENTRA INVITADO ---');
  navegadorNuevo();
  SESION='auth-w'; await conectar('santyno@gmail.com');
  ok('la lista no le trae productoras ajenas', (await sbProductorasParaElegir()).length===0);
  await sincronizarProductoras(); render();
  menu = menuArriba();
  ok('su menú no ofrece las ajenas', !/Neto Films|Millanisima/.test(menu) && !/sumar:/.test(menu));
  /* Andrés lo invita a Neto Films (la clave la guardó la base) */
  const neto = TB.productora.find(p=>p.nombre==='Neto Films');
  const milla = TB.productora.find(p=>p.nombre==='Millanisima');
  TB.invitacion.push({ token:'tok-neto', productora_id: neto.id, rol:'admin' });
  _invitacion = { v:2, t:'tok-neto', pr: neto.id, prn:'Neto Films' };
  await aceptarInvitacion();
  await sincronizarProductoras(); render();
  menu = menuArriba();
  ok('con la invitación, está SU productora con nombre real', /Neto Films/.test(menu));
  ok('la otra sigue sin aparecer', !/Millanisima/.test(menu) && !/sumar:/.test(menu));
  ok('sigue sin decir "Mi productora"', !/>Mi productora</.test(menu));

  /* --- 4. elegir una ajena por id no lo mete ----------------------------- */
  console.log('\n--- 4. NO HAY ATAJO PARA SUMARSE ---');
  await selProductora('sumar:' + milla.id);
  ok('no le crea ficha en Millanisima', !TB.usuario.some(x => x.auth_uid==='auth-w' && x.productora_id===milla.id));
  TB.invitacion.push({ token:'tok-milla', productora_id: milla.id, rol:'ejecutivo' });
  _invitacion = { v:2, t:'tok-milla', pr: milla.id, prn:'Millanisima' };
  await aceptarInvitacion();
  await sincronizarProductoras(); render();
  menu = menuArriba();
  ok('con otra invitación, tiene las dos', /Neto Films/.test(menu) && /Millanisima/.test(menu));
  ok('y quedó parado en la nueva', new RegExp('value="'+milla.id+'" selected').test(menu));

  /* --- 5. cambiar desde "Mis datos" -------------------------------------- */
  console.log('\n--- 5. DESDE MIS DATOS ---');
  _miFicha = await sbMiFicha();
  modal = null; await editarMiFicha();
  ok('la pantalla abre', /Mis datos/.test(modal||''));
  ok('tiene el selector de productora', /id="miprod"/.test(modal||''));
  ok('lista las dos', /Neto Films/.test(modal) && /Millanisima/.test(modal));
  ok('muestra la mía elegida',
    new RegExp('value="'+milla.id+'"[^>]*selected').test(modal));
  ok('ofrece crear la propia', /Crear mi productora/.test(modal));
  ok('explica que a otra se entra invitado', /se entra con una invitación/.test(modal));
  await cambiarMiProductora(neto.id);
  ok('cambiar desde Mis datos lo para en la otra', DB.ui.productoraId === neto.id);
  ok('sin crear fichas nuevas', TB.usuario.filter(x => x.auth_uid==='auth-w').length === 2);
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
