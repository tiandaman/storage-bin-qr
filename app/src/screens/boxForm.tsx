import { useState } from "preact/hooks";
import { useApp } from "../app";
import { boxPath, go, nextCode } from "../lib";
import { Icon } from "../ui";

export function BoxFormScreen({ editCode, presetCode }: { editCode?: string; presetCode?: string }) {
  const { data, store, act, toast } = useApp();
  const box = editCode ? data.boxes.find((b) => b.code === editCode) : undefined;
  const [code, setCode] = useState(box?.code ?? (presetCode || nextCode(data.boxes)));
  const [name, setName] = useState(box?.name ?? "");
  const [location, setLocation] = useState(box?.location ?? "");
  const [notes, setNotes] = useState(box?.notes ?? "");
  const places = [...new Set(data.boxes.map((b) => b.location).filter((l): l is string => !!l))].sort();

  if (editCode && !box) {
    return <p class="status">There's no box {editCode}. <a href="#/">All boxes</a></p>;
  }

  const save = async (e: Event) => {
    e.preventDefault();
    const input = { name: name.trim(), location: location.trim() || null, notes: notes.trim() || null };
    const finalCode = box ? box.code : code.trim().toUpperCase();
    if (!box && data.boxes.some((b) => b.code === finalCode)) {
      toast(`${finalCode} is already used. Pick another code.`);
      return;
    }
    const saved = await act(
      () => (box ? store.updateBox(box.id, input) : store.createBox(finalCode, input)),
      box ? "Saved" : `${finalCode} created`,
    );
    if (saved) go(boxPath(finalCode));
  };

  return (
    <>
      <a class="backlink" href={box ? "#" + boxPath(box.code) : "#/"}><Icon name="back" size={18} />{box ? box.code : "All boxes"}</a>
      <h1>{box ? `Edit ${box.code}` : "New box"}</h1>
      <form class="form" onSubmit={save}>
        <label for="b-code">Code</label>
        <input id="b-code" class="codeinput" required maxLength={12} pattern="[A-Za-z0-9\-]+" disabled={!!box}
          value={code} onInput={(e) => setCode(e.currentTarget.value)} aria-describedby="b-code-help" />
        <p class="help" id="b-code-help">
          {box ? "The code stays the same so the printed label keeps working."
            : "Printed on the label. Letters, numbers and dashes."}
        </p>
        <label for="b-name">Name</label>
        <input id="b-name" required placeholder="Christmas decorations" value={name}
          onInput={(e) => setName(e.currentTarget.value)} />
        <label for="b-place">Place</label>
        <input id="b-place" list="places" placeholder="Garage, shelf 2" value={location}
          onInput={(e) => setLocation(e.currentTarget.value)} />
        <datalist id="places">{places.map((p) => <option key={p} value={p} />)}</datalist>
        <label for="b-notes">Notes</label>
        <textarea id="b-notes" rows={3} placeholder="Optional" value={notes}
          onInput={(e) => setNotes(e.currentTarget.value)} />
        <button class="btn btn-block">{box ? "Save changes" : "Create box"}</button>
      </form>
    </>
  );
}
