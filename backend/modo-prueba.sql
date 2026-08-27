-- ===========================================================================
-- CLAP · MODO PRUEBA · TODOS ENTRAN CON PERMISOS PARA TODO
--
-- COPIÁ TODO ESTE ARCHIVO, PEGALO EN:
--     Supabase  ->  SQL Editor  ->  New query
-- y apretá RUN. Al final imprime la lista del equipo con el estado de cada uno.
-- Se puede correr las veces que quieras.
--
-- Mientras esto esté puesto: el que entra elige su rol, entra al toque y ve
-- todo. Nadie espera aprobación de nadie.
--
-- ⚠ Lo único que separa a un desconocido de tus datos es quién tiene el link
--   y quién puede crearse una cuenta. Al final del archivo está cómo cerrarlo
--   cuando terminen de probar. Son dos pasos.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. TODAS LAS PRODUCTORAS, CON EL CANDADO ABIERTO
-- ---------------------------------------------------------------------------

update productora set requiere_aprobacion = false;


-- ---------------------------------------------------------------------------
-- 2. EL QUE ENTRA, ENTRA. CON EL ROL QUE ELIJA.
--
-- Antes: declararse Administración o Productor Ejecutivo en una productora
-- ajena obligaba a quedar pendiente. Ahora entra derecho.
-- Lo único que se sigue controlando es que nadie se dé de alta POR OTRO:
-- la fila tiene que llevar tu propio usuario.
-- ---------------------------------------------------------------------------

drop policy if exists usuario_autoalta on usuario;
create policy usuario_autoalta on usuario for insert to authenticated
  with check (auth_uid = auth.uid());


-- ---------------------------------------------------------------------------
-- 3. Y QUE PUEDA CORREGIRSE SUS PROPIOS DATOS AUNQUE YA ESTE ADENTRO
-- ---------------------------------------------------------------------------

drop policy if exists usuario_editar_mia on usuario;
create policy usuario_editar_mia on usuario for update to authenticated
  using (auth_uid = auth.uid()) with check (auth_uid = auth.uid());


-- ---------------------------------------------------------------------------
-- 4. SUBIRSE DE ROL TAMPOCO ESPERA A NADIE
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
begin
  if v_uid is null then raise exception 'Hay que iniciar sesion'; end if;
  select * into u from usuario where auth_uid = v_uid limit 1;
  if not found then raise exception 'Todavía no completaste tu alta'; end if;

  update usuario
     set nombre    = coalesce(nullif(btrim(p_nombre), ''), nombre),
         tel       = coalesce(p_tel, tel),
         area      = coalesce(p_area, area),
         rol       = coalesce(p_rol, rol),
         pendiente = false,      -- MODO PRUEBA: nadie espera aprobación
         activo    = true
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
-- 5. LOS QUE YA ESTAN: TODOS ADENTRO, TODOS ADMINISTRADORES
-- ---------------------------------------------------------------------------

update usuario set pendiente = false, activo = true, rol = 'admin';


-- ---------------------------------------------------------------------------
-- 6. Y QUE TODOS SE VEAN ENTRE ELLOS EN EL CATALOGO
--
-- El que se dio de alta antes de que existiera la sincronización puede no
-- tener su ficha del catálogo. Se la creamos y se la enlazamos.
-- ---------------------------------------------------------------------------

insert into catalogo_persona (org_id, tipo, nombre, email, tel)
select p.org_id, 'persona', u.nombre, u.email, u.tel
  from usuario u
  join productora p on p.id = u.productora_id
 where u.catalogo_id is null
   and not exists (select 1 from catalogo_persona c
                    where c.org_id = p.org_id and c.email = u.email);

update usuario u
   set catalogo_id = c.id
  from catalogo_persona c
  join productora p on p.org_id = c.org_id
 where u.catalogo_id is null
   and p.id = u.productora_id
   and c.email = u.email;


-- ---------------------------------------------------------------------------
-- 7. COMO QUEDO TODO  <-- LO UNICO QUE TENES QUE MIRAR
-- ---------------------------------------------------------------------------

select p.nombre  as "Productora",
       u.nombre  as "Persona",
       u.email   as "Mail",
       case u.rol when 'admin' then 'Administración'
                  when 'ejecutivo' then 'Productor Ejecutivo'
                  when 'produccion' then 'Producción'
                  else 'Equipo' end as "Rol",
       case when u.pendiente then '⏳ esperando'
            when not u.activo then '🚫 dado de baja'
            else '✅ entra y ve todo' end as "Estado",
       case when u.catalogo_id is null then 'NO' else 'sí' end as "En el catálogo"
  from usuario u
  join productora p on p.id = u.productora_id
 order by p.nombre, u.alta_el;


-- ===========================================================================
-- CUANDO TERMINEN DE PROBAR, PARA CERRARLO
-- ---------------------------------------------------------------------------
-- Son dos pasos y hay que hacer LOS DOS.
--
-- PASO 1 — que no se pueda crear cuentas nuevas solo:
--   Supabase -> Authentication -> Sign In / Providers -> Email
--   -> apagar "Allow new users to sign up".
--   Desde ahí las cuentas las creás vos en Authentication -> Users -> Add user.
--
-- PASO 2 — volver a pedir aprobación. Corré:
--
--     -- el alta vuelve a exigir aprobación para los roles que ven todo
--     drop policy if exists usuario_autoalta on usuario;
--     create policy usuario_autoalta on usuario for insert to authenticated
--       with check (
--         auth_uid = auth.uid()
--         and (pendiente = true or not productora_pide_aprobacion(productora_id))
--       );
--
--     -- y corré backend/destrabar.sql, que deja la regla buena de subirse
--     -- de rol (esperás aprobación sólo si hay alguien que pueda dártela)
--
--     -- opcional: cerrar el candado de las productoras
--     update productora set requiere_aprobacion = true;
-- ===========================================================================
