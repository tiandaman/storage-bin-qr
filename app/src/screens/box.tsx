import { useEffect, useRef, useState } from "preact/hooks";
import { useApp } from "../app";
import { boxUrl, go, plural, qrSvg, shrinkImage } from "../lib";
import type { Box, Item, Photo } from "../types";
import { ConfirmSheet, Icon, Sheet, Tag } from "../ui";

export function BoxScreen({ code }: { code: string }) {
  const { data, store, act, toast } = useApp();
  const box = data.boxes.find((b) => b.code === code);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [editing, setEditing] = useState<Item | null>(null);
  const [viewing, setViewing] = useState<Photo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);

  const photos = box ? data.photos.filter((p) => p.box_id === box.id) : [];
  const paths = photos.map((p) => p.path).join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let current = true;
    store.photoUrls(paths ? paths.split("|") : []).then((u) => current && setUrls(u), () => {});
    return () => {
      current = false;
    };
  }, [paths, store]);

  if (!box) {
    return (
      <div class="empty">
        <Tag code={code} size="lg" />
        <h1>This label isn't set up yet</h1>
        <p class="muted">No box uses the code {code}. Create it now, or go back to your boxes.</p>
        <a class="btn" href={"#/new/" + encodeURIComponent(code)}><Icon name="plus" />Create box {code}</a>
        <a class="textbtn" href="#/">All boxes</a>
      </div>
    );
  }

  const items = data.items.filter((i) => i.box_id === box.id);

  const addItem = async (e: Event) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (await act(() => store.addItem(box.id, trimmed, Math.max(1, quantity || 1)))) {
      setName("");
      setQuantity(1);
      nameInput.current?.focus();
    }
  };

  const addPhoto = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setUploading(true);
    await act(async () => store.addPhoto(box.id, await shrinkImage(file)), "Photo added");
    setUploading(false);
  };

  const deleteBox = async () => {
    setConfirmDelete(false);
    if (await act(() => store.deleteBox(box, photos))) {
      toast(`${box.code} deleted`);
      go("/");
    }
  };

  return (
    <>
      <a class="backlink" href="#/"><Icon name="back" size={18} />All boxes</a>

      <header class="boxhead">
        <Tag code={box.code} size="lg" />
        <div class="boxhead-text">
          <h1>{box.name}</h1>
          <p class="muted where"><Icon name="pin" size={18} />{box.location ?? "No place set"}</p>
        </div>
        <a class="btn btn-quiet btn-small" href={"#/edit/" + encodeURIComponent(box.code)}>Edit</a>
      </header>
      {box.notes && <p class="boxnotes">{box.notes}</p>}

      <form class="additem" onSubmit={addItem}>
        <input ref={nameInput} placeholder="Add an item" aria-label="Item name" autocomplete="off" required
          value={name} onInput={(e) => setName(e.currentTarget.value)} />
        <input class="qtyinput" type="number" min={1} inputMode="numeric" aria-label="How many"
          value={quantity} onInput={(e) => setQuantity(parseInt(e.currentTarget.value, 10))} />
        <button class="btn">Add</button>
      </form>

      <h2 class="place">{items.length ? plural(items.length, "item") : "Nothing in this box yet"}</h2>
      {items.length > 0 && (
        <div class="card">
          {items.map((item) => (
            <button class="row" key={item.id} onClick={() => setEditing(item)} aria-label={`Edit ${item.name}`}>
              <span class="row-main">
                <span class="row-title">{item.name}</span>
                {item.notes && <span class="row-sub">{item.notes}</span>}
              </span>
              {item.quantity > 1 && <span class="count">×{item.quantity}</span>}
              <Icon name="chevron" size={18} />
            </button>
          ))}
        </div>
      )}

      <h2 class="place">Photos</h2>
      <div class="photos">
        {photos.map((photo) => (
          <button key={photo.id} class="photo" onClick={() => setViewing(photo)} aria-label="Open photo">
            {urls[photo.path] && <img src={urls[photo.path]} alt="Inside the box" />}
          </button>
        ))}
        <label class={"photo photo-add" + (uploading ? " busy" : "")}>
          <Icon name="camera" size={26} />
          {uploading ? "Uploading" : "Add photo"}
          <input type="file" accept="image/*" capture="environment" hidden disabled={uploading} onChange={addPhoto} />
        </label>
      </div>

      <h2 class="place">Label</h2>
      <div class="card labelcard">
        <div class="qr" dangerouslySetInnerHTML={{ __html: qrSvg(boxUrl(box.code)) }} />
        <div>
          <p>Scan this with any phone camera to open {box.code}.</p>
          <a class="btn btn-quiet btn-small" href={"#/labels/" + encodeURIComponent(box.code)}><Icon name="print" size={18} />Print label</a>
        </div>
      </div>

      <button class="textbtn danger" onClick={() => setConfirmDelete(true)}>Delete this box</button>

      {editing && <ItemSheet item={editing} box={box} onClose={() => setEditing(null)} />}
      {viewing && (
        <Sheet title="Photo" onClose={() => setViewing(null)}>
          {urls[viewing.path] && <img class="bigphoto" src={urls[viewing.path]} alt="Inside the box" />}
          <div class="actions">
            <button class="btn btn-quiet" onClick={() => setViewing(null)}>Close</button>
            <button class="btn btn-danger" onClick={async () => {
              const photo = viewing;
              setViewing(null);
              await act(() => store.deletePhoto(photo), "Photo removed");
            }}>Remove photo</button>
          </div>
        </Sheet>
      )}
      {confirmDelete && (
        <ConfirmSheet
          title={`Delete ${box.code}?`}
          body={`"${box.name}" and its ${plural(items.length, "item")} will be removed for good. The printed label will stop working.`}
          action="Delete box"
          onConfirm={deleteBox}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

function ItemSheet({ item, box, onClose }: { item: Item; box: Box; onClose: () => void }) {
  const { data, store, act } = useApp();
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [moveTo, setMoveTo] = useState("");
  const others = data.boxes.filter((b) => b.id !== box.id);

  const save = async (e: Event) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const target = others.find((b) => b.id === moveTo);
    const saved = await act(
      () => store.updateItem(item.id, {
        name: trimmed,
        quantity: Math.max(1, quantity || 1),
        notes: notes.trim() || null,
        ...(target ? { box_id: target.id } : {}),
      }),
      target ? `Moved to ${target.code}` : "Saved",
    );
    if (saved) onClose();
  };

  const remove = async () => {
    if (await act(() => store.deleteItem(item.id), "Item deleted")) onClose();
  };

  return (
    <Sheet title="Edit item" onClose={onClose}>
      <form onSubmit={save}>
        <div class="pair">
          <div class="grow">
            <label for="i-name">Name</label>
            <input id="i-name" required value={name} onInput={(e) => setName(e.currentTarget.value)} />
          </div>
          <div>
            <label for="i-qty">How many</label>
            <input id="i-qty" class="qtyinput" type="number" min={1} inputMode="numeric" value={quantity}
              onInput={(e) => setQuantity(parseInt(e.currentTarget.value, 10))} />
          </div>
        </div>
        <label for="i-notes">Notes</label>
        <input id="i-notes" value={notes} placeholder="Optional" onInput={(e) => setNotes(e.currentTarget.value)} />
        {others.length > 0 && (
          <>
            <label for="i-move">Box</label>
            <select id="i-move" value={moveTo} onChange={(e) => setMoveTo(e.currentTarget.value)}>
              <option value="">Keep in {box.code}, {box.name}</option>
              {others.map((b) => <option key={b.id} value={b.id}>Move to {b.code}, {b.name}</option>)}
            </select>
          </>
        )}
        <div class="actions">
          <button class="btn">Save</button>
          <button type="button" class="btn btn-quiet" onClick={onClose}>Cancel</button>
          <button type="button" class="btn btn-danger push" onClick={remove}>Delete</button>
        </div>
      </form>
    </Sheet>
  );
}
