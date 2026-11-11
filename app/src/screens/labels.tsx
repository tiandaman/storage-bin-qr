import { useState } from "preact/hooks";
import { useApp } from "../app";
import { boxUrl, plural, qrSvg } from "../lib";
import { Icon, Tag } from "../ui";

export function LabelsScreen({ only }: { only: string }) {
  const { data } = useApp();
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(data.boxes.filter((b) => !only || b.code === only).map((b) => b.id)),
  );
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (!next.delete(id)) next.add(id);
    setPicked(next);
  };
  const chosen = data.boxes.filter((b) => picked.has(b.id));

  if (!data.boxes.length) {
    return <p class="status">Labels appear here once you've added a box. <a href="#/new">Add a box</a></p>;
  }

  return (
    <>
      <div class="noprint">
        <h1>Print labels</h1>
        <p class="muted">Tick the boxes you need. Each label prints about 2.5 inches wide, on plain paper or sticker sheets.</p>
        <div class="listhead">
          <span>
            <button class="textbtn" onClick={() => setPicked(new Set(data.boxes.map((b) => b.id)))}>All</button>
            <button class="textbtn" onClick={() => setPicked(new Set())}>None</button>
          </span>
          <button class="btn" disabled={!chosen.length} onClick={() => window.print()}>
            <Icon name="print" />Print {plural(chosen.length, "label")}
          </button>
        </div>
        <div class="card">
          {data.boxes.map((box) => (
            <label class="row" key={box.id}>
              <input type="checkbox" checked={picked.has(box.id)} onChange={() => toggle(box.id)} />
              <Tag code={box.code} />
              <span class="row-main"><span class="row-title">{box.name}</span></span>
            </label>
          ))}
        </div>
        {chosen.length > 0 && <h2 class="place">Preview</h2>}
      </div>
      <div class="printsheet">
        {chosen.map((box) => (
          <div class="printlabel" key={box.id}>
            <div class="printlabel-code">{box.code}</div>
            <div class="qr" dangerouslySetInnerHTML={{ __html: qrSvg(boxUrl(box.code)) }} />
            <div class="printlabel-name">{box.name}</div>
          </div>
        ))}
      </div>
    </>
  );
}
