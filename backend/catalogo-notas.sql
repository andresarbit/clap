-- Notas en las fichas del catálogo: con quién trabajó cada persona o
-- proveedor y en qué año ("Callsheets: Verisure (2026) · Fiserv (2021)").
--
-- Sin esta columna la app sigue andando: las notas quedan guardadas en el
-- navegador de cada uno y no se comparten. Con la columna, suben y bajan con
-- el resto de la ficha.
--
-- Se corre UNA vez en Supabase: SQL Editor -> pegar -> Run.
-- Se puede correr dos veces sin problema.

alter table catalogo_persona add column if not exists notas text;
