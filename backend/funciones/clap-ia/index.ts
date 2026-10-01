// =============================================================================
// CLAP · la IA, del lado del servidor (Supabase Edge Function "clap-ia")
//
// La clave de Anthropic NO puede ir en la página: la página es pública y
// cualquiera la copiaría. Vive acá, como "secreto" de Supabase, y esta función
// es la única que la usa. La página le manda el pedido con la sesión de quien
// está usando CLAP; la función revisa que esa persona esté activa en la
// productora, cuenta el uso del mes contra un tope y recién ahí llama a la IA.
//
// Sin clave cargada no hace nada y no cuesta nada: contesta {activa:false} y
// CLAP sigue funcionando como siempre (las respuestas de los rentals se leen
// con reglas; los cuadros, por su texto).
//
// Tareas:
//   estado            ¿está prendida? ¿cuánto se usó este mes?
//   respuesta_rental  lee el mail de un rental: OK / NO / parcial y precio
//   storyboard        mira los cuadros: fondo, tiro, personajes, tamaño…
//
// Cómo prenderla: backend/PASOS.md, "La IA (opcional, paga)".
// =============================================================================

const MODELO = 'claude-sonnet-5-5';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const env = (k: string) => (globalThis as any).Deno.env.get(k) || '';

/* quién llama: la sesión que manda la página */
async function usuarioDe(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await fetch(env('SUPABASE_URL') + '/auth/v1/user', {
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? { id: u.id as string, token } : null;
}
/* ¿está activo en esa productora? Se pregunta CON SU sesión: decide RLS */
async function estaEnLaProductora(token: string, uid: string, productora: string) {
  const q = `${env('SUPABASE_URL')}/rest/v1/usuario?select=id&auth_uid=eq.${uid}&productora_id=eq.${productora}&activo=eq.true&pendiente=eq.false&limit=1`;
  const r = await fetch(q, { headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: 'Bearer ' + token } });
  if (!r.ok) return false;
  const filas = await r.json();
  return Array.isArray(filas) && filas.length > 0;
}
/* el tope del mes: lo suma la base (backend/ia.sql); si se pasó, no se llama */
async function usar(productora: string, cuanto: number, soloMirar = false) {
  const tope = parseInt(env('IA_TOPE_MENSUAL') || '300', 10);
  const r = await fetch(env('SUPABASE_URL') + '/rest/v1/rpc/sumar_uso_ia', {
    method: 'POST',
    headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: 'Bearer ' + env('SUPABASE_SERVICE_ROLE_KEY'),
      'Content-Type': 'application/json' },
    body: JSON.stringify({ p_productora: productora, p_cuanto: soloMirar ? 0 : cuanto, p_tope: tope }) });
  if (!r.ok) throw new Error('No pude contar el uso (¿corriste backend/ia.sql?)');
  const usados = await r.json();
  return { usados: Number(usados), tope };
}

