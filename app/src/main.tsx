import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "./styles.css";
import { render } from "preact";
import { App } from "./app";
import { createStore } from "./store";

createStore().then((store) => render(<App store={store} />, document.getElementById("app")!));
