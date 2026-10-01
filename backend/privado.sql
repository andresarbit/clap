-- ===========================================================================
-- CLAP · PRIVADO · SE ENTRA SÓLO CON INVITACIÓN
--
-- COPIÁ TODO ESTE ARCHIVO, PEGALO EN:
--     Supabase  ->  SQL Editor  ->  New query
-- y apretá RUN. Al final imprime quién entra y a qué. Se puede correr las
-- veces que quieras; no borra a nadie.
--
-- Reemplaza al modo prueba. Desde acá:
--   · Cualquiera puede crearse una cuenta, pero una cuenta sola no ve NADA.
--   · A una productora se entra con un link de invitación que genera alguien
--     de adentro (botón ✉ Invitar). El link trae una clave larga que la base
--     guarda: no se puede inventar ni cambiarle el rol. Quien lo abre entra
--     directo, con el rol que eligió el que invitó. Nadie aprueba a mano.
--   · O se crea su propia productora, que nace vacía y separada de todo.
--   · Nadie puede anotarse solo en una productora ajena.
--
-- Corré esto DESPUÉS de todo lo anterior (esquema, alta-propia,
-- sincronizacion, arranque, permisos, mis-datos, destrabar, modo-prueba).
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. UNA PERSONA PUEDE ESTAR EN VARIAS PRODUCTORAS
--
-- Un técnico trabaja para varias. El esquema original permitía una sola
-- ficha por cuenta, así que aceptar la invitación de una segunda productora
-- fallaba. Pasa a ser una ficha por cuenta Y productora.
-- ---------------------------------------------------------------------------

alter table usuario drop constraint if exists usuario_auth_uid_key;
do $$ begin
  create unique index if not exists usuario_uid_productora on usuario (auth_uid, productora_id);
exception when unique_violation then
  raise notice 'Hay fichas repetidas de la misma persona en la misma productora; no se agregó el índice.';
end $$;


-- ---------------------------------------------------------------------------
-- 2. LAS INVITACIONES
--
-- Sin políticas a propósito: nadie lee esta tabla directo. Sólo la tocan las
-- dos funciones de abajo, que controlan quién invita y a qué.
-- ---------------------------------------------------------------------------

create table if not exists invitacion (
  token         text primary key,
  productora_id uuid not null references productora(id) on delete cascade,
  proyecto_id   uuid references proyecto(id) on delete cascade,
  rol           rol_usuario not null default 'produccion',
  creada_por    uuid references usuario(id) on delete set null,
  creada_el     timestamptz not null default now(),
  vence_el      timestamptz not null,
  usos          int not null default 0,
  usos_max      int                      -- null = sin tope hasta que venza
);
alter table invitacion enable row level security;

-- Invitar. Admin invita con cualquier rol; Ejecutivo hasta Ejecutivo;
-- Producción a Producción o Equipo; Equipo no invita.
-- Los links que abren todo (Administración, Ejecutivo) sirven para UNA
-- persona y duran 7 días. Los de Producción y Equipo se pueden mandar a un
-- grupo y duran 30.
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
  if v_mi = 'equipo' then
    raise exception 'Con rol Equipo no se puede invitar: pedíselo a Producción o a Administración.';
  end if;
  if p_rol > v_mi then
    raise exception 'No podés invitar con un rol más alto que el tuyo.';
  end if;
  select id into v_yo from usuario where auth_uid = v_uid and productora_id = v_prod limit 1;
  v_tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into invitacion (token, productora_id, proyecto_id, rol, creada_por, vence_el, usos_max)
  values (v_tok, v_prod, p_proyecto, p_rol, v_yo,
          now() + case when p_rol in ('admin','ejecutivo') then interval '7 days' else interval '30 days' end,
          case when p_rol in ('admin','ejecutivo') then 1 else null end);
  return v_tok;
end $$;

