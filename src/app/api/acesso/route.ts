import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Janela para não contar recarregamento de página como acesso novo (minutos).
const JANELA_MIN = 30;

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    if (!token) return NextResponse.json({ success: false }, { status: 400 });

    // Confirma de quem é a sessão pelo próprio token: ninguém registra acesso por outro.
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return NextResponse.json({ success: false }, { status: 401 });
    const uid = userData.user.id;

    const { data: prof } = await supabase
      .from("profiles")
      .select("ultimo_acesso, acessos_total")
      .eq("id", uid)
      .single();

    const agora = new Date();
    const ultimo = prof?.ultimo_acesso ? new Date(prof.ultimo_acesso) : null;
    const minutosDesde = ultimo ? (agora.getTime() - ultimo.getTime()) / 60000 : Infinity;

    if (minutosDesde < JANELA_MIN) {
      // Mesma sessão (reload, voltar pra aba): atualiza só o horário, não soma acesso.
      await supabase.from("profiles").update({ ultimo_acesso: agora.toISOString() }).eq("id", uid);
      return NextResponse.json({ success: true, contou: false });
    }

    await supabase
      .from("profiles")
      .update({ ultimo_acesso: agora.toISOString(), acessos_total: (prof?.acessos_total || 0) + 1 })
      .eq("id", uid);

    return NextResponse.json({ success: true, contou: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
