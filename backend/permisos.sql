-- =============================================================================
-- CLAP · el acceso pasa a ser por proyecto, no por productora
--
-- Corré esto DESPUÉS de esquema.sql, alta-propia.sql, sincronizacion.sql y
-- arranque.sql. Se puede correr varias veces. No borra ni una fila.
--
-- LA IDEA, QUE ES DE ANDRÉS
-- Un técnico trabaja para muchas productoras. Tiene sentido que las tenga
-- todas anotadas en su perfil: "con estas laburo". Pero anotarlas no puede
-- darle acceso a nada, porque si no cualquiera se agrega y ve presupuestos
-- ajenos.
--
-- Entonces: figurar en una productora no abre ninguna puerta. La puerta la
-- abre la productora, invitándote a un PROYECTO puntual. Si no te invitaron a
-- ninguno, entrás y no ves nada — y eso está bien, no molesta a nadie.
--
-- QUIÉN VE TODO
-- Administración y Productor Ejecutivo ven todos los proyectos de su
-- productora sin que nadie los invite: son los que llevan la casa. El resto
-- —Producción y Equipo— ve sólo los proyectos donde está invitado.
--
-- Y una consecuencia linda: como agregarse a una productora ya no da acceso,
-- el alta libre deja de ser un riesgo para esos dos roles. Sólo hace falta
-- aprobación para quien se declara Administración o Productor Ejecutivo, que
-- son los que sí ven todo.
-- =============================================================================

begin;

-- --------------------------------------------------------- la invitación
create table if not exists proyecto_persona (
  proyecto_id  uuid not null references proyecto(id) on delete cascade,
  usuario_id   uuid not null references usuario(id)  on delete cascade,
  invitado_por uuid references usuario(id) on delete set null,
  invitado_el  timestamptz not null default now(),
  nota         text,
  primary key (proyecto_id, usuario_id)
);
create index if not exists ix_pp_usuario on proyecto_persona (usuario_id);
alter table proyecto_persona enable row level security;

-- ------------------------------------------- de qué productoras soy, de verdad
-- Ojo con la diferencia: `usuario` dice en qué productoras figuro; esto dice
-- en cuáles tengo algo que hacer. Es lo que se usa para decidir permisos.
create or replace function productoras_con_acceso() returns setof uuid
language sql stable security definer set search_path = public as $$
  select u.productora_id
    from usuario u
   where u.auth_uid = auth.uid() and u.activo and not u.pendiente
     and ( u.rol in ('admin','ejecutivo')
        or exists (select 1
                     from proyecto_persona pp
                     join proyecto pr on pr.id = pp.proyecto_id
                    where pp.usuario_id = u.id
                      and pr.productora_id = u.productora_id) )
$$;

-- Todas las políticas que ya existen pasan por acá, así que con repuntarla
-- alcanza: no hay que tocar las 39 políticas una por una.
create or replace function mis_productoras() returns setof uuid
language sql stable security definer set search_path = public as $$
  select productoras_con_acceso()
$$;

create or replace function mis_orgs() returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct p.org_id from productora p
   where p.id in (select productoras_con_acceso())
$$;

-- ------------------------------------------------- acceso a un proyecto
create or replace function puedo_proyecto(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1
      from proyecto pr
      join usuario u on u.productora_id = pr.productora_id
     where pr.id = p
       and u.auth_uid = auth.uid() and u.activo and not u.pendiente
       and ( u.rol in ('admin','ejecutivo')
          or exists (select 1 from proyecto_persona pp
                      where pp.proyecto_id = pr.id and pp.usuario_id = u.id) ))
$$;

-- Si no estoy en el proyecto no tengo rol EN ese proyecto, aunque tenga uno
-- en la productora. Es lo que impide que un `equipo` no invitado toque nada.
create or replace function mi_rol_en_proyecto(p uuid) returns rol_usuario
language sql stable security definer set search_path = public as $$
  select u.rol
    from proyecto pr
    join usuario u on u.productora_id = pr.productora_id
   where pr.id = p
     and u.auth_uid = auth.uid() and u.activo and not u.pendiente
     and ( u.rol in ('admin','ejecutivo')
        or exists (select 1 from proyecto_persona pp
                    where pp.proyecto_id = pr.id and pp.usuario_id = u.id) )
   limit 1
