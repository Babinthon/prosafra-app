-- =====================================================================
-- Migração 1/2 — 20260924_premios_avaliacao_v1
-- ProSafra / BZ Grãos — Prêmios: histórico automático, auditoria,
-- validação e avaliação vs. média histórica (StoneX + lançamentos próprios)
--
-- 100% aditiva. É compatível com o código ATUAL do app (a chave única
-- antiga de premios_historico é MANTIDA aqui; só sai na migração 2/2,
-- depois que o app novo estiver no ar).
-- Roda numa transação só: se qualquer verificação falhar, nada é gravado.
-- Rollback: 20260924_premios_avaliacao_v1_ROLLBACK.sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) premios_porto: dar DATA à curva histórica (parte 1 do arquivo original)
--    Calendário-base: ano 2000 = ano da entrega; 1999 = ano anterior.
-- ---------------------------------------------------------------------
alter table public.premios_porto
  add column if not exists mes_idx     integer,          -- 0=Jan ... 11=Dez (igual premios_atual)
  add column if not exists data_inicio date,
  add column if not exists data_fim    date,
  add column if not exists valido      boolean not null default true,
  add column if not exists obs         text,
  add column if not exists base_anos   text not null default '2023-2025',
  add column if not exists fonte       text not null default 'StoneX';

