/* La función del servidor que guarda la clave de la IA (backend/funciones/
   clap-ia). Se prueba sin Supabase ni Anthropic de verdad: se simulan.
   Lo que importa: sin sesión no hace nada; sólo atiende a quien está activo
   en la productora; sin clave no gasta; respeta el tope del mes; y la clave
   nunca vuelve a la página.                                                */
let fallos = 0;
const ok = (t, c, x = '') => { console.log((c ? '  OK  ' : 'FALLA ') + t + (x ? '  -> ' + x : '')); if (!c) fallos++; };
const path = require('path'), { pathToFileURL, URL: URLreal } = require('url');
global.URL = URLreal;   /* run.js lo reemplaza por uno de mentira; Request necesita el de verdad */

const ENV = { SUPABASE_URL: 'https://base.test', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'servicio', IA_TOPE_MENSUAL: '5' };
globalThis.Deno = { env: { get: k => ENV[k] }, serve() {} };
const PROD = '11111111-1111-4111-8111-111111111111';
let usos = 0, aIA = [];
global.fetch = async (url, o = {}) => {
  const u = String(url), r = (s, b) => ({ ok: s < 300, status: s, json: async () => b });
  if (u.endsWith('/auth/v1/user')) return o.headers.Authorization === 'Bearer buena' ? r(200, { id: 'uid-1' }) : r(401, {});
  if (u.includes('/rest/v1/usuario')) return r(200, u.includes(PROD) && o.headers.Authorization === 'Bearer buena' ? [{ id: 'x' }] : []);
  if (u.includes('/rpc/sumar_uso_ia')) { const b = JSON.parse(o.body);
    if (o.headers.apikey !== 'servicio') return r(401, {});
    if (b.p_cuanto > 0 && usos + b.p_cuanto > b.p_tope) return r(200, usos + b.p_cuanto);
    usos += Math.max(0, b.p_cuanto); return r(200, usos); }
  if (u === 'https://api.anthropic.com/v1/messages') { aIA.push(JSON.parse(o.body));
    return r(200, { content: [{ type: 'text', text: 'Acá va:\n{"items":[{"n":1,"estado":"ok","precio":65000}],"total":0}' }] }); }
  return r(404, {});
};
const pedir = (cuerpo, token = 'buena') => new Request('https://base.test/functions/v1/clap-ia', { method: 'POST',
  headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });

(async () => {
  const F = await import(pathToFileURL(path.join(__dirname, '..', 'backend', 'funciones', 'clap-ia', 'index.ts')).href);
  const res = async req => { const x = await F.atender(req); return { status: x.status, cuerpo: (t => { try { return JSON.parse(t || '{}'); } catch (e) { return {texto: t}; } })(await x.text()), cors: x.headers.get('Access-Control-Allow-Origin') }; };

  console.log('--- 1. QUIÉN PUEDE ---');
  let x = await res(pedir({ tarea: 'estado', productora: PROD }, 'trucha'));
  ok('sin sesión válida: 401', x.status === 401);
  x = await res(pedir({ tarea: 'estado', productora: '22222222-2222-4222-8222-222222222222' }));
  ok('de otra productora: 403', x.status === 403);
  x = await res(new Request('https://base.test/functions/v1/clap-ia', { method: 'OPTIONS' }));
  ok('responde al navegador (CORS)', x.status === 200 && x.cors === '*');

  console.log('\n--- 2. SIN CLAVE: APAGADA Y GRATIS ---');
  x = await res(pedir({ tarea: 'estado', productora: PROD }));
  ok('dice que está apagada', x.status === 200 && x.cuerpo.activa === false);
  x = await res(pedir({ tarea: 'respuesta_rental', productora: PROD, items: [], texto: 'ok' }));
  ok('no llama a la IA ni cuenta uso', x.status === 409 && aIA.length === 0 && usos === 0);

  console.log('\n--- 3. CON CLAVE ---');
  ENV.ANTHROPIC_API_KEY = 'sk-ant-de-prueba';
  x = await res(pedir({ tarea: 'estado', productora: PROD }));
  ok('prendida, con el uso del mes y el tope', x.cuerpo.activa === true && x.cuerpo.usados === 0 && x.cuerpo.tope === 5);
  x = await res(pedir({ tarea: 'respuesta_rental', productora: PROD, items: [{ n: 1, nombre: 'SkyPanel', cant: 2 }], texto: 'el sky sí, 65 lucas' }));
  ok('lee la respuesta y devuelve JSON', x.status === 200 && x.cuerpo.items[0].estado === 'ok' && x.cuerpo.items[0].precio === 65000);
  ok('le manda a la IA el pedido numerado y la respuesta', /1\. 2 × SkyPanel/.test(aIA[0].messages[0].content[0].text) && /65 lucas/.test(aIA[0].messages[0].content[0].text));
  ok('la clave nunca vuelve a la página', !JSON.stringify(x.cuerpo).includes('sk-ant'));
  ok('cuenta un uso', usos === 1);
  aIA = [];
  x = await res(pedir({ tarea: 'storyboard', productora: PROD, cuadros: [{ n: '1', img: 'data:image/jpeg;base64,QUJD', texto: 'PG cocina' }], planta: 'data:image/png;base64,UExB' }));
  const cont = aIA[0].messages[0].content;
  ok('el storyboard va con las imágenes y la planta', cont.filter(c => c.type === 'image').length === 2 && cont.some(c => c.type === 'text' && /PLANTA/.test(c.text)));

  console.log('\n--- 4. EL TOPE DEL MES ---');
  usos = 5;
  aIA = [];
  x = await res(pedir({ tarea: 'respuesta_rental', productora: PROD, items: [], texto: 'x' }));
  ok('al llegar al tope frena antes de llamar a la IA', x.status === 429 && aIA.length === 0 && /tope/.test(x.cuerpo.error));

  console.log('\n--- 5. LEER EL JSON QUE CONTESTA LA IA ---');
  ok('con texto alrededor', F.leerJson('Listo:\n[{"n":1}]\nSaludos').length === 1);
  let tiro = null; try { F.leerJson('no sé'); } catch (e) { tiro = e.message; }
  ok('sin datos, error claro', /no devolvió/.test(tiro));

  console.log(fallos ? `\n>>> ${fallos} FALLA(S)` : '\n>>> TODO OK');
})().catch(e => { console.log('FALLA excepción: ' + e.stack); console.log('\n>>> 1 FALLA(S)'); });
