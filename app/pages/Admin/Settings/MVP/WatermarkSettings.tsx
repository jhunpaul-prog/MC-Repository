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
  deleteGlobalWatermarkPreference,
} from "../../../ResidentDoctor/Search/utils/watermark";
import {
  PlusCircle,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  X,
  Move,
  CheckCircle2,
  Info,
} from "lucide-react";

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const SAMPLE_W = 720;
const SAMPLE_H = 420;

const badge =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
const chip = (tone: "gray" | "red" | "green" | "blue" | "amber" = "gray") => {
  const base = "border";
  const tones: Record<string, string> = {
    gray: `${badge} border-gray-300 text-gray-700 bg-gray-50`,
    red: `${badge} border-red-200 text-red-700 bg-red-50`,
    green: `${badge} border-green-200 text-green-700 bg-green-50`,
    blue: `${badge} border-blue-200 text-blue-700 bg-blue-50`,
    amber: `${badge} border-amber-200 text-amber-800 bg-amber-50`,
  };
  return `${base} ${tones[tone]}`;
};

type PanelMode =
  | { type: "closed" }
  | { type: "new" }
  | { type: "edit"; version: number };

type SuccessModalState = null | { title: string; message?: string };
type DuplicateInfo = {
  matches: WatermarkPreference[];
  intendedAction: "new" | "edit";
};