update public.premios_porto set mes_idx=1, data_inicio='1999-01-29', data_fim='1999-02-17', valido=true, obs=null where id=1 and premio_inicio=45 and premio_fim=22;
update public.premios_porto set mes_idx=1, data_inicio='1999-02-17', data_fim='1999-03-07', valido=true, obs=null where id=2 and premio_inicio=22 and premio_fim=15;
update public.premios_porto set mes_idx=1, data_inicio='1999-03-07', data_fim='1999-03-26', valido=true, obs=null where id=3 and premio_inicio=15 and premio_fim=10;
update public.premios_porto set mes_idx=1, data_inicio='1999-03-26', data_fim='1999-04-14', valido=true, obs=null where id=4 and premio_inicio=10 and premio_fim=-2;
update public.premios_porto set mes_idx=1, data_inicio='1999-04-14', data_fim='1999-05-01', valido=true, obs=null where id=5 and premio_inicio=-2 and premio_fim=3;
update public.premios_porto set mes_idx=1, data_inicio='1999-05-01', data_fim='1999-05-20', valido=true, obs=null where id=6 and premio_inicio=3 and premio_fim=5;
update public.premios_porto set mes_idx=1, data_inicio='1999-05-20', data_fim='1999-06-10', valido=true, obs=null where id=7 and premio_inicio=5 and premio_fim=10;
update public.premios_porto set mes_idx=1, data_inicio='1999-06-10', data_fim='1999-06-26', valido=true, obs=null where id=8 and premio_inicio=10 and premio_fim=15;
update public.premios_porto set mes_idx=1, data_inicio='1999-06-26', data_fim='1999-07-16', valido=true, obs=null where id=9 and premio_inicio=15 and premio_fim=20;
update public.premios_porto set mes_idx=1, data_inicio='1999-07-16', data_fim='1999-08-04', valido=true, obs=null where id=10 and premio_inicio=20 and premio_fim=25;
update public.premios_porto set mes_idx=1, data_inicio='1999-08-04', data_fim='1999-08-21', valido=true, obs=null where id=11 and premio_inicio=25 and premio_fim=28;
update public.premios_porto set mes_idx=1, data_inicio='1999-08-21', data_fim='1999-09-09', valido=true, obs=null where id=12 and premio_inicio=28 and premio_fim=60;
update public.premios_porto set mes_idx=1, data_inicio='1999-09-09', data_fim='1999-09-29', valido=true, obs=null where id=13 and premio_inicio=60 and premio_fim=65;
update public.premios_porto set mes_idx=1, data_inicio='1999-09-29', data_fim='1999-10-16', valido=true, obs=null where id=14 and premio_inicio=65 and premio_fim=55;
update public.premios_porto set mes_idx=1, data_inicio='1999-10-16', data_fim='1999-11-04', valido=true, obs=null where id=15 and premio_inicio=55 and premio_fim=45;
update public.premios_porto set mes_idx=1, data_inicio='1999-11-04', data_fim='1999-12-10', valido=true, obs=null where id=16 and premio_inicio=45 and premio_fim=20;
update public.premios_porto set mes_idx=1, data_inicio='1999-12-10', data_fim='2000-01-21', valido=true, obs=null where id=17 and premio_inicio=20 and premio_fim=-25;
update public.premios_porto set mes_idx=1, data_inicio='2000-01-21', data_fim='2000-02-06', valido=true, obs=null where id=18 and premio_inicio=-25 and premio_fim=-38;
update public.premios_porto set mes_idx=2, data_inicio='1999-01-29', data_fim='1999-02-19', valido=true, obs=null where id=19 and premio_inicio=35 and premio_fim=15;
update public.premios_porto set mes_idx=2, data_inicio='1999-02-19', data_fim='1999-03-11', valido=true, obs=null where id=20 and premio_inicio=15 and premio_fim=5;
update public.premios_porto set mes_idx=2, data_inicio='1999-03-11', data_fim='1999-03-31', valido=true, obs=null where id=21 and premio_inicio=5 and premio_fim=0;
update public.premios_porto set mes_idx=2, data_inicio='1999-03-31', data_fim='1999-04-18', valido=true, obs=null where id=22 and premio_inicio=0 and premio_fim=-5;
update public.premios_porto set mes_idx=2, data_inicio='1999-04-18', data_fim='1999-05-08', valido=true, obs=null where id=23 and premio_inicio=-5 and premio_fim=3;
update public.premios_porto set mes_idx=2, data_inicio='1999-05-08', data_fim='1999-05-29', valido=true, obs=null where id=24 and premio_inicio=3 and premio_fim=5;
update public.premios_porto set mes_idx=2, data_inicio='1999-05-29', data_fim='1999-06-18', valido=true, obs=null where id=25 and premio_inicio=5 and premio_fim=10;
update public.premios_porto set mes_idx=2, data_inicio='1999-06-18', data_fim='1999-07-08', valido=true, obs=null where id=26 and premio_inicio=10 and premio_fim=15;
update public.premios_porto set mes_idx=2, data_inicio='1999-07-08', data_fim='1999-07-28', valido=true, obs=null where id=27 and premio_inicio=15 and premio_fim=20;
update public.premios_porto set mes_idx=2, data_inicio='1999-07-28', data_fim='1999-08-17', valido=true, obs=null where id=28 and premio_inicio=20 and premio_fim=40;
update public.premios_porto set mes_idx=2, data_inicio='1999-08-17', data_fim='1999-09-05', valido=true, obs=null where id=29 and premio_inicio=40 and premio_fim=35;
update public.premios_porto set mes_idx=2, data_inicio='1999-09-05', data_fim='1999-09-25', valido=true, obs=null where id=30 and premio_inicio=35 and premio_fim=30;
update public.premios_porto set mes_idx=2, data_inicio='1999-09-25', data_fim='1999-10-15', valido=true, obs=null where id=31 and premio_inicio=30 and premio_fim=25;
update public.premios_porto set mes_idx=2, data_inicio='1999-10-15', data_fim='1999-11-04', valido=true, obs=null where id=32 and premio_inicio=25 and premio_fim=10;
update public.premios_porto set mes_idx=2, data_inicio='1999-11-04', data_fim='1999-11-24', valido=true, obs=null where id=33 and premio_inicio=10 and premio_fim=-30;
update public.premios_porto set mes_idx=2, data_inicio='1999-11-24', data_fim='2000-01-26', valido=true, obs=null where id=34 and premio_inicio=-30 and premio_fim=-40;
update public.premios_porto set mes_idx=2, data_inicio='2000-01-26', data_fim='2000-02-13', valido=false, obs='Salto no fim da série (-40→25): provável troca de amostra' where id=35 and premio_inicio=-40 and premio_fim=25;
update public.premios_porto set mes_idx=3, data_inicio='1999-01-29', data_fim='1999-03-13', valido=true, obs=null where id=36 and premio_inicio=27 and premio_fim=5;
update public.premios_porto set mes_idx=3, data_inicio='1999-03-13', data_fim='1999-04-25', valido=true, obs=null where id=37 and premio_inicio=5 and premio_fim=7;
update public.premios_porto set mes_idx=3, data_inicio='1999-04-25', data_fim='1999-05-16', valido=true, obs=null where id=38 and premio_inicio=7 and premio_fim=-5;
update public.premios_porto set mes_idx=3, data_inicio='1999-05-16', data_fim='1999-06-06', valido=true, obs=null where id=39 and premio_inicio=-5 and premio_fim=2;
update public.premios_porto set mes_idx=3, data_inicio='1999-06-06', data_fim='1999-06-26', valido=true, obs=null where id=40 and premio_inicio=2 and premio_fim=5;
update public.premios_porto set mes_idx=3, data_inicio='1999-06-26', data_fim='1999-07-17', valido=true, obs=null where id=41 and premio_inicio=5 and premio_fim=10;
update public.premios_porto set mes_idx=3, data_inicio='1999-07-17', data_fim='1999-08-06', valido=true, obs=null where id=42 and premio_inicio=10 and premio_fim=8;
update public.premios_porto set mes_idx=3, data_inicio='1999-08-06', data_fim='1999-08-28', valido=true, obs=null where id=43 and premio_inicio=8 and premio_fim=5;
update public.premios_porto set mes_idx=3, data_inicio='1999-08-28', data_fim='1999-10-06', valido=true, obs=null where id=44 and premio_inicio=5 and premio_fim=12;
update public.premios_porto set mes_idx=3, data_inicio='1999-10-06', data_fim='1999-10-24', valido=true, obs=null where id=45 and premio_inicio=12 and premio_fim=15;
update public.premios_porto set mes_idx=3, data_inicio='1999-10-24', data_fim='1999-11-13', valido=true, obs=null where id=46 and premio_inicio=15 and premio_fim=10;
update public.premios_porto set mes_idx=3, data_inicio='1999-11-13', data_fim='1999-12-03', valido=true, obs=null where id=47 and premio_inicio=10 and premio_fim=5;
update public.premios_porto set mes_idx=3, data_inicio='1999-12-03', data_fim='1999-12-24', valido=true, obs=null where id=48 and premio_inicio=5 and premio_fim=8;
update public.premios_porto set mes_idx=3, data_inicio='1999-12-24', data_fim='2000-01-15', valido=true, obs=null where id=49 and premio_inicio=8 and premio_fim=-18;
update public.premios_porto set mes_idx=3, data_inicio='2000-01-15', data_fim='2000-03-25', valido=false, obs='Salto no fim da série (-18→40): provável troca de amostra' where id=50 and premio_inicio=-18 and premio_fim=40;
update public.premios_porto set mes_idx=3, data_inicio='2000-03-25', data_fim='2000-04-06', valido=false, obs='Fim da série com valor travado: provável 1 ano só' where id=51 and premio_inicio=40 and premio_fim=38;
update public.premios_porto set mes_idx=4, data_inicio='1999-01-29', data_fim='1999-03-17', valido=true, obs=null where id=52 and premio_inicio=28 and premio_fim=8;
update public.premios_porto set mes_idx=4, data_inicio='1999-03-17', data_fim='1999-04-18', valido=true, obs=null where id=53 and premio_inicio=8 and premio_fim=5;
update public.premios_porto set mes_idx=4, data_inicio='1999-04-18', data_fim='1999-06-03', valido=true, obs=null where id=54 and premio_inicio=5 and premio_fim=5;
update public.premios_porto set mes_idx=4, data_inicio='1999-06-03', data_fim='1999-06-24', valido=true, obs=null where id=55 and premio_inicio=5 and premio_fim=3;
update public.premios_porto set mes_idx=4, data_inicio='1999-06-24', data_fim='1999-07-17', valido=true, obs=null where id=56 and premio_inicio=3 and premio_fim=8;
update public.premios_porto set mes_idx=4, data_inicio='1999-07-17', data_fim='1999-08-07', valido=true, obs=null where id=57 and premio_inicio=8 and premio_fim=10;
update public.premios_porto set mes_idx=4, data_inicio='1999-08-07', data_fim='1999-08-28', valido=true, obs=null where id=58 and premio_inicio=10 and premio_fim=38;
update public.premios_porto set mes_idx=4, data_inicio='1999-08-28', data_fim='1999-09-19', valido=true, obs=null where id=59 and premio_inicio=38 and premio_fim=15;
update public.premios_porto set mes_idx=4, data_inicio='1999-09-19', data_fim='1999-10-31', valido=true, obs=null where id=60 and premio_inicio=15 and premio_fim=10;
update public.premios_porto set mes_idx=4, data_inicio='1999-10-31', data_fim='1999-11-21', valido=true, obs=null where id=61 and premio_inicio=10 and premio_fim=10;
update public.premios_porto set mes_idx=4, data_inicio='1999-11-21', data_fim='1999-12-12', valido=true, obs=null where id=62 and premio_inicio=10 and premio_fim=-5;
update public.premios_porto set mes_idx=4, data_inicio='1999-12-12', data_fim='2000-01-01', valido=true, obs=null where id=63 and premio_inicio=-5 and premio_fim=0;
update public.premios_porto set mes_idx=4, data_inicio='2000-01-01', data_fim='2000-01-28', valido=true, obs=null where id=64 and premio_inicio=0 and premio_fim=5;
update public.premios_porto set mes_idx=4, data_inicio='2000-01-28', data_fim='2000-04-02', valido=false, obs='Queda brusca -92: conferir imagem' where id=65 and premio_inicio=5 and premio_fim=-92;
update public.premios_porto set mes_idx=4, data_inicio='2000-04-02', data_fim='2000-04-24', valido=false, obs='Fim da série com valor travado (28): provável 1 ano só' where id=66 and premio_inicio=-92 and premio_fim=28;
update public.premios_porto set mes_idx=5, data_inicio='1999-06-05', data_fim='1999-07-28', valido=true, obs=null where id=67 and premio_inicio=35 and premio_fim=22;
update public.premios_porto set mes_idx=5, data_inicio='1999-07-28', data_fim='1999-08-13', valido=true, obs=null where id=68 and premio_inicio=22 and premio_fim=30;
update public.premios_porto set mes_idx=5, data_inicio='1999-08-13', data_fim='1999-08-29', valido=true, obs=null where id=69 and premio_inicio=30 and premio_fim=35;
update public.premios_porto set mes_idx=5, data_inicio='1999-08-29', data_fim='1999-09-17', valido=true, obs=null where id=70 and premio_inicio=35 and premio_fim=48;
update public.premios_porto set mes_idx=5, data_inicio='1999-09-17', data_fim='1999-10-10', valido=true, obs=null where id=71 and premio_inicio=48 and premio_fim=25;
update public.premios_porto set mes_idx=5, data_inicio='1999-10-10', data_fim='1999-10-21', valido=true, obs=null where id=72 and premio_inicio=25 and premio_fim=30;
update public.premios_porto set mes_idx=5, data_inicio='1999-10-21', data_fim='1999-11-06', valido=true, obs=null where id=73 and premio_inicio=30 and premio_fim=25;
update public.premios_porto set mes_idx=5, data_inicio='1999-11-06', data_fim='1999-12-10', valido=true, obs=null where id=74 and premio_inicio=25 and premio_fim=20;
update public.premios_porto set mes_idx=5, data_inicio='1999-12-10', data_fim='2000-01-16', valido=true, obs=null where id=75 and premio_inicio=20 and premio_fim=15;
update public.premios_porto set mes_idx=5, data_inicio='2000-01-16', data_fim='2000-02-01', valido=true, obs=null where id=76 and premio_inicio=15 and premio_fim=10;
update public.premios_porto set mes_idx=5, data_inicio='2000-02-01', data_fim='2000-03-02', valido=true, obs=null where id=77 and premio_inicio=10 and premio_fim=15;
update public.premios_porto set mes_idx=5, data_inicio='2000-03-02', data_fim='2000-03-26', valido=true, obs=null where id=78 and premio_inicio=15 and premio_fim=5;
update public.premios_porto set mes_idx=5, data_inicio='2000-03-26', data_fim='2000-04-14', valido=false, obs='Queda brusca -71: conferir imagem' where id=79 and premio_inicio=5 and premio_fim=-71;
update public.premios_porto set mes_idx=5, data_inicio='2000-04-14', data_fim='2000-05-01', valido=false, obs='Fim da série: conferir' where id=80 and premio_inicio=-71 and premio_fim=5;
update public.premios_porto set mes_idx=5, data_inicio='2000-05-01', data_fim='2000-05-19', valido=false, obs='Salto 5→55 no fim da série' where id=81 and premio_inicio=5 and premio_fim=55;
update public.premios_porto set mes_idx=5, data_inicio='2000-05-19', data_fim='2000-06-05', valido=false, obs='Fim da série com valor travado' where id=82 and premio_inicio=55 and premio_fim=57;
update public.premios_porto set mes_idx=6, data_inicio='1999-06-05', data_fim='1999-07-28', valido=true, obs=null where id=83 and premio_inicio=40 and premio_fim=35;
update public.premios_porto set mes_idx=6, data_inicio='1999-07-28', data_fim='1999-08-13', valido=true, obs=null where id=84 and premio_inicio=35 and premio_fim=55;
update public.premios_porto set mes_idx=6, data_inicio='1999-08-13', data_fim='1999-09-17', valido=true, obs=null where id=85 and premio_inicio=55 and premio_fim=50;
update public.premios_porto set mes_idx=6, data_inicio='1999-09-17', data_fim='1999-10-11', valido=true, obs=null where id=86 and premio_inicio=50 and premio_fim=42;
update public.premios_porto set mes_idx=6, data_inicio='1999-10-11', data_fim='1999-11-12', valido=true, obs=null where id=87 and premio_inicio=42 and premio_fim=35;
update public.premios_porto set mes_idx=6, data_inicio='1999-11-12', data_fim='1999-12-12', valido=true, obs=null where id=88 and premio_inicio=35 and premio_fim=28;
update public.premios_porto set mes_idx=6, data_inicio='1999-12-12', data_fim='2000-01-12', valido=true, obs=null where id=89 and premio_inicio=28 and premio_fim=25;
update public.premios_porto set mes_idx=6, data_inicio='2000-01-12', data_fim='2000-02-01', valido=true, obs=null where id=90 and premio_inicio=25 and premio_fim=22;
update public.premios_porto set mes_idx=6, data_inicio='2000-02-01', data_fim='2000-03-11', valido=true, obs=null where id=91 and premio_inicio=22 and premio_fim=25;
update public.premios_porto set mes_idx=6, data_inicio='2000-03-11', data_fim='2000-03-27', valido=true, obs=null where id=92 and premio_inicio=25 and premio_fim=28;
update public.premios_porto set mes_idx=6, data_inicio='2000-03-27', data_fim='2000-04-14', valido=false, obs='Queda brusca -47: conferir imagem' where id=93 and premio_inicio=28 and premio_fim=-47;
update public.premios_porto set mes_idx=6, data_inicio='2000-04-14', data_fim='2000-05-01', valido=false, obs='Fim da série: conferir' where id=94 and premio_inicio=-47 and premio_fim=7;
update public.premios_porto set mes_idx=6, data_inicio='2000-05-01', data_fim='2000-06-05', valido=false, obs='Salto 7→87 no fim da série' where id=95 and premio_inicio=7 and premio_fim=87;
update public.premios_porto set mes_idx=6, data_inicio='2000-06-05', data_fim='2000-06-23', valido=false, obs='Fim da série com valor travado' where id=96 and premio_inicio=87 and premio_fim=83;
update public.premios_porto set mes_idx=7, data_inicio='2000-03-06', data_fim='2000-03-16', valido=true, obs=null where id=97 and premio_inicio=72 and premio_fim=70;
update public.premios_porto set mes_idx=7, data_inicio='2000-03-16', data_fim='2000-03-24', valido=true, obs=null where id=98 and premio_inicio=70 and premio_fim=35;
update public.premios_porto set mes_idx=7, data_inicio='2000-03-24', data_fim='2000-04-01', valido=true, obs=null where id=99 and premio_inicio=35 and premio_fim=45;
update public.premios_porto set mes_idx=7, data_inicio='2000-04-01', data_fim='2000-04-09', valido=true, obs=null where id=100 and premio_inicio=45 and premio_fim=60;
update public.premios_porto set mes_idx=7, data_inicio='2000-04-09', data_fim='2000-04-20', valido=true, obs=null where id=101 and premio_inicio=60 and premio_fim=65;
update public.premios_porto set mes_idx=7, data_inicio='2000-04-20', data_fim='2000-04-28', valido=true, obs=null where id=102 and premio_inicio=65 and premio_fim=55;
update public.premios_porto set mes_idx=7, data_inicio='2000-04-28', data_fim='2000-05-06', valido=true, obs=null where id=103 and premio_inicio=55 and premio_fim=50;
update public.premios_porto set mes_idx=7, data_inicio='2000-05-06', data_fim='2000-05-25', valido=true, obs=null where id=104 and premio_inicio=50 and premio_fim=55;
update public.premios_porto set mes_idx=7, data_inicio='2000-05-25', data_fim='2000-06-02', valido=true, obs=null where id=105 and premio_inicio=55 and premio_fim=60;
update public.premios_porto set mes_idx=7, data_inicio='2000-06-02', data_fim='2000-06-18', valido=true, obs=null where id=106 and premio_inicio=60 and premio_fim=55;
update public.premios_porto set mes_idx=7, data_inicio='2000-06-18', data_fim='2000-06-26', valido=true, obs=null where id=107 and premio_inicio=55 and premio_fim=65;
update public.premios_porto set mes_idx=7, data_inicio='2000-06-26', data_fim='2000-07-06', valido=true, obs=null where id=108 and premio_inicio=65 and premio_fim=55;
update public.premios_porto set mes_idx=7, data_inicio='2000-07-06', data_fim='2000-07-14', valido=true, obs=null where id=109 and premio_inicio=55 and premio_fim=50;
update public.premios_porto set mes_idx=7, data_inicio='2000-07-14', data_fim='2000-07-22', valido=true, obs=null where id=110 and premio_inicio=50 and premio_fim=55;
update public.premios_porto set mes_idx=7, data_inicio='2000-07-22', data_fim='2000-07-30', valido=false, obs='Salto 55→135 em 8 dias: conferir' where id=111 and premio_inicio=55 and premio_fim=135;
update public.premios_porto set mes_idx=8, data_inicio='2000-04-30', data_fim='2000-05-06', valido=true, obs=null where id=112 and premio_inicio=50 and premio_fim=50;
update public.premios_porto set mes_idx=8, data_inicio='2000-05-06', data_fim='2000-05-12', valido=true, obs=null where id=113 and premio_inicio=50 and premio_fim=58;
update public.premios_porto set mes_idx=8, data_inicio='2000-05-12', data_fim='2000-06-17', valido=true, obs=null where id=114 and premio_inicio=58 and premio_fim=95;
update public.premios_porto set mes_idx=8, data_inicio='2000-06-17', data_fim='2000-06-23', valido=true, obs=null where id=115 and premio_inicio=95 and premio_fim=35;
update public.premios_porto set mes_idx=8, data_inicio='2000-06-23', data_fim='2000-06-29', valido=true, obs=null where id=116 and premio_inicio=35 and premio_fim=65;
update public.premios_porto set mes_idx=8, data_inicio='2000-06-29', data_fim='2000-07-03', valido=true, obs=null where id=117 and premio_inicio=65 and premio_fim=70;
update public.premios_porto set mes_idx=8, data_inicio='2000-07-03', data_fim='2000-07-09', valido=true, obs=null where id=118 and premio_inicio=70 and premio_fim=78;
update public.premios_porto set mes_idx=8, data_inicio='2000-07-09', data_fim='2000-07-21', valido=true, obs=null where id=119 and premio_inicio=78 and premio_fim=90;
update public.premios_porto set mes_idx=8, data_inicio='2000-07-21', data_fim='2000-07-27', valido=true, obs=null where id=120 and premio_inicio=90 and premio_fim=100;
update public.premios_porto set mes_idx=8, data_inicio='2000-07-27', data_fim='2000-07-31', valido=true, obs=null where id=121 and premio_inicio=100 and premio_fim=113;
update public.premios_porto set mes_idx=8, data_inicio='2000-07-31', data_fim='2000-08-06', valido=true, obs=null where id=122 and premio_inicio=113 and premio_fim=118;
update public.premios_porto set mes_idx=8, data_inicio='2000-08-06', data_fim='2000-08-12', valido=true, obs=null where id=123 and premio_inicio=118 and premio_fim=128;
update public.premios_porto set mes_idx=8, data_inicio='2000-08-12', data_fim='2000-08-18', valido=true, obs=null where id=124 and premio_inicio=128 and premio_fim=153;
update public.premios_porto set mes_idx=8, data_inicio='2000-08-18', data_fim='2000-08-24', valido=true, obs=null where id=125 and premio_inicio=153 and premio_fim=158;
update public.premios_porto set mes_idx=8, data_inicio='2000-08-24', data_fim='2000-08-28', valido=true, obs=null where id=126 and premio_inicio=158 and premio_fim=150;
update public.premios_porto set mes_idx=9, data_inicio='2000-07-23', data_fim='2000-07-28', valido=true, obs=null where id=127 and premio_inicio=140 and premio_fim=135;
update public.premios_porto set mes_idx=9, data_inicio='2000-07-28', data_fim='2000-07-31', valido=true, obs=null where id=128 and premio_inicio=135 and premio_fim=130;
update public.premios_porto set mes_idx=9, data_inicio='2000-07-31', data_fim='2000-08-05', valido=true, obs=null where id=129 and premio_inicio=130 and premio_fim=125;
update public.premios_porto set mes_idx=9, data_inicio='2000-08-05', data_fim='2000-08-10', valido=true, obs=null where id=130 and premio_inicio=125 and premio_fim=130;
update public.premios_porto set mes_idx=9, data_inicio='2000-08-10', data_fim='2000-08-13', valido=true, obs=null where id=131 and premio_inicio=130 and premio_fim=120;
update public.premios_porto set mes_idx=9, data_inicio='2000-08-13', data_fim='2000-08-18', valido=true, obs=null where id=132 and premio_inicio=120 and premio_fim=135;
update public.premios_porto set mes_idx=9, data_inicio='2000-08-18', data_fim='2000-08-21', valido=true, obs=null where id=133 and premio_inicio=135 and premio_fim=130;
update public.premios_porto set mes_idx=9, data_inicio='2000-08-21', data_fim='2000-08-26', valido=true, obs=null where id=134 and premio_inicio=130 and premio_fim=170;
update public.premios_porto set mes_idx=9, data_inicio='2000-08-26', data_fim='2000-08-28', valido=true, obs=null where id=135 and premio_inicio=170 and premio_fim=163;
update public.premios_porto set mes_idx=9, data_inicio='2000-08-28', data_fim='2000-09-04', valido=true, obs=null where id=136 and premio_inicio=163 and premio_fim=155;
update public.premios_porto set mes_idx=9, data_inicio='2000-09-04', data_fim='2000-09-09', valido=true, obs=null where id=137 and premio_inicio=155 and premio_fim=160;
update public.premios_porto set mes_idx=9, data_inicio='2000-09-09', data_fim='2000-09-14', valido=true, obs=null where id=138 and premio_inicio=160 and premio_fim=150;
update public.premios_porto set mes_idx=9, data_inicio='2000-09-14', data_fim='2000-09-19', valido=true, obs=null where id=139 and premio_inicio=150 and premio_fim=145;
update public.premios_porto set mes_idx=9, data_inicio='2000-09-19', data_fim='2000-09-22', valido=true, obs=null where id=140 and premio_inicio=145 and premio_fim=115;
update public.premios_porto set mes_idx=9, data_inicio='2000-09-22', data_fim='2000-09-25', valido=true, obs=null where id=141 and premio_inicio=115 and premio_fim=130;
update public.premios_porto set mes_idx=9, data_inicio='2000-09-25', data_fim='2000-09-30', valido=true, obs=null where id=142 and premio_inicio=130 and premio_fim=128;
update public.premios_porto set mes_idx=9, data_inicio='2000-09-30', data_fim='2000-10-05', valido=true, obs=null where id=143 and premio_inicio=128 and premio_fim=135;
update public.premios_porto set mes_idx=9, data_inicio='2000-10-05', data_fim='2000-10-08', valido=true, obs=null where id=144 and premio_inicio=135 and premio_fim=163;
update public.premios_porto set mes_idx=9, data_inicio='2000-10-08', data_fim='2000-10-13', valido=true, obs=null where id=145 and premio_inicio=163 and premio_fim=175;
update public.premios_porto set mes_idx=10, data_inicio='2000-08-07', data_fim='2000-08-24', valido=true, obs=null where id=146 and premio_inicio=120 and premio_fim=122;
update public.premios_porto set mes_idx=10, data_inicio='2000-08-24', data_fim='2000-08-28', valido=true, obs=null where id=147 and premio_inicio=122 and premio_fim=125;
update public.premios_porto set mes_idx=10, data_inicio='2000-08-28', data_fim='2000-09-02', valido=true, obs=null where id=148 and premio_inicio=125 and premio_fim=130;
update public.premios_porto set mes_idx=10, data_inicio='2000-09-02', data_fim='2000-09-08', valido=true, obs=null where id=149 and premio_inicio=130 and premio_fim=128;
update public.premios_porto set mes_idx=10, data_inicio='2000-09-08', data_fim='2000-09-11', valido=true, obs=null where id=150 and premio_inicio=128 and premio_fim=135;
update public.premios_porto set mes_idx=10, data_inicio='2000-09-11', data_fim='2000-09-16', valido=true, obs=null where id=151 and premio_inicio=135 and premio_fim=165;
update public.premios_porto set mes_idx=10, data_inicio='2000-09-16', data_fim='2000-09-21', valido=true, obs=null where id=152 and premio_inicio=165 and premio_fim=135;
update public.premios_porto set mes_idx=10, data_inicio='2000-09-21', data_fim='2000-09-24', valido=true, obs=null where id=153 and premio_inicio=135 and premio_fim=140;
update public.premios_porto set mes_idx=10, data_inicio='2000-09-24', data_fim='2000-09-29', valido=true, obs=null where id=154 and premio_inicio=140 and premio_fim=145;
update public.premios_porto set mes_idx=10, data_inicio='2000-09-29', data_fim='2000-10-02', valido=true, obs=null where id=155 and premio_inicio=145 and premio_fim=150;
update public.premios_porto set mes_idx=10, data_inicio='2000-10-02', data_fim='2000-10-07', valido=true, obs=null where id=156 and premio_inicio=150 and premio_fim=128;
update public.premios_porto set mes_idx=10, data_inicio='2000-10-07', data_fim='2000-10-12', valido=true, obs=null where id=157 and premio_inicio=128 and premio_fim=135;
update public.premios_porto set mes_idx=10, data_inicio='2000-10-12', data_fim='2000-10-15', valido=true, obs=null where id=158 and premio_inicio=135 and premio_fim=128;
update public.premios_porto set mes_idx=10, data_inicio='2000-10-15', data_fim='2000-10-20', valido=true, obs=null where id=159 and premio_inicio=128 and premio_fim=124;
update public.premios_porto set mes_idx=10, data_inicio='2000-10-20', data_fim='2000-10-23', valido=true, obs=null where id=160 and premio_inicio=124 and premio_fim=119;
update public.premios_porto set mes_idx=10, data_inicio='2000-10-23', data_fim='2000-10-30', valido=true, obs=null where id=161 and premio_inicio=119 and premio_fim=74;
update public.premios_porto set mes_idx=11, data_inicio='2000-09-22', data_fim='2000-09-28', valido=true, obs=null where id=162 and premio_inicio=120 and premio_fim=110;
update public.premios_porto set mes_idx=11, data_inicio='2000-09-28', data_fim='2000-10-28', valido=true, obs=null where id=163 and premio_inicio=110 and premio_fim=76;
update public.premios_porto set mes_idx=11, data_inicio='2000-10-28', data_fim='2000-10-30', valido=true, obs=null where id=164 and premio_inicio=76 and premio_fim=68;
update public.premios_porto set mes_idx=11, data_inicio='2000-10-30', data_fim='2000-11-02', valido=true, obs=null where id=165 and premio_inicio=68 and premio_fim=70;
update public.premios_porto set mes_idx=11, data_inicio='2000-11-02', data_fim='2000-11-03', valido=true, obs=null where id=166 and premio_inicio=70 and premio_fim=72;
update public.premios_porto set mes_idx=11, data_inicio='2000-11-03', data_fim='2000-11-23', valido=true, obs=null where id=167 and premio_inicio=72 and premio_fim=86;
update public.premios_porto set mes_idx=11, data_inicio='2000-11-23', data_fim='2000-11-25', valido=true, obs=null where id=168 and premio_inicio=86 and premio_fim=90;