$$;

-- ------------------------------------------- políticas de la invitación
drop policy if exists pp_ver      on proyecto_persona;
drop policy if exists pp_invitar  on proyecto_persona;
drop policy if exists pp_sacar    on proyecto_persona;

-- Veo las invitaciones de los proyectos a los que entro, y siempre las mías
-- (para saber a qué me invitaron aunque todavía no haya entrado).
create policy pp_ver on proyecto_persona for select
  using ( puedo_proyecto(proyecto_id)
       or usuario_id in (select id from usuario where auth_uid = auth.uid()) );

-- Invitar y desinvitar es de quien lleva la casa.
create policy pp_invitar on proyecto_persona for insert to authenticated
  with check (mi_rol_en_proyecto(proyecto_id) in ('admin','ejecutivo'));
create policy pp_sacar on proyecto_persona for delete
  using (mi_rol_en_proyecto(proyecto_id) in ('admin','ejecutivo'));

-- ----------------------------------------------- el proyecto, por invitación
drop policy if exists proyecto_mio on proyecto;
create policy proyecto_mio on proyecto for all
  using (puedo_proyecto(id))
  with check (productora_id in (select mis_productoras()));

-- ------------------------------------------------ el ejecutivo también paga
-- En una productora chica el PE decide y a veces paga. Separarlo de
-- Administración sólo agrega fricción; quién movió cada comprobante igual
-- queda firmado en comprobante_paso, que no se puede editar ni borrar.
drop policy if exists cbte_mover on comprobante;
create policy cbte_mover on comprobante for update
  using (puedo_proyecto(proyecto_id))
  with check (
    case estado
      when 'pagado'    then mi_rol_en_proyecto(proyecto_id) in ('admin','ejecutivo')
      when 'aprobado'  then mi_rol_en_proyecto(proyecto_id) in ('admin','ejecutivo')
      when 'revisado'  then mi_rol_en_proyecto(proyecto_id) in ('admin','ejecutivo','produccion')
      when 'rechazado' then mi_rol_en_proyecto(proyecto_id) in ('admin','ejecutivo','produccion')
      else true
    end);

-- ------------------------------------- el alta libre, ahora con criterio
-- Sumarse a una productora como Producción o Equipo no da acceso a nada hasta
-- que te inviten a un proyecto: puede ser libre. Declararse Administración o
-- Productor Ejecutivo sí da acceso a todo: eso siempre pasa por aprobación,
-- salvo que la productora la esté creando uno mismo (eso lo hace
-- crear_mi_productora, que no pasa por esta política).
drop policy if exists usuario_autoalta on usuario;
create policy usuario_autoalta on usuario for insert to authenticated
  with check (
    auth_uid = auth.uid()
    and (
      pendiente = true
      or ( rol in ('equipo','produccion')
           and not productora_pide_aprobacion(productora_id) )
    )
  );

commit;

-- =============================================================================
-- COMPROBAR
--
-- 1) quién ve qué, de un vistazo:
--    select p.nombre as productora, pr.nombre as proyecto, u.nombre, u.rol,
--           case when u.rol in ('admin','ejecutivo') then 've todo'
--                when exists(select 1 from proyecto_persona pp
--                            where pp.proyecto_id = pr.id and pp.usuario_id = u.id)
--                then 'invitado' else 'sin acceso' end as acceso
--      from usuario u
--      join productora p on p.id = u.productora_id
--      left join proyecto pr on pr.productora_id = p.id
--     order by 1,2,3;
--
-- 2) que un `equipo` sin invitación no vea proyectos: entrá con esa cuenta y
--    la lista tiene que estar vacía.
--
-- 3) que la invitación exista:
--    select * from proyecto_persona;
-- =============================================================================
