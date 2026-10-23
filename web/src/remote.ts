import { useEffect, useLayoutEffect, useRef } from "react";

export function useRemote(screen: string, onBack: () => void) {
  const backRef = useRef(onBack);
  backRef.current = onBack;
  useEffect(() => {
    if (typeof (window as any).HandbackVoice?.ready === "function")
      (window as any).HandbackVoice.ready();
    const handle = (key: string) => {
      window.dispatchEvent(new CustomEvent("handback-input", { detail: key }));
      if (key === "read") {
        window.dispatchEvent(new Event("handback-read"));
        return;
      }
      if (key === "back") {
        backRef.current();
        return;
      }
      const els = Array.from(
        document.querySelectorAll<HTMLElement>("[data-remote]:not(:disabled)"),
      ).filter((el) => el.getBoundingClientRect().width > 0);
      if (key === "select") {
        (document.activeElement as HTMLElement)?.click();
        return;
      }
      const active = document.activeElement as HTMLElement;
      const rect = active?.getBoundingClientRect();
      if (!rect || !els.includes(active)) {
        els[0]?.focus();
        return;
      }
      const cx = rect.x + rect.width / 2,
        cy = rect.y + rect.height / 2;
      const candidates = els
        .filter((el) => el !== active)
        .map((el) => {
          const r = el.getBoundingClientRect(),
            dx = r.x + r.width / 2 - cx,
            dy = r.y + r.height / 2 - cy;
          return { el, dx, dy };
        })
        .filter((p) =>
          key === "left"
            ? p.dx < -5
            : key === "right"
              ? p.dx > 5
              : key === "up"
                ? p.dy < -5
                : p.dy > 5,
        );
      candidates.sort((a, b) => {
        const score = (p: typeof a) =>
          key === "left" || key === "right"
            ? Math.abs(p.dx) + Math.abs(p.dy) * 3
            : Math.abs(p.dy) + Math.abs(p.dx) * 3;
        return score(a) - score(b);
      });
      candidates[0]?.el.focus();
    };
    const listener = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,textarea,select")) return;
      const map: Record<string, string> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
        Escape: "back",
        r: "read",
        Enter: "select",
        " ": "select",
      };
      if (map[e.key]) {
        e.preventDefault();
        handle(map[e.key]);
      }
    };
    const remote = (e: Event) => handle((e as CustomEvent).detail);
    document.addEventListener("keydown", listener);
    window.addEventListener("handback-remote", remote);
    (window as any).handbackRemote = (key: string) =>
      window.dispatchEvent(new CustomEvent("handback-remote", { detail: key }));
    return () => {
      document.removeEventListener("keydown", listener);
      window.removeEventListener("handback-remote", remote);
    };
  }, []);
  useLayoutEffect(() => {
    (
      document.querySelector<HTMLElement>("[data-autofocus]:not(:disabled)") ||
      document.querySelector<HTMLElement>("main [data-remote]:not(:disabled)")
    )?.focus();
  }, [screen]);
}
