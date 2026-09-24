-- =====================================================================
-- Migração 2/2 — 20260924_premios_avaliacao_v2_drop_chave_antiga
-- Rodar SÓ DEPOIS que o app novo (admin sem upsert manual no histórico)
-- estiver publicado. Remove a chave única antiga (sem produto), liberando
-- o histórico para milho. Rollback: ..._v2_ROLLBACK.sql
-- =====================================================================
begin;
alter table public.premios_historico
  drop constraint if exists premios_historico_data_ref_mes_idx_ano_porto_key;
notify pgrst, 'reload schema';
commit;
