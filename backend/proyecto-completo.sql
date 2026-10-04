-- ===========================================================================
-- CLAP · EL PROYECTO COMPLETO EN LA BASE, Y LOS ROLES NUEVOS
--
-- COPIÁ TODO ESTE ARCHIVO, PEGALO EN:
--     Supabase  ->  SQL Editor  ->  New query
-- y apretá RUN. Se puede correr varias veces. No borra nada.
--
-- QUÉ RESUELVE (además: confirmar la citación con un toque, al final; y el
-- circuito de las rendiciones, en la sección 1a; y la etapa del proyecto
-- —en cotización, aprobado, no salió—, arriba de puedo_parte)
-- 1. Hasta ahora en la base estaba sólo la ficha de cada proyecto; el
--    presupuesto, el plan, los partes, los gastos y la liquidación vivían en
--    la compu de cada uno. Dos personas no podían trabajar sobre el mismo
--    proyecto. Ahora cada proyecto se guarda en PARTES (presupuesto, plan,
--    rodaje, gastos…) y cada una dice quién la cambió y cuándo.
-- 2. Los roles nuevos: Asistente de arte, Asistente de producción y
--    Asistente de dirección. Los asistentes y el equipo NO leen el
--    presupuesto: para ellos hay una parte "gente" con las líneas sin plata
--    (quién es quién, para el callsheet, las citaciones y las altas).
--
-- QUIÉN LEE Y QUIÉN ESCRIBE CADA PARTE
--   Administración y Productor Ejecutivo: todo.
--   Jefe de producción: todo menos el margen: el presupuesto "Real" y el del
--     "Cliente" van en la parte presupuesto_real, que no lee.
--   Asistente de dirección: escribe el plan; lee la gente, el plan y el rodaje.
--   Asistente de producción: escribe el rodaje, el pedido de luces, las altas,
--     los gastos, las tareas y los contactos; lee también la gente y el plan.
--   Asistente de arte y Equipo: escriben gastos y tareas; leen lo del set.
--   Nadie que no sea Administración, PE o jefe lee el presupuesto ni la
--   liquidación.
--   El fee (el margen) lo leen sólo Administración y el PE: el de cada
--   presupuesto y el que trae por defecto cada productora.
--   Las órdenes de compra (parte "compras") las leen y escriben sólo
--   Administración, el PE y el jefe de producción: llevan montos del
--   presupuesto. En los gastos, cada asistente cambia sólo lo suyo: sus
--   comprobantes, su rendición mientras la arma, sus cheques (ver 1a).
--   Y RECIBE sólo lo suyo: los gastos de los demás no llegan a su compu
--   (leer_gastos). El asistente de producción recibe además lo de arte y
--   el equipo, que revisa antes que el jefe. Lo de arte llega a
--   Administración sólo elevado por el jefe.
--   Las partes se escriben sólo con guardar_parte (no directo en la tabla).
-- ===========================================================================

-- Los roles nuevos van entre Equipo y Producción: para invitar, nadie puede
-- dar un rol más alto que el propio.
alter type rol_usuario add value if not exists 'arte'      before 'produccion';
alter type rol_usuario add value if not exists 'asistprod' before 'produccion';
alter type rol_usuario add value if not exists 'asistdir'  before 'produccion';

begin;

-- ---------------------------------------------------------------------------
-- 1. LAS PARTES DE CADA PROYECTO
-- ---------------------------------------------------------------------------
create table if not exists proyecto_parte (
  proyecto_id     uuid not null references proyecto(id) on delete cascade,
  parte           text not null,
  datos           jsonb not null default '{}'::jsonb,
  version         int  not null default 1,
  cambiado_el     timestamptz not null default now(),
  cambiado_por    uuid references usuario(id) on delete set null,
  cambiado_nombre text,
  primary key (proyecto_id, parte)
);
alter table proyecto_parte enable row level security;
-- Se lee directo; se escribe SÓLO con guardar_parte (más abajo), que es la
-- que hace cumplir quién toca qué. Antes también se podía escribir la tabla
-- directo, y eso salteaba los controles: ya no.
grant select on proyecto_parte to authenticated;
revoke insert, update, delete on proyecto_parte from authenticated, anon;

-- ¿Puedo leer (o escribir) esta parte de este proyecto? Compara el rol como
-- texto a propósito: así sirve en la misma corrida en que se agregan los
-- roles nuevos.
-- Los gastos: los asistentes y el equipo los ESCRIBEN (con guardar_parte),
-- pero no los leen enteros: cada uno recibe sólo lo suyo con leer_gastos
-- (sección 1a). Así a su compu no llegan los comprobantes de los demás.
-- LA ETAPA DEL PROYECTO (la situación cero: cotizar). Un proyecto nuevo
-- arranca EN COTIZACIÓN: se ven sólo el desglose y el presupuesto. Cuando el
-- PE o Administración tocan «Proyecto aprobado», pasa a APROBADO y aparece
-- todo lo demás. «No salió» lo deja guardado. Los proyectos que ya existían
-- quedan aprobados (es lo que eran). Mientras se cotiza, los asistentes y el
-- equipo (si alguien los invitó antes de tiempo) no escriben ninguna parte:
-- no hay plan, ni rodaje, ni gastos todavía.
alter table proyecto add column if not exists etapa text not null default 'aprobado';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'proyecto_etapa_valida') then
    alter table proyecto add constraint proyecto_etapa_valida check (etapa in ('cotizacion','aprobado','nosalio'));
  end if;
