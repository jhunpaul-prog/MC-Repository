import { getAuth } from "firebase/auth";
import { db } from "../../../../Backend/firebase";
import { ref, get, set, runTransaction, onValue } from "firebase/database";

/** Position modes for the watermark */
export type WatermarkMode =
  | "tiled"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center"
  | "custom";

export type WatermarkSettings = {
  mode: WatermarkMode;
  x?: number; // 0..1 (custom)
  y?: number; // 0..1 (custom)
  opacity?: number; // 0.04..1
  fontSize?: number; // 12..48
};

export type WatermarkPreference = {
  version: number; // e.g., 1, 1.1, 2, 2.1
  settings: WatermarkSettings; // visual settings
  staticText?: string | null; // if present, use this text, else use dynamic
  createdAt: number; // ms epoch
  createdBy?: string | null; // uid or "system"
  note?: string | null; // optional change note
};

const DEFAULT_SETTINGS: WatermarkSettings = {
  mode: "tiled",
  opacity: 0.14,
  fontSize: 18,
};

export function watermarkLabel(s: WatermarkSettings): string {
  switch (s.mode) {
    case "tiled":
      return "Tiled";
    case "top-left":
      return "Top-left";
    case "top-right":
      return "Top-right";
    case "bottom-left":
      return "Bottom-left";
    case "bottom-right":
      return "Bottom-right";
    case "center":
      return "Center";
    case "custom":
      return "Custom";
    default:
      return "Tiled";
  }
}

function clampSettings(s: WatermarkSettings): WatermarkSettings {
  const opacity = Math.min(1, Math.max(0.04, s.opacity ?? 0.14));
  const fontSize = Math.min(48, Math.max(12, s.fontSize ?? 18));
  const out: WatermarkSettings = { mode: s.mode ?? "tiled", opacity, fontSize };
  if (out.mode === "custom") {
    out.x = Math.min(0.98, Math.max(0.02, s.x ?? 0.5));
    out.y = Math.min(0.98, Math.max(0.02, s.y ?? 0.5));
  }
  return out;
}

/** Build per-user dynamic text for the watermark (used when no staticText) */
export async function buildWatermarkText(paperId?: string) {
  const auth = getAuth();
  const uid = auth.currentUser?.uid || "guest";
  let name = auth.currentUser?.displayName || "";
  let email = auth.currentUser?.email || "";

  try {
    if (uid !== "guest") {
      const s = await get(ref(db, `users/${uid}`));
      if (s.exists()) {
        const v = s.val();
        const first = (v?.firstName || "").trim();
        const mi = (v?.middleInitial || "").trim();
        const last = (v?.lastName || "").trim();
        const suffix = (v?.suffix || "").trim();
        const miDot = mi ? `${mi[0].toUpperCase()}.` : "";
        name = [first, miDot, last, suffix].filter(Boolean).join(" ") || name;
        email = v?.email || email;
      }
    }
  } catch {}

  const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  return `SWUMED Repository • ${name || email || uid} • ${
    email || `UID:${uid}`
  } • Paper:${paperId || "N/A"} • ${stamp}`;
}

