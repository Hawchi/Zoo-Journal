"use client";

import { useState } from "react";
import type { CoupleProfile } from "../plans";
import { ZooPhoto } from "./ZooPhoto";
import { LanguageToggle, useLanguage } from "../i18n";

export type AccountMode = "loading" | "demo" | "signed-out" | "setup" | "join" | "ready" | "error";

export function CoupleAccess({ mode, error, onSetup, onJoin }: {
  mode: AccountMode;
  error: string;
  onSetup: (name: string) => Promise<void>;
  onJoin: (name: string, code: string) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [joining, setJoining] = useState(mode === "join");
  const wantsToJoin = mode === "join" || (mode === "setup" && joining);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try { if (wantsToJoin) await onJoin(name, code); else await onSetup(name); } finally { setSaving(false); }
  };
  if (mode === "loading") return <main className="couple-access"><div className="couple-access-card"><LanguageToggle /><div className="couple-access-animal"><ZooPhoto animal="redpanda" alt="" /></div><h1>{t("Jullie dagboek wordt geopend...", "Opening your journal...")}</h1></div></main>;
  if (mode === "signed-out") return <main className="couple-access"><div className="couple-access-card"><LanguageToggle /><div className="couple-access-animal"><ZooPhoto animal="redpanda" alt="" /></div><span className="eyebrow">{t("JULLIE EIGEN DAGBOEK", "YOUR SHARED JOURNAL")}</span><h1>Zoo Journal</h1><p>{t("Log allebei met een eigen e-mailadres in. Zo blijven voorstellen, herinneringen en beoordelingen persoonlijk.", "Sign in with your own email addresses. This keeps plans, memories and reviews personal.")}</p><a className="couple-signin" href="/login">{t("Inloggen met e-mail", "Sign in with email")}</a></div></main>;
  if (mode === "error") return <main className="couple-access"><div className="couple-access-card"><LanguageToggle /><h1>{t("Het dagboek kon niet openen", "The journal could not be opened")}</h1><p>{error || t("Probeer het zo opnieuw.", "Please try again.")}</p><button className="couple-signin" onClick={() => location.reload()}>{t("Opnieuw proberen", "Try again")}</button></div></main>;
  return <main className="couple-access"><form className="couple-access-card" onSubmit={submit}><LanguageToggle /><div className="couple-access-animal"><ZooPhoto animal={wantsToJoin ? "bear" : "redpanda"} alt="" /></div><span className="eyebrow">{wantsToJoin ? t("GEBRUIKER B", "USER B") : t("GEBRUIKER A", "USER A")}</span><h1>{wantsToJoin ? t("Voeg je bij jullie dagboek", "Join your shared journal") : t("Maak jullie dagboek aan", "Create your shared journal")}</h1><p>{wantsToJoin ? t("Vul de koppelcode in die je van je partner hebt gekregen.", "Enter the pairing code you received from your partner.") : t("Maak het gedeelde dagboek aan. Daarna krijg je een koppelcode voor je partner.", "Create the shared journal. You will then receive a pairing code for your partner.")}</p>{mode === "setup" && <div className="couple-onboarding-choice"><button type="button" className={!joining ? "active" : ""} onClick={() => setJoining(false)}>{t("Nieuw dagboek", "New journal")}</button><button type="button" className={joining ? "active" : ""} onClick={() => setJoining(true)}>{t("Ik heb een code", "I have a code")}</button></div>}<label>{t("Hoe mogen we je noemen?", "What should we call you?")}<input required value={name} onChange={(event) => setName(event.target.value)} placeholder={t("Je eigen naam", "Your name")} /></label>{wantsToJoin && <label>{t("Koppelcode", "Pairing code")}<input required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="AB12CD34" maxLength={8} /></label>}{error && <p className="couple-access-error">{error}</p>}<button className="couple-signin" disabled={saving}>{saving ? t("Even koppelen...", "Connecting...") : wantsToJoin ? t("Samenvoegen ♥", "Join together ♥") : t("Dagboek aanmaken", "Create journal")}</button></form></main>;
}

