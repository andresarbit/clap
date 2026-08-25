-- =============================================================================
-- CLAP · esquema de base de datos (PostgreSQL / Supabase)
--
-- Esto NO esta en uso todavia. Es la traduccion del modelo de datos que hoy
-- vive en localStorage, para cuando montemos el backend. Se publica ahora
-- porque el modelo ya esta probado contra uso real y conviene fijarlo.
--
-- Por que Postgres y no una planilla:
--   · Los datos son anidados (un presupuesto tiene rubros, que tienen lineas)
--     y una hoja de calculo obliga a aplanarlos y a repetir todo.
--   · Hace falta que dos personas escriban a la vez sin pisarse.
--   · Hacen falta permisos de verdad: que arte NO pueda aprobar un pago. En
--     una planilla compartida, quien puede leer puede editar.
--   · Hay archivos adjuntos (fotos de comprobantes) que no van en una celda.
--
-- El aislamiento entre productoras se hace con Row Level Security: cada fila
-- lleva productora_id y la base misma impide leer las de otra. No depende de
-- que la interfaz "se acuerde" de filtrar.
-- =============================================================================

begin;

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------- catalogos
create type rol_usuario  as enum ('equipo','produccion','ejecutivo','admin');
create type estado_cbte  as enum ('cargado','revisado','aprobado','pagado','rechazado');
create type estado_oc    as enum ('borrador','emitida','cumplida','anulada');
create type estado_caja  as enum ('abierta','rendida');
create type moneda       as enum ('ARS','USD');
-- como se paga y con que respaldo: dos ejes separados a proposito
create type circuito_pago as enum ('transferencia','cheque','debito','mp','efectivo','usd','cripto');
create type respaldo_doc  as enum ('facA','facBC','reciboX','reciboS','ticket','ninguno');

-- ------------------------------------------------------------- organizacion
-- El estudio que administra varias productoras (el caso de Andres).
create table organizacion (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  creado_el   timestamptz not null default now()
);

create table productora (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizacion(id) on delete cascade,
  nombre         text not null,
  cuit           text,
  condicion_iva  text,
  jurisdiccion   text,
  fee_default          numeric(6,3) not null default 15,
  contingencia_default numeric(6,3) not null default 5,
  iva_default          numeric(6,3) not null default 21,
  iibb_default         numeric(6,3) not null default 0,
  creado_el      timestamptz not null default now()
);
create index on productora (org_id);

-- Personas con acceso al sistema. auth_uid enlaza con el login de Supabase.
create table usuario (
  id           uuid primary key default gen_random_uuid(),
  auth_uid     uuid unique,                       -- null = todavia no acepto la invitacion
  productora_id uuid not null references productora(id) on delete cascade,
  nombre       text not null,
  rol          rol_usuario not null default 'equipo',
  depto        text,
  email        text,
  tel          text,
  activo       boolean not null default true
);
create index on usuario (productora_id);
create index on usuario (auth_uid);

-- ------------------------------------------------------------------ catalogo
-- Personas, proveedores y equipos. Vive a nivel de la ORG, no de la
-- productora: es el activo que se comparte entre todas.
create table catalogo_persona (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizacion(id) on delete cascade,
  tipo        text not null default 'persona',    -- persona | proveedor | equipo
  nombre      text not null,
  funcion     text,
  rubro       text,
  dni         text,
  cuit        text,
  fecha_nac   date,
  condicion   text,
  tarifa_ref  numeric(14,2) default 0,
  moneda      moneda default 'ARS',
  unidad      text default 'jornada',
  tel         text,
  email       text,
  banco       text,
  alias       text
);
create index on catalogo_persona (org_id);
create index on catalogo_persona (org_id, rubro);

-- ------------------------------------------------------------------ proyecto
create table proyecto (
  id            uuid primary key default gen_random_uuid(),
  productora_id uuid not null references productora(id) on delete cascade,
  nombre        text not null,
  tipo          text default 'publicidad',
  cliente       text,
  agencia       text,
  producto      text,
  territorio    text,
  plazo         text,
  medios        text,
  jornadas      int default 1,
  -- condiciones de rodaje: cambian por convenio y por tipo de trabajo
  horas_jornada   numeric(5,2) not null default 8,
  recargo_he      numeric(6,3) not null default 50,
  descontar_comida boolean not null default true,
  min_turnaround  numeric(5,2) not null default 12,
  tel_produccion  text,
  archivado     boolean not null default false,
  creado_el     timestamptz not null default now()
);
create index on proyecto (productora_id);

-- --------------------------------------------------------------- presupuesto
create table version_presupuesto (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references proyecto(id) on delete cascade,
  nombre       text not null default 'v1',
  estado       text not null default 'borrador',
  moneda_base  moneda not null default 'ARS',
  tc           numeric(14,4) not null default 1000,
  tc_nombre    text default 'MEP',
  tc_fecha     date,                              -- clave para reclamar reajuste
  fee          numeric(6,3) not null default 15,
  contingencia numeric(6,3) not null default 5,
  iibb         numeric(6,3) not null default 0,
  iva          numeric(6,3) not null default 21,
  notas        text,
  creado_el    timestamptz not null default now()
);
create index on version_presupuesto (proyecto_id);

