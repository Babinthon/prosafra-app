"use client";
import { useState, useEffect } from "react";
import { supabase } from "./supabase";

export function useCotacoes(fallback: Record<string, any>) {
  const [cotacoes, setCotacoes] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCotacoes() {
      try {
        const { data, error } = await supabase
          .from("cotacoes_mercado")
          .select("symbol, last_price, change_val, change_pct, high, low, volume, updated_at")
          .order("updated_at", { ascending: false });

        if (error || !data || data.length === 0) {
          // Use fallback (hardcoded)
          setLoading(false);
          return;
        }

        const mapped: Record<string, any> = {};
        data.forEach((row) => {
          mapped[row.symbol] = {
            lp: row.last_price,
            ch: row.change_val,
            chp: row.change_pct,
            hi: row.high,
            lo: row.low,
            vol: row.volume,
          };
        });

        setCotacoes(mapped);
        setLastUpdate(data[0]?.updated_at || null);
      } catch (e) {
        console.error("Failed to fetch cotacoes:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchCotacoes();

    // Refresh every 10 minutes
    const interval = setInterval(fetchCotacoes, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { cotacoes, loading, lastUpdate };
}
