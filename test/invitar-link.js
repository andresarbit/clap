/* Invitar a alguien a un proyecto con un link.
   ---------------------------------------------------------------------------
   La historia entera: Andrés arma un proyecto, genera el link, se lo manda a
   alguien que NO tiene cuenta. Esa persona abre el link, ve de qué la
   invitaron ANTES de aceptar, se crea la cuenta, acepta, y el proyecto le
   aparece en el menú.

   Lo que hay que cuidar y por eso se prueba:
     - el mensaje es corto y dice proyecto, productora y link
     - la pantalla previa dice quién invita, a qué, de qué productora y con
       qué rol — sin eso el link es "hacé click y confiá"
     - sin cuenta, primero la cuenta
     - aceptar suma la productora SIN sacarme de las que ya tenía            */

let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

const TB = { organizacion: [{id:'org-1'}], productora: [], usuario: [],
             catalogo_persona: [], proyecto: [], proyecto_persona: [] };
let SEQ = 0, SESION = null, CUENTAS = {};
const uuid = () => `${(++SEQ+'').padStart(8,'0')}-0000-4000-8000-000000000000`;
const respu = (s, b) => ({ ok: s>=200&&s<300, status:s, statusText:'x',
  text: async () => b===undefined ? '' : JSON.stringify(b) });

/* `productoras_con_acceso()` tal cual está en backend/permisos.sql. La rama
   del proyecto_persona importa: con rol Producción o Equipo, el acceso NO sale
   de figurar en la productora sino de estar anotado en alguno de sus
   proyectos. Sin esta rama el doble miente y esconde el bug del orden. */
const mias = () => TB.usuario
  .filter(u => u.auth_uid === SESION && u.activo && !u.pendiente)
  .filter(u => ['admin','ejecutivo'].includes(u.rol)
    || TB.proyecto_persona.some(pp => pp.usuario_id === u.id
        && TB.proyecto.some(pr => pr.id === pp.proyecto_id
            && pr.productora_id === u.productora_id)))
  .map(u => u.productora_id);

global.fetch = async (url, o = {}) => {
  const u = String(url), met = o.method || 'GET', c = o.body ? JSON.parse(o.body) : null;
  if (u.includes('/auth/v1/settings')) return respu(200, { external:{} });
  if (u.includes('/auth/v1/signup')) {
    if (CUENTAS[c.email]) return respu(400, { message:'User already registered' });
    const id = 'auth-' + c.email.split('@')[0];
    CUENTAS[c.email] = { id, pass: c.password };
    SESION = id;
    return respu(200, { access_token:'t', refresh_token:'r', expires_in:3600,
      user:{ id, email:c.email } });
  }
  if (u.includes('grant_type=password')) {
    const cu = CUENTAS[c.email];
    if (!cu || cu.pass !== c.password) return respu(400, { message:'Invalid login credentials' });
    SESION = cu.id;
    return respu(200, { access_token:'t', refresh_token:'r', expires_in:3600,
      user:{ id: cu.id, email: c.email } });
  }
  if (u.includes('/auth/v1/logout')) return respu(204);
  if (u.includes('/rpc/productoras_para_elegir'))
    return respu(200, TB.productora.map(p => ({ id:p.id, nombre:p.nombre })));
  if (u.includes('/rpc/productora_pide_aprobacion')) return respu(200, false);
  if (u.includes('/rpc/crear_mi_productora')) {
    const pr = { id: uuid(), org_id:'org-1', nombre: String(c.p_nombre).trim(),
      fee_default:15, contingencia_default:5, iva_default:21, iibb_default:0 };
    TB.productora.push(pr);
    TB.usuario.push({ id: uuid(), auth_uid: SESION, productora_id: pr.id,
      nombre: c.p_mi_nombre || 'Yo', rol:'admin', email: emailDe(SESION),
      activo:true, pendiente:false, alta_el: ++SEQ });
    return respu(200, pr.id);
  }
  if (u.includes('/rpc/guardar_mis_datos')) {
    const m = TB.usuario.find(x => x.auth_uid === SESION);
    if (!m) return respu(400, { message:'Todavía no completaste tu alta' });
    if (c.p_nombre) m.nombre = c.p_nombre;
    let cat = TB.catalogo_persona.find(x => x.id === m.catalogo_id);
    if (!cat) { cat = { id: uuid(), org_id:'org-1', tipo:'persona', email:m.email };
      TB.catalogo_persona.push(cat); }
    cat.nombre = c.p_nombre || cat.nombre; m.catalogo_id = cat.id;
    return respu(200, cat.id);
  }

  const mm = u.match(/\/rest\/v1\/(\w+)/); if (!mm) return respu(404, {});
  const tabla = TB[mm[1]]; if (!tabla) return respu(404, { message:'no existe' });

  if (met === 'POST') {
    const fila = { id: uuid(), alta_el: ++SEQ, ...c };
    if (mm[1] === 'usuario' && fila.auth_uid !== SESION)
      return respu(403, { message:'row-level security policy' });
    /* upsert por id para proyecto y catálogo */
    if (['proyecto','catalogo_persona'].includes(mm[1]) && c.id) {
      const ya = tabla.find(x => x.id === c.id);
      if (ya) { Object.assign(ya, c); return respu(200, [ya]); }
      tabla.push({...c}); return respu(200, [c]);
    }
    if (mm[1] === 'proyecto_persona') {
      const ya = tabla.find(x => x.proyecto_id===c.proyecto_id && x.usuario_id===c.usuario_id);
      if (ya) return respu(200, [ya]);
      tabla.push({...c}); return respu(200, [c]);
    }
    tabla.push(fila); return respu(200, [fila]);
  }
  if (met === 'PATCH') {
    const eq = u.match(/[?&](\w+)=eq\.([^&]+)/);
    const o2 = tabla.filter(f => String(f[eq[1]]) === decodeURIComponent(eq[2]));
    o2.forEach(f => Object.assign(f, c)); return respu(200, o2);
  }
  let filas = tabla.slice(); const m2 = mias();
  if (mm[1] === 'productora') filas = filas.filter(f => m2.includes(f.id));
  if (mm[1] === 'proyecto')   filas = filas.filter(f => m2.includes(f.productora_id));
  if (mm[1] === 'usuario')    filas = filas.filter(f => m2.includes(f.productora_id) || f.auth_uid === SESION);
  if (mm[1] === 'catalogo_persona') filas = m2.length ? filas : [];
  [...u.matchAll(/[?&](\w+)=eq\.([^&]+)/g)].forEach(f => {
    filas = filas.filter(x => String(x[f[1]]) === decodeURIComponent(f[2])); });
  return respu(200, filas);
};
const emailDe = uid => Object.keys(CUENTAS).find(e => CUENTAS[e].id === uid) || uid + '@x.com';