create table rubro_version (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references version_presupuesto(id) on delete cascade,
  codigo      text not null,
  nombre      text not null,
  aplica_fee  boolean not null default true,
  orden       int,
  unique (version_id, codigo)
);

create table linea_presupuesto (
  id          uuid primary key default gen_random_uuid(),
  rubro_id    uuid not null references rubro_version(id) on delete cascade,
  concepto    text not null default '',
  ref_id      uuid references catalogo_persona(id) on delete set null,
  cantidad    numeric(12,3) not null default 1,
  dias        numeric(12,3) not null default 1,
  unidad      text default 'jornada',
  valor_unit  numeric(14,2) not null default 0,
  moneda      moneda not null default 'ARS',
  circuito    circuito_pago,
  comprobante respaldo_doc,
  notas       text,
  orden       int
);
create index on linea_presupuesto (rubro_id);

-- -------------------------------------------------------- desglose de guion
create table desglose (
  proyecto_id        uuid primary key references proyecto(id) on delete cascade,
  guion              text,
  modo               text,                        -- encabezados | parrafos | bloque
  paginas_por_jornada numeric(6,3) default 4,
  importado_el       date
);

create table escena (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyecto(id) on delete cascade,
  numero      text not null,
  encabezado  text,
  int_ext     text not null default 'INT',
  locacion    text,
  momento     text,
  texto       text,
  octavos     int not null default 1,
  jornada     int,
  notas       text,
  orden       int
);
create index on escena (proyecto_id);
create index on escena (proyecto_id, jornada);

-- Personajes y elementos: filas, no arrays, para poder preguntar
-- "en que escenas aparece el perro" sin recorrer todo.
create table escena_personaje (
  escena_id  uuid not null references escena(id) on delete cascade,
  personaje  text not null,
  primary key (escena_id, personaje)
);
create table escena_elemento (
  escena_id  uuid not null references escena(id) on delete cascade,
  depto      text not null,                       -- utileria, vestuario, vehiculos...
  elemento   text not null,
  sugerido   boolean not null default false,      -- lo propuso el diccionario
  primary key (escena_id, depto, elemento)
);

-- ------------------------------------------------------------------ jornadas
create table jornada (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyecto(id) on delete cascade,
  numero      int not null,
  fecha       date,
  citacion    time, comida time, wrap time,
  amanecer    time, atardecer time,
  clima       text, clima_real text,
  hospital_nombre text, hospital_direccion text, hospital_tel text,
  emergencia_nombre text, emergencia_tel text,
  -- parte de rodaje
  primera_toma time, comida_in time, comida_out time, ultima_toma time,
  comidas_servidas int default 0,
  incidencias text,
  notas       text,
  unique (proyecto_id, numero)
);

create table jornada_locacion (
  jornada_id uuid not null references jornada(id) on delete cascade,
  locacion   text not null,
  direccion  text, contacto text, notas text,
  primary key (jornada_id, locacion)
);

-- Citacion y fichada de cada persona en cada jornada.
-- clave_persona referencia una linea de presupuesto o un personaje del guion.
create table jornada_persona (
  jornada_id    uuid not null references jornada(id) on delete cascade,
  clave_persona text not null,
  citacion   time, maquillaje time, en_set time,
  entrada    time, salida time,
  citado     boolean not null default false,
  nota       text,
  primary key (jornada_id, clave_persona)
);

create table jornada_escena_filmada (
  jornada_id uuid not null references jornada(id) on delete cascade,
  escena_id  uuid not null references escena(id) on delete cascade,
  primary key (jornada_id, escena_id)
);

-- ------------------------------------------------------------------- plata
create table orden_compra (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyecto(id) on delete cascade,
  numero      text not null,
  rubro       text not null,
  subrubro    text,
  concepto    text,
  proveedor   text,
  cuit        text,
  importe     numeric(14,2) not null,
  moneda      moneda not null default 'ARS',
  fecha       date not null default current_date,
  entrega     text,
  condicion   text,
  estado      estado_oc not null default 'borrador',
  emitida_por uuid references usuario(id) on delete set null,
  emitida_el  timestamptz,
  notas       text,
  unique (proyecto_id, numero)
);
create index on orden_compra (proyecto_id, estado);

create table caja_chica (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyecto(id) on delete cascade,
  nombre      text not null,
  responsable uuid references usuario(id) on delete set null,
  jornada     int,
  moneda      moneda not null default 'ARS',
  estado      estado_caja not null default 'abierta',
  rendida_el  date,
  rendida_por uuid references usuario(id) on delete set null,
  devuelto    numeric(14,2) default 0,
  reintegro   numeric(14,2) default 0,
  notas       text
);
create index on caja_chica (proyecto_id, estado);

