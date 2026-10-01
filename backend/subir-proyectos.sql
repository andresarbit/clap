-- ===========================================================================
-- CLAP · ARREGLO: LOS PROYECTOS NUEVOS NO SUBÍAN A LA BASE
--
-- COPIÁ TODO ESTE ARCHIVO, PEGALO EN:
--     Supabase  ->  SQL Editor  ->  New query
-- y apretá RUN. Se puede correr varias veces. No borra nada.
--
-- EL PROBLEMA (viene desde permisos.sql, 25/08)
-- La regla que decide quién VE un proyecto (puedo_proyecto) lo busca en la
-- tabla. Al subir uno nuevo, la base pide ver la fila recién subida para
-- devolverla, pero en ese instante todavía no está en la tabla: la regla
-- dice que no y la base rechaza todo con "no te deja hacer eso". Resultado:
-- ningún proyecto creado desde el 25/08 llegó a la base, y por eso no se
-- podía invitar a ellos.
--
-- EL ARREGLO
-- La regla mira la productora de la fila que se está guardando, en vez de
-- buscar el proyecto en la tabla. Y quien crea un proyecto queda anotado en
-- él, para que alguien de Producción vea lo que creó.
-- ===========================================================================

begin;

-- ¿Puedo ver este proyecto? Igual que puedo_proyecto, pero con la productora
-- de la fila: sirve también para el proyecto que todavía no está guardado.
create or replace function puedo_proyecto_de(p_productora uuid, p_proyecto uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from usuario u
     where u.productora_id = p_productora
       and u.auth_uid = auth.uid() and u.activo and not u.pendiente
       and ( u.rol in ('admin','ejecutivo')
          or exists (select 1 from proyecto_persona pp
                      where pp.proyecto_id = p_proyecto and pp.usuario_id = u.id)
          -- el proyecto que estoy creando yo (todavía no existe): Producción
          -- puede; Equipo no crea proyectos
          or ( u.rol = 'produccion'
               and not exists (select 1 from proyecto where id = p_proyecto) ) ))
$$;

drop policy if exists proyecto_ver    on proyecto;
drop policy if exists proyecto_editar on proyecto;
create policy proyecto_ver    on proyecto for select using (puedo_proyecto_de(productora_id, id));
create policy proyecto_editar on proyecto for update
  using (puedo_proyecto_de(productora_id, id)) with check (productora_id in (select mis_productoras()));

-- Quien crea el proyecto queda anotado en él.
create or replace function anotar_al_que_crea() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_yo uuid;
begin
  select id into v_yo from usuario
   where auth_uid = auth.uid() and productora_id = new.productora_id limit 1;
  if v_yo is not null then
    insert into proyecto_persona (proyecto_id, usuario_id, invitado_por)
    values (new.id, v_yo, v_yo) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists tr_anotar_al_que_crea on proyecto;
create trigger tr_anotar_al_que_crea after insert on proyecto
  for each row execute function anotar_al_que_crea();

commit;

select 'Listo: los proyectos nuevos ya pueden subir. Volvé a CLAP y tocá ✉ Invitar.' as "Resultado";