/** Draw watermark into a 2D context */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string,
  settings: WatermarkSettings
) {
  const s = clampSettings(settings);
  ctx.save();
  ctx.globalAlpha = s.opacity!;
  ctx.font = `700 ${s.fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.fillStyle = "#7f1d1d";

  const metrics = ctx.measureText(text);
  const tW = Math.ceil(metrics.width);
  const tH = Math.ceil((s.fontSize ?? 18) * 1.2);

  if (s.mode === "tiled") {
    ctx.translate(w * 0.1, h * 0.1);
    ctx.rotate(-Math.PI / 6);
    const stepX = Math.max(320, tW * 1.2);
    const stepY = Math.max(160, tH * 2.0);
    for (let y = -stepY; y < h * 1.4; y += stepY) {
      for (let x = -stepX; x < w * 1.4; x += stepX) {
        ctx.fillText(text, x, y);
      }
    }
  } else {
    let x = 16,
      y = 16 + tH;
    switch (s.mode) {
      case "top-left":
        x = 16;
        y = 16 + tH;
        break;
      case "top-right":
        x = w - tW - 16;
        y = 16 + tH;
        break;
      case "bottom-left":
        x = 16;
        y = h - 16;
        break;
      case "bottom-right":
        x = w - tW - 16;
        y = h - 16;
        break;
      case "center":
        x = (w - tW) / 2;
        y = (h + tH) / 2;
        break;
      case "custom":
        x = Math.max(
          0,
          Math.min(w - tW, Math.round((s.x ?? 0.5) * w - tW / 2))
        );
        y = Math.max(tH, Math.min(h, Math.round((s.y ?? 0.5) * h)));
        break;
    }
    ctx.fillText(text, x, y);
  }

  ctx.restore();
}

/* =========================
   GLOBAL PREFERENCES (versioned)
   Path: Watermark/preferences
   - latestVersion: number
   - entries/{version}: WatermarkPreference
   ========================= */

/** Get latest version number (or 0 if none) */
export async function getLatestWatermarkVersion(): Promise<number> {
  const s = await get(ref(db, "Watermark/preferences/latestVersion"));
  return s.exists() ? Number(s.val()) : 0;
}

/** Load the latest preference entry */
export async function loadGlobalWatermarkPreference(): Promise<WatermarkPreference> {
  const latest = await getLatestWatermarkVersion();
  if (!latest) {
    const pref: WatermarkPreference = {
      version: 1,
      settings: { ...DEFAULT_SETTINGS },
      staticText: null,
      createdAt: Date.now(),
      createdBy: "system",
      note: "Initial default",
    };
    // seed DB
    await set(ref(db, "Watermark/preferences/entries/1"), pref);
    await set(ref(db, "Watermark/preferences/latestVersion"), 1);
    return pref;
  }
  const snap = await get(ref(db, `Watermark/preferences/entries/${latest}`));
  if (snap.exists()) return snap.val();
  // fallback to default if missing
  return {
    version: latest,
    settings: { ...DEFAULT_SETTINGS },
    staticText: null,
    createdAt: Date.now(),
    createdBy: "system",
  };
}

/** Create a NEW preference (version +1) */
export async function saveGlobalWatermarkPreferenceNew(input: {
  settings: WatermarkSettings;
  staticText?: string | null;
  note?: string | null;
}): Promise<WatermarkPreference> {
  const nextVersion = await runNextNewVersion();
  const uid = getAuth().currentUser?.uid ?? "system";
  const pref: WatermarkPreference = {
    version: nextVersion,
    settings: clampSettings(input.settings),
    staticText: input.staticText?.trim() || null,
    createdAt: Date.now(),
    createdBy: uid,
    note: input.note?.trim() || null,
  };
  await set(ref(db, `Watermark/preferences/entries/${pref.version}`), pref);
  await set(ref(db, "Watermark/preferences/latestVersion"), pref.version);
  return pref;
}

/** Create an EDIT preference (version +0.1) from latest */
export async function saveGlobalWatermarkPreferenceEdit(input: {
  settings: WatermarkSettings;
  staticText?: string | null;
  note?: string | null;
}): Promise<WatermarkPreference> {
  const nextVersion = await runNextEditVersion();
  const uid = getAuth().currentUser?.uid ?? "system";
  const pref: WatermarkPreference = {
    version: nextVersion,
    settings: clampSettings(input.settings),
    staticText: input.staticText?.trim() || null,
    createdAt: Date.now(),
    createdBy: uid,
    note: input.note?.trim() || "Edit",
  };
  await set(ref(db, `Watermark/preferences/entries/${pref.version}`), pref);
  await set(ref(db, "Watermark/preferences/latestVersion"), pref.version);
  return pref;
}

async function runNextNewVersion(): Promise<number> {
  const latest = await getLatestWatermarkVersion();
  return Math.floor(latest) + 1;
}

async function runNextEditVersion(): Promise<number> {
  const latest = await getLatestWatermarkVersion();
  const next = parseFloat((latest + 0.1).toFixed(1));
  return next;
}

/** Load ALL entries as a {version: preference} map */
export async function loadAllWatermarkPreferences(): Promise<
  Record<string, WatermarkPreference>
> {
  const snap = await get(ref(db, "Watermark/preferences/entries"));
  return snap.exists()
    ? (snap.val() as Record<string, WatermarkPreference>)
    : {};
}