create index if not exists premios_porto_busca_idx
  on public.premios_porto (porto, produto, mes_idx, data_inicio, data_fim);

-- Conferência obrigatória: as 168 linhas têm de ter sido datadas.
do $$
declare v_ok int; v_tot int; v_ids text;
begin
  select count(*) filter (where mes_idx is not null and data_inicio is not null and data_fim is not null),
         count(*),
         string_agg(id::text, ',' order by id) filter (where mes_idx is null or data_inicio is null or data_fim is null)
    into v_ok, v_tot, v_ids
    from public.premios_porto;
  if v_ok <> 168 or v_tot <> 168 then
    raise exception 'premios_porto: % de % linhas datadas (esperado 168/168). IDs sem data: %', v_ok, v_tot, coalesce(v_ids, '-');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) Parâmetros (nada fixo no código)
-- ---------------------------------------------------------------------
create table if not exists public.premios_parametros (
  chave     text primary key,
  valor     numeric not null,
  descricao text
);
insert into public.premios_parametros (chave, valor, descricao) values
  ('peso_stonex',            3,  'Peso da média StoneX na média combinada (= nº de anos da base StoneX 2023-2025)'),
  ('gap_max_dias',          10,  'Buraco máximo (dias) entre dois lançamentos próprios para interpolar'),
  ('alerta_var',            30,  'Variação (c/bu) acima da qual o lançamento fica com conferir = true'),
  ('alerta_margem_faixa',   30,  'Margem (c/bu) fora de [mín, máx] do segmento StoneX que marca conferir = true'),
  ('dias_lancamento_antigo', 3,  'Lançamento com mais de N dias é sinalizado no painel')
