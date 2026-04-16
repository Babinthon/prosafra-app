# ProSafra — O que realmente vale seu grão

Plataforma de inteligência de preço para produtores de grãos no Brasil.

## Stack
- **Frontend:** Next.js 16 + React 19 + TypeScript
- **Backend:** Supabase (PostgreSQL, Auth, RLS)
- **APIs:** TradingView Data (RapidAPI), USDA PSD, CFTC COT, BCB Ptax
- **Deploy:** Vercel

## Setup local
```bash
npm install
npm run dev
```

## Variáveis de ambiente
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
TRADINGVIEW_API_KEY=
```