const WatermarkSettings: React.FC = () => {
  /* -------------------------- data & ui state -------------------------- */
  const [loaded, setLoaded] = useState(false);
  const [entries, setEntries] = useState<WatermarkPreference[]>([]);
  const [current, setCurrent] = useState<WatermarkPreference | null>(null);

  // search & table paging
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 10;

  // right panel state (add/edit)
  const [panel, setPanel] = useState<PanelMode>({ type: "closed" });

  // form state (reused for Add & Edit)
  const [settings, setSettings] = useState<WmSettings>({
    mode: "tiled",
    opacity: 0.14,
    fontSize: 18,
  });
  const [useStaticText, setUseStaticText] = useState(false);
  const [staticText, setStaticText] = useState("");
  const [note, setNote] = useState("");

  // preview state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragXY, setDragXY] = useState<{ x: number; y: number }>({
    x: 0.5,
    y: 0.5,
  });
  const [dynamicPreviewText, setDynamicPreviewText] = useState("");

  // modals
  const [successModal, setSuccessModal] = useState<SuccessModalState>(null);
  const [duplicateModal, setDuplicateModal] = useState<DuplicateInfo | null>(
    null
  );

  const refresh = async () => {
    const latest = await loadGlobalWatermarkPreference();
    setCurrent(latest);

    // defaults for panel
    setSettings(latest.settings);
    setUseStaticText(!!latest.staticText);
    setStaticText(latest.staticText || "");
    setNote("");
    setDragXY({ x: latest.settings.x ?? 0.5, y: latest.settings.y ?? 0.5 });
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

  /* ------------------------------ preview ------------------------------ */
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

    // background
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

  /* --------------------------- helpers & actions --------------------------- */
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

  const openNew = () => {
    if (current) {
      setSettings(current.settings);
      setUseStaticText(!!current.staticText);
      setStaticText(current.staticText || "");
      setNote("");
      setDragXY({ x: current.settings.x ?? 0.5, y: current.settings.y ?? 0.5 });
    }
    setPanel({ type: "new" });
  };

  const openEdit = (pref: WatermarkPreference) => {
    setSettings(pref.settings);
    setUseStaticText(!!pref.staticText);
    setStaticText(pref.staticText || "");
    setNote(pref.note || "");
    setDragXY({ x: pref.settings.x ?? 0.5, y: pref.settings.y ?? 0.5 });
    setPanel({ type: "edit", version: pref.version });
  };

  // find duplicates by static text (trim + case-insensitive)
  const findTextDuplicates = (textRaw: string): WatermarkPreference[] => {
    const norm = textRaw.trim().toLowerCase();
    if (!norm) return [];
    return entries.filter(
      (e) => (e.staticText || "").trim().toLowerCase() === norm
    );
  };

  const saveNewWithDuplicateCheck = async () => {
    const payload = buildPayload();
    if (payload.staticText) {
      const matches = findTextDuplicates(payload.staticText);
      if (matches.length) {
        setDuplicateModal({ matches, intendedAction: "new" });
        return; // stop; user will decide
      }
    }
    const pref = await saveGlobalWatermarkPreferenceNew(payload);
    setPanel({ type: "closed" });
    await refresh();
    setSuccessModal({
      title: "Watermark version created!",
      message: `Version v${pref.version} has been saved.`,
    });
  };

  const saveEditWithDuplicateCheck = async () => {
    const payload = buildPayload();
    if (payload.staticText) {
      const matches = findTextDuplicates(payload.staticText);
      // Allow edit if match is the same version; here we just inform.
      if (matches.length) {
        setDuplicateModal({ matches, intendedAction: "edit" });
        return;
      }
    }
    const pref = await saveGlobalWatermarkPreferenceEdit(payload);
    setPanel({ type: "closed" });
    await refresh();
    setSuccessModal({
      title: "Watermark edit saved!",
      message: `Version v${pref.version} has been saved.`,
    });
  };

  const doDelete = async (version: number) => {
    const yes = confirm(
      `Delete watermark version v${version}? This cannot be undone.`
    );
    if (!yes) return;
    await deleteGlobalWatermarkPreference(version);
    await refresh();
  };

  /* ------------------------------ table data ------------------------------ */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      const hay = `${e.version} ${watermarkLabel(e.settings)} ${
        e.settings.opacity ?? 0.14
      } ${e.settings.fontSize ?? 18} ${e.staticText || "dynamic"} ${
        e.note || ""
      }`.toLowerCase();
      return hay.includes(q);
    });
  }, [entries, query]);

  const paged = useMemo(() => {
    const start = page * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  useEffect(() => {
    setPage(0);
  }, [query]);

  /* -------------------------------- render -------------------------------- */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Watermark (Global)
          </h2>
          <p className="text-gray-600 text-sm">
            Manage watermark versions. The latest version is applied
            automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800"
            title="Add New Watermark"
          >
            <PlusCircle className="w-4 h-4" />
            Add New Watermark
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-sm">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search watermark versions…"
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-200"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
        </div>
        <div className="text-sm text-gray-600">
          Rows {filtered.length ? page * pageSize + 1 : 0}–
          {Math.min((page + 1) * pageSize, filtered.length)} of{" "}
          {filtered.length}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-700">
              <th className="px-4 py-3 font-semibold">Version</th>
              <th className="px-4 py-3 font-semibold">Position</th>
              <th className="px-4 py-3 font-semibold">Access (summary)</th>
              <th className="px-4 py-3 font-semibold">Text</th>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((e) => {
              const isLatest =
                entries.length && e.version === entries[0].version;
              return (
                <tr key={e.version} className="border-t last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        v{e.version}
                      </span>
                      {isLatest && (
                        <span className={chip("green")}>Latest</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={chip("blue")}>
                      {watermarkLabel(e.settings)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <span className={chip("amber")}>
                        Opacity {(e.settings.opacity ?? 0.14).toFixed(2)}
                      </span>
                      <span className={chip("gray")}>
                        Font {e.settings.fontSize ?? 18}px
                      </span>
                      {e.settings.mode === "custom" ? (
                        <span className={chip("gray")}>
                          XY {(e.settings.x ?? 0.5).toFixed(2)},
                          {(e.settings.y ?? 0.5).toFixed(2)}
                        </span>
                      ) : null}
                      {e.note ? (
                        <span className={chip("gray")}>{e.note}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    {e.staticText ? (
                      <span
                        className="inline-block max-w-[20rem] truncate"
                        title={e.staticText}
                      >
                        {e.staticText}
                      </span>
                    ) : (
                      <span className="text-gray-500 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5" /> dynamic
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700"
                        title="Edit"
                        onClick={() => openEdit(e)}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700"
                        title="Delete"
                        onClick={() => doDelete(e.version)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!paged.length && (
              <tr>
                <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>
                  No watermark versions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filtered.length > pageSize && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600">
            Page {page + 1} of {Math.ceil(filtered.length / pageSize)}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Prev
            </button>
            <button
              className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-50"
              onClick={() =>
                setPage((p) =>
                  Math.min(Math.ceil(filtered.length / pageSize) - 1, p + 1)
                )
              }
              disabled={(page + 1) * pageSize >= filtered.length}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ===== Right Drawer: Add / Edit ===== */}
      {panel.type !== "closed" && (
        <div className="fixed inset-0 z-[60]">
          {/* overlay */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setPanel({ type: "closed" })}
          />
          {/* drawer */}
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {panel.type === "new"
                    ? "Add New Watermark"
                    : `Edit Watermark v${
                        panel.type === "edit" ? panel.version : ""
                      }`}
                </h3>
                <p className="text-xs text-gray-600">
                  Configure the watermark and preview it live.
                </p>
              </div>
              <button
                className="p-2 rounded-lg hover:bg-gray-100"
                onClick={() => setPanel({ type: "closed" })}
                title="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {/* Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="block">
                  <span className="text-sm font-medium text-gray-900">
                    Position
                  </span>
                  <select
                    value={settings.mode}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        mode: e.target.value as any,
                      }))
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
                    <span className="font-medium">
                      {watermarkLabel(settings)}
                    </span>
                  </div>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-gray-900">
                    Opacity
                  </span>
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
                  <span className="text-sm font-medium text-gray-900">
                    Font Size
                  </span>
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
                    Use static global text (otherwise dynamic per
                    user/paper/timestamp)
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
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                />
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
            </div>

            {/* footer */}
            <div className="border-t px-5 py-4 flex items-center justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => setPanel({ type: "closed" })}
              >
                Cancel
              </button>
              {panel.type === "new" ? (
                <button
                  onClick={saveNewWithDuplicateCheck}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800"
                >
                  <PlusCircle className="w-4 h-4" />
                  Save as NEW
                </button>
              ) : (
                <button
                  onClick={saveEditWithDuplicateCheck}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800"
                >
                  <Pencil className="w-4 h-4" />
                  Save EDIT
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Success Modal (no alert) ===== */}
      {successModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSuccessModal(null)}
          />
          <div className="relative mx-3 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-center mb-3">
              <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-center text-gray-900">
              {successModal.title}
            </h3>
            {successModal.message && (
              <p className="mt-1 text-center text-gray-600">
                {successModal.message}
              </p>
            )}
            <div className="mt-5 flex justify-center">
              <button
                className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800"
                onClick={() => setSuccessModal(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Duplicate Text Modal ===== */}
      {duplicateModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setDuplicateModal(null)}
          />
          <div className="relative mx-3 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <Info className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Same Static Text Found
                </h3>
                <p className="text-sm text-gray-600">
                  We found existing watermark version(s) with the same static
                  text. You can open a version to edit it, or proceed anyway.
                </p>
              </div>
            </div>

            <div className="max-h-80 overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-700">
                  <tr>
                    <th className="px-3 py-2">Version</th>
                    <th className="px-3 py-2">Position</th>
                    <th className="px-3 py-2">Opacity</th>
                    <th className="px-3 py-2">Font</th>
                    <th className="px-3 py-2">Note</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicateModal.matches.map((m) => (
                    <tr key={m.version} className="border-t text-gray-900">
                      <td className="px-3 py-2 font-medium">v{m.version}</td>
                      <td className="px-3 py-2">
                        {watermarkLabel(m.settings)}
                      </td>
                      <td className="px-3 py-2">
                        {(m.settings.opacity ?? 0.14).toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        {m.settings.fontSize ?? 18}px
                      </td>
                      <td className="px-3 py-2">{m.note || "—"}</td>
                      <td className="px-3 py-2">
                        {new Date(m.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end">
                          <button
                            className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-800"
                            onClick={() => {
                              setDuplicateModal(null);
                              openEdit(m);
                            }}
                          >
                            Open & Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!duplicateModal.matches.length && (
                    <tr>
                      <td
                        className="px-3 py-4 text-center text-gray-500"
                        colSpan={7}
                      >
                        No matches.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border text-black border-gray-300 hover:bg-gray-50"
                onClick={() => setDuplicateModal(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800"
                onClick={async () => {
                  setDuplicateModal(null);
                  // continue with original intent
                  if (duplicateModal.intendedAction === "new") {
                    const pref = await saveGlobalWatermarkPreferenceNew(
                      buildPayload()
                    );
                    setPanel({ type: "closed" });
                    await refresh();
                    setSuccessModal({
                      title: "Watermark version created!",
                      message: `Version v${pref.version} has been saved.`,
                    });
                  } else {
                    const pref = await saveGlobalWatermarkPreferenceEdit(
                      buildPayload()
                    );
                    setPanel({ type: "closed" });
                    await refresh();
                    setSuccessModal({
                      title: "Watermark edit saved!",
                      message: `Version v${pref.version} has been saved.`,
                    });
                  }
                }}
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WatermarkSettings;
