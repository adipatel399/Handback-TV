import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  DESTINATIONS,
  money,
  type Capability,
  type Task,
  type Terms,
  type Receipt,
} from "../../server/shared";
import "./style.css";
import { useRemote } from "./remote";
import { JourneyTV, JourneySetup, StudyPanel } from "./journey-ui";

const dateLabel = (d: string, short = false) =>
  new Intl.DateTimeFormat("en-IN", {
    weekday: short ? "short" : "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(`${d}T12:00:00+05:30`));
const timeLabel = (t: string) =>
  new Date(`2026-01-01T${t}:00`).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
async function api<T = any>(
  path: string,
  token?: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch(path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (data.loginRequired && location.protocol === "https:")
    location.assign(
      "/auth/login?next=" +
        encodeURIComponent(
          location.pathname.startsWith("/helper") ? "/helper" : "/tv",
        ),
    );
  if (!r.ok) {
    const e = new Error(data.error || "The local service is unavailable.");
    (e as any).status = r.status;
    throw e;
  }
  return data;
}
function Icon({ name, size = 24 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    back: <path d="m14 6-6 6 6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    book: (
      <>
        <path d="M12 6v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 3C8 2 2 8 5 15c4 9 16 1 15-12Z" />
        <path d="M3 21 15 9" />
      </>
    ),
    art: (
      <>
        <path d="m12 3 9 6-9 12L3 9Z" />
        <path d="M3 9h18M8 9l4 12 4-12M8 9l4-6 4 6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6l4 2" />
      </>
    ),
    location: (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="3" />
        <circle cx="16" cy="17" r="3" />
      </>
    ),
    trip: (
      <>
        <rect x="5" y="3" width="14" height="16" rx="3" />
        <path d="M5 11h14M8 7h8M8 19v2M16 19v2" />
        <circle cx="9" cy="15" r="1" />
        <circle cx="15" cy="15" r="1" />
      </>
    ),
    warning: (
      <>
        <path d="m12 3 10 18H2Z" />
        <path d="M12 9v5M12 17h.01" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7" />
      </>
    ),
    link: (
      <>
        <path
          d="m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l4-4M16 8l2-2a4 4 0 0 1 6 6l-4 4"
          transform="translate(1 0) scale(.9)"
        />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M5 8a8 8 0 0 1 14-2l1 6M4 12l1 6a8 8 0 0 0 14-2" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    external: (
      <>
        <path d="M14 3h7v7M21 3l-11 11" />
        <path d="M10 3H3v18h18v-7" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.trip}
    </svg>
  );
}
function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "light" : ""}`}>
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
function JourneyArt({
  kind = "library",
  compact = false,
}: {
  kind?: string;
  compact?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 600 360"
      className={`journey-art ${compact ? "compact" : ""}`}
      role="img"
      aria-label="Illustration of a community shuttle travelling past a library and trees"
    >
      <defs>
        <linearGradient id={`sky-${kind}`} x2="0" y2="1">
          <stop
            stopColor={
              kind === "arts"
                ? "#d8d5ec"
                : kind === "garden"
                  ? "#d7e7c6"
                  : "#dce9e2"
            }
          />
          <stop offset="1" stopColor="#f0efe3" />
        </linearGradient>
      </defs>
      <rect width="600" height="360" rx="26" fill={`url(#sky-${kind})`} />
      <circle cx="469" cy="75" r="37" fill="#f6dc91" />
      <path d="M0 250Q120 180 260 240T600 210V360H0Z" fill="#b6c8a9" />
      <path d="M0 290Q220 220 600 270V360H0Z" fill="#a0b69c" />
      <path
        d="M-40 330Q230 220 650 315"
        stroke="#eae4d3"
        strokeWidth="62"
        fill="none"
      />
      <path
        d="M-40 330Q230 220 650 315"
        stroke="#fffaf0"
        strokeWidth="2"
        strokeDasharray="12 14"
        fill="none"
      />
      <g transform="translate(345 122)">
        <rect x="0" y="24" width="124" height="96" fill="#e9ddc1" />
        <path d="m-10 25 72-37 72 37Z" fill="#d1a96f" />
        <rect x="13" y="37" width="98" height="13" rx="2" fill="#fff5da" />
        <text
          x="62"
          y="47"
          textAnchor="middle"
          fontFamily="sans-serif"
          fontSize="8"
          fill="#5a6458"
        >
          {kind === "library"
            ? "RIVERSIDE LIBRARY"
            : kind === "garden"
              ? "COMMUNITY GARDEN"
              : "THE ARTS CENTRE"}
        </text>
        <path
          d="M21 61v45M48 61v45M76 61v45M103 61v45"
          stroke="#b4a58b"
          strokeWidth="10"
        />
        <rect x="49" y="80" width="26" height="40" fill="#57756d" />
        <path d="M-7 120h138" stroke="#c7b69c" strokeWidth="9" />
      </g>
      <g fill="#5f8063">
        <path d="M87 251v-90" stroke="#7b7762" strokeWidth="8" />
        <ellipse cx="87" cy="144" rx="39" ry="57" />
        <ellipse cx="535" cy="193" rx="29" ry="42" />
        <path d="M535 246v-43" stroke="#7b7762" strokeWidth="7" />
      </g>
      <g transform="translate(143 202)">
        <ellipse cx="82" cy="91" rx="101" ry="12" fill="#627865" opacity=".2" />
        <rect x="0" y="2" width="175" height="77" rx="13" fill="#e7ae69" />
        <path d="M175 24h11l17 30v25h-37V24Z" fill="#ca8a4f" />
        <rect x="12" y="14" width="147" height="33" rx="5" fill="#e8f2e9" />
        <path
          d="M51 14v33M90 14v33M129 14v33"
          stroke="#b67943"
          strokeWidth="4"
        />
        <path d="M181 31h6l11 23h-17Z" fill="#dbebe5" />
        <path d="M9 60h148" stroke="#f9d7a4" strokeWidth="6" />
        <circle cx="39" cy="80" r="16" fill="#314b4b" />
        <circle cx="39" cy="80" r="7" fill="#c9d8cd" />
        <circle cx="169" cy="80" r="16" fill="#314b4b" />
        <circle cx="169" cy="80" r="7" fill="#c9d8cd" />
        <text
          x="73"
          y="70"
          fill="#684e36"
          fontFamily="sans-serif"
          fontSize="8"
          letterSpacing="2"
        >
          WILLOW LINK
        </text>
        <rect x="197" y="61" width="7" height="8" rx="2" fill="#fff0c2" />
      </g>
      <g fill="#f6f1df">
        <circle cx="37" cy="285" r="3" />
        <circle cx="511" cy="290" r="3" />
        <circle cx="522" cy="296" r="2" />
      </g>
    </svg>
  );
}

