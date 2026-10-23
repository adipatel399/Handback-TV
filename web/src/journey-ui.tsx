import { useCallback, useEffect, useRef, useState } from "react";
import { useRemote } from "./remote";
import {
  DEFAULT_JOURNEY_PREFERENCES,
  LONDON_PLACES,
  TFL_ATTRIBUTION,
  londonClock,
  type JourneyPreferences,
  type JourneyPlan,
  type JourneyOption,
  type LondonPlaceId,
  type SavedJourney,
} from "../../server/journeys-shared";
import type { StudySession } from "../../server/study";

async function request<T = any>(
  path: string,
  token: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (data.loginRequired && location.protocol === "https:")
    location.assign(
      "/auth/login?next=" +
        encodeURIComponent(
          location.pathname.startsWith("/helper") ? "/helper" : "/tv/journeys",
        ),
    );
  if (!r.ok)
    throw Object.assign(
      new Error(data.error || "The service is unavailable."),
      { status: r.status },
    );
  return data;
}
function JourneyBrand() {
  return (
    <div className="brand light">
      <span className="brand-mark">
        <span />
        <span />
      </span>
      <span>
        handback<span className="brand-tv">TV</span>
      </span>
    </div>
  );
}
function useSpeech(token: string, onRead: () => void) {
  const [speaking, setSpeaking] = useState(false),
    [speechError, setSpeechError] = useState("");
  const generation = useRef(0),
    audio = useRef<HTMLAudioElement | undefined>(undefined);
  const currentText = useRef(""),
    fallbackAttempted = useRef(false);
  const stop = useCallback(() => {
    generation.current++;
    currentText.current = "";
    (window as any).HandbackVoice?.stop();
    audio.current?.pause();
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);
  const playLocal = useCallback(
    async (text: string, current: number) => {
      fallbackAttempted.current = true;
      setSpeaking(true);
      try {
        const clip = await request("/api/voice", token, "POST", {
          text: text.slice(0, 1800),
        });
        if (generation.current !== current) return;
        const native = (window as any).HandbackVoice;
        if (native) native.play(clip.path);
        else {
          const player = new Audio(clip.path);
          audio.current = player;
          player.onended = () => setSpeaking(false);
          player.onerror = () => {
            setSpeaking(false);
            setSpeechError(
              "Read aloud is unavailable. Your route remains on screen.",
            );
          };
          await player.play();
        }
      } catch (e) {
        if (generation.current !== current) return;
        setSpeaking(false);
        setSpeechError((e as Error).message);
      }
    },
    [token],
  );
  useEffect(() => {
    const state = (e: Event) => {
      const value = (e as CustomEvent).detail;
      if (
        value === "unavailable" &&
        currentText.current &&
        !fallbackAttempted.current
      ) {
        void playLocal(currentText.current, generation.current);
        return;
      }
      setSpeaking(value === "speaking");
      if (value === "unavailable")
        setSpeechError(
          "Read aloud is unavailable. Your route remains on screen.",
        );
    };
    window.addEventListener("handback-voice-state", state);
    return () => {
      window.removeEventListener("handback-voice-state", state);
      stop();
    };
  }, [stop, playLocal]);
  const speak = useCallback(
    async (text: string) => {
      if (speaking) {
        stop();
        return;
      }
      setSpeechError("");
      onRead();
      const native = (window as any).HandbackVoice,
        current = ++generation.current;
      currentText.current = text;
      fallbackAttempted.current = false;
      setSpeaking(true);
      if (native?.available()) native.speak(text.slice(0, 1800));
      else await playLocal(text, current);
    },
    [speaking, stop, onRead, playLocal],
  );
  return { speak, stop, speaking, speechError };
}

export function JourneyTV() {
  const [token, setToken] = useState(
    localStorage.getItem("handback-tv-token") || "",
  );
  const [prefs, setPrefs] = useState<JourneyPreferences>(
    DEFAULT_JOURNEY_PREFERENCES,
  );
  const [hosted, setHosted] = useState(location.protocol === "https:");
  const [ready, setReady] = useState(false),
    [passenger, setPassenger] = useState("friend"),
    [code, setCode] = useState("");
  const [screen, setScreen] = useState("places"),
    [plan, setPlan] = useState<JourneyPlan>(),
    [option, setOption] = useState<JourneyOption>();
  const [step, setStep] = useState(-1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedJourney[]>([]),
    [session, setSession] = useState<StudySession>();
  const [, tick] = useState(0),
    remoteCount = useRef(0),
    sessionRef = useRef<StudySession | undefined>(undefined);
  sessionRef.current = session;
  const flush = useCallback(() => {
    const current = sessionRef.current,
      count = remoteCount.current;
    if (current && count) {
      remoteCount.current = 0;
      void request(`/api/study/${current.id}/event`, token, "POST", {
        type: "remote",
        count: Math.min(count, 500),
      }).catch(() => {});
    }
  }, [token]);
  const trackRead = useCallback(() => {
    if (sessionRef.current)
      void request(`/api/study/${sessionRef.current.id}/event`, token, "POST", {
        type: "read-aloud",
      }).catch(() => {});
  }, [token]);
  const voice = useSpeech(token, trackRead);
  const pair = useCallback(async (value: string) => {
    setBusy(true);
    setError("");
    try {
      const r = await request("/api/pair", "", "POST", { code: value });
      localStorage.setItem("handback-tv-token", r.token);
      setToken(r.token);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    const handler = (e: Event) => void pair(String((e as CustomEvent).detail));
    window.addEventListener("handback-pair", handler);
    return () => window.removeEventListener("handback-pair", handler);
  }, [pair]);
  useEffect(() => {
    if (!token && location.protocol === "https:")
      void request("/api/bootstrap", "")
        .then((b) => {
          if (b.previewToken) {
            localStorage.setItem("handback-tv-token", b.previewToken);
            setToken(b.previewToken);
          }
        })
        .catch((e) => setError(e.message));
  }, [token]);
  useEffect(() => {
    if (!token) return;
    let disposed = false;
    const load = async () => {
      try {
        const s = await request("/api/state", token);
        if (disposed) return;
        setHosted(s.deploymentMode === "cloud-preview");
        setPrefs(s.journeyPreferences);
        setPassenger(s.capability.passenger);
        setReady(true);
        if (sessionRef.current?.id !== s.study?.id) {
          flush();
          setSession(s.study || undefined);
        }
      } catch (e) {
        if (disposed) return;
        if ((e as any).status === 401) {
          localStorage.removeItem("handback-tv-token");
          setToken("");
          setReady(false);
        } else
          setError(
            location.protocol === "https:"
              ? "The preview is unavailable. Check your internet connection, then try again."
              : "Your local service is unavailable. Keep the paired laptop running, then try again.",
          );
      }
    };
    void load();
    const timer = setInterval(() => void load(), 2500);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [token, flush]);
  useEffect(() => {
    const input = () => {
      if (sessionRef.current?.condition === "handback") {
        remoteCount.current++;
        flush();
      }
    };
    window.addEventListener("handback-input", input);
    return () => {
      window.removeEventListener("handback-input", input);
      flush();
    };
  }, [flush]);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 15000);
    return () => clearInterval(t);
  }, []);
  const stale =
    !!plan &&
    (plan.stale || Date.now() - Date.parse(plan.fetchedAt) > 5 * 60000);
  const changedPrefs =
    !!plan && JSON.stringify(plan.preferences) !== JSON.stringify(prefs);
  const back = () => {
    voice.stop();
    setError("");
    if (screen === "steps") {
      setScreen("routes");
      setStep(-1);
    } else {
      setScreen("places");
      setPlan(undefined);
      setOption(undefined);
      setStep(-1);
    }
  };
  useRemote(`${screen}-${ready}-${busy}-${step}-${option?.id}`, back);
  const loadPlan = async (id: LondonPlaceId) => {
    voice.stop();
    setBusy(true);
    setError("");
    try {
      const result = await request<JourneyPlan>(
        "/api/journeys/plan",
        token,
        "POST",
        { destinationId: id },
      );
      setPlan(result);
      setPrefs(result.preferences);
      setOption(undefined);
      setStep(-1);
      setScreen("routes");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const openSaved = async () => {
    voice.stop();
    setBusy(true);
    setError("");
    try {
      setSaved(await request("/api/journeys/saved", token));
      setScreen("saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!plan || !option) return;
    setBusy(true);
    setError("");
    try {
      await request("/api/journeys/save", token, "POST", {
        planId: plan.id,
        optionId: option.id,
      });
      flush();
      setScreen("done");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const currentLeg = option && step >= 0 ? option.legs[step] : undefined;
  const narration = currentLeg
    ? `Step ${step + 1} of ${option!.legs.length}. ${currentLeg.detail}. About ${currentLeg.duration} minutes. ${currentLeg.disruptions.join(" ")}`
    : option
      ? `Your journey to ${plan?.destination}. ${option.duration} minutes, with ${option.walkingMinutes} minutes walking and ${option.changes} changes. Depart ${londonClock(option.departure)}, arrive ${londonClock(option.arrival)}, London time. ${prefs.stepFree ? "Step-free routing was requested. Check lift availability before travel." : ""}`
      : screen === "places"
        ? `Hello ${passenger}. Choose a familiar London station. Your starting point is ${LONDON_PLACES.find((p) => p.id === prefs.originId)?.name}.`
        : `Choose a journey to ${plan?.destination}. ${plan?.options.length || 0} routes meet your helper's walking and change limits.`;
  useEffect(() => {
    const read = () => voice.speak(narration);
    window.addEventListener("handback-read", read);
    return () => window.removeEventListener("handback-read", read);
  }, [narration, voice.speak]);
  return (
    <div className="tv-app live-tv">
      <header className="tv-header">
        <JourneyBrand />
        <nav className="tv-nav">
          <button
            data-remote
            onClick={() => {
              voice.stop();
              setScreen("places");
              setPlan(undefined);
              setOption(undefined);
              setStep(-1);
            }}
          >
            My places
          </button>
          <button data-remote onClick={() => void openSaved()}>
            Saved routes
          </button>
          <button data-remote onClick={() => location.assign("/tv")}>
            Booking lab
          </button>
        </nav>
        <span className="live-badge">London pilot · real TfL data</span>
      </header>
      <main className={`live-main live-screen-${screen}`}>
        {error && (
          <div className="alert" role="alert">
            {error}
            <button data-remote onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}
        {!token ? (
          <section className="live-pair">
            <p className="eyebrow">ONE SMALL SETUP</p>
            <h1>Make yourself at home.</h1>
            <p>
              Ask your helper for the pairing code. On Android TV, press Menu →
              Pair television.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void pair(code);
              }}
            >
              <label htmlFor="live-code">Pairing code</label>
              <input
                id="live-code"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
              />
              <button data-remote className="primary" disabled={busy}>
                Connect my TV
              </button>
            </form>
          </section>
        ) : !ready ? (
          <h1>Connecting to your private space…</h1>
        ) : (
          <>
            <div className="live-tools">
              <span className="eyebrow">
                {screen === "places"
                  ? "YOUR CHOICE. YOUR PACE."
                  : "A LITTLE CLARITY FOR THE JOURNEY"}
              </span>
              <button
                data-remote
                className="speech-button"
                onClick={() => voice.speak(narration)}
              >
                {voice.speaking ? "■ Stop reading" : "◖ Read aloud"}
              </button>
            </div>
            {voice.speechError && (
              <p role="status" className="voice-message">
                {voice.speechError}
              </p>
            )}
            {session && (
              <p className="study-indicator">
                Observation active · {session.kind} · {session.condition} · no
                audio recording
              </p>
            )}
            {screen === "places" && (
              <>
                <div className="live-welcome">
                  <div>
                    <h1>Where shall we go, {passenger}?</h1>
                    <p className="lead">
                      Real routes. Familiar places. One decision at a time.
                    </p>
                  </div>
                  <div className="origin-card">
                    <small>STARTING AT</small>
                    <strong>
                      {LONDON_PLACES.find((p) => p.id === prefs.originId)?.name}
                    </strong>
                    <span>
                      {prefs.stepFree
                        ? "Step-free routing requested"
                        : "Standard routing"}
                    </span>
                  </div>
                </div>
                <div className="preference-strip">
                  <span>Up to {prefs.maxWalkingMinutes} min walking</span>
                  <span>
                    {prefs.maxChanges === 0
                      ? "Direct transport only"
                      : `Up to ${prefs.maxChanges} change${prefs.maxChanges > 1 ? "s" : ""}`}
                  </span>
                  <span>No tickets or payments</span>
                </div>
                <div className="live-places">
                  {prefs.destinationIds.map((id, i) => {
                    const place = LONDON_PLACES.find((p) => p.id === id)!;
                    return (
                      <button
                        data-remote
                        data-autofocus={i === 0 ? "true" : undefined}
                        key={id}
                        disabled={busy}
                        className="live-place"
                        onClick={() => void loadPlan(id)}
                      >
                        <span className="place-number">0{i + 1}</span>
                        <h2>{place.name}</h2>
                        <p>{place.note}</p>
                        <span className="live-place-action">
                          {busy ? "Checking routes…" : "Find my route →"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="live-explainer">
                  Your helper sets the starting station and comfortable limits.
                  The destination stays your decision.
                </p>
              </>
            )}
            {screen === "routes" && plan && (
              <>
                <div className="live-heading">
                  <div>
                    <h1>{plan.destination}</h1>
                    <p>From {plan.origin} · times shown in London time</p>
                  </div>
                  <button
                    data-remote
                    disabled={busy}
                    className="secondary"
                    onClick={() => void loadPlan(plan.destinationId)}
                  >
                    Refresh routes
                  </button>
                </div>
                <Freshness plan={plan} stale={stale} />
                {changedPrefs && (
                  <div role="alert" className="alert">
                    Your helper changed the journey limits. Refresh before
                    choosing a route.
                  </div>
                )}
                {plan.options.length ? (
                  <div className="route-options">
                    {plan.options.map((o, i) => (
                      <button
                        data-remote
                        data-autofocus={i === 0 ? "true" : undefined}
                        disabled={busy || stale || changedPrefs}
                        className="route-option"
                        key={o.id}
                        onClick={() => {
                          voice.stop();
                          setOption(o);
                          setStep(-1);
                          setScreen("steps");
                        }}
                      >
                        <span className="route-duration">
                          {o.duration}
                          <small>minutes</small>
                        </span>
                        <span>
                          <strong>
                            {o.legs
                              .filter((l) => l.mode !== "walking")
                              .map((l) => l.instruction)
                              .join(" · ") || "Walking route"}
                          </strong>
                          <span>
                            {londonClock(o.departure)} →{" "}
                            {londonClock(o.arrival)} · {o.walkingMinutes} min
                            walking · {o.changes} changes
                          </span>
                          {o.warnings.length > 0 && (
                            <em>
                              Service alert reported — review before travel
                            </em>
                          )}
                        </span>
                        <b>Review →</b>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="no-route">
                    <h2>No returned route fits your limits.</h2>
                    <p>
                      We kept your walking and change limits. Your helper can
                      review them; nothing was silently relaxed.
                    </p>
                    <button
                      data-remote
                      data-autofocus
                      className="primary"
                      onClick={back}
                    >
                      Choose another place
                    </button>
                  </div>
                )}
                <p className="live-limit">
                  {prefs.stepFree
                    ? "Step-free routing requested from TfL. Lift availability and assistance are not guaranteed. "
                    : ""}
                  Fares and tickets are not checked. Review current service
                  information before travelling.
                </p>
              </>
            )}
            {screen === "steps" && plan && option && (
              <>
                <div className="step-layout">
                  <section>
                    <p className="eyebrow">
                      {step < 0
                        ? "YOUR JOURNEY AT A GLANCE"
                        : `STEP ${step + 1} OF ${option.legs.length}`}
                    </p>
                    <h1>
                      {currentLeg
                        ? currentLeg.instruction
                        : `Your route to ${plan.destination}.`}
                    </h1>
                    <p className="lead">
                      {currentLeg
                        ? currentLeg.detail
                        : `${option.duration} minutes · ${option.walkingMinutes} minutes walking · ${option.changes} changes`}
                    </p>
                    <p className="step-time">
                      {currentLeg
                        ? `${londonClock(currentLeg.departure)} → ${londonClock(currentLeg.arrival)} · about ${currentLeg.duration} min`
                        : `${londonClock(option.departure)} → ${londonClock(option.arrival)}`}{" "}
                      · London time
                    </p>
                    {currentLeg?.disruptions.map((d, i) => (
                      <p className="route-warning" key={i}>
                        {d}
                      </p>
                    ))}
                  </section>
                  <aside className="route-summary">
                    <small>FROM</small>
                    <strong>{plan.origin}</strong>
                    <span className="summary-line" />
                    <small>TO</small>
                    <strong>{plan.destination}</strong>
                    <span>
                      {step < 0
                        ? "Your choice, at your pace"
                        : `${step + 1} / ${option.legs.length}`}
                    </span>
                  </aside>
                </div>
                <div className="step-actions">
                  <button
                    data-remote
                    className="secondary"
                    onClick={() => {
                      voice.stop();
                      step < 0 ? back() : setStep(step - 1);
                    }}
                  >
                    {step < 0 ? "Other routes" : "Previous step"}
                  </button>
                  {step < option.legs.length - 1 ? (
                    <button
                      data-remote
                      data-autofocus
                      className="primary"
                      onClick={() => {
                        voice.stop();
                        setStep(step + 1);
                      }}
                    >
                      {step < 0 ? "Show me one step at a time" : "Next step →"}
                    </button>
                  ) : (
                    <button
                      data-remote
                      data-autofocus
                      className="primary"
                      disabled={busy || stale || changedPrefs}
                      onClick={() => void save()}
                    >
                      Save this route
                    </button>
                  )}
                </div>
                {(stale || changedPrefs) && (
                  <p role="alert" className="route-warning">
                    This route needs a fresh check. Return to the routes and
                    refresh before saving.
                  </p>
                )}
              </>
            )}
            {screen === "done" && (
              <section className="live-done">
                <div className="status-symbol">✓</div>
                <h1>Your route is saved.</h1>
                <p className="lead">
                  You chose it. You reviewed it. It’s here when you need it.
                </p>
                <p>
                  {hosted
                    ? "This saves a copy in the private preview."
                    : "This saves a copy on your paired laptop."}{" "}
                  No ticket or reservation was made.
                </p>
                <button
                  data-remote
                  data-autofocus
                  className="primary"
                  onClick={() => void openSaved()}
                >
                  See my saved routes
                </button>
              </section>
            )}
            {screen === "saved" && (
              <>
                <h1>Your saved routes.</h1>
                <p className="lead">
                  Saved copies are a reminder. Check a fresh route before you
                  set off.
                </p>
                <div className="route-options">
                  {saved.length ? (
                    saved.map((s, i) => (
                      <button
                        data-remote
                        data-autofocus={i === 0 ? "true" : undefined}
                        className="route-option"
                        key={s.id}
                        onClick={() => void loadPlan(s.plan.destinationId)}
                      >
                        <span className="place-number">↗</span>
                        <span>
                          <strong>{s.plan.destination}</strong>
                          <span>
                            From {s.plan.origin} · saved{" "}
                            {new Date(s.savedAt).toLocaleDateString("en-GB")}
                          </span>
                        </span>
                        <b>Check again →</b>
                      </button>
                    ))
                  ) : (
                    <div className="no-route">
                      <p>No routes saved yet.</p>
                      <button
                        data-remote
                        data-autofocus
                        className="primary"
                        onClick={back}
                      >
                        Choose a place
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </main>
      <footer className="live-footer">
        <div>
          <span>
            ↑↓←→ Move · OK Choose · Back Return · Play/Pause Read aloud
          </span>
          <span>
            {hosted ? "Private hosted preview" : "Paired laptop required"} ·{" "}
            {screen === "places"
              ? "request on demand"
              : "journey information, no booking"}
          </span>
        </div>
        <small>{TFL_ATTRIBUTION} Independent app; no TfL endorsement.</small>
      </footer>
    </div>
  );
}
function Freshness({ plan, stale }: { plan: JourneyPlan; stale: boolean }) {
  return (
    <div className={`freshness ${stale ? "is-stale" : ""}`} role="status">
      <span>
        {stale ? "Saved information — refresh needed" : "TfL response checked"}
      </span>
      <span>
        {new Date(plan.fetchedAt).toLocaleTimeString("en-GB", {
          timeZone: "Europe/London",
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        London time
      </span>
      {plan.staleReason && <span>{plan.staleReason}</span>}
    </div>
  );
}

export function JourneySetup({ token }: { token: string }) {
  const [prefs, setPrefs] = useState<JourneyPreferences>(),
    [message, setMessage] = useState("");
  useEffect(() => {
    request("/api/helper", token)
      .then((s) => setPrefs(s.journeyPreferences))
      .catch((e) => setMessage(e.message));
  }, [token]);
  if (!prefs) return <p>{message || "Loading journey settings…"}</p>;
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">A REAL SERVICE. A FAMILIAR ROUTE.</p>
          <h1>London, within their reach.</h1>
          <p>
            Choose public stations and comfortable limits. No passenger details
            are sent to TfL.
          </p>
        </div>
      </div>
      <form
        className="panel journey-setup"
        onSubmit={(e) => {
          e.preventDefault();
          request("/api/helper/journeys", token, "PUT", prefs)
            .then(() =>
              setMessage(
                "Journey settings saved. The TV updates automatically.",
              ),
            )
            .catch((e) => setMessage(e.message));
        }}
      >
        <label>
          Starting station
          <select
            value={prefs.originId}
            onChange={(e) => {
              const id = e.target.value as LondonPlaceId;
              setPrefs({
                ...prefs,
                originId: id,
                destinationIds: prefs.destinationIds.filter((x) => x !== id),
              });
            }}
          >
            {LONDON_PLACES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Familiar destinations (choose up to three)</legend>
          {LONDON_PLACES.filter((p) => p.id !== prefs.originId).map((p) => (
            <label className="check-label" key={p.id}>
              <input
                type="checkbox"
                checked={prefs.destinationIds.includes(p.id)}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    destinationIds: e.target.checked
                      ? [...prefs.destinationIds, p.id].slice(0, 3)
                      : prefs.destinationIds.filter((x) => x !== p.id),
                  })
                }
              />
              {p.name}
            </label>
          ))}
        </fieldset>
        <div className="settings-pair">
          <label>
            Maximum total walking (minutes)
            <input
              type="number"
              min="0"
              max="60"
              value={prefs.maxWalkingMinutes}
              onChange={(e) =>
                setPrefs({
                  ...prefs,
                  maxWalkingMinutes: Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Maximum transport changes
            <select
              value={prefs.maxChanges}
              onChange={(e) =>
                setPrefs({ ...prefs, maxChanges: Number(e.target.value) })
              }
            >
              {[0, 1, 2, 3].map((n) => (
                <option value={n} key={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={prefs.stepFree}
            onChange={(e) => setPrefs({ ...prefs, stepFree: e.target.checked })}
          />
          Request step-free access to the vehicle
        </label>
        <p>
          This is a routing preference, not a lift-availability guarantee. The
          app keeps walking and change limits even when no returned route fits.
        </p>
        <button className="primary" type="submit">
          Save journey settings
        </button>
        {message && <p role="status">{message}</p>}
        <a
          className="link-button"
          href="/tv/journeys"
          target="_blank"
          rel="noreferrer"
        >
          Open real journey TV preview →
        </a>
      </form>
      <p className="prototype-note">
        London pilot · read-only TfL API · no fares, ticket sales, or
        reservations · no API key required for this rate-limited prototype.
      </p>
    </>
  );
}
export function StudyPanel({ token }: { token: string }) {
  const [sessions, setSessions] = useState<StudySession[]>([]),
    [kind, setKind] = useState("self"),
    [condition, setCondition] = useState("handback"),
    [task, setTask] = useState("live-journey"),
    [consent, setConsent] = useState(false),
    [message, setMessage] = useState("");
  const load = useCallback(
    () =>
      request("/api/helper", token).then((s) => setSessions(s.studySessions)),
    [token],
  );
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 2000);
    return () => clearInterval(t);
  }, [load]);
  const active = sessions.find((s) => !s.endedAt),
    humans = sessions.filter((s) => s.kind === "human" && s.endedAt);
  const act = async (path: string, body: unknown) => {
    try {
      await request(path, token, "POST", body);
      await load();
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const exportData = async () => {
    const data = await request("/api/helper/study/export", token);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "handback-observations.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">OBSERVE FIRST. CLAIM SECOND.</p>
          <h1>Does it give independence back?</h1>
          <p>
            Opt-in observations. No names, audio, or video are collected.
            {location.protocol === "https:"
              ? " Records are stored on the hosted preview and shared with invited reviewers."
              : " Records stay on this laptop until you export them."}
          </p>
        </div>
      </div>
      <div className="study-grid">
        <section className="panel journey-setup">
          <h2>{active ? "Observation in progress" : "Start an observation"}</h2>
          {active ? (
            <>
              <p>
                {active.kind} · {active.condition} · {active.task}
              </p>
              <div className="study-counts">
                <strong>
                  {active.remotePresses}
                  <small>remote presses in Handback</small>
                </strong>
                <strong>
                  {active.assistance}
                  <small>times assistance was given</small>
                </strong>
                <strong>
                  {active.readAlouds}
                  <small>read-aloud requests</small>
                </strong>
              </div>
              <button
                className="secondary"
                onClick={() =>
                  void act(`/api/helper/study/${active.id}/assistance`, {})
                }
              >
                Record assistance
              </button>
              <p>
                Finish after the participant saves the requested route or stops.
                Success is observer-reported; selecting a button does not prove
                independent completion.
              </p>
              <div className="study-finish">
                {[
                  ["independent", "Completed independently"],
                  ["assisted", "Completed with help"],
                  ["incomplete", "Stopped / incomplete"],
                ].map(([outcome, label]) => (
                  <button
                    className="small-button"
                    key={outcome}
                    onClick={() =>
                      void act(`/api/helper/study/${active.id}/finish`, {
                        outcome,
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act("/api/helper/study/start", {
                  kind,
                  condition,
                  task,
                  consent,
                });
              }}
            >
              <label>
                Who is testing?
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="self">Builder self-test</option>
                  <option value="human">Consenting participant</option>
                  <option value="automated">Automated verification</option>
                </select>
              </label>
              <label>
                Interface condition
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                >
                  <option value="handback">Handback TV</option>
                  <option value="baseline">Original service / baseline</option>
                </select>
              </label>
              <label>
                Assigned task
                <select value={task} onChange={(e) => setTask(e.target.value)}>
                  <option value="live-journey">
                    Find and review a real journey
                  </option>
                  <option value="reference-booking">
                    Book the fictional shuttle
                  </option>
                </select>
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                The participant agreed to this observation and understands they
                may stop.
              </label>
              <button className="primary" disabled={!consent}>
                Start timer
              </button>
            </form>
          )}
          {message && <p role="alert">{message}</p>}
        </section>
        <section className="panel journey-setup">
          <h2>Evidence, without invented results</h2>
          <div className="human-count">
            {humans.length}
            <small>completed participant observations</small>
          </div>
          <p>
            {humans.length === 0
              ? "No participant results yet. Automated checks and builder self-tests do not count as customer validation."
              : "A small convenience sample provides observations, not population-level proof. Review the exported conditions and assistance before making claims."}
          </p>
          <p>
            Task: “From the starting station your helper chose, find a route to
            Green Park. Tell me the walking time, review the steps, and save
            it.” Keep the same task and routing limits across conditions;
            alternate the order.
          </p>
          <p>
            Record time from start to finish and every time you help. Remote
            presses are captured only within Handback; baseline input counts are
            not comparable. No statistical improvement is claimed automatically.
          </p>
          <button className="secondary" onClick={() => void exportData()}>
            Export observations
          </button>
        </section>
      </div>
      <section className="panel study-table">
        <h2>Observation ledger</h2>
        <table>
          <thead>
            <tr>
              <th>Kind / interface</th>
              <th>Result</th>
              <th>Time</th>
              <th>Remote presses</th>
              <th>Help</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.kind} / {s.condition}
                </td>
                <td>{s.outcome || "In progress"}</td>
                <td>
                  {s.durationSeconds === undefined
                    ? "Running"
                    : `${s.durationSeconds}s`}
                </td>
                <td>
                  {s.condition === "handback"
                    ? s.remotePresses
                    : "Not measured"}
                </td>
                <td>{s.assistance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
