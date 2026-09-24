-- =====================================================================
-- Rollback da migração 1/2 — volta o schema ao estado de 24/09/2026.
-- ORDEM: 1) publicar de volta o app antigo (git revert) ;
--        2) se a migração 2/2 foi aplicada, rodar ..._v2_ROLLBACK.sql ;
--        3) rodar este arquivo.
-- Mantém as LINHAS de premios_historico gravadas pelo trigger (são
-- lançamentos válidos); remove só as colunas/objetos novos.
-- As colunas de auditoria (lancado_por, fonte, conferir...) são perdidas.
-- =====================================================================
begin;

do $$ begin
  if exists (select 1 from public.premios_historico where produto <> 'Soja') then
    raise exception 'premios_historico tem linhas de produto <> Soja; trate-as antes do rollback.';
  end if;
  if not exists (select 1 from pg_constraint
                 where conname = 'premios_historico_data_ref_mes_idx_ano_porto_key') then
    raise exception 'Chave antiga ausente: rode antes 20260924_premios_avaliacao_v2_ROLLBACK.sql';
  end if;
end $$;

drop view if exists public.vw_premios_atual_avaliacao_combinada;
drop view if exists public.vw_premios_atual_avaliacao;
drop view if exists public.vw_premios_avaliacao;
drop function if exists public.premio_leitura(numeric, numeric, numeric, numeric);
drop function if exists public.premio_referencia_combinada(text, text, int, int, date);

drop trigger if exists trg_premio_atual_para_historico on public.premios_atual;
drop function if exists public.fn_premio_atual_para_historico();
drop trigger if exists trg_premios_atual_updated_at on public.premios_atual;
drop function if exists public.fn_premios_atual_updated_at();
drop function if exists public.premio_referencia(text, text, int, int, date);

drop index if exists public.premios_historico_busca_idx;
alter table public.premios_historico drop constraint if exists premios_historico_uk;
alter table public.premios_historico drop constraint if exists premios_historico_premio_faixa_chk;
alter table public.premios_historico
  drop column if exists revisado_por,
  drop column if exists revisado_em,
  drop column if exists var_calc,
  drop column if exists motivo_conferir,
  drop column if exists conferir,
  drop column if exists fonte,
  drop column if exists origem,
  drop column if exists lancado_em,
  drop column if exists lancado_por,
  drop column if exists produto;

alter table public.premios_atual drop constraint if exists premios_atual_venda_faixa_chk;
alter table public.premios_atual drop column if exists fonte;

drop table if exists public.premios_parametros;

drop index if exists public.premios_porto_busca_idx;
alter table public.premios_porto
  drop column if exists fonte,
  drop column if exists base_anos,
  drop column if exists obs,
  drop column if exists valido,
  drop column if exists data_fim,
  drop column if exists data_inicio,
  drop column if exists mes_idx;

notify pgrst, 'reload schema';
commit;
