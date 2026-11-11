import { useState } from "preact/hooks";
import { useApp } from "../app";
import { boxPath, plural } from "../lib";
import type { Box } from "../types";
import { Highlight, Icon, Tag } from "../ui";

const SEARCH_KEY = "storage-bins-search";
function savedSearch(): string {
  try {
    return sessionStorage.getItem(SEARCH_KEY) ?? "";
  } catch {
    return "";
  }
}

export function HomeScreen() {
  const { data } = useApp();
  const [term, setTermState] = useState(savedSearch);
  const setTerm = (value: string) => {
    setTermState(value);
    try {
      sessionStorage.setItem(SEARCH_KEY, value);
    } catch {
      /* private browsing: search just isn't remembered */
    }
  };
  const query = term.trim();

  if (!data.boxes.length) {
    return (
      <div class="empty">
        <Tag code="B-01" size="lg" />
        <h1>Start with your first box</h1>
        <p class="muted">Name it, list what's inside, then print its label and stick it on.</p>
        <a class="btn" href="#/new"><Icon name="plus" />Add a box</a>
      </div>
    );
  }

  return (
    <>
      <div class="searchbar">
        <Icon name="search" />
        <input type="search" placeholder="Find an item, box or place" aria-label="Search" autocomplete="off"
          value={term} onInput={(e) => setTerm(e.currentTarget.value)} />
      </div>
      {query ? <Results term={query} /> : <AllBoxes />}
    </>
  );
}

function BoxRow({ box, term = "" }: { box: Box; term?: string }) {
  const { data } = useApp();
  const count = data.items.filter((i) => i.box_id === box.id).length;
  return (
    <a class="row" href={"#" + boxPath(box.code)}>
      <Tag code={box.code} />
      <span class="row-main">
        <span class="row-title"><Highlight text={box.name} term={term} /></span>
        {term && box.location && <span class="row-sub"><Highlight text={box.location} term={term} /></span>}
      </span>
      <span class="row-meta">{plural(count, "item")}</span>
      <Icon name="chevron" size={18} />
    </a>
  );
}

function AllBoxes() {
  const { data } = useApp();
  const groups = new Map<string, Box[]>();
  for (const box of data.boxes) {
    const place = box.location ?? "";
    groups.set(place, [...(groups.get(place) ?? []), box]);
  }
  // Named places first, A to Z; boxes with no place go last.
  const places = [...groups.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));

  return (
    <>
      <div class="listhead">
        <p class="muted">{plural(data.boxes.length, "box", "boxes")}, {plural(data.items.length, "item")}</p>
        <a class="btn btn-small" href="#/new"><Icon name="plus" size={18} />New box</a>
      </div>
      {places.map((place) => (
        <section key={place}>
          <h2 class="place">{place ? <><Icon name="pin" size={18} />{place}</> : "No place set"}</h2>
          <div class="card">{groups.get(place)!.map((box) => <BoxRow key={box.id} box={box} />)}</div>
        </section>
      ))}
    </>
  );
}

function Results({ term }: { term: string }) {
  const { data } = useApp();
  const t = term.toLowerCase();
  const has = (s: string | null) => !!s && s.toLowerCase().includes(t);
  const items = data.items.filter((i) => has(i.name) || has(i.notes));
  const boxes = data.boxes.filter((b) => has(b.name) || has(b.location) || has(b.code) || has(b.notes));

  if (!items.length && !boxes.length) {
    return <p class="status">Nothing matches "{term}". Try a shorter word.</p>;
  }
  return (
    <>
      {items.length > 0 && (
        <section>
          <h2 class="place">Items</h2>
          <div class="card">
            {items.map((item) => {
              const box = data.boxes.find((b) => b.id === item.box_id)!;
              return (
                <a class="row" key={item.id} href={"#" + boxPath(box.code)}>
                  <Tag code={box.code} />
                  <span class="row-main">
                    <span class="row-title">
                      <Highlight text={item.name} term={term} />
                      {item.quantity > 1 && <span class="qty"> ×{item.quantity}</span>}
                    </span>
                    <span class="row-sub">{box.name}{box.location ? `, ${box.location}` : ""}</span>
                  </span>
                  <Icon name="chevron" size={18} />
                </a>
              );
            })}
          </div>
        </section>
      )}
      {boxes.length > 0 && (
        <section>
          <h2 class="place">Boxes</h2>
          <div class="card">{boxes.map((box) => <BoxRow key={box.id} box={box} term={term} />)}</div>
        </section>
      )}
    </>
  );
}
