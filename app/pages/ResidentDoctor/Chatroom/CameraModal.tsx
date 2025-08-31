import React, { useEffect, useRef, useState } from "react";

/* ---------- Local device storage (IndexedDB) ---------- */
const DB_NAME = "SWU_REPOSITORY_MEDIA";
const STORE_CAPTURES = "captures";
const STORE_CFG = "cfg";
const DB_VERSION = 2;

async function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CAPTURES)) {
        const os = db.createObjectStore(STORE_CAPTURES, {
          keyPath: "id",
          autoIncrement: true,
        });
        os.createIndex("created", "created");
      }
      if (!db.objectStoreNames.contains(STORE_CFG)) {
        db.createObjectStore(STORE_CFG, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSaveCapture(blob: Blob, name: string, mime: string) {
  const db = await idbOpen();
  return new Promise<{ id: number }>((resolve, reject) => {
    const tx = db.transaction(STORE_CAPTURES, "readwrite");
    const store = tx.objectStore(STORE_CAPTURES);
    const created = Date.now();
    const putReq = store.add({ created, name, mime, blob });
    putReq.onsuccess = () => resolve({ id: putReq.result as number });
    putReq.onerror = () => reject(putReq.error);
  });
}

async function idbGetSavedDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await idbOpen();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CFG, "readonly");
      const store = tx.objectStore(STORE_CFG);
      const req = store.get("saveDir");
      req.onsuccess = () => resolve((req.result && req.result.handle) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSetSavedDirHandle(handle: FileSystemDirectoryHandle) {
  const db = await idbOpen();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_CFG, "readwrite");
    const store = tx.objectStore(STORE_CFG);
    const req = store.put({ key: "saveDir", handle });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/* ---------- File System Access helpers ---------- */
const supportsFS =
  typeof window !== "undefined" &&
  typeof (window as any).showDirectoryPicker === "function";

async function ensureWritePermission(
  dir: FileSystemDirectoryHandle
): Promise<boolean> {
  // @ts-ignore
  const q = await dir.queryPermission?.({ mode: "readwrite" });
  if (q === "granted") return true;
  // @ts-ignore
  const r = await dir.requestPermission?.({ mode: "readwrite" });
  return r === "granted";
}

async function chooseBaseDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    // @ts-ignore
    const base: FileSystemDirectoryHandle = await (
      window as any
    ).showDirectoryPicker({
      id: "swurepo-base",
      mode: "readwrite",
      startIn: "downloads",
    });
    return base;
  } catch {
    return null;
  }
}

async function getOrCreateSWUREPOFolder(
  base: FileSystemDirectoryHandle
): Promise<FileSystemDirectoryHandle> {
  // @ts-ignore
  const swu = await base.getDirectoryHandle("SWUREPO", { create: true });
  return swu;
}

async function writeBlobToDir(
  dir: FileSystemDirectoryHandle,
  filename: string,
  blob: Blob
) {
  // @ts-ignore
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  // @ts-ignore
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

/* ---------- Auto “Download” save fallback ---------- */
function autoDownloadToSWUREPO(blob: Blob, baseName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const clean = baseName.replace(/[/\\?%*:|"<>]/g, "_");
  const prefixed = clean.startsWith("SWUREPO_") ? clean : `SWUREPO_${clean}`;
  a.download = `SWUREPO/${prefixed}`;

  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
};

const CameraModal: React.FC<Props> = ({ open, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startStream = async (mode: "environment" | "user") => {
    setIsStarting(true);
    setError(null);
    try {
      stopStream();
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (e: any) {
      setError(e?.message || "Unable to access camera.");
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    if (!open) {
      stopStream();
      return;
    }
    const supported = !!(
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    );
    if (!supported) {
      setError("Camera not supported in this browser.");
      return;
    }
    startStream(facingMode);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const flipCamera = async () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    await startStream(next);
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    const makeBlob = (): Promise<Blob> =>
      new Promise((resolve) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else {
              const dataURL = canvas.toDataURL("image/jpeg", 0.92);
              const byteString = atob(dataURL.split(",")[1]);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++)
                ia[i] = byteString.charCodeAt(i);
              resolve(new Blob([ab], { type: "image/jpeg" }));
            }
          },
          "image/jpeg",
          0.92
        );
      });

    const blob = await makeBlob();
    const filename = `photo_${Date.now()}.jpg`;

    try {
      await idbSaveCapture(blob, filename, "image/jpeg");
    } catch {}

    let savedToFolder = false;
    if (supportsFS) {
      try {
        let dir = await idbGetSavedDirHandle();
        if (!dir) {
          const chosen = await chooseBaseDirectory();
          if (chosen) {
            dir = chosen;
            await idbSetSavedDirHandle(dir);
          }
        }
        if (dir) {
          const ok = await ensureWritePermission(dir);
          if (ok) {
            const targetDir = await getOrCreateSWUREPOFolder(dir);
            await writeBlobToDir(targetDir, filename, blob);
            savedToFolder = true;
          }
        }
      } catch {
        savedToFolder = false;
      }
    }

    if (!savedToFolder) autoDownloadToSWUREPO(blob, filename);

    const file = new File([blob], `SWUREPO_${filename}`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
    onCapture(file);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300]">
      <div className="absolute inset-0 bg-gray-900/70" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="font-semibold text-gray-900">Camera</div>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-800"
            >
              Close
            </button>
          </div>

          <div className="bg-black aspect-video relative">
            {error ? (
              <div className="absolute inset-0 flex items-center justify-center text-white p-6 text-center">
                <div>
                  <div className="font-semibold mb-2">Camera Error</div>
                  <div className="text-sm opacity-80">{error}</div>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-contain bg-black"
                />
                {isStarting && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-lg px-4 py-2 bg-black/60 text-white text-sm">
                      Starting camera…
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={flipCamera}
                disabled={!!error || isStarting}
                className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                Flip Camera
              </button>
            </div>
            <div className="flex gap-2">
              {!navigator.mediaDevices?.getUserMedia && (
                <label className="px-4 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800 cursor-pointer">
                  Use Device Camera
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const stamp = Date.now();
                        const base = `photo_${stamp}.jpg`;
                        try {
                          await idbSaveCapture(f, base, f.type || "image/jpeg");
                        } catch {}
                        autoDownloadToSWUREPO(f, base);
                        const renamed = new File([f], `SWUREPO_${base}`, {
                          type: f.type || "image/jpeg",
                          lastModified: stamp,
                        });
                        onCapture(renamed);
                        onClose();
                      }
                    }}
                  />
                </label>
              )}

              <button
                onClick={capture}
                disabled={!!error || isStarting}
                className="px-4 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800 disabled:opacity-50"
              >
                Send Photo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraModal;
