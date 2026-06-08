import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PillLogo } from "@/components/PillLogo";
import { toast } from "sonner";

// Local-only gate for school assignment. No backend auth.
// Default credentials are created on first run and stored in localStorage.
// Users can change them from the login screen via "Set new credentials".

const CRED_KEY = "numedi_local_cred";
const SESSION_KEY = "numedi_local_session";
const DEFAULT_USER = "admin";
const DEFAULT_PASS = "numedi";

type Cred = { username: string; password: string };

function readCred(): Cred {
  try {
    const raw = localStorage.getItem(CRED_KEY);
    if (raw) return JSON.parse(raw) as Cred;
  } catch {}
  const c = { username: DEFAULT_USER, password: DEFAULT_PASS };
  localStorage.setItem(CRED_KEY, JSON.stringify(c));
  return c;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: Gate,
});

function Gate() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [mode, setMode] = useState<"signin" | "setup">("signin");
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [p2, setP2] = useState("");

  useEffect(() => {
    readCred();
    setAuthed(sessionStorage.getItem(SESSION_KEY) === "1" || localStorage.getItem(SESSION_KEY) === "1");
    setReady(true);
  }, []);

  if (!ready) return null;

  if (authed) {
    return (
      <>
        <Outlet />
        <button
          onClick={() => {
            sessionStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(SESSION_KEY);
            setAuthed(false);
          }}
          className="fixed bottom-3 right-3 text-xs text-muted-foreground hover:text-foreground bg-card/80 backdrop-blur border border-border/60 rounded-md px-2 py-1"
        >
          Lock
        </button>
      </>
    );
  }

  const signIn = (e: React.FormEvent) => {
    e.preventDefault();
    const c = readCred();
    if (u.trim() === c.username && p === c.password) {
      localStorage.setItem(SESSION_KEY, "1");
      setAuthed(true);
    } else {
      toast.error("Wrong username or password");
    }
  };

  const setup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!u.trim() || p.length < 4) return toast.error("Username required, password ≥ 4 chars");
    if (p !== p2) return toast.error("Passwords do not match");
    localStorage.setItem(CRED_KEY, JSON.stringify({ username: u.trim(), password: p }));
    localStorage.setItem(SESSION_KEY, "1");
    toast.success("Credentials saved");
    setAuthed(true);
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <PillLogo size={42} />
          <span className="text-3xl font-bold text-gradient tracking-tight">NuMEDi</span>
        </div>
        <Card className="p-6 bg-card/80 backdrop-blur border-border/60 glow">
          <h1 className="text-xl font-semibold mb-1">
            {mode === "signin" ? "Enter access code" : "Set new credentials"}
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            {mode === "signin"
              ? `Default: ${DEFAULT_USER} / ${DEFAULT_PASS}`
              : "Stored locally on this device only."}
          </p>
          <form onSubmit={mode === "signin" ? signIn : setup} className="space-y-3">
            <div>
              <Label htmlFor="u">Username</Label>
              <Input id="u" value={u} onChange={(e) => setU(e.target.value)} maxLength={50} autoComplete="username" required />
            </div>
            <div>
              <Label htmlFor="p">Password</Label>
              <Input id="p" type="password" value={p} onChange={(e) => setP(e.target.value)} maxLength={100} autoComplete={mode === "signin" ? "current-password" : "new-password"} required />
            </div>
            {mode === "setup" && (
              <div>
                <Label htmlFor="p2">Confirm password</Label>
                <Input id="p2" type="password" value={p2} onChange={(e) => setP2(e.target.value)} maxLength={100} required />
              </div>
            )}
            <Button type="submit" className="w-full bg-gradient-brand text-primary-foreground hover:opacity-90">
              {mode === "signin" ? "Unlock" : "Save & enter"}
            </Button>
          </form>
          <button
            type="button"
            onClick={() => { setMode(mode === "signin" ? "setup" : "signin"); setU(""); setP(""); setP2(""); }}
            className="text-sm text-muted-foreground hover:text-foreground mt-4 w-full text-center"
          >
            {mode === "signin" ? "Set new credentials" : "Back to sign in"}
          </button>
        </Card>
        <p className="text-xs text-muted-foreground text-center mt-6">Local-only gate. No data leaves your device.</p>
      </div>
    </main>
  );
}