create table caja_adelanto (
  id          uuid primary key default gen_random_uuid(),
  caja_id     uuid not null references caja_chica(id) on delete cascade,
  fecha       date not null default current_date,
  importe     numeric(14,2) not null,
  circuito    circuito_pago,
  entregado_por uuid references usuario(id) on delete set null,
  nota        text
);
create index on caja_adelanto (caja_id);

create table comprobante (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyecto(id) on delete cascade,
  rubro       text not null,                      -- obligatorio: sin rubro no se imputa
  subrubro    text,
  concepto    text,
  proveedor   text,
  cuit        text,
  tipo        respaldo_doc,
  numero      text,
  fecha       date not null default current_date,
  importe     numeric(14,2) not null,
  moneda      moneda not null default 'ARS',
  circuito    circuito_pago,
  linea_id    uuid references linea_presupuesto(id) on delete set null,
  oc_id       uuid references orden_compra(id) on delete set null,
  caja_id     uuid references caja_chica(id) on delete set null,
  jornada     int,
  estado      estado_cbte not null default 'cargado',
  cargado_por uuid references usuario(id) on delete set null,
  cargado_el  timestamptz not null default now(),
  notas       text
);
create index on comprobante (proyecto_id, rubro);
create index on comprobante (proyecto_id, estado);
create index on comprobante (oc_id);
create index on comprobante (caja_id);

-- Quien hizo que y cuando. Se escribe, nunca se edita ni se borra.
create table comprobante_paso (
  id            uuid primary key default gen_random_uuid(),
  comprobante_id uuid not null references comprobante(id) on delete cascade,
  de_estado     estado_cbte,
  a_estado      estado_cbte not null,
  accion        text not null,
  usuario_id    uuid references usuario(id) on delete set null,
  usuario_nombre text,                            -- copia, por si el usuario se borra
  rol           rol_usuario,
  nota          text,
  fecha         timestamptz not null default now()
);
create index on comprobante_paso (comprobante_id, fecha);

-- Las fotos van a Supabase Storage; aca queda la referencia, no el archivo.
create table adjunto (
  id            uuid primary key default gen_random_uuid(),
  comprobante_id uuid not null references comprobante(id) on delete cascade,
  bucket        text not null default 'comprobantes',
  path          text not null,
  nombre        text,
  tipo          text,
  bytes         int,
  ancho         int, alto int,
  subido_por    uuid references usuario(id) on delete set null,
  subido_el     timestamptz not null default now()
);
create index on adjunto (comprobante_id);

-- ------------------------------------------------------------- contactos
create table contacto_proyecto (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyecto(id) on delete cascade,
  clave       text,                               -- linea de presupuesto, locacion, o suelto
  grupo       text,
  rol         text,
  nombre      text,
  tel         text,
  email       text,
  notas       text
);
create index on contacto_proyecto (proyecto_id);

-- =============================================================================
-- AISLAMIENTO ENTRE PRODUCTORAS
-- La base impide leer lo que no es tuyo. No depende de que la interfaz filtre.
-- =============================================================================
create or replace function mis_productoras() returns setof uuid
language sql stable security definer as $$
  select productora_id from usuario where auth_uid = auth.uid() and activo
$$;

create or replace function mi_rol(p uuid) returns rol_usuario
language sql stable security definer as $$
  select rol from usuario where auth_uid = auth.uid() and productora_id = p and activo limit 1
$$;

alter table proyecto     enable row level security;
alter table comprobante  enable row level security;
alter table orden_compra enable row level security;
alter table caja_chica   enable row level security;
alter table usuario      enable row level security;

create policy proyecto_de_mi_productora on proyecto
  for all using (productora_id in (select mis_productoras()));

create policy usuario_de_mi_productora on usuario
  for select using (productora_id in (select mis_productoras()));

-- Todos los de la productora ven los comprobantes del proyecto...
create policy comprobante_ver on comprobante for select
  using (proyecto_id in (select id from proyecto where productora_id in (select mis_productoras())));

-- ...cualquiera con acceso puede cargar...
create policy comprobante_cargar on comprobante for insert
  with check (proyecto_id in (select id from proyecto where productora_id in (select mis_productoras())));

-- ...pero SOLO administracion puede marcar algo como pagado.
-- Esto es lo que hoy no se puede hacer cumplir sin servidor.
create policy comprobante_pagar on comprobante for update using (
  proyecto_id in (select id from proyecto where productora_id in (select mis_productoras()))
) with check (
  estado <> 'pagado'
  or mi_rol((select productora_id from proyecto where id = comprobante.proyecto_id)) = 'admin'
);

commit;

-- =============================================================================
-- MIGRACION DESDE EL ARCHIVO ACTUAL
-- El JSON que exporta CLAP (Datos → Exportar todo) tiene exactamente estas
-- entidades con los mismos nombres de campo. La migracion es un script que
-- recorre el JSON e inserta; no hay que volver a cargar nada a mano.
-- =============================================================================
