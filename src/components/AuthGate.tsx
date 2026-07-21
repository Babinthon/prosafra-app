"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import ProSafraApp from "./ProSafraApp";

// Domínio interno usado para montar o "e-mail etiqueta" quando o login é por nome de usuário.
const DOMAIN = "bazamagro.com.br";

const C = {
  gold: "#D5A246", bronze: "#B67A33", brown: "#4A2C16", brownDeep: "#4A2C16",
  bg: "#F7F7F5", surface: "#FFFFFF", surfaceAlt: "#FCFBF9", border: "#ECE7DD",
  text: "#2E2620", textMute: "#8A7E6F", textFaint: "#A89C8A", down: "#B0503F", goldSoft: "#FBF4E6",
};

const inpStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: C.surfaceAlt,
  border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
  padding: "10px 12px", fontSize: 14, outline: "none",
};

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui,-apple-system,sans-serif" }}>
      {children}
    </div>
  );
}

function Brand() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
      <img src="/bzgraos-emblem.svg" alt="BZ Grãos" width={54} height={54} style={{ display: "block" }} />
      <div style={{ fontSize: 19, fontWeight: 700, marginTop: 10, letterSpacing: "-0.01em" }}>
        <span style={{ color: C.brownDeep }}>BZ</span> <span style={{ color: C.bronze }}>Grãos</span>
      </div>
      <div style={{ fontSize: 9, color: C.textFaint, letterSpacing: "0.06em", marginTop: 2 }}>BAZAM AGRONEGÓCIOS</div>
    </div>
  );
}

function Login() {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!id.trim() || !pw) { setErr("Preencha usuário e senha."); return; }
    setLoading(true); setErr("");
    const email = id.includes("@") ? id.trim() : `${id.trim().toLowerCase()}@${DOMAIN}`;
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) { setErr("Usuário ou senha inválidos."); setLoading(false); }
    // Em caso de sucesso, o onAuthStateChange do AuthGate assume a partir daqui.
  };

  return (
    <Screen>
      <div style={{ width: "100%", maxWidth: 360, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "32px 28px", boxShadow: "0 8px 40px rgba(74,44,22,0.08)" }}>
        <Brand />
        <label style={{ fontSize: 10, color: C.textMute, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>Usuário ou e-mail</label>
        <input value={id} onChange={e => setId(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); }} autoFocus style={inpStyle} />
        <label style={{ fontSize: 10, color: C.textMute, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", margin: "14px 0 5px" }}>Senha</label>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); }} style={inpStyle} />
        {err && <div style={{ color: C.down, fontSize: 12, marginTop: 12 }}>{err}</div>}
        <button onClick={submit} disabled={loading} style={{ width: "100%", marginTop: 20, padding: "11px", borderRadius: 8, border: "none", background: C.bronze, color: "#fff", fontSize: 14, fontWeight: 600, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
        <div style={{ fontSize: 11, color: C.textFaint, marginTop: 16, textAlign: "center", lineHeight: 1.5 }}>
          Esqueceu a senha? Fale com o administrador do BZ Grãos.
        </div>
      </div>
    </Screen>
  );
}

function Message({ title, sub, onLogout }: { title: string; sub?: string; onLogout?: () => void }) {
  return (
    <Screen>
      <div style={{ width: "100%", maxWidth: 360, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "32px 28px", textAlign: "center", boxShadow: "0 8px 40px rgba(74,44,22,0.08)" }}>
        <Brand />
        <div style={{ fontSize: 15, fontWeight: 600, color: C.brown, marginBottom: 6 }}>{title}</div>
        {sub && <div style={{ fontSize: 13, color: C.textMute, lineHeight: 1.5 }}>{sub}</div>}
        {onLogout && (
          <button onClick={onLogout} style={{ marginTop: 20, padding: "9px 18px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surfaceAlt, color: C.textMute, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Sair</button>
        )}
      </div>
    </Screen>
  );
}

export default function AuthGate() {
  const [booted, setBooted] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [profileState, setProfileState] = useState<"idle" | "loading" | "ok" | "missing">("idle");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setBooted(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); setProfileState("idle"); return; }
    let cancel = false;
    setProfileState("loading");
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, nome, role, ativo, regiao")
        .eq("id", session.user.id)
        .single();
      if (cancel) return;
      if (error || !data) { setProfile(null); setProfileState("missing"); }
      else { setProfile(data); setProfileState("ok"); }
    })();
    return () => { cancel = true; };
  }, [session]);

  const logout = () => supabase.auth.signOut();

  if (!booted) return <Message title="Carregando..." />;
  if (!session) return <Login />;
  if (profileState === "loading" || profileState === "idle") return <Message title="Carregando perfil..." />;
  if (profileState === "missing") return <Message title="Perfil não encontrado" sub="Sua conta existe, mas não tem um perfil liberado. Fale com o administrador do BZ Grãos." onLogout={logout} />;
  if (profile && profile.ativo === false) return <Message title="Conta inativa" sub="Seu acesso está desativado no momento. Fale com o administrador do BZ Grãos." onLogout={logout} />;

  return <ProSafraApp userProfile={profile} onLogout={logout} />;
}
