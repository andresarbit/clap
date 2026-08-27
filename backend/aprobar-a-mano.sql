-- CLAP · aprobar a alguien y darle rol, desde el SQL Editor de Supabase
-- ===========================================================================
-- Esto se corre en el SQL Editor (Supabase -> SQL Editor -> New query), que
-- entra como dueño de la base y NO pasa por las políticas de RLS. Sirve
-- cuando no hay ningún admin activo que pueda aprobar desde la app, o cuando
-- alguien quedó trabado.
--
-- Por qué hace falta: nadie puede aprobarse a sí mismo. La política
-- `usuario_editar_mia` exige `pendiente` en el USING y en el WITH CHECK, así
-- que uno puede corregir su nombre o su teléfono mientras espera, pero no
-- sacarse el `pendiente`. Y `guardar_mis_datos` vuelve a poner `pendiente`
-- cada vez que alguien se sube a admin o ejecutivo en una productora ajena.
-- Es a propósito: si no, pedir "Administración" sería entrar sin que nadie
-- te apruebe.


-- ---------------------------------------------------------------- 1. MIRAR
-- Quién hay, en qué productora, con qué rol y en qué estado.
-- Corré esto primero y leé el resultado antes de tocar nada.

select u.nombre,
       u.email,
       u.rol,
       u.activo,
       u.pendiente,
       p.nombre as productora,
       p.requiere_aprobacion as candado_cerrado,
       u.alta_el
  from usuario u
  join productora p on p.id = u.productora_id
 order by p.nombre, u.alta_el;


-- ------------------------------------------------------- 2. APROBAR Y DAR ROL
-- Cambiá el mail si hace falta. `pendiente = false` es lo que lo deja entrar;
-- `rol = 'admin'` es lo que le da el control de la productora.
-- Roles posibles: 'equipo', 'produccion', 'ejecutivo', 'admin'.

update usuario
   set pendiente = false,
       activo    = true,
       rol       = 'admin'
 where email = 'santyno@gmail.com';


-- ------------------------------------------------------------- 3. CONFIRMAR
-- Tiene que decir pendiente = false y rol = admin.

select nombre, email, rol, activo, pendiente
  from usuario
 where email = 'santyno@gmail.com';


-- ===========================================================================
-- SI QUEDÓ ATADO A LA PRODUCTORA EQUIVOCADA
-- ---------------------------------------------------------------------------
-- Pasa si completó el alta cuando la lista de productoras no se pudo traer y
-- creó una nueva sin querer. Primero mirá qué productoras hay:
--
--     select id, nombre from productora order by nombre;
--
-- y después mudalo a la que corresponde:
--
--     update usuario
--        set productora_id = 'PEGA-ACA-EL-ID-DE-LA-PRODUCTORA-BUENA'
--      where email = 'santyno@gmail.com';
--
-- La productora que quedó vacía se borra sola cuando no le cuelga nadie:
--
--     delete from productora p
--      where not exists (select 1 from usuario u where u.productora_id = p.id)
--        and not exists (select 1 from proyecto pr where pr.productora_id = p.id);
