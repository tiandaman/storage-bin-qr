import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// Relative base so the app works from https://<user>.github.io/<repo>/
export default defineConfig({ base: "./", plugins: [preact()] });
