import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { checkInteractions, type InteractionResult, type Severity } from "@/lib/interactions.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { PillLogo } from "@/components/PillLogo";
import {
  Flame, Bell, Calendar as CalendarIcon, ShieldAlert, ShieldCheck, AlertTriangle,
  ShoppingBag, X, Plus, LogOut, Trophy, ChevronLeft, ChevronRight, Clock, Sparkles, Gift, Coins, Search,
} from "lucide-react";

// Replace with your Amazon Associates tracking ID (e.g. "yourname-20")
const AMAZON_TAG = "numedi-20";
const amazonLink = (q: string) =>
  `https://www.amazon.com/s?k=${encodeURIComponent(q)}&tag=${AMAZON_TAG}`;

const POINTS_PER_CHECKIN = 10;
const STREAK_BONUS = 200; // every 30-day milestone

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "NuMEDi — Supplement & medication interaction checker" },
      { name: "description", content: "Check interactions between supplements and medications, get optimal timing, and track your adherence streak." },
    ],
  }),
  component: Dashboard,
});

type CheckIn = { check_in_date: string; created_at?: string };

// Current local user from the gate (route.tsx). Falls back to "guest".
const currentUser = (): string => {
  if (typeof window === "undefined") return "guest";
  try {
    const raw = localStorage.getItem("numedi_local_cred");
    if (raw) return (JSON.parse(raw).username as string) || "guest";
  } catch {}
  return "guest";
};
const userKey = (k: string) => `numedi:${currentUser()}:${k}`;

// Local date in YYYY-MM-DD
const today = () => {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
};


function diffDays(a: string, b: string) {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const set = new Set(dates);
  const t = today();
  // Streak must include today or yesterday
  const start = set.has(t) ? t : set.has(addDays(t, -1)) ? addDays(t, -1) : null;
  if (!start) return 0;
  let n = 0;
  let cur = start;
  while (set.has(cur)) {
    n++;
    cur = addDays(cur, -1);
  }
  return n;
}

