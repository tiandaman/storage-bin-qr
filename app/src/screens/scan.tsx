import { useEffect, useRef, useState } from "preact/hooks";
import { useApp } from "../app";
import { boxPath, go } from "../lib";

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
declare const BarcodeDetector: { new (options: { formats: string[] }): Detector } | undefined;

type Read = (video: HTMLVideoElement) => Promise<string | undefined>;

/** Uses the browser's own QR reader where it exists (Android), and a bundled one elsewhere (iPhone). */
async function makeReader(): Promise<Read> {
  if (typeof BarcodeDetector !== "undefined") {
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    return async (video) => (await detector.detect(video))[0]?.rawValue;
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  return async (video) => {
    if (!video.videoWidth) return undefined;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    return jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data;
  };
}

export function ScanScreen() {
  const { data } = useApp();
  const video = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("Starting the camera");
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | undefined;
    let frame = 0;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        setBlocked(true);
        setMessage("The camera is blocked. Allow camera access for this page, or scan the label with your phone's camera app.");
        return;
      }
      if (stopped || !video.current) return stream.getTracks().forEach((t) => t.stop());
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});
      const read = await makeReader();
      setMessage("Point the camera at a box label");

      const tick = async () => {
        if (stopped || !video.current) return;
        try {
          const text = await read(video.current);
          if (text) {
            const code = /#\/box\/([^?#/]+)/.exec(text)?.[1] ?? data.boxes.find((b) => b.code === text.trim())?.code;
            if (code) return go(boxPath(decodeURIComponent(code)));
            setMessage("That code isn't one of your box labels");
          }
        } catch {
          /* a frame that can't be read is fine; try the next one */
        }
        frame = requestAnimationFrame(tick);
      };
      tick();
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <>
      <h1>Scan a label</h1>
      {!blocked && (
        <div class="viewfinder">
          <video ref={video} playsInline muted />
          <span class="viewfinder-frame" aria-hidden="true" />
        </div>
      )}
      <p class={blocked ? "note note-bad" : "muted"} role="status">{message}</p>
    </>
  );
}
