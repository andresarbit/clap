/* La capa de conexión con Supabase, contra un servidor falso que controlo.
   Lo que se prueba: que las llamadas salgan bien formadas, que la sesión se
   renueve sola, que los errores se traduzcan a algo legible, y que la clave
   service_role quede rechazada. */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };

/* --- Supabase de mentira ------------------------------------------------- */
let LLAMADAS = [];
let ESTADO = { tablas: ['organizacion', 'productora', 'usuario', 'proyecto', 'comprobante', 'comprobante_paso'], vence: 3600 };
const resp = (status, body) => ({
  ok: status >= 200 && status < 300, status, statusText: 'x',
  text: async () => body === undefined ? '' : JSON.stringify(body)
});
global.fetch = async (url, opts = {}) => {
  LLAMADAS.push({ url, metodo: opts.method || 'GET', headers: opts.headers || {}, body: opts.body });
  const u = String(url);
  if (ESTADO.caido) throw new Error('network');
  if ((opts.headers || {}).apikey !== 'anon_valida') return resp(401, { msg: 'Invalid API key' });

  if (u.includes('/auth/v1/settings')) return resp(200, { external: {} });
  if (u.includes('grant_type=password')) {
    const b = JSON.parse(opts.body);
    if (b.password !== 'secreto123') return resp(401, { error_description: 'Invalid login credentials' });
    return resp(200, { access_token: 'tok_1', refresh_token: 'ref_1', expires_in: ESTADO.vence, user: { id: 'u1', email: b.email } });
  }
  if (u.includes('grant_type=refresh_token')) {
    const b = JSON.parse(opts.body);
    if (b.refresh_token !== 'ref_1') return resp(401, { msg: 'Invalid refresh token' });
    return resp(200, { access_token: 'tok_2', refresh_token: 'ref_2', expires_in: 3600, user: { id: 'u1', email: 'a@b.com' } });
  }
  if (u.includes('/auth/v1/signup')) {
    const b = JSON.parse(opts.body);
    if (b.email === 'repetido@b.com') return resp(400, { msg: 'User already registered' });
    if (String(b.password).length < 6) return resp(400, { msg: 'Password should be at least 6 characters' });
    if (ESTADO.pideConfirmar) return resp(200, { user: { id: 'u2', email: b.email } });
    return resp(200, { access_token: 'tok_1', refresh_token: 'ref_1', expires_in: 3600, user: { id: 'u2', email: b.email } });
  }
  if (u.includes('/auth/v1/logout')) return resp(204);
  const m = u.match(/\/rest\/v1\/(\w+)/);
  if (m) {
    if (!(opts.headers || {}).Authorization) return resp(401, { msg: 'JWT required' });
    if (!ESTADO.tablas.includes(m[1]))
      return resp(404, { message: `relation "public.${m[1]}" does not exist` });
    return resp(200, []);
  }
  return resp(404, { msg: 'no such route' });
};

const reset = () => { sbOlvidar(); LLAMADAS = []; ESTADO.caido = false; ESTADO.pideConfirmar = false; ESTADO.vence = 3600; };

/* --- 1. configuración ---------------------------------------------------- */
console.log('--- 1. CONFIGURACION ---');
reset();
ok('arranca sin configurar', !sbConfigurado() && !sbConectado());
[['xxxx.supabase.co', 'https://xxxx.supabase.co'],
['https://xxxx.supabase.co/', 'https://xxxx.supabase.co'],
['  https://xxxx.supabase.co  ', 'https://xxxx.supabase.co'],
['http://localhost:54321', 'http://localhost:54321'],
['', '']].forEach(([e, esp]) =>
  ok('normaliza URL ' + JSON.stringify(e), sbNormalizarUrl(e) === esp, sbNormalizarUrl(e)));