function addDays(d: string, delta: number): string {
  const dt = new Date(d + "T00:00:00");
  dt.setDate(dt.getDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function Dashboard() {
  const [supplements, setSupplements] = useState<string[]>([]);
  const [meds, setMeds] = useState<string[]>([]);
  const [supInput, setSupInput] = useState("");
  const [medInput, setMedInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InteractionResult | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("08:00");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [itemReminders, setItemReminders] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("numedi_item_reminders") || "{}"); } catch { return {}; }
  });
  const [timingDialog, setTimingDialog] = useState<{ item: string; time: string } | null>(null);
  const [supSearch, setSupSearch] = useState("");
  const [supSearched, setSupSearched] = useState<string | null>(null);

  const runCheck = useServerFn(checkInteractions);

  // Schedule in-app push notifications for each per-item reminder
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(userKey("item_reminders"), JSON.stringify(itemReminders));
    const timers: number[] = [];
    Object.entries(itemReminders).forEach(([item, hhmm]) => {
      const [h, m] = hhmm.split(":").map(Number);
      const now = new Date();
      const next = new Date();
      next.setHours(h, m, 0, 0);
      if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
      const delay = next.getTime() - now.getTime();
      const id = window.setTimeout(() => {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("NuMEDi reminder", { body: `Time to take ${item}` });
        } else {
          toast(`⏰ Time to take ${item}`);
        }
      }, delay);
      timers.push(id);
    });
    return () => { timers.forEach((t) => clearTimeout(t)); };
  }, [itemReminders]);

  // Load this user's check-ins and reminder settings from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const ci = JSON.parse(localStorage.getItem(userKey("check_ins")) || "[]") as CheckIn[];
      setCheckIns(ci);
    } catch { setCheckIns([]); }
    try {
      const rs = JSON.parse(localStorage.getItem(userKey("reminder_settings")) || "null");
      if (rs) {
        setReminderEnabled(!!rs.enabled);
        if (typeof rs.reminder_time === "string") setReminderTime(rs.reminder_time.slice(0, 5));
      }
    } catch {}
    try {
      const ir = JSON.parse(localStorage.getItem(userKey("item_reminders")) || "{}");
      setItemReminders(ir);
    } catch {}
  }, []);

  const streak = useMemo(() => computeStreak(checkIns.map((c) => c.check_in_date)), [checkIns]);
  const checkedInToday = useMemo(() => checkIns.some((c) => c.check_in_date === today()), [checkIns]);

  const [redeemed, setRedeemed] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem(userKey("points_redeemed")) || "0");
  });
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const earnedPoints = checkIns.length * POINTS_PER_CHECKIN + Math.floor(checkIns.length / 30) * STREAK_BONUS;
  const availablePoints = Math.max(0, earnedPoints - redeemed);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(userKey("points_redeemed"), String(redeemed));
  }, [redeemed]);


  const addChip = (type: "sup" | "med") => {
    const value = (type === "sup" ? supInput : medInput).trim();
    if (!value) return;
    if (type === "sup") {
      if (!supplements.includes(value)) setSupplements([...supplements, value]);
      setSupInput("");
    } else {
      if (!meds.includes(value)) setMeds([...meds, value]);
      setMedInput("");
    }
  };

  const removeChip = (type: "sup" | "med", v: string) => {
    if (type === "sup") setSupplements(supplements.filter((x) => x !== v));
    else setMeds(meds.filter((x) => x !== v));
  };

  const onCheck = async () => {
    if (supplements.length === 0 && meds.length === 0) {
      toast.error("Add at least one supplement or medication.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await runCheck({ data: { supplements, medications: meds } });
      setResult(r);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to check interactions");
    } finally {
      setLoading(false);
    }
  };

  const checkInToday = async () => {
    if (checkedInToday) {
      toast.info("You've already checked in today. 🎉");
      return;
    }
    const next = [{ check_in_date: today(), created_at: new Date().toISOString() }, ...checkIns];
    setCheckIns(next);
    localStorage.setItem(userKey("check_ins"), JSON.stringify(next));
    toast.success("Checked in! Keep the streak alive.");
  };

  const saveReminders = async () => {
    localStorage.setItem(
      userKey("reminder_settings"),
      JSON.stringify({ enabled: reminderEnabled, reminder_time: reminderTime + ":00" }),
    );
    toast.success("Reminder settings saved.");
  };

  const signOut = () => {
    sessionStorage.removeItem("numedi_local_session");
    localStorage.removeItem("numedi_local_session");
    window.location.href = "/";
  };


  const allItems = [...supplements, ...meds];

  return (
    <main className="min-h-screen">
      {/* Top bar */}
      <header className="border-b border-border/50 bg-background/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PillLogo size={32} />
            <span className="text-xl font-bold text-gradient tracking-tight">NuMEDi</span>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span className="font-semibold">{streak}</span>
                  <span className="text-muted-foreground hidden sm:inline">day{streak === 1 ? "" : "s"}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Adherence calendar</DialogTitle></DialogHeader>
                <StreakCalendar checkIns={checkIns} />
              </DialogContent>
            </Dialog>

            <Sheet open={reminderOpen} onOpenChange={setReminderOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon"><Bell className="w-4 h-4" /></Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader><SheetTitle>Reminders</SheetTitle></SheetHeader>
                <div className="mt-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="rem-enabled" className="flex flex-col gap-1">
                      <span>Daily reminder</span>
                      <span className="text-xs text-muted-foreground font-normal">Get reminded to check in</span>
                    </Label>
                    <Switch id="rem-enabled" checked={reminderEnabled} onCheckedChange={setReminderEnabled} />
                  </div>
                  <div>
                    <Label htmlFor="rem-time">Time</Label>
                    <Input id="rem-time" type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
                  </div>
                  {result?.timing && result.timing.length > 0 && (
                    <Card className="p-4 bg-secondary/40">
                      <div className="text-sm font-medium mb-2 flex items-center gap-2"><Clock className="w-4 h-4" /> Per-item timing</div>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {result.timing.map((t, i) => (
                          <li key={i}>
                            <span className="text-foreground font-medium">{t.item}</span> · {t.recommended_time} — {t.advice}
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted-foreground mt-3">We'll suggest individual reminders for these times once notifications are enabled on your device.</p>
                    </Card>
                  )}
                  <Button onClick={saveReminders} className="w-full bg-gradient-brand">Save settings</Button>
                </div>
              </SheetContent>
            </Sheet>

            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out"><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <section className="text-center max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Smarter supplements, <span className="text-gradient">safer stacks</span>.
          </h1>
          <p className="text-muted-foreground mt-2">
            Track adherence, check interactions, and discover the right supplements — all in one place.
          </p>
        </section>

        <Tabs defaultValue="adherence" className="w-full">
          <TabsList className="grid grid-cols-3 w-full h-auto p-1.5 bg-card/70 backdrop-blur border border-border/60">
            <TabsTrigger value="adherence" className="flex-col gap-1 py-3 data-[state=active]:bg-gradient-brand data-[state=active]:text-primary-foreground">
              <Flame className="w-5 h-5" />
              <span className="text-xs sm:text-sm font-medium">Adherence</span>
            </TabsTrigger>
            <TabsTrigger value="interactions" className="flex-col gap-1 py-3 data-[state=active]:bg-gradient-brand data-[state=active]:text-primary-foreground">
              <Sparkles className="w-5 h-5" />
              <span className="text-xs sm:text-sm font-medium">Interactions</span>
            </TabsTrigger>
            <TabsTrigger value="find" className="flex-col gap-1 py-3 data-[state=active]:bg-gradient-brand data-[state=active]:text-primary-foreground">
              <Search className="w-5 h-5" />
              <span className="text-xs sm:text-sm font-medium">Find supplements</span>
            </TabsTrigger>
          </TabsList>

          {/* 1. ADHERENCE */}
          <TabsContent value="adherence" className="mt-6">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-6 bg-gradient-brand text-primary-foreground glow flex flex-col justify-between">
                <button
                  type="button"
                  onClick={() => setCalendarOpen(true)}
                  className="text-left rounded-lg -m-1 p-1 hover:bg-white/10 transition-colors"
                  title="View adherence calendar"
                >
                  <div className="flex items-center gap-2 text-sm opacity-90"><Flame className="w-4 h-4" /> Adherence streak</div>
                  <div className="text-6xl font-bold mt-2">{streak}</div>
                  <div className="text-sm opacity-90 underline-offset-2 underline decoration-white/40">
                    day{streak === 1 ? "" : "s"} in a row · tap to view calendar
                  </div>
                  {streak >= 30 && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium">
                      <Trophy className="w-3.5 h-3.5" /> 30-day badge unlocked
                    </div>
                  )}
                </button>
                <div className="mt-4 rounded-lg bg-white/10 px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Coins className="w-4 h-4" />
                    <span className="font-semibold">{availablePoints} pts</span>
                  </div>
                  <button
                    onClick={() => setRewardsOpen(true)}
                    className="text-xs underline underline-offset-2 hover:opacity-80"
                  >
                    Redeem →
                  </button>
                </div>
                <Button
                  onClick={checkInToday}
                  variant="secondary"
                  className="mt-3 w-full bg-white text-purple-900 hover:bg-white/90"
                  disabled={checkedInToday}
                >
                  {checkedInToday ? `Checked in today ✓ +${POINTS_PER_CHECKIN} pts` : `Check in today  ·  +${POINTS_PER_CHECKIN} pts`}
                </Button>
              </Card>

              <Card className="p-6 bg-card/70 backdrop-blur border-border/60">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" /> Recent check-ins
                </h3>
                <StreakCalendar checkIns={checkIns} />
              </Card>
            </div>
          </TabsContent>

          {/* 2. INTERACTIONS */}
          <TabsContent value="interactions" className="mt-6 space-y-6">
            <Card className="p-6 bg-card/70 backdrop-blur border-border/60">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Interaction checker</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <ChipInput
                  label="Supplements"
                  placeholder="e.g. Vitamin D, Magnesium, Iron"
                  value={supInput}
                  onChange={setSupInput}
                  chips={supplements}
                  onAdd={() => addChip("sup")}
                  onRemove={(v) => removeChip("sup", v)}
                />
                <ChipInput
                  label="Prescription medications"
                  placeholder="e.g. Lisinopril, Metformin"
                  value={medInput}
                  onChange={setMedInput}
                  chips={meds}
                  onAdd={() => addChip("med")}
                  onRemove={(v) => removeChip("med", v)}
                />
              </div>
              <Button onClick={onCheck} disabled={loading} className="mt-6 bg-gradient-brand text-primary-foreground hover:opacity-90 px-6">
                {loading ? "Analyzing…" : "Check interactions"}
              </Button>
            </Card>

            {result && (
              <section className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Interactions</h3>
                  {result.interactions.length === 0 ? (
                    <Card className="p-4 text-muted-foreground">No interactions returned.</Card>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-3">
                      {result.interactions.map((i, idx) => <InteractionCard key={idx} {...i} />)}
                    </div>
                  )}
                </div>

                {result.timing.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Optimal timing</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {result.timing.map((t, idx) => {
                        const saved = itemReminders[t.item];
                        return (
                          <Card key={idx} className="p-4 bg-card/70">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium truncate">{t.item}</div>
                              <button
                                onClick={() => setTimingDialog({ item: t.item, time: saved || t.recommended_time })}
                                className="shrink-0"
                                title="Tap to set a reminder"
                              >
                                <Badge variant={saved ? "default" : "secondary"} className="font-mono cursor-pointer hover:opacity-80">
                                  {saved ? <><Bell className="w-3 h-3 mr-1 inline" />{saved}</> : t.recommended_time}
                                </Badge>
                              </button>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1.5">{t.advice}</p>
                            <button
                              onClick={() => setTimingDialog({ item: t.item, time: saved || t.recommended_time })}
                              className="text-xs text-primary hover:underline mt-2"
                            >
                              {saved ? "Edit reminder" : "Set reminder at this time →"}
                            </button>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {allItems.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" /> Buy your stack
                </h3>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {allItems.map((item) => (
                    <a key={item} href={amazonLink(item)} target="_blank" rel="noopener noreferrer sponsored" className="block">
                      <Card className="p-4 bg-card/70 hover:bg-card transition-colors group">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{item}</span>
                          <ShoppingBag className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Shop on Amazon</p>
                      </Card>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </TabsContent>

          {/* 3. FIND SUPPLEMENTS */}
          <TabsContent value="find" className="mt-6 space-y-6">
            <Card className="p-6 bg-card/70 backdrop-blur border-border/60">
              <div className="flex items-center gap-2 mb-1">
                <Search className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Looking for supplement recommendations?</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Type the supplement name you are looking for and we will show curated Amazon links so you can buy right away.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Omega-3, Probiotics, Ashwagandha"
                  value={supSearch}
                  onChange={(e) => setSupSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && supSearch.trim()) setSupSearched(supSearch.trim());
                  }}
                />
                <Button
                  onClick={() => supSearch.trim() && setSupSearched(supSearch.trim())}
                  className="bg-gradient-brand text-primary-foreground"
                >
                  <Search className="w-4 h-4 mr-1.5" /> Search
                </Button>
              </div>
            </Card>

            {supSearched && (
              <section>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" />
                  Top picks for <span className="text-gradient">"{supSearched}"</span>
                </h3>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { tag: "Best seller", query: `best seller ${supSearched}` },
                    { tag: "Highest rated", query: `${supSearched} 4 stars and up` },
                    { tag: "Organic / Non-GMO", query: `${supSearched} organic non-gmo` },
                    { tag: "High potency", query: `${supSearched} high potency` },
                    { tag: "Vegan", query: `${supSearched} vegan` },
                    { tag: "Budget pick", query: `${supSearched} value pack` },
                  ].map((opt) => (
                    <a
                      key={opt.tag}
                      href={amazonLink(opt.query)}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="block"
                    >
                      <Card className="p-4 bg-card/70 hover:bg-card transition-colors group">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">{opt.tag}</Badge>
                          <ShoppingBag className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div className="mt-2 font-medium">{supSearched}</div>
                        <p className="text-xs text-muted-foreground mt-1">Open on Amazon →</p>
                      </Card>
                    </a>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-3">
                  As an Amazon Associate, NuMEDi may earn from qualifying purchases.
                </p>
              </section>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <footer className="border-t border-border/40 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          For informational purposes only, not medical advice. Always consult a healthcare professional.
        </div>
      </footer>

      <Dialog open={!!timingDialog} onOpenChange={(o) => !o && setTimingDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set reminder for {timingDialog?.item}</DialogTitle>
          </DialogHeader>
          {timingDialog && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="confirm-time">Reminder time</Label>
                <Input
                  id="confirm-time"
                  type="time"
                  value={timingDialog.time}
                  onChange={(e) => setTimingDialog({ ...timingDialog, time: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  NuMEDi will push a notification at this time daily while the app is open.
                </p>
              </div>
              <div className="flex gap-2">
                {itemReminders[timingDialog.item] && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      const next = { ...itemReminders };
                      delete next[timingDialog.item];
                      setItemReminders(next);
                      setTimingDialog(null);
                      toast.success("Reminder removed");
                    }}
                  >
                    Remove
                  </Button>
                )}
                <Button
                  className="flex-1 bg-gradient-brand"
                  onClick={async () => {
                    if ("Notification" in window && Notification.permission === "default") {
                      try { await Notification.requestPermission(); } catch { /* ignore */ }
                    }
                    setItemReminders({ ...itemReminders, [timingDialog.item]: timingDialog.time });
                    const granted = "Notification" in window && Notification.permission === "granted";
                    toast.success(
                      granted
                        ? `Reminder set for ${timingDialog.time}`
                        : `Reminder set for ${timingDialog.time} (enable browser notifications for push)`
                    );
                    setTimingDialog(null);
                  }}
                >
                  Confirm
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rewardsOpen} onOpenChange={setRewardsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" /> NuMEDi Rewards
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="p-4 bg-gradient-brand text-primary-foreground">
              <div className="text-xs opacity-90">Available balance</div>
              <div className="text-3xl font-bold">{availablePoints} pts</div>
              <div className="text-xs opacity-90 mt-1">
                Earn {POINTS_PER_CHECKIN} pts per daily check-in · +{STREAK_BONUS} bonus every 30 days
              </div>
            </Card>

            <div className="space-y-2">
              {[
                { name: "Sleep stack (Magnesium + Melatonin)", cost: 100, query: "magnesium glycinate melatonin" },
                { name: "Energy stack (B-Complex + CoQ10)", cost: 150, query: "b complex coq10" },
                { name: "Immunity stack (Vitamin C + D + Zinc)", cost: 200, query: "vitamin c d zinc bundle" },
                { name: "30-day reward bundle", cost: 300, query: "best multivitamin" },
              ].map((r) => {
                const canRedeem = availablePoints >= r.cost;
                return (
                  <div key={r.name} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/40">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.cost} pts</div>
                    </div>
                    <Button
                      size="sm"
                      disabled={!canRedeem}
                      onClick={() => {
                        setRedeemed(redeemed + r.cost);
                        window.open(amazonLink(r.query), "_blank", "noopener,noreferrer");
                        toast.success(`Redeemed ${r.cost} pts — opening Amazon`);
                      }}
                    >
                      {canRedeem ? "Redeem" : "Locked"}
                    </Button>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Redemptions open Amazon affiliate links. As an Amazon Associate, NuMEDi may earn from qualifying purchases.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ChipInput({
  label, placeholder, value, onChange, chips, onAdd, onRemove,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  chips: string[];
  onAdd: () => void;
  onRemove: (v: string) => void;
}) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={onAdd}><Plus className="w-4 h-4" /></Button>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {chips.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm">
              {c}
              <button onClick={() => onRemove(c)} className="text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function InteractionCard({ items, severity, explanation }: { items: string[]; severity: Severity; explanation: string }) {
  const styles: Record<Severity, { bg: string; border: string; icon: React.ReactNode; label: string }> = {
    DANGEROUS: {
      bg: "bg-danger/15", border: "border-danger/40",
      icon: <ShieldAlert className="w-5 h-5 text-danger" />, label: "Dangerous",
    },
    CAUTION: {
      bg: "bg-warning/15", border: "border-warning/40",
      icon: <AlertTriangle className="w-5 h-5 text-warning" />, label: "Caution",
    },
    SAFE: {
      bg: "bg-success/10", border: "border-success/30",
      icon: <ShieldCheck className="w-5 h-5 text-success" />, label: "Safe",
    },
  };
  const s = styles[severity] ?? styles.SAFE;
  return (
    <Card className={`p-4 ${s.bg} ${s.border}`}>
      <div className="flex items-start gap-3">
        {s.icon}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wide">{s.label}</span>
            <span className="text-sm font-medium">{items.join(" + ")}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{explanation}</p>
        </div>
      </div>
    </Card>
  );
}

function StreakCalendar({ checkIns }: { checkIns: CheckIn[] }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const timeByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of checkIns) {
      if (!c.created_at) continue;
      const d = new Date(c.created_at);
      const label = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      map.set(c.check_in_date, label);
    }
    return map;
  }, [checkIns]);
  const set = useMemo(() => new Set(checkIns.map((c) => c.check_in_date)), [checkIns]);
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDow = new Date(year, m, 1).getDay();
  const days = new Date(year, m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  const t = today();

  const fmt = (d: number) => {
    const mm = String(m + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  };

  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" onClick={() => setMonth(new Date(year, m - 1, 1))}><ChevronLeft className="w-4 h-4" /></Button>
        <div className="font-medium">{monthLabel}</div>
        <Button variant="ghost" size="icon" onClick={() => setMonth(new Date(year, m + 1, 1))}><ChevronRight className="w-4 h-4" /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs text-center text-muted-foreground mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const dateStr = fmt(day);
          const filled = set.has(dateStr);
          const isToday = dateStr === t;
          return (
            <div
              key={i}
              className={[
                "aspect-square flex flex-col items-center justify-center text-sm rounded-lg leading-tight px-1",
                filled ? "bg-gradient-brand text-primary-foreground font-medium" : "bg-secondary/40 text-muted-foreground",
                isToday ? "ring-2 ring-primary" : "",
              ].join(" ")}
              title={filled && timeByDate.get(dateStr) ? `Checked in at ${timeByDate.get(dateStr)}` : undefined}
            >
              <span>{day}</span>
              {filled && timeByDate.get(dateStr) && (
                <span className="text-[9px] opacity-90 font-mono mt-0.5 truncate w-full text-center">
                  {timeByDate.get(dateStr)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-3 text-center">
        {checkIns.length} total check-in{checkIns.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