/* el navegador: URL y localStorage propios por persona */
global.location = { origin:'https://clap.test', pathname:'/clap.html', search:'', hash:'', href:'https://clap.test/clap.html' };
global.history = { replaceState(){ } };
global.btoa = s => Buffer.from(s, 'binary').toString('base64');
global.atob = s => Buffer.from(s, 'base64').toString('binary');
global.URLSearchParams = class { constructor(q){ this.q = String(q||'').replace(/^\?/,''); }
  get(k){ const m = this.q.match(new RegExp('(?:^|&)'+k+'=([^&]*)')); return m ? decodeURIComponent(m[1]) : null; } };
global.URL = class { constructor(h){ this.href=h; this.pathname='/clap.html'; this.search=''; this.hash='';
  this.searchParams = { delete(){} }; } };
global.navigator = { clipboard: { writeText: async () => {} } };

const conectar = async (mail, pass) => { await sbLogin(mail, pass); SB.orgId = null; };
const cargarForm = campos => { global.document.querySelectorAll = s =>
  /\[name\]/.test(s) ? Object.entries(campos).map(([name,value])=>({name,value})) : []; };
const navegadorNuevo = () => { DB = dbVacia(); sembrar(); _miFicha=null; _miProductora=null;
  _misFichas=[]; _todasLasProductoras=[]; _invitacion=null; modal=null;
  SB.url='https://x.supabase.co'; SB.anon='a'; SB.access=null; SB.user=null; };