async function preguntar(contenido: unknown[], maxTokens = 4000) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODELO, max_tokens: maxTokens, messages: [{ role: 'user', content: contenido }] }) });
  const d = await r.json();
  if (!r.ok) throw new Error((d && d.error && d.error.message) || 'La IA no contestó');
  const texto = (d.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
  return leerJson(texto);
}
/* la IA contesta JSON; por las dudas se busca el primer objeto o lista */
export function leerJson(texto: string) {
  const s = String(texto || '');
  const i = s.search(/[\[{]/);
  if (i < 0) throw new Error('La IA no devolvió datos');
  const abre = s[i], cierra = abre === '[' ? ']' : '}';
  const j = s.lastIndexOf(cierra);
  return JSON.parse(s.slice(i, j + 1));
}
const imagen = (dataUrl: string) => {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(String(dataUrl || ''));
  return m ? { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } } : null;
};

export function pedidoRespuestaRental(items: { n: number; nombre: string; cant: number }[], texto: string) {
  return [{ type: 'text', text:
`Sos asistente de producción de cine y publicidad en Argentina. Le mandamos a un rental este pedido de luces, numerado:
${items.map(x => `${x.n}. ${x.cant} × ${x.nombre}`).join('\n')}

Esto es lo que contestó el rental (puede venir desordenado, con el mail original citado con ">", o como el mismo pedido con OK/NO escrito al lado):
"""
${String(texto).slice(0, 20000)}
"""

Para CADA número del pedido decí si lo tienen. Devolvé SOLO JSON, sin texto antes ni después:
{"items":[{"n":1,"estado":"ok|no|parcial|?","cant":null,"precio":0,"nota":""}],"total":0}
- "parcial" si tienen menos unidades de las pedidas; "cant" = cuántas tienen.
- "precio" en pesos por jornada, número sin puntos; 0 si no lo dicen. "total" si dan un total.
- "?" si la respuesta no dice nada de ese renglón. No inventes.
- "nota": lo que escribieron sobre ese renglón, corto.` }];
}
export function pedidoStoryboard(cuadros: { n: string; img?: string; texto?: string }[], planta?: string) {
  const c: unknown[] = [{ type: 'text', text:
`Sos asistente de dirección de publicidad. Te paso los cuadros de un storyboard, cada uno con su número y el texto que trae.
Para cada cuadro decí lo que se VE (no lo que imaginás). Devolvé SOLO JSON:
{"cuadros":[{"n":"1","fondo":"","tiro":"frente|contra|lateral|pov|arriba|","personajes":[],"tamano":"","movimiento":"","intExt":"INT|EXT|","luz":"dia|dorada|azul|noche|","puesta":""}]}
- "fondo": el lugar o set que se ve, corto y siempre igual para el mismo lugar ("Cocina", "Calle - vereda").
- "tiro": hacia dónde mira la cámara respecto del cuadro anterior del mismo fondo: frente, contra (contraplano), lateral, pov (subjetiva), arriba (cenital o aéreo).
- "tamano": uno de: Gran plano general, Plano general, Plano conjunto, Plano americano, Plano medio, Primer plano, Primerísimo primer plano, Plano detalle, Insert, Cenital, Aéreo.
- "puesta": una letra; los cuadros que se filman con la misma posición de cámara y la misma luz llevan la misma letra (A, B, C… por fondo).
- Si algo no se puede saber, dejalo vacío.${planta ? '\nTambién va la PLANTA de cámara del DF (el set desde arriba con las posiciones): usala para decidir las puestas.' : ''}` }];
  if (planta) { const p = imagen(planta); if (p) c.push({ type: 'text', text: 'PLANTA:' }, p); }
  cuadros.slice(0, 30).forEach(x => {
    c.push({ type: 'text', text: `Cuadro ${x.n}: ${String(x.texto || '').slice(0, 400)}` });
    const im = x.img ? imagen(x.img) : null;
    if (im) c.push(im);
  });
  return c;
}

export async function atender(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Sólo POST' }, 405);
  let cuerpo: any;
  try { cuerpo = await req.json(); } catch { return json({ error: 'Pedido mal armado' }, 400); }
  const u = await usuarioDe(req);
  if (!u) return json({ error: 'Hay que iniciar sesión' }, 401);
  const productora = String(cuerpo.productora || '');
  if (!/^[0-9a-f-]{36}$/i.test(productora) || !(await estaEnLaProductora(u.token, u.id, productora)))
    return json({ error: 'No estás en esa productora' }, 403);
  const activa = !!env('ANTHROPIC_API_KEY');
  try {
    if (cuerpo.tarea === 'estado') {
      if (!activa) return json({ activa: false });
      return json({ activa: true, ...(await usar(productora, 0, true)) });
    }
    if (!activa) return json({ activa: false, error: 'La IA no está prendida' }, 409);
    const cuanto = cuerpo.tarea === 'storyboard' ? Math.max(1, Math.ceil((cuerpo.cuadros || []).length / 10)) : 1;
    const uso = await usar(productora, cuanto);
    if (uso.usados > uso.tope) return json({ error: `Se llegó al tope del mes (${uso.tope} usos).`, ...uso }, 429);
    if (cuerpo.tarea === 'respuesta_rental')
      return json({ ...(await preguntar(pedidoRespuestaRental(cuerpo.items || [], cuerpo.texto || ''), 3000)), ...uso });
    if (cuerpo.tarea === 'storyboard')
      return json({ ...(await preguntar(pedidoStoryboard(cuerpo.cuadros || [], cuerpo.planta), 6000)), ...uso });
    return json({ error: 'Tarea desconocida' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || 'Falló la IA' }, 502);
  }
}

if ((globalThis as any).Deno && (globalThis as any).Deno.serve) (globalThis as any).Deno.serve(atender);
