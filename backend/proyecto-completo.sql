-- ===========================================================================
-- CLAP · EL PROYECTO COMPLETO EN LA BASE, Y LOS ROLES NUEVOS
--
-- COPIÁ TODO ESTE ARCHIVO, PEGALO EN:
--     Supabase  ->  SQL Editor  ->  New query
-- y apretá RUN. Se puede correr varias veces. No borra nada.
--
-- QUÉ RESUELVE
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
grant select, insert, update on proyecto_parte to authenticated;

-- ¿Puedo leer (o escribir) esta parte de este proyecto? Compara el rol como
-- texto a propósito: así sirve en la misma corrida en que se agregan los
-- roles nuevos.
create or replace function puedo_parte(p_proyecto uuid, p_parte text, p_escribir boolean)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(case
    when r is null then false
    when r in ('admin','ejecutivo') then true
    when r = 'produccion' then p_parte <> 'presupuesto_real'
    when p_escribir then case r
        when 'asistdir'  then p_parte in ('plan','tareas')
        when 'asistprod' then p_parte in ('rodaje','luces','alta','gastos','tareas','contactos')
        else                  p_parte in ('gastos','tareas') end
    else p_parte in ('gente','plan','rodaje','luces','alta','gastos','tareas','contactos','extra') end, false)
  from (select mi_rol_en_proyecto(p_proyecto)::text as r) x
$$;
revoke all on function puedo_parte(uuid, text, boolean) from public, anon;
grant execute on function puedo_parte(uuid, text, boolean) to authenticated;

drop policy if exists parte_ver     on proyecto_parte;
drop policy if exists parte_crear   on proyecto_parte;
drop policy if exists parte_cambiar on proyecto_parte;
create policy parte_ver     on proyecto_parte for select using (puedo_parte(proyecto_id, parte, false));
create policy parte_crear   on proyecto_parte for insert with check (puedo_parte(proyecto_id, parte, true));
create policy parte_cambiar on proyecto_parte for update
  using (puedo_parte(proyecto_id, parte, true)) with check (puedo_parte(proyecto_id, parte, true));

-- Guardar una parte. Se manda la versión sobre la que se trabajó: si
-- mientras tanto alguien guardó otra, no se pisa; vuelve lo que hay en la
-- base para juntar los cambios y probar de nuevo.
create or replace function guardar_parte(p_proyecto uuid, p_parte text, p_datos jsonb, p_base int)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_prod uuid; v_yo uuid; v_nom text;
  r proyecto_parte%rowtype;
begin
  if auth.uid() is null then raise exception 'Hay que iniciar sesión.'; end if;
  if p_parte not in ('presupuesto','presupuesto_real','gente','plan','rodaje','luces','alta',
                     'gastos','liquidacion','tareas','contactos','extra') then
    raise exception 'Esa parte del proyecto no existe: %', p_parte;
  end if;
  if not puedo_parte(p_proyecto, p_parte, true) then
    raise exception 'Con tu rol no podés guardar "%" en este proyecto.', p_parte;
  end if;
  select productora_id into v_prod from proyecto where id = p_proyecto;
  select id, nombre into v_yo, v_nom from usuario
   where auth_uid = auth.uid() and productora_id = v_prod limit 1;
  select * into r from proyecto_parte where proyecto_id = p_proyecto and parte = p_parte for update;
  if found then
    if p_base is distinct from r.version then
      return json_build_object('ok', false, 'version', r.version, 'datos', r.datos,
                               'quien', r.cambiado_nombre, 'cuando', r.cambiado_el);
    end if;
    update proyecto_parte
       set datos = p_datos, version = r.version + 1, cambiado_el = now(),
           cambiado_por = v_yo, cambiado_nombre = v_nom
     where proyecto_id = p_proyecto and parte = p_parte;
    return json_build_object('ok', true, 'version', r.version + 1);
  end if;
  if p_base is not null then
    -- la trabajé sobre una versión que ya no está: que vuelva a traer
    return json_build_object('ok', false, 'version', null, 'datos', null);
  end if;
  insert into proyecto_parte (proyecto_id, parte, datos, version, cambiado_por, cambiado_nombre)
  values (p_proyecto, p_parte, p_datos, 1, v_yo, v_nom);
  return json_build_object('ok', true, 'version', 1);
end $$;
revoke all on function guardar_parte(uuid, text, jsonb, int) from public, anon;
grant execute on function guardar_parte(uuid, text, jsonb, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. INVITAR: los asistentes y el equipo no invitan
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
  if p_rol > v_mi then
    raise exception 'No podés invitar con un rol más alto que el tuyo.';
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

commit;

select 'Listo: los proyectos se guardan completos y hay roles de asistente. Volvé a CLAP y tocá ☁ → Sincronizar todo.' as "Resultado";