on conflict (chave) do nothing;
alter table public.premios_parametros enable row level security;
drop policy if exists public_read_premios_parametros on public.premios_parametros;
create policy public_read_premios_parametros on public.premios_parametros for select using (true);
grant select on public.premios_parametros to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3) premios_atual: fonte + faixa de sanidade + updated_at no UPDATE
-- ---------------------------------------------------------------------
alter table public.premios_atual add column if not exists fonte text;

alter table public.premios_atual drop constraint if exists premios_atual_venda_faixa_chk;
alter table public.premios_atual
  add constraint premios_atual_venda_faixa_chk check (venda between -300 and 400);

-- updated_at: o app já envia updated_at; outros gravadores (SQL manual, scripts)
-- podem não enviar. Só preenche com now() quando o UPDATE não mexeu na coluna
-- (assim um valor explícito — ex.: lançamento retroativo — é respeitado).
create or replace function public.fn_premios_atual_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_premios_atual_updated_at on public.premios_atual;
create trigger trg_premios_atual_updated_at
before update on public.premios_atual
for each row execute function public.fn_premios_atual_updated_at();

-- ---------------------------------------------------------------------
-- 4) premios_historico: produto + auditoria + validação
-- ---------------------------------------------------------------------
alter table public.premios_historico
  add column if not exists produto         text not null default 'Soja',
  add column if not exists lancado_por     uuid,
  add column if not exists lancado_em      timestamptz,
  add column if not exists origem          text,         -- papel que gravou (service_role, authenticated, postgres…)
  add column if not exists fonte           text,         -- StoneX, corretora, trading…
  add column if not exists conferir        boolean not null default false,
  add column if not exists motivo_conferir text,
  add column if not exists var_calc        numeric,      -- variação vs. lançamento anterior (calculada)
  add column if not exists revisado_em     timestamptz,
  add column if not exists revisado_por    text;

