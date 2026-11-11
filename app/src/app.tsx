import { createContext } from "preact";
import { useCallback, useContext, useEffect, useRef, useState } from "preact/hooks";
import { useRoute } from "./lib";
import { LoginScreen, SetPasswordScreen } from "./screens/auth";
import { BoxScreen } from "./screens/box";
import { BoxFormScreen } from "./screens/boxForm";
import { HomeScreen } from "./screens/home";
import { LabelsScreen } from "./screens/labels";
import { ScanScreen } from "./screens/scan";
import type { Store } from "./store";
import type { AuthState, Data } from "./types";
import { Icon } from "./ui";

interface AppContext {
  store: Store;
  data: Data;
  /** Runs a change, reloads the data, and shows `done` (or the error) as a toast. */
  act: (change: () => Promise<void>, done?: string) => Promise<boolean>;
  toast: (message: string) => void;
}

const Ctx = createContext<AppContext | null>(null);
export const useApp = () => useContext(Ctx)!;

export function App({ store }: { store: Store }) {
  const [auth, setAuth] = useState<AuthState>("loading");
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState("");
  const [toastText, setToastText] = useState("");
  const toastTimer = useRef(0);
  const route = useRoute();

  const toast = useCallback((message: string) => {
    setToastText(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastText(""), 2600);
  }, []);

  const load = useCallback(async () => {
    try {
      setData(await store.load());
      setLoadError("");
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [store]);

  useEffect(() => store.onAuth(setAuth), [store]);
  useEffect(() => {
    if (auth === "signedIn") load();
    if (auth === "signedOut") setData(null);
  }, [auth, load]);

  const act = useCallback<AppContext["act"]>(
    async (change, done) => {
      try {
        await change();
        setData(await store.load());
        if (done) toast(done);
        return true;
      } catch (e) {
        toast((e as Error).message);
        return false;
      }
    },
    [store, toast],
  );

  let screen;
  let signedIn = false;
  if (auth === "loading") screen = <p class="status">Loading</p>;
  else if (auth === "signedOut") screen = <LoginScreen store={store} />;
  else if (auth === "recovery") screen = <SetPasswordScreen store={store} toast={toast} />;
  else if (loadError)
    screen = (
      <div class="status">
        <p>Your boxes couldn't be loaded. {loadError}</p>
        <button class="btn" onClick={load}>Try again</button>
      </div>
    );
  else if (!data) screen = <p class="status">Loading your boxes</p>;
  else {
    signedIn = true;
    const { page, arg } = route;
    screen =
      page === "box" && arg ? <BoxScreen key={arg} code={arg} />
      : page === "new" ? <BoxFormScreen key="new" presetCode={arg} />
      : page === "edit" && arg ? <BoxFormScreen key={arg} editCode={arg} />
      : page === "labels" ? <LabelsScreen key={arg} only={arg} />
      : page === "scan" ? <ScanScreen />
      : <HomeScreen />;
  }

  const tab = route.page === "scan" ? "scan" : route.page === "labels" ? "labels" : "boxes";
  return (
    <Ctx.Provider value={data ? { store, data, act, toast } : null}>
      <header class="topbar noprint">
        <a href="#/" class="wordmark">
          <span class="wordmark-lid" aria-hidden="true" />
          Storage bins
        </a>
        {signedIn && <button class="textbtn" onClick={() => store.signOut()}>Sign out</button>}
      </header>
      <main class={signedIn ? "with-tabs" : ""}>{screen}</main>
      {signedIn && (
        <nav class="tabs noprint" aria-label="Main">
          <a href="#/" aria-current={tab === "boxes" ? "page" : undefined}><Icon name="box" />Boxes</a>
          <a href="#/scan" aria-current={tab === "scan" ? "page" : undefined}><Icon name="scan" />Scan</a>
          <a href="#/labels" aria-current={tab === "labels" ? "page" : undefined}><Icon name="label" />Labels</a>
        </nav>
      )}
      <div class={"toast noprint" + (toastText ? " show" : "")} role="status" aria-live="polite">{toastText}</div>
    </Ctx.Provider>
  );
}