(async () => {
  /* --- 1. Andrés arma la productora y el proyecto ------------------------ */
  console.log('--- 1. ANDRES ARMA EL PROYECTO ---');
  navegadorNuevo();
  CUENTAS['andres@x.com'] = { id:'auth-andres', pass:'secreto123' };
  await conectar('andres@x.com','secreto123');
  cargarForm({ nombre:'Andrés', tel:'', productoraId:'__nueva',
    productoraNombre:'Neto Films', rol:'admin', area:'produccion' });
  await confirmarAlta();
  await sincronizarProductoras();
  const pr = getPr();
  ok('tiene su productora', pr && pr.nombre === 'Neto Films', pr && pr.nombre);

  cargarForm({ nombre:'Spot Verano', tipo:'publicidad', cliente:'Marca X', agencia:'Agencia Y',
    producto:'Bebida', jornadas:'1', medios:'Digital', territorio:'Argentina', plazo:'12 meses' });
  saveProyecto();
  const py = getPr().proyectos.find(p => p.nombre === 'Spot Verano');
  ok('y su proyecto', !!py, py && py.nombre);
  await subirProyectosDe(getPr());
  ok('EL PROYECTO SUBIO A LA BASE', TB.proyecto.some(p => p.nombre === 'Spot Verano'),
    TB.proyecto.map(p=>p.nombre).join(' · '));

  /* --- 1b. el boton se ve en TODAS las solapas ---------------------------
     Estaba metido adentro de la cabecera del Presupuesto, y la app abre en
     Resumen: no se veia nunca. Ahora vive en el encabezado, al lado del
     selector de Proyecto, que esta siempre.                               */
  console.log('\n--- 1b. EL BOTON DE INVITAR SE VE SIEMPRE ---');
  DB.ui.proyectoId = py.id;
  DB.ui.versionId = py.versiones[0].id;
  for(const t of ['resumen','presu','desglose','callsheet','rodaje','gastos','equipo','catalogo','config']){
    DB.ui.tab = t; render();
    ok('está en la solapa ' + t, /invitarAlProyecto\(\)/.test(app.innerHTML));
  }
  DB.ui.tab = 'resumen'; render();
  ok('aparece una sola vez, no repetido',
    (app.innerHTML.match(/invitarAlProyecto\(\)/g)||[]).length === 1,
    (app.innerHTML.match(/invitarAlProyecto\(\)/g)||[]).length + ' veces');
  ok('dice Invitar con todas las letras', /✉ Invitar/.test(app.innerHTML));
  /* sin proyecto no tiene sentido ofrecerlo */
  const guardados = getPr().proyectos; getPr().proyectos = [];
  DB.ui.proyectoId = null; render();
  ok('sin proyecto no aparece', !/invitarAlProyecto\(\)/.test(app.innerHTML));
  getPr().proyectos = guardados; DB.ui.proyectoId = py.id; render();

  /* --- 2. genera el link ------------------------------------------------- */
  console.log('\n--- 2. EL LINK Y EL MENSAJE ---');
  DB.ui.proyectoId = py.id;
  modal = null; invitarAlProyecto();
  ok('la pantalla de invitar abre', /Invitar a "Spot Verano"/.test(modal||''));
  ok('deja elegir el rol', /name="rol"/.test(modal||''));

  cargarForm({ rol:'produccion' });
  let salida = '';
  global.document.getElementById = () => ({ set innerHTML(v){ salida = v; }, get innerHTML(){ return salida; } });
  generarInvitacion();
  const link = (salida.match(/https:\/\/clap\.test\/clap\.html\?inv=[^\s"&<]+/)||[])[0];
  ok('generó el link', !!link, link && link.slice(0, 70) + '…');

  const msg = textoInvitacion('Spot Verano', 'Neto Films', link);
  console.log('    mensaje: ' + msg.split('\n')[0]);
  ok('el mensaje es el pedido',
    msg.startsWith('Te invitaron a participar del proyecto: "Spot Verano" en la productora: "Neto Films"'));
  ok('y trae el link', msg.includes(link));
  ok('es corto: dos renglones', msg.split('\n').length === 2);

  const inv = JSON.parse(deB64(link.split('inv=')[1].split('&')[0]));
  ok('el link lleva el proyecto', inv.py === py.id);
  ok('la productora', inv.pr === getPr().id);
  ok('el rol', inv.rol === 'produccion');
  ok('y quién invita', inv.de === 'Andrés', inv.de);

  /* --- 3. alguien SIN cuenta abre el link ------------------------------- */
  console.log('\n--- 3. LO ABRE ALGUIEN SIN CUENTA ---');
  navegadorNuevo();
  SESION = null;
  global.location.search = '?inv=' + link.split('inv=')[1];
  global.document.getElementById = () => null;
  const hubo = await revisarInvitacion();
  ok('la app frena y muestra la invitación', hubo === true);
  ok('dice el proyecto', /Spot Verano/.test(modal||''));
  ok('dice la productora', /Neto Films/.test(modal||''));
  ok('dice quién lo invitó', /Andrés/.test(modal||''));
  ok('dice con qué rol entra', /Producción/.test(modal||''));
  ok('PIDE CREAR CUENTA ANTES', /Primero necesitás una cuenta/.test(modal||''));
  ok('con campos de mail y contraseña',
    /name="invmail"/.test(modal||'') && /name="invpass"/.test(modal||''));
  ok('y deja decir que ya tiene cuenta', /Ya tengo cuenta/.test(modal||''));
  ok('no muestra la app por atrás todavía', !/Presupuesto/.test(modal||''));

  /* --- 4. se crea la cuenta y acepta ------------------------------------ */
  console.log('\n--- 4. SE CREA LA CUENTA Y ACEPTA ---');
  let diag = '';
  global.document.getElementById = id => id === 'invdiag'
    ? { set innerHTML(v){ diag = v; }, get innerHTML(){ return diag; } } : null;
  cargarForm({ invmail:'willy@x.com', invpass:'secreto123' });
  await entrarYAceptar('crear');

  ok('quedó con sesión', sbConectado(), SB.user && SB.user.email);
  const suFicha = _misFichas.find(f => f.productora_id === inv.pr);
  ok('SE SUMO A LA PRODUCTORA', !!suFicha, suFicha && suFicha.rol);
  ok('con el rol de la invitación', suFicha && suFicha.rol === 'produccion', suFicha && suFicha.rol);
  ok('quedó anotado en el proyecto',
    TB.proyecto_persona.some(x => x.proyecto_id === py.id && x.usuario_id === suFicha.id));
  ok('la invitación se consumió', _invitacion === null);

  /* --- 5. y lo VE en los menús ------------------------------------------ */
  console.log('\n--- 5. LA PRODUCTORA Y EL PROYECTO APARECEN ---');
  ok('está parado en esa productora', DB.ui.productoraId === inv.pr);
  const prLocal = DB.productoras.find(p => p.id === inv.pr);
  ok('LA PRODUCTORA ESTA EN SU NAVEGADOR', !!prLocal, prLocal && prLocal.nombre);
  ok('con su nombre real', prLocal && prLocal.nombre === 'Neto Films', prLocal && prLocal.nombre);
  const pyLocal = prLocal && (prLocal.proyectos||[]).find(x => x.id === py.id);
  ok('EL PROYECTO TAMBIEN', !!pyLocal, pyLocal && pyLocal.nombre);
  ok('y quedó elegido', DB.ui.proyectoId === py.id);
  render();
  const menu = (app.innerHTML.match(/<label>Productora<\/label>[\s\S]*?<\/select>/)||[''])[0];
  ok('el menú de arriba muestra Neto Films', /Neto Films/.test(menu));

  /* --- 6. aceptar otra invitación NO me saca de la anterior -------------- */
  console.log('\n--- 6. SUMARSE A OTRA NO ME SACA DE LA PRIMERA ---');
  const otra = { id: uuid(), org_id:'org-1', nombre:'Millanisima' };
  TB.productora.push(otra);
  const pyOtro = { id: uuid(), productora_id: otra.id, nombre:'Corto B' };
  TB.proyecto.push(pyOtro);
  _invitacion = { v:1, py:pyOtro.id, pyn:'Corto B', pr:otra.id, prn:'Millanisima',
    rol:'produccion', de:'Otro' };
  await aceptarInvitacion();
  ok('ahora tengo DOS fichas', _misFichas.length === 2, _misFichas.length + '');
  ok('sigo estando en Neto Films', !!fichaDe(inv.pr));
  ok('y también en Millanisima', !!fichaDe(otra.id));
  render();
  const menu2 = (app.innerHTML.match(/<label>Productora<\/label>[\s\S]*?<\/select>/)||[''])[0];
  ok('el menú muestra LAS DOS',
    /Neto Films/.test(menu2) && /Millanisima/.test(menu2), menu2.replace(/\s+/g,' ').slice(0,160));

  /* --- 7. "Ahora no" no rompe nada -------------------------------------- */
  console.log('\n--- 7. "AHORA NO" ---');
  _invitacion = { v:1, py:'x', pyn:'Otro', pr:'y', prn:'Z', rol:'equipo', de:'Nadie' };
  descartarInvitacion();
  ok('se descarta', _invitacion === null);
  ok('y no queda modal abierto', modal === null);

  console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
  process.exitCode = fallos ? 1 : 0;
})();
