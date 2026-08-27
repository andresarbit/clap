-- ===========================================================================
-- CLAP · DESTRABAR
--
-- COPIÁ TODO ESTE ARCHIVO, PEGALO EN:
--     Supabase  ->  SQL Editor  ->  New query
-- y apretá RUN. No hay nada que leer ni que completar: al final imprime una
-- lista con los nombres y en qué estado quedó cada uno.
--
-- Se puede correr las veces que haga falta; correrlo dos veces no rompe nada.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. ARREGLA LA TRAMPA
--
-- Hasta ahora, si te ponías Administración o Productor Ejecutivo, el sistema
-- te dejaba "esperando aprobación". Pero si sos la única persona de esa
-- productora, no hay NADIE que pueda aprobarte: quedás afuera de tu propia
-- productora para siempre, sin salida.
--
-- A partir de acá: sólo esperás aprobación si de verdad hay alguien adentro
-- que pueda dártela. Si no hay nadie, entrás.
-- ---------------------------------------------------------------------------

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
  v_uid uuid := auth.uid();
  u     usuario%rowtype;
  v_org uuid;
  v_cat uuid;
  v_hay_quien_apruebe boolean;
begin
  if v_uid is null then raise exception 'Hay que iniciar sesion'; end if;

  select * into u from usuario where auth_uid = v_uid limit 1;
  if not found then raise exception 'Todavía no completaste tu alta'; end if;

  -- ¿Hay otra persona, adentro de esta misma productora, que pueda aprobarme?
  select exists (
    select 1 from usuario o
     where o.productora_id = u.productora_id
       and o.id <> u.id
       and o.activo and not o.pendiente
       and o.rol in ('admin','ejecutivo')
  ) into v_hay_quien_apruebe;

  update usuario
     set nombre = coalesce(nullif(btrim(p_nombre), ''), nombre),
         tel    = coalesce(p_tel, tel),
         area   = coalesce(p_area, area),
         rol    = coalesce(p_rol, rol),
         pendiente = case
           when p_rol is null or p_rol = u.rol then pendiente
           -- subirse a un rol que ve todo espera aprobación SÓLO si hay
           -- alguien que pueda darla. Si no, no hay a quién esperar.
           when p_rol in ('admin','ejecutivo')
            and u.rol not in ('admin','ejecutivo')
            and v_hay_quien_apruebe
             then true
           else pendiente end
   where id = u.id;

  select org_id into v_org from productora where id = u.productora_id;

  v_cat := u.catalogo_id;
  if v_cat is null then
    select id into v_cat from catalogo_persona
     where org_id = v_org and email is not null and email = u.email limit 1;
  end if;
  if v_cat is null then
    insert into catalogo_persona (org_id, tipo, nombre, email)
    values (v_org, 'persona', coalesce(nullif(btrim(p_nombre),''), u.nombre), u.email)
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
         email     = coalesce(email, u.email),
         banco     = coalesce(nullif(btrim(p_banco), ''), banco),
         alias     = coalesce(nullif(btrim(p_alias), ''), alias)
   where id = v_cat;

  update usuario set catalogo_id = v_cat where id = u.id;
  return v_cat;
end $$;

revoke all on function guardar_mis_datos(text,text,text,rol_usuario,text,text,text,text,text,text,text) from public;
grant execute on function guardar_mis_datos(text,text,text,rol_usuario,text,text,text,text,text,text,text) to authenticated;


-- ---------------------------------------------------------------------------
-- 2. DESTRABA A LOS QUE YA QUEDARON COLGADOS
--
-- Cualquiera que esté esperando una aprobación que nadie puede darle, entra.
-- ---------------------------------------------------------------------------

update usuario u
   set pendiente = false, activo = true
 where u.pendiente
   and not exists (
     select 1 from usuario o
      where o.productora_id = u.productora_id
        and o.id <> u.id
        and o.activo and not o.pendiente
        and o.rol in ('admin','ejecutivo'));


-- ---------------------------------------------------------------------------
-- 3. WILLY, ADMINISTRADOR
-- ---------------------------------------------------------------------------

update usuario
   set pendiente = false, activo = true, rol = 'admin'
 where lower(email) = 'santyno@gmail.com';


-- ---------------------------------------------------------------------------
-- 4. QUE NADIE MAS QUEDE SIN PODER ENTRAR
--
-- Toda productora tiene que tener al menos un administrador activo. Si alguna
-- se quedó sin ninguno, el que llegó primero pasa a serlo.
-- ---------------------------------------------------------------------------

update usuario u
   set rol = 'admin', pendiente = false, activo = true
 where u.id = (
   select u2.id from usuario u2
    where u2.productora_id = u.productora_id
    order by u2.alta_el limit 1)
   and not exists (
     select 1 from usuario o
      where o.productora_id = u.productora_id
        and o.activo and not o.pendiente
        and o.rol = 'admin');


-- ---------------------------------------------------------------------------
-- 5. COMO QUEDO TODO  <-- ESTO ES LO UNICO QUE TENES QUE MIRAR
-- ---------------------------------------------------------------------------

select p.nombre                              as "Productora",
       u.nombre                              as "Persona",
       u.email                               as "Mail",
       case u.rol
         when 'admin'      then 'Administración'
         when 'ejecutivo'  then 'Productor Ejecutivo'
         when 'produccion' then 'Producción'
         else                   'Equipo'
       end                                   as "Rol",
       case
         when u.pendiente then '⏳ ESPERANDO APROBACION'
         when not u.activo then '🚫 dado de baja'
         else                  '✅ entra y ve todo'
       end                                   as "Estado"
  from usuario u
  join productora p on p.id = u.productora_id
 order by p.nombre, u.alta_el;