-- linhas antigas: lancado_em = created_at (não a data da migração)
update public.premios_historico set lancado_em = created_at where lancado_em is null;
alter table public.premios_historico alter column lancado_por set default auth.uid();
alter table public.premios_historico alter column lancado_em  set default now();

alter table public.premios_historico drop constraint if exists premios_historico_premio_faixa_chk;
alter table public.premios_historico
  add constraint premios_historico_premio_faixa_chk check (premio between -300 and 400);

-- chave nova (com produto). A antiga continua até a migração 2/2.
alter table public.premios_historico drop constraint if exists premios_historico_uk;
alter table public.premios_historico
  add constraint premios_historico_uk unique (data_ref, mes_idx, ano, produto, porto);

create index if not exists premios_historico_busca_idx
  on public.premios_historico (porto, produto, mes_idx, ano, data_ref);

-- ---------------------------------------------------------------------
-- 5) Referência histórica StoneX para uma data de negociação
--    Interpola linearmente o segmento (inicio -> fim) que contém a data.
-- ---------------------------------------------------------------------
create or replace function public.premio_referencia(
  p_porto text, p_produto text, p_mes_idx int, p_ano int, p_data date)
returns table (segmento_id int, data_base date,
               premio_medio numeric, premio_min numeric, premio_max numeric)
