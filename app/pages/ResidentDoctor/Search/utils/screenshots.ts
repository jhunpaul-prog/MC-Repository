// app/pages/ResidentDoctor/Search/utils/screenshot.ts
import {
  getStorage,
  ref as sRef,
  uploadString,
  getDownloadURL,
} from "firebase/storage";
import {
  ref,
  push,
  set,
  serverTimestamp,
  runTransaction,
} from "firebase/database";
import { getAuth } from "firebase/auth";
import { db } from "../../../../Backend/firebase";
import type { WatermarkSettings } from "./watermark";
import { watermarkLabel } from "./watermark";

export type SnapshotMeta = {
  paperId: string;
  pageNumber: number;
  zoom: number;
  source: "FullView" | "PaperCard" | "ViewResearch";
  viewport?: { w: number; h: number; dpr: number };
  userAgent?: string;
  watermark?: {
    version?: number; // which global preference version was applied
    mode: WatermarkSettings["mode"];
    opacity: number;
    fontSize: number;
    x?: number;
    y?: number;
    label: string;
    textType: "dynamic" | "static";
  };
};

export async function saveSnapshotPNG(canvas: HTMLCanvasElement, path: string) {
  const storage = getStorage();
  const r = sRef(storage, path);
  const dataUrl = canvas.toDataURL("image/png");
  await uploadString(r, dataUrl, "data_url");
  const url = await getDownloadURL(r);
  return { url, dataUrl };
}

export async function logSnapshot(
  paperId: string,
  storagePath: string,
  url: string,
  meta: SnapshotMeta
) {
  const auth = getAuth();
  const uid = auth.currentUser?.uid ?? "guest";

  const logsRef = push(ref(db, `History/Screenshoots/${paperId}/${uid}`));
  await set(logsRef, {
    storagePath,
    downloadUrl: url,
    meta,
    userId: uid,
    paperId,
    timestamp: serverTimestamp(),
  });

  await runTransaction(
    ref(db, `PaperMetrics/${paperId}/counts/screenshot`),
    (v) => (typeof v === "number" ? v + 1 : 1)
  );
  const day = new Date().toISOString().slice(0, 10);
  await runTransaction(
    ref(db, `PaperMetricsTotals/${paperId}/screenshot`),
    (v) => (v || 0) + 1
  );
  await runTransaction(
    ref(db, `PaperMetricsDaily/${paperId}/${day}/screenshot`),
    (v) => (v || 0) + 1
  );
}

/** Narrowly-typed serializer so `textType` is `"static" | "dynamic"`, not `string`. */
export function serializeWatermark(
  settings: WatermarkSettings,
  opts?: { version?: number; usedStaticText?: boolean }
): NonNullable<SnapshotMeta["watermark"]> {
  return {
    version: opts?.version,
    mode: settings.mode,
    opacity: settings.opacity ?? 0.14,
    fontSize: settings.fontSize ?? 18,
    x: settings.x,
    y: settings.y,
    label: watermarkLabel(settings),
    // force literal union instead of widening to `string`
    textType: (opts?.usedStaticText ? "static" : "dynamic") as
      | "static"
      | "dynamic",
  };
}
