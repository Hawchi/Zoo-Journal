"use client";

import { useState } from "react";
import type { CoupleProfile } from "../plans";
import { ZooPhoto } from "./ZooPhoto";

export type AccountMode = "loading" | "demo" | "signed-out" | "setup" | "join" | "ready" | "error";

export function CoupleAccess({ mode, error, onSetup, onJoin }: {
  mode: AccountMode;
  error: string;
  onSetup: (name: string) => Promise<void>;
  onJoin: (name: string, code: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try { if (mode === "setup") await onSetup(name); else await onJoin(name, code); } finally { setSaving(false); }
  };
  if (mode === "loading") return <main className="couple-access"><div className="couple-access-card"><div className="couple-access-animal"><ZooPhoto animal="redpanda" alt="" /></div><h1>Jullie dagboek wordt geopend…</h1></div></main>;
  if (mode === "signed-out") return <main className="couple-access"><div className="couple-access-card"><div className="couple-access-animal"><ZooPhoto animal="redpanda" alt="" /></div><span className="eyebrow">ALLEEN VOOR JULLIE TWEE</span><h1>Ons Zoo Dagboek</h1><p>Log allebei met je eigen account in. Zo weten voorstellen en reacties altijd van wie ze komen.</p><a className="couple-signin" href="/signin-with-chatgpt?return_to=%2F">Inloggen om verder te gaan</a></div></main>;
  if (mode === "error") return <main className="couple-access"><div className="couple-access-card"><h1>Het dagboek kon niet openen</h1><p>{error || "Probeer het zo opnieuw."}</p><button className="couple-signin" onClick={() => location.reload()}>Opnieuw proberen</button></div></main>;
  return <main className="couple-access"><form className="couple-access-card" onSubmit={submit}><div className="couple-access-animal"><ZooPhoto animal={mode === "setup" ? "redpanda" : "bear"} alt="" /></div><span className="eyebrow">{mode === "setup" ? "EERSTE ACCOUNT" : "TWEEDE ACCOUNT"}</span><h1>{mode === "setup" ? "Maak jullie dagboek aan" : "Voeg je bij jullie dagboek"}</h1><p>{mode === "setup" ? "Jij maakt het gedeelde dagboek aan en krijgt daarna een koppelcode voor je vriend." : "Vul de koppelcode in die je van je partner hebt gekregen."}</p><label>Hoe mogen we je noemen?<input required value={name} onChange={(event) => setName(event.target.value)} placeholder={mode === "setup" ? "Paulien" : "Je naam"} /></label>{mode === "join" && <label>Koppelcode<input required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="AB12CD34" maxLength={8} /></label>}{error && <p className="couple-access-error">{error}</p>}<button className="couple-signin" disabled={saving}>{saving ? "Even koppelen…" : mode === "setup" ? "Dagboek aanmaken" : "Samenvoegen ♥"}</button></form></main>;
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
  const current = profiles.find((profile) => profile.id === currentId) || profiles[0];
  const partner = profiles.find((profile) => profile.id !== current?.id);
  return <section className="couple-bar" aria-label="Jullie accounts"><div className="couple-bar-people"><span className="couple-mini-avatar">{current?.displayName?.slice(0, 1).toUpperCase() || "P"}</span><div><small>Je bent ingelogd als</small><strong>{current?.displayName || "Paulien"}</strong></div>{partner ? <span className="couple-together">♥ samen met {partner.displayName}</span> : <button className="couple-invite-hint" onClick={onSettings}>＋ Partner uitnodigen</button>}</div><div className="couple-bar-actions">{mode === "demo" && partner && <button className="couple-switch" onClick={() => onSwitch(partner.id)} title="Alleen beschikbaar in de lokale voorbeeldversie">Wissel naar {partner.displayName}</button>}<button className={`couple-requests ${requestCount ? "has-requests" : ""}`} onClick={onPlanner}><span>Voorstellen</span>{requestCount > 0 && <b>{requestCount}</b>}</button><button className="couple-settings-button" onClick={onSettings} aria-label="Accountinstellingen">⚙</button></div></section>;
}

export function CoupleSettings({ profiles, currentId, mode, inviteCode, onRename }: {
  profiles: CoupleProfile[];
  currentId: string;
  mode: AccountMode;
  inviteCode: string;
  onRename: (id: string, name: string) => Promise<void>;
}) {
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(profiles.map((profile) => [profile.id, profile.displayName])));
  const [saved, setSaved] = useState("");
  const editable = mode === "demo" ? profiles : profiles.filter((profile) => profile.id === currentId);
  const save = async (profile: CoupleProfile) => { await onRename(profile.id, names[profile.id] || profile.displayName); setSaved(profile.id); setTimeout(() => setSaved(""), 1600); };
  return <section className="couple-settings-card"><div><span className="eyebrow">JULLIE TWEE</span><h2>Accounts</h2><p>Iedereen plant vanuit zijn eigen profiel. De ander kan een voorstel daarna goedkeuren of afwijzen.</p></div><div className="couple-profile-list">{editable.map((profile) => <label key={profile.id}><span className="couple-mini-avatar">{(names[profile.id] || profile.displayName).slice(0, 1).toUpperCase()}</span><span><small>{profile.role === "owner" ? "Eerste account" : "Tweede account"}</small><input value={names[profile.id] ?? profile.displayName} onChange={(event) => setNames((current) => ({ ...current, [profile.id]: event.target.value }))} /></span><button onClick={() => save(profile)}>{saved === profile.id ? "Opgeslagen ✓" : "Naam opslaan"}</button></label>)}</div>{inviteCode && profiles.length < 2 && <div className="couple-invite-code"><span><small>KOPPELCODE VOOR JE PARTNER</small><strong>{inviteCode}</strong></span><p>Je vriend logt in met zijn eigen account en vult deze code één keer in.</p></div>}{mode === "ready" && <a className="couple-signout" href="/signout-with-chatgpt?return_to=%2F">Uitloggen</a>}</section>;
}