language sql
stable
set search_path = public
as $$
  with b as (
    select (make_date(2000 + (extract(year from p_data)::int - p_ano),
                      extract(month from p_data)::int, 1)
            + (extract(day from p_data)::int - 1))::date as d
    where 2000 + (extract(year from p_data)::int - p_ano) between 1999 and 2000
  )
  select s.id,
         b.d,
         round(s.premio_inicio + (s.premio_fim - s.premio_inicio)
               * (b.d - s.data_inicio)::numeric
               / greatest(s.data_fim - s.data_inicio, 1), 1),
         s.premio_min,
         s.premio_max
  from b
  join public.premios_porto s
    on s.porto = p_porto
   and s.produto = p_produto
   and s.mes_idx = p_mes_idx
   and s.valido
   and b.d between s.data_inicio and s.data_fim
  order by s.data_inicio desc
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- 6) Trigger premios_atual -> premios_historico (com auditoria e alerta)
--    1 linha por dia (America/Sao_Paulo) / mês / ano / produto / porto.
--    Relançar no mesmo dia atualiza, não duplica.
-- ---------------------------------------------------------------------
create or replace function public.fn_premio_atual_para_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data     date := (coalesce(new.updated_at, now()) at time zone 'America/Sao_Paulo')::date;
  v_porto    text := coalesce(new.porto, 'Paranaguá');
  v_produto  text := coalesce(new.produto, 'Soja');
  v_alerta   numeric := coalesce((select valor from public.premios_parametros where chave = 'alerta_var'), 30);
  v_margem   numeric := coalesce((select valor from public.premios_parametros where chave = 'alerta_margem_faixa'), 30);
  v_prev     numeric;
  v_prev_dt  date;
  v_var      numeric;
  v_ref      record;
  v_motivos  text[] := '{}';
  v_mudou    boolean := (tg_op = 'INSERT') or (new.venda is distinct from old.venda);
  v_origem   text := coalesce(
                nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role',
                nullif(current_setting('request.jwt.claim.role', true), ''),
                nullif(current_setting('role', true), 'none'),   -- papel do chamador (a função é security definer)
                session_user::text);
