-- =============================================================================
-- CLAP · quien entra queda en el catálogo
--
-- Corré esto DESPUÉS de esquema.sql, alta-propia.sql, sincronizacion.sql,
-- arranque.sql y permisos.sql. Se puede correr varias veces. No borra nada.
--
-- POR QUÉ
-- Hoy el catálogo lo carga producción a mano: nombre, función, CUIT, alias,
-- condición frente a AFIP. Esos datos los tiene la persona, no la productora,
-- y terminan persiguiéndose por WhatsApp el día que hay que pagar.
--
-- Si el técnico ya entró al sistema, sus datos tienen que llegar solos al
-- catálogo. Y lo que falta —CUIT, alias, condición— lo completa él mismo desde
-- su perfil, una vez, y le sirve para todas las productoras con las que
-- trabaja.
--
-- POR QUÉ UNA FUNCIÓN Y NO UN INSERT COMÚN
-- Alguien recién sumado a una productora, o esperando aprobación, todavía no
-- tiene acceso a esa organización: RLS le impide escribir en el catálogo. Pero
-- SU PROPIA ficha tiene que poder cargarla igual. Esta función corre con
-- permisos de dueño y sólo toca la fila de quien la llama.
-- =============================================================================

begin;

alter table usuario add column if not exists catalogo_id uuid
  references catalogo_persona(id) on delete set null;

comment on column usuario.catalogo_id is
  'Su ficha en el catálogo de la organización. Se crea sola al darse de alta.';

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
  u     record;
  v_org uuid;
  v_cat uuid;
begin
  if v_uid is null then
    raise exception 'Hay que iniciar sesión';
  end if;

  select * into u from usuario where auth_uid = v_uid limit 1;
  if not found then
    raise exception 'Todavía no completaste tu alta';
  end if;

  -- El rol sólo se puede cambiar solo si no es de los que ven todo, o si la
  -- productora es de uno. Si no, vuelve a quedar pendiente de aprobación: la
  -- regla la decide acá, no la pantalla.
  update usuario
     set nombre = coalesce(nullif(btrim(p_nombre), ''), nombre),
         tel    = coalesce(p_tel, tel),
         area   = coalesce(p_area, area),
         rol    = coalesce(p_rol, rol),
         pendiente = case
           when p_rol is null or p_rol = u.rol then pendiente
           when p_rol in ('admin','ejecutivo') and u.rol not in ('admin','ejecutivo')
             then true
           else pendiente end
   where id = u.id;

  select org_id into v_org from productora where id = u.productora_id;

  -- Su ficha del catálogo: la que ya tenía, o la que coincide por mail, o una
  -- nueva. El mail es lo que identifica a una persona entre productoras.
  v_cat := u.catalogo_id;
  if v_cat is null and u.email is not null then
    select id into v_cat from catalogo_persona
     where org_id = v_org and lower(email) = lower(u.email) limit 1;
  end if;

  if v_cat is null then
    insert into catalogo_persona (org_id, tipo, nombre, funcion, rubro, dni, cuit,
                                  condicion, tel, email, banco, alias)
    values (v_org, 'persona',
            coalesce(nullif(btrim(p_nombre), ''), u.nombre),
            p_funcion, p_rubro, p_dni, p_cuit, p_condicion,
            coalesce(p_tel, u.tel), u.email, p_banco, p_alias)
    returning id into v_cat;
  else
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
  end if;

  update usuario set catalogo_id = v_cat where id = u.id;
  return v_cat;
end $$;

revoke all on function guardar_mis_datos(text,text,text,rol_usuario,text,text,text,text,text,text,text) from public;
grant execute on function guardar_mis_datos(text,text,text,rol_usuario,text,text,text,text,text,text,text) to authenticated;

-- ------------------------------------------------------- leer lo mío
-- Para poder mostrarle sus propios datos hay que dejarlo leer su ficha del
-- catálogo aunque todavía no tenga acceso a la organización. Sólo la suya.
drop policy if exists catalogo_mia on catalogo_persona;
create policy catalogo_mia on catalogo_persona for select
  using (id in (select catalogo_id from usuario
                 where auth_uid = auth.uid() and catalogo_id is not null));

-- ------------------------------------------- los que ya estaban dados de alta
-- Que no se queden afuera del catálogo por haber entrado antes de esto.
do $$
declare u record; v_org uuid; v_cat uuid;
begin
  for u in select * from usuario where catalogo_id is null loop
    select org_id into v_org from productora where id = u.productora_id;
    if v_org is null then continue; end if;
    select id into v_cat from catalogo_persona
     where org_id = v_org and u.email is not null and lower(email) = lower(u.email) limit 1;
    if v_cat is null then
      insert into catalogo_persona (org_id, tipo, nombre, tel, email)
      values (v_org, 'persona', u.nombre, u.tel, u.email)
      returning id into v_cat;
    end if;
    update usuario set catalogo_id = v_cat where id = u.id;
  end loop;
end $$;

commit;

-- =============================================================================
-- COMPROBAR
--
-- 1) que cada usuario tenga su ficha en el catálogo:
--    select u.nombre, u.rol, c.nombre as en_catalogo, c.cuit, c.alias
--      from usuario u left join catalogo_persona c on c.id = u.catalogo_id;
--
-- 2) que la función esté y sólo la use quien tiene sesión:
--    select has_function_privilege('anon',
--      'guardar_mis_datos(text,text,text,rol_usuario,text,text,text,text,text,text,text)',
--      'execute');   -- false
-- =============================================================================