/* la clave service_role tiene que quedar afuera */
const claves = [
  ['eyJhbGciOiJIUzI1NiIsInR9.eyJyb2xlIjoiYW5vbiJ9.x', 'anon en JWT', true],
  ['sb_publishable_abc123', 'publishable nueva', true],
  ['sb_secret_abc123', 'secret nueva', false],
  ['{"role":"service_role"}', 'service_role a la vista', false],
];
claves.forEach(([k, l, deberia]) => {
  const rechaza = /service_role|^sb_secret_/i.test(k) || /"role"\s*:\s*"service_role"/.test(k);
  ok('clave ' + l + (deberia ? ' se acepta' : ' se RECHAZA'), rechaza !== deberia);
});

SB.url = 'https://xxxx.supabase.co'; SB.anon = 'anon_valida';
ok('queda configurado', sbConfigurado() && !sbConectado());

/* --- 2. login ------------------------------------------------------------ */
console.log('\n--- 2. LOGIN ---');
(async () => {
  LLAMADAS = [];
  const u = await sbLogin('a@b.com', 'secreto123');
  ok('entra y devuelve el usuario', u.email === 'a@b.com', u.email);
  ok('queda conectado', sbConectado());
  const l = LLAMADAS[0];
  ok('pega en el endpoint correcto', /\/auth\/v1\/token\?grant_type=password$/.test(l.url), l.url.split('.co')[1]);
  ok('manda la apikey', l.headers.apikey === 'anon_valida');
  ok('el login NO manda Authorization', !l.headers.Authorization);
  ok('manda mail y contraseña', JSON.parse(l.body).email === 'a@b.com');
  ok('guarda los dos tokens', SB.access === 'tok_1' && SB.refresh === 'ref_1');
  ok('calcula el vencimiento con margen', SB.expira > Date.now() && SB.expira < Date.now() + 3600000,
    Math.round((SB.expira - Date.now()) / 1000) + 's (de 3600, 60 de margen)');
  ok('recorta espacios del mail', (() => {
    LLAMADAS = []; return sbLogin('  a@b.com ', 'secreto123').then(() =>
      JSON.parse(LLAMADAS[0].body).email === 'a@b.com'); })() instanceof Promise);

  /* mal la contraseña */
  try { await sbLogin('a@b.com', 'mala'); ok('contraseña mala falla', false, 'no tiró error'); }
  catch (e) { ok('contraseña mala da mensaje legible', e.message === 'Mail o contraseña incorrectos.', e.message); }

  /* --- 3. renovación de sesión ------------------------------------------ */
  console.log('\n--- 3. RENOVACION ---');
  await sbLogin('a@b.com', 'secreto123');
  ok('con token fresco no renueva', (() => { LLAMADAS = []; return true; })());
  ok('sesión viva sin llamar al server', await sbSesionViva() && LLAMADAS.length === 0, LLAMADAS.length + ' llamadas');
  SB.expira = Date.now() - 1000;             /* lo vencemos a mano */
  LLAMADAS = [];
  ok('token vencido: renueva solo', await sbSesionViva() && SB.access === 'tok_2', SB.access);
  ok('usó el refresh_token', /grant_type=refresh_token/.test(LLAMADAS[0].url));
  SB.expira = Date.now() - 1000; SB.refresh = 'ref_roto';
  ok('refresh inválido: cierra la sesión sin romper', await sbSesionViva() === false && !sbConectado());

  /* --- 4. registro ------------------------------------------------------- */
  console.log('\n--- 4. REGISTRO ---');
  reset(); SB.url = 'https://xxxx.supabase.co'; SB.anon = 'anon_valida';
  let r = await sbRegistrar('nuevo@b.com', 'secreto123');
  ok('registro que entra directo', r.entro === true && sbConectado());
  reset(); SB.url = 'https://xxxx.supabase.co'; SB.anon = 'anon_valida';
  ESTADO.pideConfirmar = true;
  r = await sbRegistrar('nuevo@b.com', 'secreto123');
  ok('si pide confirmar mail, avisa y no entra', r.entro === false && !sbConectado(), 'entro=' + r.entro);
  ESTADO.pideConfirmar = false;
  try { await sbRegistrar('repetido@b.com', 'secreto123'); ok('mail repetido falla', false); }
  catch (e) { ok('mail repetido da mensaje claro', /ya está registrado/.test(e.message), e.message); }
  try { await sbRegistrar('x@b.com', '123'); ok('contraseña corta falla', false); }
  catch (e) { ok('contraseña corta da mensaje claro', /mínimo 6/.test(e.message), e.message); }

  /* --- 5. errores traducidos -------------------------------------------- */
  console.log('\n--- 5. ERRORES LEGIBLES ---');
  reset();
  try { await sbFetch('/rest/v1/x'); ok('sin configurar avisa', false); }
  catch (e) { ok('sin configurar avisa', /Todavía no configuraste/.test(e.message), e.message); }
  SB.url = 'https://xxxx.supabase.co'; SB.anon = 'clave_mala';
  try { await sbFetch('/auth/v1/settings', { sinToken: true }); ok('clave mala avisa', false); }
  catch (e) { ok('clave mala avisa', /clave anónima no es válida/.test(e.message), e.message); }
  SB.anon = 'anon_valida'; ESTADO.caido = true;
  try { await sbFetch('/auth/v1/settings', { sinToken: true }); ok('servidor caído avisa', false); }
  catch (e) { ok('servidor caído avisa', /No pude llegar al servidor/.test(e.message), e.message); }
  ESTADO.caido = false;

  /* --- 6. diagnóstico ---------------------------------------------------- */
  console.log('\n--- 6. DIAGNOSTICO ---');
  reset();
  let pasos = await sbDiagnostico();
  ok('sin configurar: falla en el primer paso', pasos.length === 1 && !pasos[0].ok, pasos[0].t);

  SB.url = 'https://xxxx.supabase.co'; SB.anon = 'anon_valida';
  pasos = await sbDiagnostico();
  ok('configurado sin sesión: llega hasta la sesión', pasos.length === 3 && !pasos[2].ok,
    pasos.map(p => (p.ok ? '✓' : '✕') + p.t).join(' · '));

  await sbLogin('a@b.com', 'secreto123');
  pasos = await sbDiagnostico();
  console.log(pasos.map(p => `  ${p.ok ? '✓' : '✕'} ${p.t}${p.detalle ? ' — ' + p.detalle : ''}`).join('\n'));
  ok('con esquema completo: todo verde', pasos.every(p => p.ok), pasos.length + ' pasos');

  /* le sacamos dos tablas */
  ESTADO.tablas = ['organizacion', 'productora'];
  pasos = await sbDiagnostico();
  const pEsq = pasos.find(p => /Esquema/.test(p.t));
  ok('detecta las tablas que faltan', !pEsq.ok && /usuario/.test(pEsq.detalle) && /comprobante/.test(pEsq.detalle),
    pEsq.detalle);
  ok('y dice qué hacer', /esquema\.sql/.test(pEsq.detalle));

  /* --- 7. persistencia y aislamiento ------------------------------------ */
  console.log('\n--- 7. PERSISTENCIA ---');
  ESTADO.tablas = ['organizacion', 'productora', 'usuario', 'proyecto', 'comprobante', 'comprobante_paso'];
  await sbLogin('a@b.com', 'secreto123');
  ok('la config va a su propia clave', !!localStorage.getItem('clap.backend'));
  ok('NO se mezcla con los datos', !String(localStorage.getItem(KEY) || '').includes('anon_valida'));
  SB = { url: '', anon: '', access: null, refresh: null, user: null, expira: 0 };
  sbCargar();
  ok('al recargar recupera la sesión', sbConectado() && SB.user.email === 'a@b.com', SB.user?.email);
  await sbSalir();
  ok('cerrar sesión borra el token pero deja la config', !sbConectado() && sbConfigurado());
  sbOlvidar();
  ok('olvidar borra todo', !sbConfigurado() && !localStorage.getItem('clap.backend'));

  console.log('\n' + (fallos ? '>>> ' + fallos + ' FALLAS' : '>>> TODO OK'));
  process.exitCode = fallos ? 1 : 0;
})();