begin
  -- último lançamento ANTERIOR ao dia (para a variação calculada)
  select h.premio, h.data_ref into v_prev, v_prev_dt
    from public.premios_historico h
   where h.porto = v_porto and h.produto = v_produto
     and h.mes_idx = new.mes_idx and h.ano = new.ano
     and h.data_ref < v_data
   order by h.data_ref desc
   limit 1;
  v_var := new.venda - v_prev;

  if v_mudou and abs(coalesce(new.var_dia, 0)) > v_alerta then
    v_motivos := v_motivos || format('Var. dia informada %s c/bu', new.var_dia);
  end if;
  if v_var is not null and abs(v_var) > v_alerta then
    v_motivos := v_motivos || format('Variação de %s c/bu vs. lançamento de %s', round(v_var, 1), to_char(v_prev_dt, 'DD/MM/YYYY'));
  end if;

  select * into v_ref from public.premio_referencia(v_porto, v_produto, new.mes_idx, new.ano, v_data);
  if v_ref.premio_medio is not null
     and (new.venda < v_ref.premio_min - v_margem or new.venda > v_ref.premio_max + v_margem) then
    v_motivos := v_motivos || format('Fora da faixa histórica [%s; %s] ± %s', v_ref.premio_min, v_ref.premio_max, v_margem);
  end if;

  insert into public.premios_historico as h
    (data_ref, mes_idx, ano, contrato, premio, porto, produto,
     lancado_por, lancado_em, origem, fonte, conferir, motivo_conferir, var_calc)
  values
    (v_data, new.mes_idx, new.ano, new.contrato, new.venda, v_porto, v_produto,
     auth.uid(), now(), v_origem, new.fonte,
     cardinality(v_motivos) > 0, nullif(array_to_string(v_motivos, ' | '), ''), v_var)
  on conflict (data_ref, mes_idx, ano, produto, porto)
  do update set
     contrato    = excluded.contrato,
     premio      = excluded.premio,
     fonte       = coalesce(excluded.fonte, h.fonte),
     lancado_por = excluded.lancado_por,
     lancado_em  = excluded.lancado_em,
     origem      = excluded.origem,
     var_calc    = excluded.var_calc,
     -- valor igual ao já gravado: preserva a conferência/revisão existente
     conferir        = case when h.premio = excluded.premio then h.conferir        else excluded.conferir        end,
     motivo_conferir = case when h.premio = excluded.premio then h.motivo_conferir else excluded.motivo_conferir end,
     revisado_em     = case when h.premio = excluded.premio then h.revisado_em     else null end,
     revisado_por    = case when h.premio = excluded.premio then h.revisado_por    else null end;
  return new;
end;
$$;

drop trigger if exists trg_premio_atual_para_historico on public.premios_atual;
create trigger trg_premio_atual_para_historico
after insert or update of venda, contrato on public.premios_atual
for each row execute function public.fn_premio_atual_para_historico();

-- ---------------------------------------------------------------------
-- 7) Views de avaliação vs. StoneX (partes 4/5 do arquivo original)
--    tolerância "na média" = maior entre 5 c/bu e 15% da amplitude do segmento
-- ---------------------------------------------------------------------
create or replace view public.vw_premios_avaliacao
with (security_invoker = on) as
select h.data_ref, h.porto, h.produto, h.mes_idx, h.ano, h.contrato,
       h.premio                           as premio_lancado,
       r.premio_medio, r.premio_min, r.premio_max,
       round(h.premio - r.premio_medio, 1) as desvio_media,
       case when r.premio_max > r.premio_min
            then round(100 * (h.premio - r.premio_min) / (r.premio_max - r.premio_min))
       end                                 as posicao_faixa_pct,
       case
         when r.premio_medio is null            then 'Sem referência histórica'
         when h.premio <  r.premio_min          then 'Abaixo da mínima histórica'
         when h.premio >  r.premio_max          then 'Acima da máxima histórica'
         when h.premio <  r.premio_medio - t.tol then 'Abaixo da média'
         when h.premio >  r.premio_medio + t.tol then 'Acima da média'
         else 'Na média'
       end                                 as leitura
from public.premios_historico h
left join lateral public.premio_referencia(h.porto, h.produto, h.mes_idx, h.ano, h.data_ref) r on true
left join lateral (select greatest(5, 0.15 * (r.premio_max - r.premio_min)) as tol) t on true;

create or replace view public.vw_premios_atual_avaliacao
with (security_invoker = on) as
select a.porto, a.produto, a.mes_idx, a.ano, a.contrato,
       (a.updated_at at time zone 'America/Sao_Paulo')::date as data_ref,
       a.venda as premio_lancado, a.var_dia,
       r.premio_medio, r.premio_min, r.premio_max,
       round(a.venda - r.premio_medio, 1) as desvio_media,
       case when r.premio_max > r.premio_min
            then round(100 * (a.venda - r.premio_min) / (r.premio_max - r.premio_min))
       end as posicao_faixa_pct,
       case
         when r.premio_medio is null            then 'Sem referência histórica'
         when a.venda <  r.premio_min           then 'Abaixo da mínima histórica'
         when a.venda >  r.premio_max           then 'Acima da máxima histórica'
         when a.venda <  r.premio_medio - t.tol then 'Abaixo da média'
         when a.venda >  r.premio_medio + t.tol then 'Acima da média'
         else 'Na média'
       end as leitura
from public.premios_atual a
left join lateral public.premio_referencia(a.porto, a.produto, a.mes_idx, a.ano,
       (a.updated_at at time zone 'America/Sao_Paulo')::date) r on true
left join lateral (select greatest(5, 0.15 * (r.premio_max - r.premio_min)) as tol) t on true;

-- ---------------------------------------------------------------------
-- 8) Média viva: StoneX + lançamentos próprios de safras ENCERRADAS
--    (não altera premio_referencia)
-- ---------------------------------------------------------------------
create or replace function public.premio_referencia_combinada(
  p_porto text, p_produto text, p_mes_idx int, p_ano int, p_data date)
returns table (
  media_stonex numeric, stonex_min numeric, stonex_max numeric, base_stonex text,
  media_propria numeric, n_anos_proprios int, anos_proprios int[],
  peso_stonex numeric, media_combinada numeric, faixa_min numeric, faixa_max numeric,
  base_label text)