end $$;
-- La etapa la cambian sólo Administración y el PE. Si otro rol guarda la
-- ficha del proyecto (el jefe que corrige el nombre) con otra etapa, la etapa
-- queda como estaba: no rebota el guardado, simplemente no se toca.
create or replace function etapa_solo_pe() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.etapa is distinct from old.etapa and auth.uid() is not null
     and coalesce(mi_rol_en_proyecto(old.id)::text, '') not in ('admin','ejecutivo') then
    new.etapa := old.etapa;
  end if;
  return new;
end $$;
drop trigger if exists tr_etapa_solo_pe on proyecto;
create trigger tr_etapa_solo_pe before update of etapa on proyecto
  for each row execute function etapa_solo_pe();

create or replace function puedo_parte(p_proyecto uuid, p_parte text, p_escribir boolean)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(case
    when r is null then false
    when r in ('admin','ejecutivo') then true
    when r = 'produccion' then p_parte <> 'presupuesto_real'
    -- cotizando (o no salió): los asistentes y el equipo no escriben nada
    when p_escribir and coalesce((select etapa from proyecto where id = p_proyecto), 'aprobado') <> 'aprobado' then false
    when p_escribir then case r
        when 'asistdir'  then p_parte in ('plan','tareas')
        when 'asistprod' then p_parte in ('rodaje','luces','alta','gastos','tareas','contactos')
        else                  p_parte in ('gastos','tareas') end
    else p_parte in ('gente','plan','rodaje','luces','alta','tareas','contactos','extra') end, false)
  from (select mi_rol_en_proyecto(p_proyecto)::text as r) x
$$;
revoke all on function puedo_parte(uuid, text, boolean) from public, anon;
grant execute on function puedo_parte(uuid, text, boolean) to authenticated;

drop policy if exists parte_ver     on proyecto_parte;
drop policy if exists parte_crear   on proyecto_parte;
drop policy if exists parte_cambiar on proyecto_parte;
create policy parte_ver     on proyecto_parte for select using (puedo_parte(proyecto_id, parte, false));