function TVApp() {
  const [token, setToken] = useState(
    localStorage.getItem("handback-tv-token") || "",
  );
  const [boot, setBoot] = useState<{ dates: string[] }>();
  const [cap, setCap] = useState<Capability>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [observation, setObservation] = useState<{
    id: string;
    condition: string;
  }>();
  const [screen, setScreen] = useState("home"),
    [destination, setDestination] = useState("library"),
    [date, setDate] = useState(""),
    [task, setTask] = useState<Task>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [offline, setOffline] = useState(false),
    [code, setCode] = useState("");
  const load = useCallback(async () => {
    try {
      const b = await api("/api/bootstrap");
      if (!token && b.previewToken) {
        localStorage.setItem("handback-tv-token", b.previewToken);
        setToken(b.previewToken);
      }
      setBoot(b);
      setDate((x) => x || b.dates[0]);
      if (token) {
        const state = await api("/api/state", token);
        setCap(state.capability);
        setTasks(state.tasks);
        setObservation(state.study || undefined);
        setTask((old) =>
          old ? state.tasks.find((t: Task) => t.id === old.id) || old : old,
        );
      }
      setOffline(false);
    } catch (e) {
      if ((e as any).status === 401) {
        localStorage.removeItem("handback-tv-token");
        setToken("");
        setCap(undefined);
      } else setOffline(true);
    }
  }, [token]);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (!observation || observation.condition !== "handback") return;
    const input = () => {
      void api(`/api/study/${observation.id}/event`, token, "POST", {
        type: "remote",
      }).catch(() => {});
    };
    window.addEventListener("handback-input", input);
    return () => window.removeEventListener("handback-input", input);
  }, [observation?.id, observation?.condition, token]);
  useEffect(() => {
    const listener = (e: Event) => {
      const value = String((e as CustomEvent).detail);
      setCode(value);
      setBusy(true);
      api("/api/pair", undefined, "POST", { code: value })
        .then((r) => {
          localStorage.setItem("handback-tv-token", r.token);
          setToken(r.token);
          setError("");
        })
        .catch((e) => setError(e.message))
        .finally(() => setBusy(false));
    };
    window.addEventListener("handback-pair", listener);
    return () => window.removeEventListener("handback-pair", listener);
  }, []);
  const back = () => {
    if (busy) return;
    setError("");
    if (screen === "review") setScreen("when");
    else if (screen === "when") setScreen("home");
    else setScreen("home");
  };
  useRemote(`${screen}-${!!cap}-${busy}`, back);
  const run = async (fn: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const pair = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const r = await api("/api/pair", undefined, "POST", { code });
      localStorage.setItem("handback-tv-token", r.token);
      setToken(r.token);
    });
  };
  const preview = () =>
    void run(async () => {
      const t = await api<Task>("/api/tasks", token, "POST", {
        destinationId: destination,
        date,
      });
      setTask(t);
      setScreen("review");
    });
  const confirm = () =>
    void run(async () => {
      if (!task) return;
      const t = await api<Task>(
        `/api/tasks/${task.id}/confirm`,
        token,
        "POST",
        { confirmationToken: task.confirmationToken },
      );
      setTask(t);
      setScreen(t.state === "awaiting_confirmation" ? "review" : "result");
    });
  const check = () =>
    void run(async () => {
      if (task)
        setTask(await api(`/api/tasks/${task.id}/check`, token, "POST", {}));
    });
  const d = DESTINATIONS.find((x) => x.id === destination)!;
  const resume =
    tasks.find((t) => t.state === "unknown") ||
    tasks.find((t) => t.state === "submitting") ||
    tasks.find((t) => t.state === "awaiting_confirmation");
  const goTask = (t: Task) => {
    setTask(t);
    setDestination(t.terms.destinationId);
    setScreen(t.state === "awaiting_confirmation" ? "review" : "result");
  };
  return (
    <div className="tv-app">
      <header className="tv-header">
        <Brand light />
        <div className="tv-nav">
          <button
            data-remote
            className={screen === "home" ? "active" : ""}
            onClick={() => {
              setScreen("home");
              setError("");
            }}
          >
            My day
          </button>
          <button
            data-remote
            className={screen === "trips" ? "active" : ""}
            onClick={() => setScreen("trips")}
          >
            My trips{" "}
            <span>{tasks.filter((t) => t.state === "verified").length}</span>
          </button>
          <button data-remote onClick={() => location.assign("/tv/journeys")}>
            Live journeys
          </button>
        </div>
        <div className="tv-person">
          <span className="online-dot" /> Your private space{" "}
          <span className="avatar">{cap?.passenger.charAt(0) || "H"}</span>
        </div>
      </header>
      {offline ? (
        <main className="pair-main">
          <div className="status-symbol warn">
            <Icon name="link" size={40} />
          </div>
          <p className="eyebrow">LET’S RECONNECT</p>
          <h1>Your connection is resting.</h1>
          <p className="lead">
            {location.protocol === "https:"
              ? "Check your internet connection, then try again."
              : "Keep your laptop awake and Handback running."}
            <br />
            Your saved trips will be here when it reconnects.
          </p>
          <button
            data-remote
            data-autofocus
            className="primary"
            onClick={() => void load()}
          >
            <Icon name="refresh" />
            Try again
          </button>
        </main>
      ) : !cap ? (
        <main className="pair-main">
          <div className="pair-symbol">
            <Brand />
          </div>
          <p className="eyebrow">A LITTLE HELP TO GET STARTED</p>
          <h1>Make yourself at home.</h1>
          <p className="lead">
            Ask your helper for the six-digit pairing code.
            <br />
            You only need to do this once.
          </p>
          <form onSubmit={pair}>
            <label className="sr-only" htmlFor="pair-code">
              Pairing code
            </label>
            <input
              id="pair-code"
              className="pair-code"
              autoComplete="off"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              required
            />
            <button data-remote className="primary" disabled={busy}>
              Connect my TV <Icon name="arrow" />
            </button>
          </form>
          <p className="muted">
            Helper dashboard: localhost:4310/helper on your laptop
          </p>
          {error && (
            <div role="alert" className="alert">
              {error}
            </div>
          )}
        </main>
      ) : (
        <main className={`tv-main screen-${screen}`}>
          {error && (
            <div role="alert" className="alert">
              <Icon name="warning" />
              {error}
              <button data-remote onClick={() => setError("")}>
                Dismiss
              </button>
            </div>
          )}
          {screen === "home" && (
            <>
              <div className="home-intro">
                <div>
                  <p className="eyebrow">YOUR DAY, YOUR WAY</p>
                  <h1>
                    Hello, {cap.passenger}.<br />
                    <span>A good day starts here.</span>
                  </h1>
                  <p className="lead">
                    A familiar place. A little adventure.
                    <br />
                    Where would you like to go?
                  </p>
                  <div className="helper-note">
                    <Icon name="shield" size={19} />
                    <span>Your trips are set up. The choice is yours.</span>
                  </div>
                </div>
                <div className="hero-art">
                  <JourneyArt />
                  <div className="art-caption">
                    <span className="tiny-dot" /> A seat on your community
                    shuttle <span>Willow Link ↗</span>
                  </div>
                </div>
              </div>
              {resume && (
                <button
                  data-remote
                  className="resume-banner"
                  onClick={() => goTask(resume)}
                >
                  <Icon
                    name={resume.state === "unknown" ? "warning" : "clock"}
                  />
                  <span>
                    {resume.state === "unknown"
                      ? "Let’s check your unfinished booking"
                      : "You have a trip ready to review"}
                  </span>
                  <Icon name="arrow" />
                </button>
              )}
              <div className="section-label">
                <h2>Your familiar places</h2>
                <span>Choose with your remote</span>
              </div>
              <div className="destination-grid">
                {DESTINATIONS.filter((x) =>
                  cap.allowedDestinations.includes(x.id),
                ).map((x, i) => (
                  <button
                    data-remote
                    data-autofocus={i === 0 ? "true" : undefined}
                    className="destination-card"
                    key={x.id}
                    onClick={() => {
                      setDestination(x.id);
                      setScreen("when");
                      setError("");
                    }}
                  >
                    <div className="place-icon" style={{ background: x.color }}>
                      <Icon
                        name={
                          x.id === "library"
                            ? "book"
                            : x.id === "garden"
                              ? "leaf"
                              : "art"
                        }
                        size={28}
                      />
                    </div>
                    <div>
                      <h3>{x.name}</h3>
                      <p>{x.note}</p>
                    </div>
                    <span className="card-arrow">
                      <Icon name="arrow" />
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          {screen === "when" && (
            <>
              <button data-remote className="back-button" onClick={back}>
                <Icon name="back" />
                Your places
              </button>
              <div className="journey-layout">
                <section className="journey-copy">
                  <p className="eyebrow">SOMETHING TO LOOK FORWARD TO</p>
                  <h1>{d.name}</h1>
                  <p className="lead">When would you like to go?</p>
                  <div className="date-grid">
                    {boot?.dates.slice(0, 4).map((x, i) => (
                      <button
                        data-remote
                        data-autofocus={i === 0 ? "true" : undefined}
                        aria-pressed={date === x}
                        className={`date-choice ${date === x ? "selected" : ""}`}
                        key={x}
                        onClick={() => setDate(x)}
                      >
                        <span>
                          {i === 0
                            ? "Tomorrow"
                            : new Date(
                                `${x}T12:00:00+05:30`,
                              ).toLocaleDateString("en-IN", {
                                weekday: "short",
                              })}
                        </span>
                        <strong>
                          {new Date(`${x}T12:00:00+05:30`).getDate()}
                        </strong>
                        <small>
                          {new Date(`${x}T12:00:00+05:30`).toLocaleDateString(
                            "en-IN",
                            { month: "short" },
                          )}
                        </small>
                      </button>
                    ))}
                  </div>
                  <p className="trip-hint">
                    <Icon name="clock" size={19} /> Your usual departure is{" "}
                    {timeLabel(d.time)}
                  </p>
                  <button
                    data-remote
                    className="primary"
                    disabled={busy}
                    onClick={preview}
                  >
                    {busy ? (
                      <>
                        <span className="spinner" />
                        Checking the shuttle…
                      </>
                    ) : (
                      <>
                        Review my trip
                        <Icon name="arrow" />
                      </>
                    )}
                  </button>
                  <p className="quiet-note">
                    You’ll see the current fare before you decide.
                  </p>
                </section>
                <aside className="destination-art">
                  <JourneyArt kind={d.id} />
                  <div className="route-line">
                    <span className="route-dot" />
                    <div>
                      <small>PICKUP</small>
                      <strong>{cap.pickup}</strong>
                    </div>
                    <span className="route-connector" />
                    <span className="route-dot filled" />
                    <div>
                      <small>DESTINATION</small>
                      <strong>{d.name}</strong>
                    </div>
                  </div>
                </aside>
              </div>
            </>
          )}
          {screen === "review" && task && (
            <>
              <button
                data-remote
                className="back-button"
                disabled={busy}
                onClick={back}
              >
                <Icon name="back" />
                Choose a day
              </button>
              <div className="review-layout">
                <section>
                  <p className="eyebrow">YOUR TRIP, YOUR DECISION</p>
                  <h1>Does this look right?</h1>
                  <p className="lead">
                    One last look, then you’re on your way.
                  </p>
                  <div
                    className={`review-notice ${task.message.includes("changed") || task.message.includes("updated") ? "changed" : ""}`}
                    role="status"
                  >
                    <Icon
                      name={
                        task.message.includes("changed") ||
                        task.message.includes("updated")
                          ? "warning"
                          : "shield"
                      }
                    />
                    <span>{task.message}</span>
                  </div>
                  <button
                    data-remote
                    data-autofocus
                    className="primary big"
                    disabled={busy}
                    onClick={confirm}
                  >
                    {busy ? (
                      <>
                        <span className="spinner" />
                        Booking and checking…
                      </>
                    ) : (
                      <>
                        Yes, book this trip
                        <Icon name="check" />
                      </>
                    )}
                  </button>
                  <button
                    data-remote
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api(
                          `/api/tasks/${task.id}/cancel`,
                          token,
                          "POST",
                          {},
                        );
                        setTask(undefined);
                        setScreen("home");
                      })
                    }
                  >
                    Not now
                  </button>
                  <p className="quiet-note">
                    A reservation on our fictional reference service.
                    <br />
                    No payment is taken.
                  </p>
                </section>
                <TripTicket terms={task.terms} />
              </div>
            </>
          )}
          {screen === "result" && task && (
            <div className="result-layout">
              <section>
                <div
                  className={`status-symbol ${task.state === "verified" ? "success" : "warn"}`}
                >
                  <Icon
                    name={
                      task.state === "verified"
                        ? "check"
                        : task.state === "submitting"
                          ? "clock"
                          : "warning"
                    }
                    size={38}
                  />
                </div>
                <p className="eyebrow">
                  {task.state === "verified"
                    ? "ALL SET. ENJOY YOUR DAY."
                    : task.state === "unknown"
                      ? "LET’S BE SURE"
                      : "YOUR TRIP"}
                </p>
                <h1>
                  {task.state === "verified" ? (
                    <>
                      You’re going places,
                      <br />
                      {cap.passenger}.
                    </>
                  ) : task.state === "submitting" ? (
                    "We’re checking your trip."
                  ) : task.state === "failed" ? (
                    "Let’s pause here."
                  ) : (
                    "Your booking needs a check."
                  )}
                </h1>
                <p className="lead result-message">{task.message}</p>
                {task.state === "unknown" ? (
                  <button
                    data-remote
                    data-autofocus
                    className="primary"
                    disabled={busy}
                    onClick={check}
                  >
                    {busy ? (
                      <span className="spinner" />
                    ) : (
                      <Icon name="refresh" />
                    )}
                    Check booking result
                  </button>
                ) : (
                  <button
                    data-remote
                    data-autofocus
                    className="primary"
                    onClick={() => {
                      setTask(undefined);
                      setScreen("home");
                    }}
                  >
                    Back to my day
                    <Icon name="home" />
                  </button>
                )}
                {task.state === "unknown" && (
                  <button
                    data-remote
                    className="text-button"
                    onClick={() => setScreen("home")}
                  >
                    Back to my day
                  </button>
                )}
                {task.state === "verified" && (
                  <div className="verification-note">
                    <Icon name="shield" size={18} />
                    <span>Checked against the provider’s stored booking.</span>
                  </div>
                )}
              </section>
              <TripTicket terms={task.terms} receipt={task.receipt} />
            </div>
          )}
          {screen === "trips" && (
            <>
              <p className="eyebrow">A LITTLE SOMETHING ON THE CALENDAR</p>
              <h1>Your trips.</h1>
              <p className="lead">Your plans, all in one familiar place.</p>
              <div className="trip-list">
                {tasks.filter((t) => t.state !== "cancelled").length ? (
                  tasks
                    .filter((t) => t.state !== "cancelled")
                    .map((t, i) => (
                      <button
                        data-remote
                        data-autofocus={i === 0 ? "true" : undefined}
                        key={t.id}
                        onClick={() => goTask(t)}
                      >
                        <span className="place-icon">
                          <Icon name="trip" size={28} />
                        </span>
                        <span>
                          <strong>{t.terms.destination}</strong>
                          <small>
                            {dateLabel(t.terms.date)} ·{" "}
                            {timeLabel(t.terms.time)}
                          </small>
                        </span>
                        <span
                          className={`tag ${t.state === "verified" ? "verified" : ""}`}
                        >
                          {t.state === "verified"
                            ? "Booking checked"
                            : t.state === "awaiting_confirmation"
                              ? "Ready to review"
                              : t.state === "unknown"
                                ? "Needs a check"
                                : t.state}
                        </span>
                        <Icon name="arrow" />
                      </button>
                    ))
                ) : (
                  <div className="empty-state">
                    <Icon name="trip" size={40} />
                    <h2>Your next outing starts here.</h2>
                    <p>Choose a familiar place to plan your first trip.</p>
                    <button
                      data-remote
                      data-autofocus
                      className="primary"
                      onClick={() => setScreen("home")}
                    >
                      Explore my places
                      <Icon name="arrow" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      )}
      <footer className="tv-footer">
        <span>
          <span className="keycap">↑↓←→</span> Move{" "}
          <span className="keycap">OK</span> Choose{" "}
          <span className="keycap">↩</span> Go back
        </span>
        <span>
          <span className="tiny-dot" />
          Local reference service · no real charges
        </span>
      </footer>
    </div>
  );
}
function TripTicket({
  terms: t,
  receipt,
}: {
  terms: Terms;
  receipt?: Receipt;
}) {
  return (
    <aside className={`trip-ticket ${receipt ? "complete" : ""}`}>
      <div className="ticket-top">
        <span className="ticket-operator">
          <Icon name="trip" size={23} /> WILLOW LINK
        </span>
        <span className="tag">Community shuttle</span>
      </div>
      <h2>{t.destination}</h2>
      <p className="ticket-passenger">A seat for {t.passenger}</p>
      <div className="ticket-journey">
        <div>
          <span className="route-dot" />
          <span>
            <small>FROM</small>
            <strong>{t.pickup}</strong>
          </span>
        </div>
        <div>
          <span className="route-dot filled" />
          <span>
            <small>TO</small>
            <strong>{t.destination}</strong>
          </span>
        </div>
      </div>
      <div className="ticket-facts">
        <div>
          <small>DAY</small>
          <strong>{dateLabel(t.date, true)}</strong>
        </div>
        <div>
          <small>DEPARTURE</small>
          <strong>{timeLabel(t.time)}</strong>
        </div>
      </div>
      <div className="ticket-fare">
        <span>Trip fare</span>
        <strong>
          {money(t.fare)}
          <small> INR</small>
        </strong>
      </div>
      {receipt ? (
        <div className="ticket-receipt">
          <span>
            <Icon name="shield" size={18} /> Reservation verified
          </span>
          <strong>{receipt.reference}</strong>
          <small>
            {receipt.verifiedAt
              ? `Checked ${new Date(receipt.verifiedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
              : "Stored by the provider"}
          </small>
        </div>
      ) : (
        <p className="ticket-footnote">
          Current terms · nothing booked until you confirm
        </p>
      )}
    </aside>
  );
}

function HelperApp() {
  const [token, setToken] = useState(""),
    [state, setState] = useState<any>(),
    [cap, setCap] = useState<Capability>(),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("overview");
  const load = useCallback(
    async (t = token) => {
      if (!t) return;
      try {
        setState(await api("/api/helper", t));
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [token],
  );
  useEffect(() => {
    api("/api/bootstrap?role=helper")
      .then((b) => {
        if (!b.adminToken)
          throw new Error(
            "Open this dashboard using localhost on the paired laptop.",
          );
        setToken(b.adminToken);
        return api("/api/helper", b.adminToken);
      })
      .then((s) => {
        setState(s);
        setCap(s.capability);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const i = setInterval(() => void load(), 3000);
    return () => clearInterval(i);
  }, [load]);
  const action = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const changeLab = (patch: unknown) =>
    void action(async () => {
      await api("/api/lab", token, "POST", patch);
      setMessage(
        "Test scenario updated. The TV will check the provider’s current terms.",
      );
    });
  return (
    <div className="helper-app">
      <aside className="helper-sidebar">
        <Brand />
        <div className="workspace-label">FAMILY WORKSPACE</div>
        <nav>
          {[
            ["overview", "home", "Overview"],
            ["setup", "settings", "Supported task"],
            ["evidence", "shield", "Activity & evidence"],
            ["journeys", "trip", "Live journeys"],
            ["study", "clock", "Usability sessions"],
            ["lab", "refresh", "Demo controls"],
          ].map(([id, icon, label]) => (
            <button
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
              key={id}
            >
              <Icon name={icon} />
              {label}
              {tab === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="online-dot" />
          <strong>Made for your home.</strong>
          <p>
            {state?.deploymentMode === "cloud-preview"
              ? "Hosted private preview."
              : "Runs on this laptop."}
            <br />
            Your personal details stay in this private workspace.
          </p>
        </div>
        <a
          className="sidebar-link"
          href="/tv/journeys"
          target="_blank"
          rel="noreferrer"
        >
          Open TV preview
          <Icon name="external" size={17} />
        </a>
        <a
          className="sidebar-link"
          href="/provider"
          target="_blank"
          rel="noreferrer"
        >
          Reference provider
          <Icon name="external" size={17} />
        </a>
        <div className="sidebar-user">
          <span className="avatar">A</span>
          <span>
            <strong>Aditya’s workspace</strong>
            <small>
              {state?.deploymentMode === "cloud-preview"
                ? "Private hosted preview"
                : "Local prototype"}
            </small>
          </span>
        </div>
      </aside>
      <div className="helper-content">
        <header className="helper-header">
          <span>
            Handback /{" "}
            <strong>
              {tab === "overview"
                ? "Overview"
                : tab === "setup"
                  ? "Supported task"
                  : tab === "evidence"
                    ? "Activity & evidence"
                    : tab === "journeys"
                      ? "Live journeys"
                      : tab === "study"
                        ? "Usability sessions"
                        : "Demo controls"}
            </strong>
          </span>
          <span className="local-badge">
            <span className="online-dot" />{" "}
            {state?.deploymentMode === "cloud-preview"
              ? "Hosted preview"
              : "Local service"}
          </span>
        </header>
        <main className="helper-main">
          {tab === "journeys" && token && <JourneySetup token={token} />}
          {tab === "study" && token && <StudyPanel token={token} />}
          {error && (
            <div className="alert" role="alert">
              <Icon name="warning" />
              {error}
            </div>
          )}
          {message && (
            <div className="toast" role="status">
              <Icon name="check" />
              {message}
            </div>
          )}
          {tab === "overview" && (
            <>
              <div className="dashboard-heading">
                <div>
                  <p className="eyebrow">A LITTLE SETUP. A LOT MORE FREEDOM.</p>
                  <h1>Give the everyday back.</h1>
                  <p>Set up a familiar task. Let them take it from there.</p>
                </div>
                <span className="profile-chip">
                  <span className="avatar">
                    {state?.capability.passenger.charAt(0) || "A"}
                  </span>
                  {state?.capability.passenger}’s space
                </span>
              </div>
              <section className="dashboard-hero">
                <div>
                  <span className="pill-light">LIVE JOURNEY PILOT</span>
                  <h2>
                    A familiar trip.
                    <br />
                    Their own decision.
                  </h2>
                  <p>
                    Real London journeys, reviewed
                    <br />
                    one clear step at a time.
                  </p>
                  <button
                    className="primary"
                    onClick={() => setTab("journeys")}
                  >
                    Set up real journeys
                    <Icon name="arrow" />
                  </button>
                </div>
                <svg
                  className="helper-route-art"
                  viewBox="0 0 450 260"
                  role="img"
                  aria-label="Illustration of a familiar starting point and destination linked by a route"
                >
                  <path
                    d="M60 180C150 180 110 70 220 70S290 180 390 90"
                    fill="none"
                    stroke="#d5c49a"
                    strokeWidth="4"
                    strokeDasharray="9 9"
                  />
                  <circle cx="60" cy="180" r="24" fill="#e9c18b" />
                  <circle cx="60" cy="180" r="9" fill="#1c4946" />
                  <circle cx="390" cy="90" r="28" fill="#d7e2ba" />
                  <circle cx="390" cy="90" r="10" fill="#1c4946" />
                  <text
                    x="45"
                    y="232"
                    fill="#e8efd6"
                    fontSize="17"
                    fontFamily="Arial"
                  >
                    A familiar start
                  </text>
                  <text
                    x="255"
                    y="42"
                    fill="#e8efd6"
                    fontSize="17"
                    fontFamily="Arial"
                  >
                    Their choice of destination
                  </text>
                  <path d="m208 139 14-14 14 14v26h-28Z" fill="#d7e2ba" />
                  <path d="M218 165v-15h8v15" fill="#365d50" />
                </svg>
              </section>
              <div className="dashboard-row">
                <section className="panel pairing-panel">
                  <div className="panel-title">
                    <span className="soft-icon">
                      <Icon name="link" />
                    </span>
                    <div>
                      <h2>Connect their television</h2>
                      <p>
                        {state?.deploymentMode === "cloud-preview"
                          ? "A private connection to this preview."
                          : "A private connection to this laptop."}
                      </p>
                    </div>
                  </div>
                  <div className="pairing-digits">
                    {state?.deploymentMode === "cloud-preview"
                      ? "Ready"
                      : state?.pairing?.used
                        ? "Paired"
                        : state?.pairing?.code || "······"}
                  </div>
                  <div className="pairing-bottom">
                    <span>
                      {state?.deploymentMode === "cloud-preview"
                        ? "Sign in on the TV with the private preview password."
                        : state?.pairing?.used
                          ? "Your television is connected."
                          : state?.pairing &&
                              Date.parse(state.pairing.expiresAt) < Date.now()
                            ? "Code expired. Generate a new one."
                            : "Enter this code on the TV. Valid for 10 minutes."}
                    </span>
                    {state?.deploymentMode === "cloud-preview" ? (
                      <a className="link-button" href="/tv/journeys">
                        Open TV preview →
                      </a>
                    ) : (
                      <button
                        disabled={busy}
                        className="small-button"
                        onClick={() =>
                          void action(async () => {
                            await api("/api/helper/pairing", token, "POST", {});
                            setMessage("A new one-use pairing code is ready.");
                          })
                        }
                      >
                        <Icon name="refresh" size={16} />
                        New code
                      </button>
                    )}
                  </div>
                </section>
                <section className="panel assurance-panel">
                  <span className="soft-icon peach">
                    <Icon name="shield" />
                  </span>
                  <h2>
                    A little reassurance,
                    <br />
                    built into every trip.
                  </h2>
                  <ul>
                    <li>
                      <Icon name="check" size={16} />
                      Walking and change limits kept
                    </li>
                    <li>
                      <Icon name="check" size={16} />
                      One instruction at a time
                    </li>
                    <li>
                      <Icon name="check" size={16} />
                      Source freshness made visible
                    </li>
                  </ul>
                </section>
              </div>
              <section className="panel activity-panel">
                <div className="section-label">
                  <h2>Recent reference bookings</h2>
                  <button
                    className="link-button"
                    onClick={() => setTab("evidence")}
                  >
                    View activity
                    <Icon name="arrow" size={16} />
                  </button>
                </div>
                {state?.tasks.length ? (
                  <div className="helper-trips">
                    {state.tasks.slice(0, 4).map((t: Task) => (
                      <div key={t.id}>
                        <span className="soft-icon">
                          <Icon name="trip" />
                        </span>
                        <span>
                          <strong>{t.terms.destination}</strong>
                          <small>
                            {dateLabel(t.terms.date, true)} ·{" "}
                            {t.terms.passenger}
                          </small>
                        </span>
                        <span
                          className={`tag ${t.state === "verified" ? "verified" : ""}`}
                        >
                          {t.state.replaceAll("_", " ")}
                        </span>
                        <strong>{money(t.terms.fare)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-inline">
                    <Icon name="trip" />
                    <p>
                      No trips yet. Your first outing is a few remote clicks
                      away.
                    </p>
                  </div>
                )}
              </section>
              <p className="prototype-note">
                {state?.deploymentMode === "cloud-preview"
                  ? "Private Azure preview"
                  : "Prototype · paired laptop must stay awake"}{" "}
                · real TfL journey planning · separate fictional booking lab ·
                no ticket sales
              </p>
            </>
          )}
          {tab === "setup" && cap && (
            <>
              <div className="dashboard-heading">
                <div>
                  <p className="eyebrow">
                    ONE FAMILIAR TASK, THOUGHTFULLY SET UP
                  </p>
                  <h1>Their trip. Their choices.</h1>
                  <p>Configure the supported community shuttle workflow.</p>
                </div>
                <span className="tag">
                  Reviewed template · v{state?.capability.revision}
                </span>
              </div>
              <form
                className="setup-layout"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(async () => {
                    const { revision, ...body } = cap;
                    const saved = await api<Capability>(
                      "/api/helper/capability",
                      token,
                      "PUT",
                      body,
                    );
                    setCap(saved);
                    setMessage(
                      "Task settings saved. The connected TV updates automatically.",
                    );
                  });
                }}
              >
                <section className="panel">
                  <h2>Make it feel familiar</h2>
                  <p className="panel-intro">
                    These details appear on the TV. Use fictional details for
                    the demo.
                  </p>
                  <label>
                    Name on the trip
                    <input
                      value={cap.passenger}
                      maxLength={40}
                      required
                      onChange={(e) =>
                        setCap({ ...cap, passenger: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Pickup address
                    <input
                      value={cap.pickup}
                      maxLength={100}
                      required
                      onChange={(e) =>
                        setCap({ ...cap, pickup: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Task title
                    <input
                      value={cap.title}
                      maxLength={70}
                      required
                      onChange={(e) =>
                        setCap({ ...cap, title: e.target.value })
                      }
                    />
                  </label>
                  <h3>Places they can choose</h3>
                  <div className="allowed-places">
                    {DESTINATIONS.map((d) => (
                      <label key={d.id}>
                        <input
                          type="checkbox"
                          checked={cap.allowedDestinations.includes(d.id)}
                          onChange={(e) =>
                            setCap({
                              ...cap,
                              allowedDestinations: e.target.checked
                                ? [...cap.allowedDestinations, d.id]
                                : cap.allowedDestinations.filter(
                                    (x) => x !== d.id,
                                  ),
                            })
                          }
                        />
                        <span className="soft-icon">
                          <Icon
                            name={
                              d.id === "library"
                                ? "book"
                                : d.id === "garden"
                                  ? "leaf"
                                  : "art"
                            }
                          />
                        </span>
                        <span>
                          <strong>{d.name}</strong>
                          <small>
                            Usual fare {money(d.fare)} · {timeLabel(d.time)}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
                <aside>
                  <section className="panel">
                    <span className="soft-icon peach">
                      <Icon name="shield" />
                    </span>
                    <h2>Comfortable limits</h2>
                    <label>
                      Maximum trip fare (INR)
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        value={cap.maxFare}
                        onChange={(e) =>
                          setCap({ ...cap, maxFare: Number(e.target.value) })
                        }
                        required
                      />
                    </label>
                    <label>
                      Task available until
                      <input
                        type="date"
                        value={cap.expiresAt.slice(0, 10)}
                        onChange={(e) => {
                          if (e.target.value)
                            setCap({
                              ...cap,
                              expiresAt: new Date(
                                `${e.target.value}T23:59:59+05:30`,
                              ).toISOString(),
                            });
                        }}
                        required
                      />
                    </label>
                    <p className="muted">
                      Limits are enforced by the service, including when a fare
                      changes.
                    </p>
                    <button
                      className="primary"
                      disabled={busy || cap.allowedDestinations.length === 0}
                    >
                      Save supported task
                      <Icon name="check" size={18} />
                    </button>
                  </section>
                  <div className="honesty-note">
                    <Icon name="book" size={18} />
                    <p>
                      This configures one supported workflow. It does not
                      automatically learn arbitrary websites.
                    </p>
                  </div>
                </aside>
              </form>
            </>
          )}
          {tab === "evidence" && (
            <>
              <div className="dashboard-heading">
                <div>
                  <p className="eyebrow">CLEAR STEPS. CHECKABLE RESULTS.</p>
                  <h1>A record you can follow.</h1>
                  <p>
                    What happened, what was checked, and what still needs
                    attention.
                  </p>
                </div>
              </div>
              <section className="panel">
                <div className="section-label">
                  <h2>Task activity</h2>
                  <span className="tag">
                    {state?.deploymentMode === "cloud-preview"
                      ? "Stored in the private hosted preview"
                      : "Stored on this laptop"}
                  </span>
                </div>
                <div className="event-list">
                  {state?.events.length ? (
                    state.events.map((e: any, i: number) => (
                      <div key={i}>
                        <span
                          className={`event-dot ${e.kind === "verified" ? "good" : e.kind === "unknown" ? "warn" : ""}`}
                        />
                        <div>
                          <strong>{e.kind.replaceAll("_", " ")}</strong>
                          <p>{e.detail}</p>
                          {e.taskId && (
                            <small>Task {e.taskId.slice(0, 8)}</small>
                          )}
                        </div>
                        <time>
                          {new Date(e.at).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </time>
                      </div>
                    ))
                  ) : (
                    <div className="empty-inline">
                      Activity appears here when a task is used.
                    </div>
                  )}
                </div>
              </section>
              <div className="honesty-note">
                <Icon name="shield" />
                <p>
                  Verification means an exact matching reservation was read from
                  the reference provider’s history page. It does not establish
                  compatibility with a real transport company.
                </p>
              </div>
            </>
          )}
          {tab === "lab" && (
            <>
              <div className="dashboard-heading">
                <div>
                  <p className="eyebrow">DISCLOSED TEST SCENARIOS</p>
                  <h1>Show what happens when.</h1>
                  <p>Controlled changes to our fictional reference provider.</p>
                </div>
                <span className="tag">Demo only</span>
              </div>
              <div className="lab-grid">
                <section className="panel">
                  <span className="soft-icon peach">
                    <Icon name="refresh" />
                  </span>
                  <h2>The fare changes</h2>
                  <p>
                    Update the provider after a trip preview. The original terms
                    must be reviewed again.
                  </p>
                  <div className="lab-value">
                    +{money(state?.lab.fareDelta || 0)}
                    <small>Current fare adjustment</small>
                  </div>
                  <div className="button-row">
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        changeLab({
                          fareDelta: (state?.lab.fareDelta || 0) + 20,
                        })
                      }
                    >
                      Raise fare by ₹20
                    </button>
                    <button
                      className="small-button"
                      disabled={busy}
                      onClick={() => changeLab({ fareDelta: 0 })}
                    >
                      Usual fare
                    </button>
                  </div>
                </section>
                <section className="panel">
                  <span className="soft-icon">
                    <Icon name="link" />
                  </span>
                  <h2>The response goes missing</h2>
                  <p>
                    The next reservation is stored, but its submit response
                    fails. Handback checks history before reporting a result.
                  </p>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      changeLab({
                        loseNextResponse: !state?.lab.loseNextResponse,
                      })
                    }
                  >
                    {state?.lab.loseNextResponse
                      ? "Armed · turn off"
                      : "Arm lost response"}
                  </button>
                </section>
                <section className="panel">
                  <span className="soft-icon">
                    <Icon name="warning" />
                  </span>
                  <h2>The result is uncertain</h2>
                  <p>
                    Hide booking history. Handback must show uncertainty and
                    avoid automatic resubmission.
                  </p>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      changeLab({ hideHistory: !state?.lab.hideHistory })
                    }
                  >
                    {state?.lab.hideHistory
                      ? "Restore booking history"
                      : "Make history unavailable"}
                  </button>
                </section>
                <section className="panel">
                  <span className="soft-icon">
                    <Icon name="settings" />
                  </span>
                  <h2>The page looks different</h2>
                  <p>
                    Switch to a supported second layout, or an intentionally
                    unsupported interface.
                  </p>
                  <label>
                    Provider layout
                    <select
                      value={state?.lab.layout || "classic"}
                      onChange={(e) => changeLab({ layout: e.target.value })}
                    >
                      <option value="classic">Classic · supported</option>
                      <option value="modern">Modern · supported</option>
                      <option value="unsupported">
                        Unsupported · must stop
                      </option>
                    </select>
                  </label>
                </section>
              </div>
              <section className="panel reset-panel">
                <div>
                  <h2>Start a clean demonstration</h2>
                  <p>
                    Clears only fictional demo reservations and task activity.
                    Keeps helper settings and pairing.
                  </p>
                </div>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await api("/api/lab/reset", token, "POST", {});
                      setMessage("The fictional demo scenario has been reset.");
                    })
                  }
                >
                  Reset demo scenario
                </button>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function ProviderApp() {
  const params = new URLSearchParams(location.search),
    isHistory = location.pathname.endsWith("/history");
  const [data, setData] = useState<any>(),
    [history, setHistory] = useState<Receipt[]>([]),
    [available, setAvailable] = useState<boolean>(),
    [error, setError] = useState("");
  const [form, setForm] = useState({
    passenger: params.get("passenger") || "Arun",
    pickup: params.get("pickup") || "12 Willow Lane",
    destinationId: params.get("destinationId") || "library",
    date: params.get("date") || "",
  });
  const [quote, setQuote] = useState<{ terms: Terms; signature: string }>(),
    [outcome, setOutcome] = useState(""),
    [receipt, setReceipt] = useState<Receipt>();
  useEffect(() => {
    api("/provider/api/config").then((s) => {
      setData(s);
      setForm((f) => ({ ...f, date: f.date || s.tomorrow }));
    });
    if (isHistory)
      api<Receipt[]>("/provider/api/history")
        .then((h) => {
          setHistory(h);
          setAvailable(true);
        })
        .catch(() => setAvailable(false));
  }, [isHistory]);
  const review = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      setQuote(await api("/provider/api/quote", undefined, "POST", form));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const submit = async () => {
    if (!quote) return;
    try {
      const r = await fetch("/provider/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...quote,
          requestId: params.get("requestId") || crypto.randomUUID(),
        }),
      });
      if (r.status === 409) {
        setOutcome("changed");
        return;
      }
      if (!r.ok) {
        setOutcome("uncertain");
        return;
      }
      setReceipt(await r.json());
      setOutcome("accepted");
    } catch {
      setOutcome("uncertain");
    }
  };
  return (
    <div
      className={`provider-app ${data?.config.layout === "modern" ? "modern" : ""}`}
    >
      <div className="reference-banner">
        FICTIONAL REFERENCE PROVIDER · LOCAL TEST DATA · NO REAL TRANSPORT OR
        PAYMENTS
      </div>
      <header>
        <a href="/provider" className="provider-brand">
          <Icon name="trip" size={29} />
          Willow Link<span>COMMUNITY TRANSPORT</span>
        </a>
        <nav>
          <a href="/provider/book">Make a reservation</a>
          <a href="/provider/history">Booking history</a>
          <a href="/helper">Handback helper ↗</a>
        </nav>
      </header>
      <main>
        <p className="eyebrow">YOUR COMMUNITY. A LITTLE CLOSER.</p>
        <h1>
          {isHistory ? "Reservation history" : "A seat for your next outing."}
        </h1>
        <p className="provider-subtitle">
          A deliberately conventional booking interface, operated by Handback
          through the browser.
        </p>
        {data?.config.layout === "unsupported" ? (
          <div className="panel">
            <h2>This provider interface has changed</h2>
            <p>
              This deliberately unsupported layout has no supported review
              control. Handback must stop here.
            </p>
          </div>
        ) : isHistory ? (
          <section
            data-testid={
              available === undefined ? undefined : "provider-history"
            }
            data-available={String(available)}
            className="provider-history panel"
          >
            {available === undefined ? (
              "Loading reservations…"
            ) : available === false ? (
              <p role="alert">Booking history is temporarily unavailable.</p>
            ) : history.length ? (
              history
                .filter(
                  (r) =>
                    !params.get("requestId") ||
                    params.get("requestId") === r.requestId,
                )
                .map((r) => (
                  <article
                    key={r.requestId}
                    data-request-id={r.requestId}
                    data-receipt={JSON.stringify(r)}
                  >
                    <span className="tag verified">Reservation stored</span>
                    <h2>{r.destination}</h2>
                    <dl>
                      <dt>Reference</dt>
                      <dd>{r.reference}</dd>
                      <dt>Passenger</dt>
                      <dd>{r.passenger}</dd>
                      <dt>Pickup</dt>
                      <dd>{r.pickup}</dd>
                      <dt>Departure</dt>
                      <dd>
                        {dateLabel(r.date)} · {timeLabel(r.time)}
                      </dd>
                      <dt>Fare</dt>
                      <dd>{money(r.fare)} INR</dd>
                      <dt>Request ID</dt>
                      <dd>{r.requestId}</dd>
                    </dl>
                  </article>
                ))
            ) : (
              <p>No stored reservations.</p>
            )}
          </section>
        ) : (
          <div className="provider-columns">
            <form className="panel provider-form" onSubmit={review}>
              <h2>Passenger and journey details</h2>
              <p>Please complete all fields to review availability.</p>
              <label>
                Passenger name
                <input
                  required
                  value={form.passenger}
                  onChange={(e) =>
                    setForm({ ...form, passenger: e.target.value })
                  }
                />
              </label>
              <label>
                Pickup address
                <input
                  required
                  value={form.pickup}
                  onChange={(e) => setForm({ ...form, pickup: e.target.value })}
                />
              </label>
              <label>
                Destination
                <select
                  value={form.destinationId}
                  onChange={(e) => {
                    setForm({ ...form, destinationId: e.target.value });
                    setQuote(undefined);
                  }}
                >
                  {DESTINATIONS.map((d) => (
                    <option value={d.id} key={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Travel date
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => {
                    setForm({ ...form, date: e.target.value });
                    setQuote(undefined);
                  }}
                />
              </label>
              <button className="primary">
                Review trip
                <Icon name="arrow" size={18} />
              </button>
              {error && <p role="alert">{error}</p>}
            </form>
            <div>
              {quote && (
                <section
                  className="panel provider-quote"
                  data-testid="provider-quote"
                  data-terms={JSON.stringify(quote.terms)}
                >
                  <span className="tag">
                    Current quote · version {quote.terms.version}
                  </span>
                  <h2>Review your reservation</h2>
                  <dl>
                    <dt>Passenger</dt>
                    <dd>{quote.terms.passenger}</dd>
                    <dt>From</dt>
                    <dd>{quote.terms.pickup}</dd>
                    <dt>To</dt>
                    <dd>{quote.terms.destination}</dd>
                    <dt>Date</dt>
                    <dd>{dateLabel(quote.terms.date)}</dd>
                    <dt>Departure</dt>
                    <dd>{timeLabel(quote.terms.time)}</dd>
                    <dt>Fare</dt>
                    <dd>{money(quote.terms.fare)} INR</dd>
                  </dl>
                  <p>
                    Submitting accepts these exact terms. The provider validates
                    the current quote atomically.
                  </p>
                  <button
                    className="primary"
                    type="button"
                    disabled={!!outcome}
                    onClick={() => void submit()}
                  >
                    Confirm reservation
                  </button>
                </section>
              )}
              {outcome && (
                <section
                  className={`panel provider-result ${outcome === "accepted" ? "accepted" : ""}`}
                  data-testid="provider-result"
                  data-outcome={outcome}
                >
                  <h2>
                    {outcome === "accepted"
                      ? "Your reservation is stored"
                      : outcome === "changed"
                        ? "The trip terms changed"
                        : "The response could not be delivered"}
                  </h2>
                  <p>
                    {outcome === "accepted"
                      ? `Confirmation: ${receipt?.reference}`
                      : outcome === "changed"
                        ? "Review a fresh quote before booking."
                        : "This controlled test may have stored a reservation. Check booking history before trying again."}
                  </p>
                  <a href="/provider/history">View booking history →</a>
                </section>
              )}
              {!quote && <JourneyArt />}
            </div>
          </div>
        )}
      </main>
      <footer>
        Willow Link is a reference application created for the Handback TV
        prototype. All people, locations, and reservations are fictional.
      </footer>
    </div>
  );
}
const root = createRoot(document.getElementById("root")!);
root.render(
  location.pathname.startsWith("/provider") ? (
    <ProviderApp />
  ) : location.pathname.startsWith("/helper") ? (
    <HelperApp />
  ) : location.pathname.startsWith("/tv/journeys") ? (
    <JourneyTV />
  ) : (
    <TVApp />
  ),
);
