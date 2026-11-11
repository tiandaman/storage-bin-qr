import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

const ICONS = {
  box: "M3 8l9-5 9 5v8l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v8",
  scan: "M4 8V5a1 1 0 0 1 1-1h3 M16 4h3a1 1 0 0 1 1 1v3 M20 16v3a1 1 0 0 1-1 1h-3 M8 20H5a1 1 0 0 1-1-1v-3 M4 12h16",
  label: "M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9z M7.5 7.5h.01",
  plus: "M12 5v14 M5 12h14",
  search: "M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14z M20 20l-4-4",
  back: "M15 5l-7 7 7 7",
  pin: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z M12 10.5h.01",
  camera: "M4 8h3l2-3h6l2 3h3v11H4z M12 10a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7z",
  chevron: "M9 5l7 7-7 7",
  print: "M7 9V4h10v5 M7 17H4v-7h16v7h-3 M7 14h10v6H7z",
} as const;

export function Icon({ name, size = 22 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg class="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/** The yellow bin label. The one loud thing in the interface. */
export function Tag({ code, size }: { code: string; size?: "lg" }) {
  return <span class={"tag" + (size ? " tag-" + size : "")}>{code}</span>;
}

export function Highlight({ text, term }: { text: string; term: string }) {
  const at = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + term.length)}</mark>
      {text.slice(at + term.length)}
    </>
  );
}

/** A panel that slides up from the bottom of the screen. */
export function Sheet(props: { title: string; onClose: () => void; children: ComponentChildren }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    document.addEventListener("keydown", onKey);
    const first = panel.current?.querySelector<HTMLElement>("[data-autofocus], input, button");
    first?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div class="scrim" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={props.title} ref={panel}>
        <h2>{props.title}</h2>
        {props.children}
      </div>
    </div>
  );
}

export function ConfirmSheet(props: {
  title: string;
  body: string;
  action: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet title={props.title} onClose={props.onCancel}>
      <p class="muted">{props.body}</p>
      <div class="actions">
        <button class="btn btn-danger" onClick={props.onConfirm}>{props.action}</button>
        <button class="btn btn-quiet" data-autofocus onClick={props.onCancel}>Cancel</button>
      </div>
    </Sheet>
  );
}