export function CoupleBar({ profiles, currentId, mode, requestCount, onSwitch, onPlanner, onSettings }: {
  profiles: CoupleProfile[];
  currentId: string;
  mode: AccountMode;
  requestCount: number;
  onSwitch: (id: string) => void;
  onPlanner: () => void;
  onSettings: () => void;
}) {
  const { t } = useLanguage();
  const current = profiles.find((profile) => profile.id === currentId) || profiles[0];
  const partner = profiles.find((profile) => profile.id !== current?.id);
  return <section className="couple-bar" aria-label={t("Jullie accounts", "Your accounts")}><div className="couple-bar-people"><span className="couple-mini-avatar">{current?.displayName?.slice(0, 1).toUpperCase() || "A"}</span><div><small>{t("Je bent ingelogd als", "Signed in as")}</small><strong>{current?.displayName || t("Gebruiker", "User")}</strong></div>{partner ? <span className="couple-together">♥ {t("samen met", "together with")} {partner.displayName}</span> : <button className="couple-invite-hint" onClick={onSettings}>＋ {t("Partner uitnodigen", "Invite partner")}</button>}</div><div className="couple-bar-actions">{mode === "demo" && partner && <button className="couple-switch" onClick={() => onSwitch(partner.id)}>{t("Wissel naar", "Switch to")} {partner.displayName}</button>}<button className={`couple-requests ${requestCount ? "has-requests" : ""}`} onClick={onPlanner} title={t("Uitjesplanner", "Trip planner")}><img src="/icons-clean/calendar.png" alt="" /><span>{t("Uitjes", "Trips")}</span>{requestCount > 0 && <b>{requestCount}</b>}</button><button className="couple-settings-button" onClick={onSettings} aria-label={t("Accountinstellingen", "Account settings")}><img src="/icons-clean/settings.png" alt="" /></button></div></section>;
}

export function CoupleSettings({ profiles, currentId, mode, inviteCode, onRename }: {
  profiles: CoupleProfile[];
  currentId: string;
  mode: AccountMode;
  inviteCode: string;
  onRename: (id: string, name: string) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(profiles.map((profile) => [profile.id, profile.displayName])));
  const [saved, setSaved] = useState("");
  const editable = mode === "demo" ? profiles : profiles.filter((profile) => profile.id === currentId);
  const save = async (profile: CoupleProfile) => { await onRename(profile.id, names[profile.id] || profile.displayName); setSaved(profile.id); setTimeout(() => setSaved(""), 1600); };
  return <section className="couple-settings-card"><div><LanguageToggle /><span className="eyebrow">{t("JULLIE TWEE", "THE TWO OF YOU")}</span><h2>{t("Accounts", "Accounts")}</h2><p>{t("Iedereen plant vanuit een eigen profiel. De partner kan een voorstel daarna goedkeuren of afwijzen.", "Each person plans from their own profile. Their partner can then approve or decline the suggestion.")}</p>{mode === "ready" && <p>{t("Alles wat jullie toevoegen wordt online gedeeld en veilig bewaard.", "Everything you add is shared online and stored securely.")}</p>}</div><div className="couple-profile-list">{editable.map((profile) => <label key={profile.id}><span className="couple-mini-avatar">{(names[profile.id] || profile.displayName).slice(0, 1).toUpperCase()}</span><span><small>{profile.role === "owner" ? t("Gebruiker A", "User A") : t("Gebruiker B", "User B")}</small><input value={names[profile.id] ?? profile.displayName} onChange={(event) => setNames((current) => ({ ...current, [profile.id]: event.target.value }))} /></span><button onClick={() => save(profile)}>{saved === profile.id ? t("Opgeslagen ✓", "Saved ✓") : t("Naam opslaan", "Save name")}</button></label>)}</div>{inviteCode && profiles.length < 2 && <div className="couple-invite-code"><span><small>{t("KOPPELCODE VOOR JE PARTNER", "PAIRING CODE FOR YOUR PARTNER")}</small><strong>{inviteCode}</strong></span><p>{t("Je partner logt in met een eigen account en vult deze code één keer in.", "Your partner signs in with their own account and enters this code once.")}</p></div>}{mode === "ready" && <form action="/auth/signout" method="post"><button className="couple-signout" type="submit">{t("Uitloggen", "Sign out")}</button></form>}</section>;
}