-- Aceptar. Lo único que hace falta es la clave del link y tener sesión.
-- Da de alta (o reactiva) mi ficha en esa productora con el rol del link,
-- sin bajarme si ya tenía uno más alto, y me anota en el proyecto.
create or replace function aceptar_invitacion(p_token text, p_nombre text default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_mail text;
  inv    invitacion%rowtype;
  u      usuario%rowtype;
  v_nom  text;
begin
  if v_uid is null then raise exception 'Hay que iniciar sesión para aceptar la invitación.'; end if;
  select * into inv from invitacion where token = p_token for update;
  if not found then
    raise exception 'Ese link de invitación no existe o lo dieron de baja. Pedile uno nuevo a quien te invitó.';
  end if;
  if inv.vence_el < now() then
    raise exception 'Ese link de invitación ya venció. Pedile uno nuevo a quien te invitó.';
  end if;

  select email into v_mail from auth.users where id = v_uid;
  select * into u from usuario where auth_uid = v_uid and productora_id = inv.productora_id limit 1;

  if not found then
    if inv.usos_max is not null and inv.usos >= inv.usos_max then
      raise exception 'Ese link ya lo usó otra persona. Pedile uno nuevo a quien te invitó.';
    end if;
    v_nom := coalesce(nullif(btrim(p_nombre), ''),
                      (select nombre from usuario where auth_uid = v_uid order by alta_el limit 1),
                      initcap(replace(replace(split_part(v_mail, '@', 1), '.', ' '), '_', ' ')),
                      'Sin nombre');
    insert into usuario (auth_uid, productora_id, nombre, rol, email, tel, area, activo, pendiente)
    values (v_uid, inv.productora_id, v_nom, inv.rol, v_mail,
            (select tel  from usuario where auth_uid = v_uid order by alta_el limit 1),
            (select area from usuario where auth_uid = v_uid order by alta_el limit 1),
            true, false)
    returning * into u;
    update invitacion set usos = usos + 1 where token = inv.token;
  else
    -- ya estaba: el link lo reactiva y, si trae un rol más alto, lo sube
    update usuario
       set activo = true, pendiente = false, rol = greatest(rol, inv.rol)
     where id = u.id
    returning * into u;
  end if;

  if inv.proyecto_id is not null then
    insert into proyecto_persona (proyecto_id, usuario_id, invitado_por)
    values (inv.proyecto_id, u.id, inv.creada_por)
    on conflict (proyecto_id, usuario_id) do nothing;
  end if;

  return json_build_object('productora_id', inv.productora_id,
                           'proyecto_id',   inv.proyecto_id,
                           'rol',           u.rol);
end $$;

revoke all on function crear_invitacion(uuid, rol_usuario) from public, anon;
grant execute on function crear_invitacion(uuid, rol_usuario) to authenticated;
revoke all on function aceptar_invitacion(text, text) from public, anon;
grant execute on function aceptar_invitacion(text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 3. NADIE SE ANOTA SOLO EN UNA PRODUCTORA AJENA
--
-- Antes cualquiera con cuenta podía meterse en cualquier productora (en modo
-- prueba, hasta como Administración) y cambiarse el rol. Ahora una ficha
-- nace sólo de tres maneras: aceptando una invitación, creando su propia
-- productora, o porque un administrador de adentro la carga.
-- ---------------------------------------------------------------------------

drop policy if exists usuario_autoalta   on usuario;
drop policy if exists usuario_editar_mia on usuario;
-- (los datos propios se corrigen con guardar_mis_datos, que no toca el rol)

-- La lista para "elegir productora" ya no es la de todo el sistema: son las
-- mías. Nadie ve los nombres de las productoras ajenas.
create or replace function productoras_para_elegir()
returns table(id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre from productora p
   where p.id in (select productora_id from usuario where auth_uid = auth.uid())
   order by p.nombre
$$;
revoke all on function productoras_para_elegir() from public, anon;
grant execute on function productoras_para_elegir() to authenticated;
revoke all on function productora_pide_aprobacion(uuid) from public, anon;
grant execute on function productora_pide_aprobacion(uuid) to authenticated;

-- Crear mi productora: nace en MI organización o en una nueva. Antes reusaba
-- la organización de cualquier productora donde figurara, aunque fuera
-- esperando aprobación, y por ahí se llegaba al catálogo ajeno.
create or replace function crear_mi_productora(
  p_nombre text,
  p_mi_nombre text default null,
  p_rol rol_usuario default 'admin',
  p_area text default null,
  p_tel text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_org  uuid;
  v_prod uuid;
begin
  if v_uid is null then
    raise exception 'Hay que iniciar sesión antes de crear una productora';
  end if;
  if coalesce(btrim(p_nombre), '') = '' then
    raise exception 'La productora necesita un nombre';
  end if;

  -- reuso una organización sólo si ya la administro
  select p.org_id into v_org
    from productora p
    join usuario u on u.productora_id = p.id
   where u.auth_uid = v_uid and u.activo and not u.pendiente and u.rol = 'admin'
   order by u.alta_el
   limit 1;

  if v_org is null then
    insert into organizacion (nombre)
    values (coalesce(nullif(btrim(p_mi_nombre), ''), 'Mi estudio'))
    returning id into v_org;
  end if;

  insert into productora (org_id, nombre)
  values (v_org, btrim(p_nombre))
  returning id into v_prod;

  -- quien crea la productora es su administrador, elija lo que elija
  update usuario
     set nombre = coalesce(nullif(btrim(p_mi_nombre), ''), nombre),
         rol    = 'admin', activo = true, pendiente = false,
         area   = p_area,
         tel    = p_tel
   where productora_id = v_prod and auth_uid = v_uid;

  if not found then
    insert into usuario (auth_uid, productora_id, nombre, rol, area, tel, email, activo, pendiente)
    values (v_uid, v_prod,
            coalesce(nullif(btrim(p_mi_nombre), ''),
                     (select email from auth.users where id = v_uid), 'Yo'),
            'admin', p_area, p_tel,
            (select email from auth.users where id = v_uid), true, false);
  end if;

  return v_prod;
end $$;
revoke all on function crear_mi_productora(text, text, rol_usuario, text, text) from public, anon;
grant execute on function crear_mi_productora(text, text, rol_usuario, text, text) to authenticated;

-- Mis datos: los corrijo yo, en todas las productoras donde estoy. El rol NO
-- se toca desde acá (p_rol queda por compatibilidad y se ignora): el rol lo
-- da la invitación o un administrador.
-- Mi ficha del catálogo se busca por mi mail SÓLO si Supabase lo confirmó:
-- si no, cualquiera podría registrarse con el mail de otro y quedarse con su
-- ficha (CBU, alias).
create or replace function guardar_mis_datos(
  p_nombre    text default null,
  p_tel       text default null,
  p_area      text default null,
  p_rol       rol_usuario default null,
  p_funcion   text default null,
  p_rubro     text default null,
  p_dni       text default null,
  p_cuit      text default null,
  p_condicion text default null,
  p_banco     text default null,
  p_alias     text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_mail text;
  v_ok   boolean;
  u      usuario%rowtype;
  v_org  uuid;
  v_cat  uuid;
  v_prim uuid;
begin
  if v_uid is null then raise exception 'Hay que iniciar sesion'; end if;
  select email, email_confirmed_at is not null into v_mail, v_ok from auth.users where id = v_uid;
  if not exists (select 1 from usuario where auth_uid = v_uid) then
    raise exception 'Todavía no estás en ninguna productora';
  end if;

  for u in select * from usuario where auth_uid = v_uid order by alta_el loop
    update usuario
       set nombre = coalesce(nullif(btrim(p_nombre), ''), nombre),
           tel    = coalesce(p_tel, tel),
           area   = coalesce(p_area, area),
           email  = coalesce(v_mail, email)
     where id = u.id;

    select org_id into v_org from productora where id = u.productora_id;

    -- la ficha enlazada vale sólo si es de la organización de esta productora
    v_cat := (select c.id from catalogo_persona c where c.id = u.catalogo_id and c.org_id = v_org);
    if v_cat is null and v_ok and v_mail is not null then
      select id into v_cat from catalogo_persona
       where org_id = v_org and lower(email) = lower(v_mail) limit 1;
    end if;
    if v_cat is null then
      insert into catalogo_persona (org_id, tipo, nombre, email)
      values (v_org, 'persona', coalesce(nullif(btrim(p_nombre),''), u.nombre), v_mail)
      returning id into v_cat;
    end if;

    update catalogo_persona
       set nombre    = coalesce(nullif(btrim(p_nombre), ''), nombre),
           funcion   = coalesce(nullif(btrim(p_funcion), ''), funcion),
           rubro     = coalesce(nullif(btrim(p_rubro), ''), rubro),
           dni       = coalesce(nullif(btrim(p_dni), ''), dni),
           cuit      = coalesce(nullif(btrim(p_cuit), ''), cuit),
           condicion = coalesce(nullif(btrim(p_condicion), ''), condicion),
           tel       = coalesce(nullif(btrim(p_tel), ''), tel),
           email     = coalesce(email, v_mail),
           banco     = coalesce(nullif(btrim(p_banco), ''), banco),
           alias     = coalesce(nullif(btrim(p_alias), ''), alias)
     where id = v_cat;

    update usuario set catalogo_id = v_cat where id = u.id;
    v_prim := coalesce(v_prim, v_cat);
  end loop;
  return v_prim;
end $$;
revoke all on function guardar_mis_datos(text,text,text,rol_usuario,text,text,text,text,text,text,text) from public, anon;
grant execute on function guardar_mis_datos(text,text,text,rol_usuario,text,text,text,text,text,text,text) to authenticated;


-- ---------------------------------------------------------------------------
-- 4. LA CASA LA MANEJA QUIEN LA LLEVA
--
-- Antes cualquiera con acceso —hasta alguien de Equipo invitado a un solo
-- proyecto— podía cambiar el CUIT de la productora o borrarla entera (y con
-- ella todo lo que tiene adentro). Ahora: ver, todos los de adentro; cambiar,
-- Administración y Ejecutivo; borrar, sólo Administración.
-- ---------------------------------------------------------------------------

create or replace function org_que_administro() returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct p.org_id from productora p
    join usuario u on u.productora_id = p.id
   where u.auth_uid = auth.uid() and u.activo and not u.pendiente and u.rol = 'admin'
$$;

drop policy if exists org_mia          on organizacion;
drop policy if exists org_ver          on organizacion;
drop policy if exists org_cambiar      on organizacion;
drop policy if exists org_borrar       on organizacion;
create policy org_ver     on organizacion for select using (id in (select mis_orgs()));
create policy org_cambiar on organizacion for update
  using (id in (select org_que_administro())) with check (id in (select org_que_administro()));
create policy org_borrar  on organizacion for delete using (id in (select org_que_administro()));

drop policy if exists productora_mia     on productora;
drop policy if exists productora_crear   on productora;
drop policy if exists productora_ver     on productora;
drop policy if exists productora_cambiar on productora;
drop policy if exists productora_borrar  on productora;
create policy productora_ver     on productora for select using (id in (select mis_productoras()));
-- una productora nueva va en una organización que ya administro (la primera
-- la crea crear_mi_productora, que no pasa por acá)
create policy productora_crear   on productora for insert to authenticated
  with check (org_id in (select org_que_administro()));
create policy productora_cambiar on productora for update
  using (mi_rol(id) in ('admin','ejecutivo')) with check (mi_rol(id) in ('admin','ejecutivo'));
create policy productora_borrar  on productora for delete using (mi_rol(id) = 'admin');

-- Un proyecto lo ve y lo edita quien está en él; borrarlo, quien lleva la casa.
drop policy if exists proyecto_mio    on proyecto;
drop policy if exists proyecto_ver    on proyecto;
drop policy if exists proyecto_crear  on proyecto;
drop policy if exists proyecto_editar on proyecto;
drop policy if exists proyecto_borrar on proyecto;
create policy proyecto_ver    on proyecto for select using (puedo_proyecto(id));
create policy proyecto_crear  on proyecto for insert
  with check (productora_id in (select mis_productoras()));
create policy proyecto_editar on proyecto for update
  using (puedo_proyecto(id)) with check (productora_id in (select mis_productoras()));
create policy proyecto_borrar on proyecto for delete
  using (mi_rol_en_proyecto(id) in ('admin','ejecutivo'));


-- ---------------------------------------------------------------------------
-- 5. EL CATÁLOGO (DNI, CUIT, CBU) NO ES PARA TODOS
--
-- Alguien de Equipo invitado a un proyecto veía el catálogo entero de la
-- organización, con los datos bancarios de todos. Ahora el catálogo es de
-- Administración, Ejecutivo y Producción. Equipo ve su propia ficha y nada más.
-- ---------------------------------------------------------------------------

create or replace function mis_orgs_catalogo() returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct p.org_id from productora p
    join usuario u on u.productora_id = p.id
   where u.auth_uid = auth.uid() and u.activo and not u.pendiente
     and u.rol in ('admin','ejecutivo','produccion')
     and p.id in (select productoras_con_acceso())
$$;

drop policy if exists catalogo_mio on catalogo_persona;
create policy catalogo_mio on catalogo_persona for all
  using (org_id in (select mis_orgs_catalogo()))
  with check (org_id in (select mis_orgs_catalogo()));


-- ---------------------------------------------------------------------------
-- 6. SE TERMINA EL MODO PRUEBA
-- ---------------------------------------------------------------------------

update productora set requiere_aprobacion = true;

commit;


-- ---------------------------------------------------------------------------
-- 7. QUIÉN ENTRA  <-- LO ÚNICO QUE TENÉS QUE MIRAR
--
-- El modo prueba dejó a TODOS como Administración. Si en esta lista hay
-- alguien que no tiene que ver todo, cambiale el rol o dalo de baja desde
-- CLAP: ☁ → Quién entra.
-- ---------------------------------------------------------------------------

select p.nombre  as "Productora",
       u.nombre  as "Persona",
       u.email   as "Mail",
       case u.rol when 'admin' then 'Administración'
                  when 'ejecutivo' then 'Productor Ejecutivo'
                  when 'produccion' then 'Producción'
                  else 'Equipo' end as "Rol",
       case when not u.activo then '🚫 dado de baja'
            when u.pendiente then '⏳ sin acceso (alta vieja sin aprobar)'
            when u.rol in ('admin','ejecutivo') then '✅ ve toda la productora'
            else '✅ ve ' || (select count(*) from proyecto_persona pp where pp.usuario_id = u.id)
                 || ' proyecto(s) donde lo invitaron' end as "Qué ve"
  from usuario u
  join productora p on p.id = u.productora_id
 order by p.nombre, u.alta_el;


-- ===========================================================================
-- EN SUPABASE, UNA SOLA COSA PARA REVISAR (no es SQL)
--
--   Authentication -> Sign In / Providers -> Email
--     · "Allow new users to sign up": PRENDIDO (así el invitado se crea la
--       cuenta solo; una cuenta sin invitación no ve nada).
--     · "Confirm email": PRENDIDO (así nadie se registra con el mail de otro).
-- ===========================================================================
