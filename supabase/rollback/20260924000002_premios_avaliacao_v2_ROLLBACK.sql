-- Rollback da migração 2/2: recria a chave única antiga.
begin;
do $$ begin
  if exists (select 1 from public.premios_historico
             group by data_ref, mes_idx, ano, porto having count(*) > 1) then
    raise exception 'Há mais de um produto na mesma data/mês/ano/porto (ex.: milho). Não dá para recriar a chave antiga sem remover linhas.';
  end if;
end $$;
alter table public.premios_historico
  add constraint premios_historico_data_ref_mes_idx_ano_porto_key unique (data_ref, mes_idx, ano, porto);
notify pgrst, 'reload schema';
commit;
