import { useState } from "preact/hooks";
import { appUrl, go } from "../lib";
import type { Store } from "../store";
import { Tag } from "../ui";

export function LoginScreen({ store }: { store: Store }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(
    store.linkError ? { text: `That reset link didn't work (${store.linkError}). Ask for a new one below.`, bad: true } : null,
  );

  const signIn = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      await store.signIn(email.trim(), password);
    } catch (err) {
      const message = (err as Error).message;
      setNote({ text: /invalid login/i.test(message) ? "That email and password don't match. Check them and try again." : message, bad: true });
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) {
      setNote({ text: "Type your email above, then tap Forgot password.", bad: true });
      return;
    }
    try {
      await store.sendPasswordReset(email.trim(), appUrl());
      setNote({ text: "If that email has an account, a reset link is on its way. Open it on this device to choose a new password.", bad: false });
    } catch (err) {
      setNote({ text: (err as Error).message, bad: true });
    }
  };

  return (
    <form class="auth" onSubmit={signIn}>
      <Tag code="B-01" size="lg" />
      <h1>Know what's in every box</h1>
      <p class="muted">Sign in once on this phone. After that, scanning a label opens the box.</p>
      <label for="email">Email</label>
      <input id="email" type="email" autocomplete="username" required value={email}
        onInput={(e) => setEmail(e.currentTarget.value)} />
      <label for="password">Password</label>
      <input id="password" type="password" autocomplete="current-password" required value={password}
        onInput={(e) => setPassword(e.currentTarget.value)} />
      <button class="btn btn-block" disabled={busy}>Sign in</button>
      <button type="button" class="textbtn" onClick={forgot}>Forgot password?</button>
      {note && <p class={note.bad ? "note note-bad" : "note"} role="alert">{note.text}</p>}
    </form>
  );
}

export function SetPasswordScreen({ store, toast }: { store: Store; toast: (m: string) => void }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [error, setError] = useState("");

  const save = async (e: Event) => {
    e.preventDefault();
    if (a !== b) return setError("The two passwords don't match.");
    try {
      await store.setPassword(a);
      toast("Password saved");
      go("/");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form class="auth" onSubmit={save}>
      <h1>Choose a new password</h1>
      <label for="np">New password</label>
      <input id="np" type="password" autocomplete="new-password" minLength={6} required value={a}
        onInput={(e) => setA(e.currentTarget.value)} />
      <label for="np2">Type it again</label>
      <input id="np2" type="password" autocomplete="new-password" minLength={6} required value={b}
        onInput={(e) => setB(e.currentTarget.value)} />
      <button class="btn btn-block">Save password</button>
      {error && <p class="note note-bad" role="alert">{error}</p>}
    </form>
  );
}