language sql
stable
set search_path = public
as $$
  with par as (
    select coalesce((select valor from premios_parametros where chave = 'peso_stonex'), 3)  as peso,
           coalesce((select valor from premios_parametros where chave = 'gap_max_dias'), 10) as gap
  ),
  sx as (
    select r.premio_medio, r.premio_min, r.premio_max,
           (select s.base_anos from premios_porto s where s.id = r.segmento_id) as base_anos
      from premio_referencia(p_porto, p_produto, p_mes_idx, p_ano, p_data) r
  ),
  -- anos próprios: entrega ANTERIOR à avaliada e já encerrada na data da avaliação
  -- (o lançamento da safra em curso nunca entra na média que avalia a si mesmo)
  anos as (
    select distinct h.ano as y
      from premios_historico h
     where h.porto = p_porto and h.produto = p_produto and h.mes_idx = p_mes_idx
       and h.ano < p_ano
       and (make_date(h.ano, p_mes_idx + 1, 1) + interval '1 month')::date <= p_data
  ),
  alvo as (  -- mesma posição no calendário de negociação, deslocada para o ano y
    select a.y,
           (make_date(extract(year from p_data)::int + (a.y - p_ano), extract(month from p_data)::int, 1)
            + (extract(day from p_data)::int - 1))::date as d
      from anos a
  ),
  proprio as (
    select t.y,
           coalesce(
             ex.premio,
             case when pv.data_ref is not null and nx.data_ref is not null
                       and (nx.data_ref - pv.data_ref) <= (select gap from par)
                  then pv.premio + (nx.premio - pv.premio) * (t.d - pv.data_ref)::numeric
                                   / greatest(nx.data_ref - pv.data_ref, 1)
             end) as valor
      from alvo t
      left join lateral (select h.premio from premios_historico h
                          where h.porto = p_porto and h.produto = p_produto and h.mes_idx = p_mes_idx
                            and h.ano = t.y and h.data_ref = t.d and not h.conferir) ex on true
      left join lateral (select h.premio, h.data_ref from premios_historico h
                          where h.porto = p_porto and h.produto = p_produto and h.mes_idx = p_mes_idx
                            and h.ano = t.y and h.data_ref < t.d and not h.conferir
                          order by h.data_ref desc limit 1) pv on true
      left join lateral (select h.premio, h.data_ref from premios_historico h
                          where h.porto = p_porto and h.produto = p_produto and h.mes_idx = p_mes_idx
                            and h.ano = t.y and h.data_ref > t.d and not h.conferir
                          order by h.data_ref asc limit 1) nx on true
  ),
  agg as (
    select avg(valor) as media, count(*)::int as n, sum(valor) as soma,
           min(valor) as vmin, max(valor) as vmax,
           array_agg(y order by y) as anos
      from proprio where valor is not null
  )
  select
    sx.premio_medio,
    sx.premio_min,
    sx.premio_max,
    sx.base_anos,
    round(agg.media, 1),
    coalesce(agg.n, 0),
    coalesce(agg.anos, '{}'::int[]),
    par.peso,
    round(case
            when sx.premio_medio is not null
              then (sx.premio_medio * par.peso + coalesce(agg.soma, 0)) / (par.peso + coalesce(agg.n, 0))
            when agg.n > 0 then agg.media
          end, 1),
    round(least(sx.premio_min, agg.vmin), 1),
    round(greatest(sx.premio_max, agg.vmax), 1),
    case
      when sx.premio_medio is null and coalesce(agg.n, 0) = 0 then null
      else
        'Média '
        || (select case when lo = hi then lo::text else lo || '–' || hi end
              from (select least(coalesce(split_part(sx.base_anos, '-', 1)::int, 9999), coalesce(agg.anos[1], 9999)) as lo,
                           greatest(coalesce(split_part(sx.base_anos, '-', 2)::int, 0),
                                    coalesce(agg.anos[array_length(agg.anos, 1)], 0)) as hi) x)
        || ' ('
        || concat_ws(' + ',
             case when sx.premio_medio is not null
                  then 'StoneX ' || split_part(sx.base_anos, '-', 1) || '–' || right(split_part(sx.base_anos, '-', 2), 2) end,
             case when coalesce(agg.n, 0) > 0
                  then 'BZ ' || array_to_string(agg.anos, ', ') end)
        || ')'
    end
  from par
  left join sx  on true
  left join agg on true;
$$;

-- leitura padronizada (mesmas regras das views StoneX)
create or replace function public.premio_leitura(p_valor numeric, p_media numeric, p_min numeric, p_max numeric)
returns text language sql immutable set search_path = public as $$
  select case
    when p_media is null or p_valor is null then 'Sem referência histórica'
    when p_valor < p_min then 'Abaixo da mínima histórica'
    when p_valor > p_max then 'Acima da máxima histórica'
    when p_valor < p_media - greatest(5, 0.15 * (p_max - p_min)) then 'Abaixo da média'
    when p_valor > p_media + greatest(5, 0.15 * (p_max - p_min)) then 'Acima da média'
    else 'Na média'
  end
$$;

create or replace view public.vw_premios_atual_avaliacao_combinada
with (security_invoker = on) as
with base as (
  select a.*, (a.updated_at at time zone 'America/Sao_Paulo')::date as data_ref
    from public.premios_atual a
)
select a.porto, a.produto, a.mes_idx, a.ano, a.contrato, a.fonte,
       a.data_ref,
       ((now() at time zone 'America/Sao_Paulo')::date - a.data_ref) as dias_desde_lancamento,
       ((now() at time zone 'America/Sao_Paulo')::date - a.data_ref)
         > coalesce((select valor from public.premios_parametros where chave = 'dias_lancamento_antigo'), 3)
                                                     as lancamento_antigo,
       a.venda as premio_lancado, a.var_dia,
       c.media_stonex, c.media_propria, c.n_anos_proprios, c.anos_proprios,
       c.media_combinada, c.faixa_min, c.faixa_max, c.base_label,
       round(a.venda - c.media_combinada, 1) as desvio_media,
       case when c.faixa_max > c.faixa_min
            then round(100 * (a.venda - c.faixa_min) / (c.faixa_max - c.faixa_min)) end as posicao_faixa_pct,
       public.premio_leitura(a.venda, c.media_combinada, c.faixa_min, c.faixa_max) as leitura,
       coalesce(h.conferir, false) as conferir,
       h.motivo_conferir
from base a
left join lateral public.premio_referencia_combinada(
       coalesce(a.porto, 'Paranaguá'), coalesce(a.produto, 'Soja'), a.mes_idx, a.ano, a.data_ref) c on true
left join public.premios_historico h
       on h.data_ref = a.data_ref and h.mes_idx = a.mes_idx and h.ano = a.ano
      and h.produto = coalesce(a.produto, 'Soja') and h.porto = coalesce(a.porto, 'Paranaguá');

grant select on public.vw_premios_avaliacao, public.vw_premios_atual_avaliacao,
                public.vw_premios_atual_avaliacao_combinada to anon, authenticated, service_role;

-- Funções de trigger não ficam expostas via /rest/v1/rpc (linter 0028/0029).
-- Os triggers continuam disparando (EXECUTE só é checado ao criar o trigger).
revoke execute on function public.fn_premio_atual_para_historico() from public, anon, authenticated;
revoke execute on function public.fn_premios_atual_updated_at() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
