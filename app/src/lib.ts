import qrcode from "qrcode-generator";
import { useEffect, useState } from "preact/hooks";
import type { Box } from "./types";

/* ---------- routing: #/box/B-01, #/new, #/edit/B-01, #/labels, #/scan ---------- */
export interface Route {
  page: string;
  arg: string;
}

function parseRoute(): Route {
  const hash = location.hash;
  if (!hash.startsWith("#/")) return { page: "", arg: "" };
  const [page = "", arg = ""] = hash.slice(2).split("/");
  try {
    return { page, arg: decodeURIComponent(arg) };
  } catch {
    return { page, arg };
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parseRoute);
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const go = (path: string) => {
  location.hash = "#" + path;
};
export const boxPath = (code: string) => "/box/" + encodeURIComponent(code);
export const appUrl = () => location.origin + location.pathname;
/** The link a box's QR code points to. Must stay stable so printed labels keep working. */
export const boxUrl = (code: string) => appUrl() + "#" + boxPath(code);

/* ---------- small helpers ---------- */
export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function nextCode(boxes: Box[]): string {
  const numbers = boxes.map((b) => parseInt(/\d+/.exec(b.code)?.[0] ?? "0", 10) || 0);
  return "B-" + String(Math.max(0, ...numbers) + 1).padStart(2, "0");
}

export function qrSvg(text: string): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}

/** Shrinks a camera photo so uploads are quick and storage lasts. */
export function shrinkImage(file: File, maxSide = 1600): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error("That file couldn't be read as a photo."));
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      canvas.toBlob((blob) => (blob ? resolve(blob) : fail()), "image/jpeg", 0.8);
    };
    img.onerror = fail;
    img.src = URL.createObjectURL(file);
  });
}
