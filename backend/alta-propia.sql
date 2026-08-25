-- =============================================================================
-- CLAP · agregado: alta propia al entrar por primera vez
--
-- Corré esto DESPUÉS de esquema.sql. Es un agregado, no lo reemplaza.
-- Se puede correr varias veces sin romper nada.
--
-- Qué resuelve: que cada uno declare su rol, su área y a qué productora se
-- suma cuando entra por primera vez, sin que un admin tenga que cargarlo.
--
-- EL CANDADO ARRANCA ABIERTO. Mientras están probando, el que entra elige su
-- rol —incluso Administración— y queda activo al toque. Es lo cómodo cuando
-- son dos o tres y se conocen.
--
-- Cuando la herramienta se abra a más gente, se cierra con un switch:
--
--     update productora set requiere_aprobacion = true where id = '...';
--
-- Desde ahí, el que se da de alta queda PENDIENTE hasta que un admin lo
-- apruebe, y puede entrar pero no ver nada. Los que ya estaban no se tocan.
-- Lo importante: quién puede aprobar lo decide la BASE, no la interfaz, así
-- que nadie se aprueba a sí mismo ni se declara admin cuando el candado está
-- cerrado.
-- =============================================================================

begin;

-- ------------------------------------------------------------- columnas
alter table productora add column if not exists requiere_aprobacion boolean not null default false;
comment on column productora.requiere_aprobacion is
  'false = el que entra elige su rol y queda activo. true = queda pendiente hasta que un admin lo apruebe.';

alter table usuario add column if not exists pendiente boolean not null default false;
alter table usuario add column if not exists area      text;
alter table usuario add column if not exists alta_el   timestamptz not null default now();

comment on column usuario.pendiente is
  'Se dio de alta solo y todavía nadie de la productora lo aprobó.';

-- --------------------------------------------- los pendientes no cuentan
-- Todas las funciones de permisos tienen que ignorarlos: si no, alguien
-- pendiente ya tendría acceso mientras espera.

create or replace function mis_productoras() returns setof uuid
language sql stable security definer set search_path = public as $$
  select productora_id from usuario
   where auth_uid = auth.uid() and activo and not pendiente
$$;

create or replace function mis_orgs() returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct p.org_id from productora p
  where p.id in (select productora_id from usuario
                  where auth_uid = auth.uid() and activo and not pendiente)
$$;

create or replace function mi_rol(p uuid) returns rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from usuario
  where auth_uid = auth.uid() and productora_id = p and activo and not pendiente limit 1
$$;

create or replace function puedo_proyecto(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from proyecto
    where id = p and productora_id in (select productora_id from usuario
                                       where auth_uid = auth.uid() and activo and not pendiente))
$$;

create or replace function mi_rol_en_proyecto(p uuid) returns rol_usuario
language sql stable security definer set search_path = public as $$
  select u.rol from proyecto pr
  join usuario u on u.productora_id = pr.productora_id
  where pr.id = p and u.auth_uid = auth.uid() and u.activo and not u.pendiente limit 1
$$;

-- --------------------------------------------------------- el candado
create or replace function productora_pide_aprobacion(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select requiere_aprobacion from productora where id = p), false)
$$;
revoke all on function productora_pide_aprobacion(uuid) from public;
grant execute on function productora_pide_aprobacion(uuid) to authenticated;

-- ------------------------------------------------------- elegir productora
-- Al darse de alta hay que elegir a cuál sumarse, pero RLS todavía no deja ver
-- ninguna. Esta función devuelve SOLO id y nombre: ni CUIT, ni fees, nada más.
create or replace function productoras_para_elegir()
returns table(id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre from productora p order by p.nombre
$$;
revoke all on function productoras_para_elegir() from public;
grant execute on function productoras_para_elegir() to authenticated;

-- -------------------------------------------------------------- políticas
drop policy if exists usuario_ver_mia    on usuario;
drop policy if exists usuario_autoalta   on usuario;
drop policy if exists usuario_editar_mia on usuario;

-- Siempre puedo ver MI ficha, aunque esté pendiente: es lo que me deja saber
-- en qué estado quedó mi solicitud.
create policy usuario_ver_mia on usuario for select
  using (auth_uid = auth.uid());

-- Alta propia: sólo MI propia fila. Si la productora tiene el candado abierto
-- puedo entrar activo con el rol que declaro; si está cerrado, sólo pendiente.
-- La condición se resuelve contra la base, así que cerrar el candado alcanza:
-- no hay forma de esquivarlo desde el navegador.
create policy usuario_autoalta on usuario for insert to authenticated
  with check (
    auth_uid = auth.uid()
    and (pendiente = true or not productora_pide_aprobacion(productora_id))
  );

-- Puedo corregir mis datos mientras espero. El `using` exige que siga
-- pendiente, así que no puedo aprobarme a mí mismo.
create policy usuario_editar_mia on usuario for update
  using (auth_uid = auth.uid() and pendiente)
  with check (auth_uid = auth.uid() and pendiente);

-- Cerrar el candado es cosa de un admin de esa productora.
drop policy if exists productora_candado on productora;
create policy productora_candado on productora for update
  using (mi_rol(id) = 'admin') with check (mi_rol(id) = 'admin');

-- ---------------------------------------------------------------- trigger
-- Quien crea la productora no espera aprobación de nadie: es el primero.
create or replace function alta_primer_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and not exists(select 1 from usuario where productora_id = new.id) then
    insert into usuario (auth_uid, productora_id, nombre, rol, email, pendiente)
    values (auth.uid(), new.id,
            coalesce((select raw_user_meta_data->>'nombre' from auth.users where id = auth.uid()),
                     (select email from auth.users where id = auth.uid()), 'Yo'),
            'admin',
            (select email from auth.users where id = auth.uid()),
            false);
  end if;
  return new;
end $$;

drop trigger if exists tr_alta_primer_usuario on productora;
create trigger tr_alta_primer_usuario after insert on productora
  for each row execute function alta_primer_usuario();

commit;

-- =============================================================================
-- COMPROBAR
-- 1) que las columnas estén:
--    select table_name, column_name from information_schema.columns
--     where (table_name = 'usuario'    and column_name in ('pendiente','area'))
--        or (table_name = 'productora' and column_name = 'requiere_aprobacion');
--
-- 1b) ver cómo está el candado de cada productora:
--    select nombre, requiere_aprobacion from productora;
--
-- 2) que nadie quede sin RLS (no tiene que devolver filas):
--    select c.relname, c.relrowsecurity, count(p.polname)
--      from pg_class c join pg_namespace n on n.oid = c.relnamespace
--      left join pg_policy p on p.polrelid = c.oid
--     where n.nspname = 'public' and c.relkind = 'r'
--     group by 1,2 having c.relrowsecurity = false or count(p.polname) = 0;
-- =============================================================================
