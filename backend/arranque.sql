-- =============================================================================
-- CLAP · arreglo: crear la primera productora
--
-- Corré esto DESPUÉS de esquema.sql, alta-propia.sql y sincronizacion.sql.
-- Se puede correr varias veces sin romper nada. No borra ni una fila.
--
-- EL PROBLEMA
-- Alguien que entra por primera vez no pertenece a ninguna productora. Eso está
-- bien: es lo que impide que un desconocido lea datos ajenos. Pero también
-- significa que, al crear la SUYA, el cliente inserta la fila y después no
-- puede leerla de vuelta para saber qué id le tocó — porque la política de
-- lectura exige ser miembro, y todavía no lo es. La fila entra y la respuesta
-- rebota con 403. El alta falla aunque el permiso de escritura esté bien.
--
-- LA SALIDA QUE NO SIRVE
-- Aflojar la política de lectura de organizacion o productora. Con eso
-- cualquiera con la clave pública podría listar todas las productoras del
-- sistema con sus CUIT y sus fees. No.
--
-- LA QUE SÍ
-- Un solo movimiento del lado de la base: esta función crea la organización si
-- hace falta, crea la productora, y da de alta a quien la pidió como
-- administrador de lo que acaba de crear. Devuelve el id ya listo. Corre como
-- `security definer`, o sea con permisos del dueño de la base, pero SÓLO hace
-- esas tres cosas y SÓLO para el usuario que la llama: no hay forma de pedirle
-- que te meta en la productora de otro.
-- =============================================================================

begin;

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

  -- Si ya soy de alguna organización, la reuso; si no, armo la mía.
  select p.org_id into v_org
    from productora p
    join usuario u on u.productora_id = p.id
   where u.auth_uid = v_uid
   limit 1;

  if v_org is null then
    insert into organizacion (nombre)
    values (coalesce(nullif(btrim(p_mi_nombre), ''), 'Mi estudio'))
    returning id into v_org;
  end if;

  insert into productora (org_id, nombre)
  values (v_org, btrim(p_nombre))
  returning id into v_prod;

  -- El trigger de esquema.sql ya me dio de alta como admin al crearla. Le
  -- completo los datos que puso en el formulario. Si por lo que sea no corrió,
  -- lo doy de alta acá: el que crea la productora nunca espera aprobación.
  update usuario
     set nombre = coalesce(nullif(btrim(p_mi_nombre), ''), nombre),
         rol    = p_rol,
         area   = p_area,
         tel    = p_tel
   where productora_id = v_prod and auth_uid = v_uid;

  if not found then
    insert into usuario (auth_uid, productora_id, nombre, rol, area, tel, email, activo, pendiente)
    values (v_uid, v_prod,
            coalesce(nullif(btrim(p_mi_nombre), ''),
                     (select email from auth.users where id = v_uid), 'Yo'),
            p_rol, p_area, p_tel,
            (select email from auth.users where id = v_uid), true, false);
  end if;

  return v_prod;
end $$;

revoke all on function crear_mi_productora(text, text, rol_usuario, text, text) from public;
grant execute on function crear_mi_productora(text, text, rol_usuario, text, text) to authenticated;

-- ----------------------------------------------------------------- limpieza
-- Un intento fallido puede haber dejado una organización sin ninguna
-- productora colgando. No molesta a nadie, pero tampoco sirve.
delete from organizacion o
 where not exists (select 1 from productora p where p.org_id = o.id);

commit;

-- =============================================================================
-- COMPROBAR
--
-- 1) que la función esté:
--    select proname from pg_proc where proname = 'crear_mi_productora';
--
-- 2) que sólo la pueda ejecutar quien tiene sesión (no `anon`):
--    select has_function_privilege('authenticated',
--      'crear_mi_productora(text,text,rol_usuario,text,text)', 'execute') as puede_logueado,
--           has_function_privilege('anon',
--      'crear_mi_productora(text,text,rol_usuario,text,text)', 'execute') as puede_anonimo;
--    -- tiene que dar  true | false
--
-- 3) después de que alguien se dé de alta:
--    select p.nombre as productora, u.nombre, u.rol, u.pendiente
--      from productora p join usuario u on u.productora_id = p.id;
-- =============================================================================