-- ---------------------------------------------------------------------------
-- 1a. RENDICIONES Y GASTOS: quién ve y quién cambia qué en la parte "gastos"
--
-- Una rendición es una caja: la plata que se le da a alguien para gastar
-- (sale de una línea del presupuesto), más los tickets que rinde. Pasa por:
--   borrador (la arma quien rinde)
--   -> enviada (al jefe de producción)  ·  arte y el equipo: aProduccion
--      (a producción: la chequea primero el asistente de producción, que se
--      la pasa al jefe -> enviada. El jefe la ve, pero no la toca mientras
--      está en producción; sólo si el proyecto no tiene asistente de
--      producción la revisa él directo)
--   -> observada (vuelve con comentario)
--   -> aprobada (la eleva el jefe)  ->  cerrada (Administración o el PE,
--      que anotan lo que devolvió o lo que se le reintegra).
--
-- QUIÉN VE: Administración, el PE y el jefe de producción, todo. Los
-- asistentes y el equipo reciben sólo lo suyo (sus comprobantes, sus
-- rendiciones y sus cheques); el asistente de producción, además, lo de arte
-- y el equipo, que revisa. Se lee con leer_gastos(), no de la tabla.
--
-- QUIÉN CAMBIA: los asistentes y el equipo escriben lo suyo, pero NO pueden:
--   · tocar lo que cargó otra persona (salvo el asistente de producción, que
--     a lo de arte lo comenta, lo devuelve o se lo pasa al jefe);
--   · dar fondos ni anotar adelantos: eso lo hace quien da la plata;
--   · cambiar los gastos de una rendición ya mandada;
--   · aprobar ni cerrar nada;
--   · tocar las órdenes de compra (van en la parte "compras", que no leen).
-- El jefe revisa y eleva, pero no cierra. Y lo de arte llega a
-- Administración sólo elevado por el jefe: nadie lo aprueba salteando
-- producción, ni Administración lo cierra antes. Si el proyecto no tiene
-- jefe de producción (casi nunca pasa), lo eleva el PE en su lugar.
-- ---------------------------------------------------------------------------
create or replace function rend_estado(c jsonb) returns text
language sql immutable as $$
  select case when c->>'estado' = 'rendida' then 'cerrada'
              else coalesce(nullif(c#>>'{rendicion,estado}', ''), 'borrador') end
$$;

-- los de arte y el equipo de una productora (los que rinden "a producción")
create or replace function gastos_arte(p_prod uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id::text), '{}'::text[]) from usuario
   where productora_id = p_prod and rol::text in ('arte', 'equipo')
$$;
revoke all on function gastos_arte(uuid) from public, anon, authenticated;

-- ¿el proyecto NO tiene jefe de producción? (invitado, activo y aprobado).
-- Casi nunca: entonces lo de arte y el equipo lo eleva el PE.
create or replace function proyecto_sin_jefe(p_proyecto uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from proyecto_persona pp join usuario u on u.id = pp.usuario_id
                      where pp.proyecto_id = p_proyecto and u.rol::text = 'produccion' and u.activo and not u.pendiente)
$$;
revoke all on function proyecto_sin_jefe(uuid) from public, anon, authenticated;

-- ¿el proyecto NO tiene asistente de producción? (invitado, activo y aprobado).
-- Entonces lo de arte "en producción" lo revisa el jefe directo; si hay
-- asistente, el jefe actúa recién cuando el asistente se lo pasó.
create or replace function proyecto_sin_asist(p_proyecto uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from proyecto_persona pp join usuario u on u.id = pp.usuario_id
                      where pp.proyecto_id = p_proyecto and u.rol::text = 'asistprod' and u.activo and not u.pendiente)
$$;
revoke all on function proyecto_sin_asist(uuid) from public, anon, authenticated;

-- Lo que le toca ver a cada uno de los gastos
create or replace function gastos_visibles(p jsonb, p_yo text, p_rol text, p_arte text[])
returns jsonb
language plpgsql immutable set search_path = public as $$
declare v_cajas jsonb; v_ids text[];
begin
  if p is null then return null; end if;
  if p_rol in ('admin', 'ejecutivo', 'produccion') then return p; end if;
  select coalesce(jsonb_agg(x order by i), '[]'::jsonb) into v_cajas
    from jsonb_array_elements(coalesce(p->'cajas', '[]'::jsonb)) with ordinality t(x, i)
   where x->>'responsable' = p_yo or (p_rol = 'asistprod' and x->>'responsable' = any(p_arte));
  v_ids := array(select x->>'id' from jsonb_array_elements(v_cajas) x);
  return jsonb_build_object(
    'cajas', v_cajas,
    'comprobantes', (select coalesce(jsonb_agg(x order by i), '[]'::jsonb)
                       from jsonb_array_elements(coalesce(p->'comprobantes', '[]'::jsonb)) with ordinality t(x, i)
                      where x->>'cargadoPor' = p_yo or x->>'cajaId' = any(v_ids)
                         or (p_rol = 'asistprod' and x->>'cargadoPor' = any(p_arte))),
    'cheques', (select coalesce(jsonb_agg(x order by i), '[]'::jsonb)
                  from jsonb_array_elements(coalesce(p->'cheques', '[]'::jsonb)) with ordinality t(x, i)
                 where x->>'pedidoPor' = p_yo));
end $$;

-- Una lista de lo que guarda un asistente, metida en la lista entera: lo que
-- no ve queda como estaba y en su lugar; lo suyo, como lo mandó.
create or replace function gastos_juntar_lista(p_viejo jsonb, p_mios jsonb, p_vis text[])
returns jsonb
language plpgsql immutable set search_path = public as $$
declare x jsonb; m jsonb; v_out jsonb := '[]'::jsonb; v_puse text[] := '{}'::text[];
begin
  for x in select * from jsonb_array_elements(coalesce(p_viejo, '[]'::jsonb)) loop
    if (x->>'id') = any(p_vis) then
      select y into m from jsonb_array_elements(coalesce(p_mios, '[]'::jsonb)) y where y->>'id' = x->>'id' limit 1;
      if m is not null then v_out := v_out || jsonb_build_array(m); v_puse := v_puse || (x->>'id'); end if;
    else
      v_out := v_out || jsonb_build_array(x);
    end if;
  end loop;
  for m in select * from jsonb_array_elements(coalesce(p_mios, '[]'::jsonb)) loop
    if not ((m->>'id') = any(v_puse)) then v_out := v_out || jsonb_build_array(m); end if;
  end loop;
  return v_out;
end $$;

create or replace function gastos_juntar(p_todo jsonb, p_mio jsonb, p_yo text, p_rol text, p_arte text[])
returns jsonb
language plpgsql immutable set search_path = public as $$
declare v_vis jsonb; v_out jsonb; k text; v_ids text[]; v_ocultos text[]; v_nvis jsonb;
begin
  p_todo := coalesce(p_todo, '{}'::jsonb);
  v_vis := gastos_visibles(p_todo, p_yo, p_rol, p_arte);
  v_out := p_todo;
  foreach k in array array['cajas', 'comprobantes', 'cheques'] loop
    v_ids := array(select x->>'id' from jsonb_array_elements(coalesce(v_vis->k, '[]'::jsonb)) x);
    v_ocultos := array(select x->>'id' from jsonb_array_elements(coalesce(p_todo->k, '[]'::jsonb)) x
                        where not ((x->>'id') = any(v_ids)));
    if exists (select 1 from jsonb_array_elements(coalesce(p_mio->k, '[]'::jsonb)) y where (y->>'id') = any(v_ocultos)) then
      raise exception 'Eso no es tuyo: no se puede guardar.';
    end if;
    v_out := jsonb_set(v_out, array[k], gastos_juntar_lista(p_todo->k, p_mio->k, v_ids));
  end loop;
  -- todo lo que mandó tiene que seguir siendo suyo (no se le pasa nada a otro)
  v_nvis := gastos_visibles(v_out, p_yo, p_rol, p_arte);
  foreach k in array array['cajas', 'comprobantes', 'cheques'] loop
    if jsonb_array_length(coalesce(v_nvis->k, '[]'::jsonb)) <> jsonb_array_length(coalesce(p_mio->k, '[]'::jsonb)) then
      raise exception 'Sólo podés guardar lo tuyo: algo quedaría a nombre de otra persona.';
    end if;
  end loop;
  return v_out;
end $$;

-- Las versiones de antes (4 y 5 parámetros) quedan reemplazadas por la de abajo
drop function if exists gastos_permitidos(jsonb, jsonb, text, text);
drop function if exists gastos_permitidos(jsonb, jsonb, text, text, text[]);
drop function if exists gastos_permitidos(jsonb, jsonb, text, text, text[], boolean);

-- null si el cambio está permitido; si no, el motivo (en castellano).
-- A un asistente se le pasa lo que ve de antes y lo que manda. p_sin_jefe:
-- el proyecto no tiene jefe de producción (lo de arte lo eleva el PE).
-- p_sin_asist: el proyecto no tiene asistente de producción (lo de arte "en
-- producción" lo toca el jefe directo; si hay asistente, lo chequea él antes).
create or replace function gastos_permitidos(p_viejo jsonb, p_nuevo jsonb, p_yo text, p_rol text, p_arte text[],
                                             p_sin_jefe boolean default false, p_sin_asist boolean default false)
returns text
language plpgsql immutable set search_path = public as $$
declare
  c jsonb; v jsonb; e_v text; e_n text; v_dest text;
  trabadas text[]; mias text[];
  vc jsonb := coalesce(p_viejo->'cajas', '[]'::jsonb);
  nc jsonb := coalesce(p_nuevo->'cajas', '[]'::jsonb);
  vp jsonb := coalesce(p_viejo->'comprobantes', '[]'::jsonb);
  np jsonb := coalesce(p_nuevo->'comprobantes', '[]'::jsonb);
  vq jsonb := coalesce(p_viejo->'cheques', '[]'::jsonb);
  nq jsonb := coalesce(p_nuevo->'cheques', '[]'::jsonb);
begin
  p_arte := coalesce(p_arte, '{}'::text[]);
  -- 0. Para todos: lo de arte y el equipo pasa por producción. Lo eleva sólo
  --    el jefe (desde producción), y Administración lo cierra recién elevado.
  --    Si el proyecto no tiene jefe de producción, el PE hace de jefe.
  for c in select * from jsonb_array_elements(nc) loop
    if c->>'responsable' = any(p_arte) then
      select x into v from jsonb_array_elements(vc) x where x->>'id' = c->>'id' limit 1;
      e_n := rend_estado(c);
      e_v := case when v is null then 'borrador' else rend_estado(v) end;
      if e_n <> e_v and e_n = 'aprobada'
         and (not (p_rol = 'produccion' or (p_rol = 'ejecutivo' and coalesce(p_sin_jefe, false))) or e_v not in ('aProduccion', 'enviada')) then
        return 'Lo de arte lo eleva el jefe de producción, después de pasar por producción.';
      end if;
      -- "en producción" la chequea primero el asistente de producción: nadie más
      -- la mueve (salvo quien la mandó, que la puede retirar) hasta que él se la
      -- pase al jefe. Sin asistente en el proyecto, el jefe la toma directo.
      if e_n <> e_v and e_v = 'aProduccion' and p_rol <> 'asistprod'
         and c->>'responsable' is distinct from p_yo and not coalesce(p_sin_asist, false) then
        return 'Lo de arte lo chequea primero el asistente de producción: el jefe lo revisa cuando se lo pasa.';
      end if;
      if e_n <> e_v and e_n = 'cerrada' and e_v <> 'aprobada' then
        return 'Lo de arte se cierra cuando el jefe de producción ya lo elevó.';
      end if;
    end if;
  end loop;
  for c in select * from jsonb_array_elements(np) loop
    if c->>'cargadoPor' = any(p_arte) and coalesce(c->>'estado', 'cargado') not in ('cargado', 'rechazado') then
      select x into v from jsonb_array_elements(vp) x where x->>'id' = c->>'id' limit 1;
      if coalesce(v->>'estado', 'cargado') = 'cargado' then
        if c->>'cajaId' is not null then
          if not exists (select 1 from jsonb_array_elements(nc) x
                          where x->>'id' = c->>'cajaId' and rend_estado(x) in ('aprobada', 'cerrada')) then
            return 'Los gastos de arte van con su rendición: primero la revisa producción.';
          end if;
        elsif not (p_rol = 'produccion' or (p_rol = 'ejecutivo' and coalesce(p_sin_jefe, false))) then
          return 'Los gastos de arte los revisa primero producción (el asistente y el jefe).';
        elsif v->>'vistoProd' is null and not coalesce(p_sin_asist, false) then
          return 'Los gastos de arte los chequea primero el asistente de producción: el jefe los revisa cuando se los pasa.';
        end if;
      end if;
    end if;
  end loop;
  -- devolver (rechazar) un gasto suelto de arte que todavía no pasó por el
  -- asistente de producción: sólo él (o el jefe, si no hay asistente)
  for c in select * from jsonb_array_elements(np) loop
    if c->>'cargadoPor' = any(p_arte) and c->>'cajaId' is null and c->>'estado' = 'rechazado'
       and c->>'cargadoPor' is distinct from p_yo and p_rol <> 'asistprod' and not coalesce(p_sin_asist, false) then
      select x into v from jsonb_array_elements(vp) x where x->>'id' = c->>'id' limit 1;
      if coalesce(v->>'estado', 'cargado') = 'cargado' and v->>'vistoProd' is null then
        return 'Los gastos de arte los chequea primero el asistente de producción: el jefe los revisa cuando se los pasa.';
      end if;
    end if;
  end loop;

  if p_rol in ('admin', 'ejecutivo') then return null; end if;
  if p_rol = 'produccion' then
    for c in select * from jsonb_array_elements(nc) loop
      select x into v from jsonb_array_elements(vc) x where x->>'id' = c->>'id' limit 1;
      if rend_estado(c) = 'cerrada' and (v is null or rend_estado(v) <> 'cerrada') then
        return 'La rendición la cierra Administración.';
      end if;
    end loop;
    return null;
  end if;

  -- asistentes y equipo
  -- 1. las rendiciones (cajas)
  v_dest := case when p_yo = any(p_arte) then 'aProduccion' else 'enviada' end;
  for v in select * from jsonb_array_elements(vc) loop
    select x into c from jsonb_array_elements(nc) x where x->>'id' = v->>'id' limit 1;
    if c is null then return 'Un fondo para rendir lo da de baja quien lo dio.'; end if;
    e_v := rend_estado(v); e_n := rend_estado(c);
    if v->>'responsable' is distinct from p_yo then
      if p_rol = 'asistprod' and v->>'responsable' = any(p_arte) then
        -- el asistente de producción revisa lo de arte: comenta, la devuelve o se la pasa al jefe
        if (c - 'rendicion') is distinct from (v - 'rendicion') then
          return 'De la rendición de arte sólo podés comentar, devolverla o pasársela al jefe.';
        end if;
        if e_n <> e_v and not ((e_v = 'aProduccion' and e_n in ('observada', 'enviada'))
                               or (e_v in ('observada', 'enviada') and e_n = 'aProduccion')) then
          return 'Eso lo hace el jefe de producción.';
        end if;
      elsif c is distinct from v then
        return 'No podés cambiar la rendición de otra persona.';
      end if;
    else
      if (c - 'rendicion') is distinct from (v - 'rendicion') then
        return 'Lo entregado (el fondo y los adelantos) lo anota quien da la plata.';
      end if;
      if e_n <> e_v and not ((e_v in ('borrador', 'observada') and e_n = v_dest)
                             or (e_v = v_dest and e_n in ('borrador', 'observada'))) then
        return 'No podés pasar tu rendición a "' || e_n || '": eso lo hace quien la revisa.';
      end if;
    end if;
  end loop;
  for c in select * from jsonb_array_elements(nc) loop
    if not exists (select 1 from jsonb_array_elements(vc) x where x->>'id' = c->>'id') then
      return 'El fondo para rendir lo da el jefe de producción o Administración.';
    end if;
  end loop;
  trabadas := array(select x->>'id' from jsonb_array_elements(vc) x
                     where rend_estado(x) in ('aProduccion', 'enviada', 'aprobada', 'cerrada'));
  mias := array(select x->>'id' from jsonb_array_elements(nc) x where x->>'responsable' = p_yo);

  -- 2. los comprobantes
  for v in select * from jsonb_array_elements(vp) loop
    select x into c from jsonb_array_elements(np) x where x->>'id' = v->>'id' limit 1;
    if v->>'cargadoPor' is distinct from p_yo then
      if p_rol = 'asistprod' and v->>'cargadoPor' = any(p_arte) and v->>'cajaId' is null then
        -- un gasto suelto de arte: el asistente de producción se lo pasa al jefe o lo devuelve
        if c is null then return 'No podés borrar comprobantes que cargó otra persona.'; end if;
        if (c - 'vistoProd' - 'historial' - 'estado') is distinct from (v - 'vistoProd' - 'historial' - 'estado') then
          return 'De los gastos de arte sólo podés pasárselos al jefe o devolverlos.';
        end if;
        if c->>'estado' is distinct from v->>'estado' and not (v->>'estado' = 'cargado' and c->>'estado' = 'rechazado') then
          return 'Eso lo hace el jefe de producción.';
        end if;
      elsif c is null or (c - 'cargadoPor' - 'historial') is distinct from (v - 'cargadoPor' - 'historial') then
        return 'No podés cambiar comprobantes que cargó otra persona.';
      end if;
    else
      if v->>'cajaId' = any(trabadas)
         and (c is null or (c - 'cargadoPor' - 'historial') is distinct from (v - 'cargadoPor' - 'historial')) then
        return 'Esa rendición ya se mandó: sus gastos no se cambian (pedí que te la devuelvan).';
      end if;
      if c is not null and c->>'estado' is distinct from v->>'estado' then
        return 'El estado de un comprobante lo cambia quien lo revisa.';
      end if;
      if c is not null and c->>'cargadoPor' is distinct from v->>'cargadoPor' then
        return 'Un comprobante queda a nombre de quien lo cargó.';
      end if;
      if c is not null and c->>'cajaId' is not null and c->>'cajaId' is distinct from v->>'cajaId'
         and (c->>'cajaId' = any(trabadas) or not (c->>'cajaId' = any(mias))) then
        return 'Sólo podés cargar gastos en tu propia rendición, mientras la estás armando.';
      end if;
    end if;
  end loop;
  for c in select * from jsonb_array_elements(np) loop
    if not exists (select 1 from jsonb_array_elements(vp) x where x->>'id' = c->>'id') then
      if c->>'cargadoPor' is distinct from p_yo then return 'Un comprobante nuevo va a tu nombre.'; end if;
      if coalesce(c->>'estado', 'cargado') <> 'cargado' then
        return 'Un comprobante nuevo entra como cargado: lo revisa producción.';
      end if;
      if c->>'cajaId' is not null and (c->>'cajaId' = any(trabadas) or not (c->>'cajaId' = any(mias))) then
        return 'Sólo podés cargar gastos en tu propia rendición, mientras la estás armando.';
      end if;
    end if;
  end loop;

  -- 3. los cheques de garantía
  for v in select * from jsonb_array_elements(vq) loop
    select x into c from jsonb_array_elements(nq) x where x->>'id' = v->>'id' limit 1;
    if v->>'pedidoPor' is distinct from p_yo then
      if c is distinct from v then return 'No podés cambiar el cheque que pidió otra persona.'; end if;
    elsif c is not null and c->>'estado' is distinct from v->>'estado' then
      return 'El cheque lo aprueba el Productor Ejecutivo y lo entrega Administración.';
    end if;
  end loop;
  for c in select * from jsonb_array_elements(nq) loop
    if not exists (select 1 from jsonb_array_elements(vq) x where x->>'id' = c->>'id')
       and (c->>'pedidoPor' is distinct from p_yo or coalesce(c->>'estado', 'pedido') <> 'pedido') then
      return 'Un cheque nuevo va a tu nombre y entra como pedido.';
    end if;
  end loop;
  return null;
end $$;

-- Los gastos que le tocan a quien pregunta: enteros para Administración, el
-- PE y el jefe; filtrados (lo suyo) para los asistentes y el equipo. Con
-- p_con_datos = false trae sólo la versión, para ver si cambió algo.
create or replace function leer_gastos(p_proyecto uuid, p_con_datos boolean default true)
returns json
language plpgsql stable security definer set search_path = public as $$
declare v_rol text; v_prod uuid; v_yo text; r proyecto_parte%rowtype;
begin
  if auth.uid() is null then return null; end if;
  v_rol := mi_rol_en_proyecto(p_proyecto)::text;
  if v_rol is null then return null; end if;
  select productora_id into v_prod from proyecto where id = p_proyecto;
  select id::text into v_yo from usuario where auth_uid = auth.uid() and productora_id = v_prod limit 1;
  select * into r from proyecto_parte where proyecto_id = p_proyecto and parte = 'gastos';
  if not found then return json_build_object('version', null); end if;
  return json_build_object('version', r.version, 'cambiado_nombre', r.cambiado_nombre, 'cambiado_el', r.cambiado_el,
    'datos', case when p_con_datos then gastos_visibles(r.datos, v_yo, v_rol, gastos_arte(v_prod)) else null end);
end $$;
revoke all on function leer_gastos(uuid, boolean) from public, anon;
grant execute on function leer_gastos(uuid, boolean) to authenticated;

-- Guardar una parte. Se manda la versión sobre la que se trabajó: si
-- mientras tanto alguien guardó otra, no se pisa; vuelve lo que hay en la
-- base para juntar los cambios y probar de nuevo. Un asistente manda sólo
-- lo suyo de los gastos y la base lo junta con lo de los demás.
create or replace function guardar_parte(p_proyecto uuid, p_parte text, p_datos jsonb, p_base int)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_prod uuid; v_yo uuid; v_nom text; v_rol text; v_hay boolean; v_err text;
  v_arte text[]; v_filtra boolean; v_sin_jefe boolean := false; v_sin_asist boolean := false;
  r proyecto_parte%rowtype;
begin
  if auth.uid() is null then raise exception 'Hay que iniciar sesión.'; end if;
  if p_parte not in ('presupuesto','presupuesto_real','gente','plan','rodaje','luces','alta',
                     'gastos','compras','liquidacion','tareas','contactos','extra') then
    raise exception 'Esa parte del proyecto no existe: %', p_parte;
  end if;
  if not puedo_parte(p_proyecto, p_parte, true) then
    raise exception 'Con tu rol no podés cambiar % en este proyecto.', p_parte;
  end if;
  select productora_id into v_prod from proyecto where id = p_proyecto;
  select id, nombre into v_yo, v_nom from usuario
   where auth_uid = auth.uid() and productora_id = v_prod limit 1;
  v_rol := mi_rol_en_proyecto(p_proyecto)::text;
  v_filtra := p_parte = 'gastos' and v_rol not in ('admin', 'ejecutivo', 'produccion');
  if p_parte = 'gastos' then
    v_arte := gastos_arte(v_prod); v_sin_jefe := proyecto_sin_jefe(p_proyecto); v_sin_asist := proyecto_sin_asist(p_proyecto);
  end if;
  select * into r from proyecto_parte where proyecto_id = p_proyecto and parte = p_parte for update;
  v_hay := found;
  if v_hay and p_base is distinct from r.version then
    return json_build_object('ok', false, 'version', r.version,
                             'datos', case when v_filtra then gastos_visibles(r.datos, v_yo::text, v_rol, v_arte) else r.datos end,
                             'quien', r.cambiado_nombre, 'cuando', r.cambiado_el);
  end if;
  if not v_hay and p_base is not null then
    -- la trabajé sobre una versión que ya no está: que vuelva a traer
    return json_build_object('ok', false, 'version', null, 'datos', null);
  end if;
  if p_parte = 'gastos' then
    if v_filtra then
      v_err := gastos_permitidos(case when v_hay then gastos_visibles(r.datos, v_yo::text, v_rol, v_arte) else null end,
                                 p_datos, v_yo::text, v_rol, v_arte, v_sin_jefe, v_sin_asist);
      if v_err is not null then raise exception '%', v_err; end if;
      -- lo suyo, metido en lo de todos (las órdenes de compra y lo ajeno quedan como estaban)
      p_datos := gastos_juntar(case when v_hay then r.datos else '{}'::jsonb end, p_datos, v_yo::text, v_rol, v_arte);
    else
      v_err := gastos_permitidos(case when v_hay then r.datos else null end, p_datos, v_yo::text, v_rol, v_arte, v_sin_jefe, v_sin_asist);
      if v_err is not null then raise exception '%', v_err; end if;
    end if;
  end if;
  if v_hay then
    update proyecto_parte
       set datos = p_datos, version = r.version + 1, cambiado_el = now(),
           cambiado_por = v_yo, cambiado_nombre = v_nom
     where proyecto_id = p_proyecto and parte = p_parte;
    return json_build_object('ok', true, 'version', r.version + 1);
  end if;
  insert into proyecto_parte (proyecto_id, parte, datos, version, cambiado_por, cambiado_nombre)
  values (p_proyecto, p_parte, p_datos, 1, v_yo, v_nom);
  return json_build_object('ok', true, 'version', 1);
end $$;
revoke all on function guardar_parte(uuid, text, jsonb, int) from public, anon;
grant execute on function guardar_parte(uuid, text, jsonb, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 1b. EL FEE ES MARGEN: sólo Administración y el Productor Ejecutivo
--
-- El fee de cada presupuesto ya viaja aparte (en presupuesto_real). Queda el
-- fee por defecto de cada productora, que estaba en la tabla productora, que
-- leen todos los de la productora. Se pasa a una tabla propia y en productora
-- queda en 0.
-- ---------------------------------------------------------------------------
create table if not exists productora_privado (
  productora_id uuid primary key references productora(id) on delete cascade,
  fee_default   numeric(6,3) not null default 15,
  cambiado_el   timestamptz not null default now()
);
alter table productora_privado enable row level security;
grant select, insert, update on productora_privado to authenticated;
drop policy if exists privado_margen on productora_privado;
create policy privado_margen on productora_privado for all
  using (mi_rol(productora_id)::text in ('admin','ejecutivo'))
  with check (mi_rol(productora_id)::text in ('admin','ejecutivo'));

insert into productora_privado (productora_id, fee_default)
  select id, fee_default from productora where fee_default <> 0
  on conflict (productora_id) do nothing;
update productora set fee_default = 0 where fee_default <> 0;
alter table productora alter column fee_default set default 0;

-- las productoras nuevas nacen con su fee en la tabla privada
create or replace function fee_a_privado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into productora_privado (productora_id, fee_default)
  values (new.id, case when new.fee_default > 0 then new.fee_default else 15 end)
  on conflict (productora_id) do nothing;
  if new.fee_default <> 0 then update productora set fee_default = 0 where id = new.id; end if;
  return new;
end $$;
drop trigger if exists tr_fee_a_privado on productora;
create trigger tr_fee_a_privado after insert on productora
  for each row execute function fee_a_privado();

-- ---------------------------------------------------------------------------
-- 2. INVITAR: Administración y el PE invitan a cualquiera (también a
--    Administración); el jefe de producción invita a su equipo (no a
--    Administración ni al PE); los asistentes y el equipo no invitan.
-- ---------------------------------------------------------------------------
create or replace function crear_invitacion(p_proyecto uuid, p_rol rol_usuario default 'produccion')
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_prod uuid;
  v_mi   rol_usuario;
  v_yo   uuid;
  v_tok  text;
begin
  if v_uid is null then raise exception 'Hay que iniciar sesión para invitar.'; end if;
  select productora_id into v_prod from proyecto where id = p_proyecto;
  if v_prod is null then
    raise exception 'Ese proyecto todavía no está en la web. Tocá ☁ → Sincronizar todo y probá de nuevo.';
  end if;
  v_mi := mi_rol_en_proyecto(p_proyecto);
  if v_mi is null then raise exception 'No tenés acceso a ese proyecto.'; end if;
  if v_mi::text not in ('produccion','ejecutivo','admin') then
    raise exception 'Con tu rol no se puede invitar: pedíselo al jefe de producción o a Administración.';
  end if;
  if v_mi::text = 'produccion' and p_rol::text in ('ejecutivo','admin') then
    raise exception 'El jefe de producción invita a su equipo: a Administración y al Productor Ejecutivo los invitan Administración o el PE.';
  end if;
  select id into v_yo from usuario where auth_uid = v_uid and productora_id = v_prod limit 1;
  v_tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into invitacion (token, productora_id, proyecto_id, rol, creada_por, vence_el, usos_max)
  values (v_tok, v_prod, p_proyecto, p_rol, v_yo,
          now() + case when p_rol::text in ('admin','ejecutivo') then interval '7 days' else interval '30 days' end,
          case when p_rol::text in ('admin','ejecutivo') then 1 else null end);
  return v_tok;
end $$;
revoke all on function crear_invitacion(uuid, rol_usuario) from public, anon;
grant execute on function crear_invitacion(uuid, rol_usuario) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. CONFIRMAR LA CITACIÓN CON UN TOQUE
--
-- Cada citación que se manda lleva un link personal. El que lo abre no
-- necesita cuenta: ve su citación y toca "Confirmo" (o avisa que no puede).
-- El link es una clave larga al azar; sin ella no se ve ni se confirma nada.
-- La tabla no tiene políticas: sólo la tocan las cuatro funciones de abajo.
-- ---------------------------------------------------------------------------
create table if not exists citacion_link (
  token           text primary key,
  proyecto_id     uuid not null references proyecto(id) on delete cascade,
  jornada         int  not null,
  clave           text not null,
  nombre          text, rol text, hora text, fecha text, texto text,
  creado_el       timestamptz not null default now(),
  confirmado_el   timestamptz,
  confirma        boolean,
  confirmada_hora text,
  respuesta       text,
  unique (proyecto_id, jornada, clave)
);
alter table citacion_link enable row level security;
revoke all on citacion_link from anon, authenticated;

-- Producción arma (o actualiza) los links de una jornada. Si cambió la hora,
-- el link es el mismo y la confirmación vieja queda como de la hora vieja.
create or replace function preparar_citaciones(p_proyecto uuid, p_jornada int, p_items jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  it jsonb; v_tok text; out jsonb := '{}'::jsonb;
begin
  if not puedo_parte(p_proyecto, 'rodaje', true) then
    raise exception 'Con tu rol no podés mandar citaciones en este proyecto.';
  end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into citacion_link (token, proyecto_id, jornada, clave, nombre, rol, hora, fecha, texto)
    values (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
            p_proyecto, p_jornada, it->>'clave', left(it->>'nombre', 200), left(it->>'rol', 200),
            left(it->>'hora', 20), left(it->>'fecha', 20), left(it->>'texto', 4000))
    on conflict (proyecto_id, jornada, clave) do update
      set nombre = excluded.nombre, rol = excluded.rol, hora = excluded.hora,
          fecha = excluded.fecha, texto = excluded.texto
    returning token into v_tok;
    out := out || jsonb_build_object(it->>'clave', v_tok);
  end loop;
  return out;
end $$;

-- Quién confirmó, para la pantalla de citaciones.
create or replace function estado_citaciones(p_proyecto uuid, p_jornada int)
returns table(clave text, hora text, confirmado_el timestamptz, confirma boolean, confirmada_hora text, respuesta text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not puedo_parte(p_proyecto, 'rodaje', false) then return; end if;
  return query select c.clave, c.hora, c.confirmado_el, c.confirma, c.confirmada_hora, c.respuesta
    from citacion_link c where c.proyecto_id = p_proyecto and c.jornada = p_jornada;
end $$;

-- Lo que ve el que abre el link (sin cuenta).
create or replace function ver_citacion(p_token text)
returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('nombre', c.nombre, 'rol', c.rol, 'hora', c.hora, 'fecha', c.fecha,
           'jornada', c.jornada, 'texto', c.texto, 'proyecto', p.nombre, 'productora', pr.nombre,
           'confirmado_el', c.confirmado_el, 'confirma', c.confirma, 'confirmada_hora', c.confirmada_hora,
           'respuesta', c.respuesta)
    from citacion_link c join proyecto p on p.id = c.proyecto_id join productora pr on pr.id = p.productora_id
   where c.token = p_token and length(p_token) >= 32
$$;

-- Confirmar (o avisar que no puede), sin cuenta.
create or replace function confirmar_citacion(p_token text, p_confirma boolean default true, p_respuesta text default null)
returns json
language plpgsql security definer set search_path = public as $$
declare r citacion_link%rowtype;
begin
  update citacion_link
     set confirmado_el = now(), confirma = coalesce(p_confirma, true), confirmada_hora = hora,
         respuesta = nullif(btrim(left(coalesce(p_respuesta, ''), 500)), '')
   where token = p_token and length(p_token) >= 32
  returning * into r;
  if not found then
    raise exception 'Ese link de citación ya no sirve. Pedile uno nuevo a producción.';
  end if;
  return json_build_object('ok', true, 'hora', r.hora, 'confirma', r.confirma);
end $$;

revoke all on function preparar_citaciones(uuid, int, jsonb) from public, anon;
grant execute on function preparar_citaciones(uuid, int, jsonb) to authenticated;
revoke all on function estado_citaciones(uuid, int) from public, anon;
grant execute on function estado_citaciones(uuid, int) to authenticated;
revoke all on function ver_citacion(text) from public;
grant execute on function ver_citacion(text) to anon, authenticated;
revoke all on function confirmar_citacion(text, boolean, text) from public;
grant execute on function confirmar_citacion(text, boolean, text) to anon, authenticated;

commit;

select 'Listo: los proyectos se guardan completos, hay roles de asistente, el fee es sólo de Administración y el PE, las citaciones se confirman con un toque, cada asistente cambia y recibe sólo sus gastos y su rendición, lo de arte pasa por producción y los proyectos tienen etapa (en cotización, aprobado, no salió). Volvé a CLAP y tocá ☁ → Sincronizar todo.' as "Resultado";
