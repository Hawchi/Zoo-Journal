"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { ZooPhoto } from "../components/ZooPhoto";
import { LanguageToggle, useLanguage } from "../i18n";

export default function LoginPage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError("");
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    if (password.length < 8) {
      setError(t("Gebruik minimaal 8 tekens voor je wachtwoord.", "Use at least 8 characters for your password."));
      setSending(false);
      return;
    }
    if (mode === "signup" && password !== confirmation) {
      setError(t("De wachtwoorden zijn niet hetzelfde.", "The passwords do not match."));
      setSending(false);
      return;
    }
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });
    if (result.error) setError(result.error.message);
    else if (result.data.session) window.location.href = "/";
    else setMessage(t("Je account is aangemaakt. Bevestig je e-mailadres als Supabase daarom vraagt en log daarna in.", "Your account has been created. Confirm your email if Supabase asks you to, then sign in."));
    setSending(false);
  };

  return (
    <main className="couple-access">
      <form className="couple-access-card" onSubmit={submit}>
        <LanguageToggle />
        <div className="couple-access-animal"><ZooPhoto animal="redpanda" alt="" /></div>
        <span className="eyebrow">{t("JULLIE EIGEN DAGBOEK", "YOUR SHARED JOURNAL")}</span>
        <h1>{mode === "login" ? t("Welkom terug", "Welcome back") : t("Maak je account aan", "Create your account")}</h1>
        <p>{mode === "login" ? t("Log in met je e-mailadres en wachtwoord.", "Sign in with your email address and password.") : t("Maak je eigen account. Daarna kun je een nieuw dagboek maken of met de code van je partner koppelen.", "Create your own account. You can then start a new journal or join your partner with their pairing code.")}</p>
        <div className="couple-onboarding-choice auth-choice">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); setMessage(""); }}>{t("Inloggen", "Sign in")}</button>
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); setMessage(""); }}>{t("Account maken", "Create account")}</button>
        </div>
        <label>{t("E-mailadres", "Email address")}<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label>{t("Wachtwoord", "Password")}<input required minLength={8} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t("Minimaal 8 tekens", "At least 8 characters")} /></label>
        {mode === "signup" && <label>{t("Herhaal wachtwoord", "Repeat password")}<input required minLength={8} type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>}
        {message && <p className="couple-access-success" role="status">{message}</p>}
        {error && <p className="couple-access-error" role="alert">{error}</p>}
        <button className="couple-signin" disabled={sending}>{sending ? t("Even geduld...", "One moment...") : mode === "login" ? t("Inloggen", "Sign in") : t("Account aanmaken", "Create account")}</button>
      </form>
    </main>
  );
}
