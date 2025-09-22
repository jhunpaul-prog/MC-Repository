import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  drawWatermark,
  buildWatermarkText,
  watermarkLabel,
  type WatermarkSettings as WmSettings,
  type WatermarkPreference,
  loadGlobalWatermarkPreference,
  saveGlobalWatermarkPreferenceNew,
  saveGlobalWatermarkPreferenceEdit,
  loadAllWatermarkPreferences,
} from "../../../ResidentDoctor/Search/utils/watermark";
import { Check, Move, RefreshCw, PlusCircle, Pencil } from "lucide-react";

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const SAMPLE_W = 720;
const SAMPLE_H = 420;

const WatermarkSettings: React.FC = () => {
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState<WatermarkPreference | null>(null);
  const [entries, setEntries] = useState<WatermarkPreference[]>([]);

  // form state
  const [settings, setSettings] = useState<WmSettings>({
    mode: "tiled",
    opacity: 0.14,
    fontSize: 18,
  });
  const [useStaticText, setUseStaticText] = useState<boolean>(false);
  const [staticText, setStaticText] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // preview
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragXY, setDragXY] = useState<{ x: number; y: number }>({
    x: 0.5,
    y: 0.5,
  });
  const [dynamicPreviewText, setDynamicPreviewText] = useState<string>("");

  // load all
  const refresh = async () => {
    const latest = await loadGlobalWatermarkPreference();
    setCurrent(latest);
    setSettings(latest.settings);
    setUseStaticText(!!latest.staticText);
    setStaticText(latest.staticText || "");
    setDragXY({
      x: latest.settings.x ?? 0.5,
      y: latest.settings.y ?? 0.5,
    });
    setDynamicPreviewText(await buildWatermarkText("N/A"));

    const map = await loadAllWatermarkPreferences();
    const list = Object.values(map || {}) as WatermarkPreference[];
    list.sort((a, b) => b.version - a.version);
    setEntries(list);
    setLoaded(true);
  };

  useEffect(() => {
    refresh();
  }, []);

  // preview draw
  useEffect(() => {
    if (!loaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${SAMPLE_W}px`;
    canvas.style.height = `${SAMPLE_H}px`;
    canvas.width = Math.floor(SAMPLE_W * dpr);
    canvas.height = Math.floor(SAMPLE_H * dpr);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#E5E7EB";
    for (let i = 24 * dpr; i < canvas.height; i += 24 * dpr) {
      ctx.fillRect(0, i, canvas.width, 1);
    }

    const s: WmSettings = { ...settings };
    if (s.mode === "custom") {
      s.x = dragXY.x;
      s.y = dragXY.y;
    }

    const text =
      useStaticText && staticText.trim()
        ? staticText.trim()
        : dynamicPreviewText || "Loading…";

    drawWatermark(ctx, canvas.width, canvas.height, text, s);
  }, [loaded, settings, dragXY, useStaticText, staticText, dynamicPreviewText]);

  // drag handlers
  const onDown = (e: React.PointerEvent) => {
    if (settings.mode !== "custom") return;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging || settings.mode !== "custom") return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setDragXY({ x: clamp(x, 0.02, 0.98), y: clamp(y, 0.02, 0.98) });
  };
  const onUp = () => setDragging(false);

  // helpers for saving payload
  const buildPayload = () => {
    const s: WmSettings = { ...settings };
    if (s.mode === "custom") {
      s.x = dragXY.x;
      s.y = dragXY.y;
    } else {
      delete s.x;
      delete s.y;
    }
    return {
      settings: s,
      staticText: useStaticText ? staticText.trim() || null : null,
      note: note.trim() || null,
    };
  };

  const saveNew = async () => {
    const pref = await saveGlobalWatermarkPreferenceNew(buildPayload());
    alert(
      `Saved NEW preference v${pref.version} (${watermarkLabel(pref.settings)})`
    );
    await refresh();
  };

  const saveEdit = async () => {
    const pref = await saveGlobalWatermarkPreferenceEdit(buildPayload());
    alert(
      `Saved EDIT preference v${pref.version} (${watermarkLabel(
        pref.settings
      )})`
    );
    await refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Watermark (Global)
          </h2>
          <p className="text-gray-600 text-sm">
            These settings apply to all screenshots. Latest version is used
            automatically.
          </p>
        </div>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-900">Position</span>
          <select
            value={settings.mode}
            onChange={(e) =>
              setSettings((s) => ({ ...s, mode: e.target.value as any }))
            }
            className="mt-1 w-full rounded border-gray-300 text-gray-900"
          >
            <option value="tiled">Tiled (default)</option>
            <option value="top-left">Top-left</option>
            <option value="top-right">Top-right</option>
            <option value="bottom-left">Bottom-left</option>
            <option value="bottom-right">Bottom-right</option>
            <option value="center">Center</option>
            <option value="custom">Custom (drag on preview)</option>
          </select>
          <div className="mt-1 text-xs text-gray-900">
            Position:{" "}
            <span className="font-medium">{watermarkLabel(settings)}</span>
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-900">Opacity</span>
          <input
            type="range"
            min={0.04}
            max={1}
            step={0.02}
            value={settings.opacity ?? 0.14}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                opacity: parseFloat(e.target.value),
              }))
            }
            className="mt-3 w-full"
          />
          <div className="text-xs text-gray-900 mt-1">
            {(settings.opacity ?? 0.14).toFixed(2)}
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-900">Font Size</span>
          <input
            type="range"
            min={12}
            max={48}
            step={2}
            value={settings.fontSize ?? 18}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                fontSize: parseInt(e.target.value, 10),
              }))
            }
            className="mt-3 w-full"
          />
          <div className="text-xs text-gray-900 mt-1">
            {settings.fontSize ?? 18}px
          </div>
        </label>
      </div>

      {/* Text mode */}
      <div className="grid grid-cols-1 gap-3">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={useStaticText}
            onChange={(e) => setUseStaticText(e.target.checked)}
          />
          <span className="text-sm text-gray-900">
            Use static global text (otherwise dynamic per user/paper/timestamp)
          </span>
        </label>
        {useStaticText && (
          <label className="block">
            <span className="text-sm font-medium text-gray-900">
              Static Text
            </span>
            <textarea
              value={staticText}
              onChange={(e) => setStaticText(e.target.value)}
              className="mt-1 w-full rounded border-gray-300 text-gray-900 focus:border-gray-400 focus:ring-0 text-sm"
              rows={3}
              placeholder="Enter a fixed watermark text for all screenshots"
            />
            <div className="mt-1 text-xs text-gray-500">
              Characters: {staticText.length}
            </div>
          </label>
        )}

        <label className="block">
          <span className="text-sm font-medium text-gray-900">
            Note (optional)
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded border-gray-300 text-gray-900 focus:border-gray-400 focus:ring-0 text-sm"
            placeholder="e.g., Increased opacity; diagonal tiles"
          />
        </label>
      </div>

      {/* Preview */}
      <div
        ref={stageRef}
        className="relative w-full rounded-lg border border-gray-300 bg-white shadow-sm overflow-hidden"
        style={{ aspectRatio: `${SAMPLE_W}/${SAMPLE_H}` }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        {settings.mode === "custom" && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${dragXY.x * 100}%`,
              top: `${dragXY.y * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="px-2 py-1 rounded bg-black/40 text-white text-[10px] flex items-center gap-1">
              <Move className="w-3 h-3" /> drag anchor
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={saveNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800"
          title="Create a NEW preference (version +1)"
        >
          <PlusCircle className="w-4 h-4" />
          Save as NEW (v+1)
        </button>

        <button
          onClick={saveEdit}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700"
          title="Create an EDIT preference (version +0.1)"
        >
          <Pencil className="w-4 h-4" />
          Save as EDIT (v+0.1)
        </button>
      </div>

      {/* Table of versions */}
      <div className="mt-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">
          Preferences (latest first)
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-700">
                <th className="px-3 py-2 border-b">Version</th>
                <th className="px-3 py-2 border-b">Position</th>
                <th className="px-3 py-2 border-b">Opacity</th>
                <th className="px-3 py-2 border-b">Font</th>
                <th className="px-3 py-2 border-b">Custom XY</th>
                <th className="px-3 py-2 border-b">Text</th>
                <th className="px-3 py-2 border-b">Note</th>
                <th className="px-3 py-2 border-b">Created</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.version} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {e.version}
                  </td>
                  <td className="px-3 py-2 text-gray-900">
                    {watermarkLabel(e.settings)}
                  </td>
                  <td className="px-3 py-2 text-gray-900">
                    {(e.settings.opacity ?? 0.14).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-gray-900">
                    {e.settings.fontSize ?? 18}px
                  </td>
                  <td className="px-3 py-2 text-gray-900">
                    {e.settings.mode === "custom"
                      ? `${(e.settings.x ?? 0.5).toFixed(2)}, ${(
                          e.settings.y ?? 0.5
                        ).toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-900">
                    {e.staticText ? (
                      <span
                        className="truncate inline-block max-w-[22rem]"
                        title={e.staticText}
                      >
                        {e.staticText}
                      </span>
                    ) : (
                      <span className="text-gray-600">dynamic</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-900">{e.note || "—"}</td>
                  <td className="px-3 py-2 text-gray-900">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {!entries.length && (
                <tr>
                  <td className="px-3 py-3 text-gray-600" colSpan={8}>
                    No preferences found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WatermarkSettings;
