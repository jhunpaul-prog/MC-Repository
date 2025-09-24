// src/pages/admin/components/EthicsClearanceUploader.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Divider,
  Snackbar,
  Alert,
  CircularProgress,
  Link as MuiLink,
  Tooltip,
  InputAdornment,
} from "@mui/material";
import type { AlertColor } from "@mui/material";
import Grid from "@mui/material/Grid";
import SaveIcon from "@mui/icons-material/Save";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { getAuth } from "firebase/auth";
import {
  ref as dbRef,
  set,
  serverTimestamp,
  push,
  get as dbGet,
} from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { supabase } from "../../../../Backend/supabaseClient";

/** -------- TYPES -------- */
interface ExistingClearance {
  url?: string;
  storagePath?: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
  signatoryName?: string;
  dateRequired?: string;
  uploadedBy?: string;
  uploadedByName?: string;
  uploadedAt?: number | string;
  status?: string;
}
interface MsgState {
  open: boolean;
  text: string;
  severity: AlertColor;
}

/** -------- HELPERS -------- */
const fileExt = (filename = "") => {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
};
// Allow common document/image types. Change as needed.
const isAllowed = (f: File) =>
  ["pdf", "png", "jpg", "jpeg"].includes(fileExt(f.name));

async function uploadToSupabase(params: {
  bucket: string;
  path: string;
  file: File;
}) {
  const { bucket, path, file } = params;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw error;
  const { data: pubUrl } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path, publicUrl: pubUrl.publicUrl };
}

// Safe open of native date picker (Chrome/Edge), fallback to focus
const openNativePicker = (input: HTMLInputElement | null) => {
  if (!input) return;
  const anyInput = input as any;
  if (typeof anyInput.showPicker === "function") anyInput.showPicker();
  else input.focus();
};

/** -------- COMPONENT -------- */
const EthicsClearanceUploader: React.FC = () => {
  const auth = getAuth();
  const uid = auth.currentUser?.uid ?? null;

  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // form
  const [file, setFile] = useState<File | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [signatoryName, setSignatoryName] = useState<string>("");
  const [dateRequired, setDateRequired] = useState<string>("");

  // (optional) last created entry info, to show “Open Current”
  const [created, setCreated] = useState<ExistingClearance | null>(null);

  // UI
  const [msg, setMsg] = useState<MsgState>({
    open: false,
    text: "",
    severity: "success",
  });

  // refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);

  // Base collection
  const basePath = "Papers/ClearanceEthics";

  /** Load user display name */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (uid) {
          const uSnap = await dbGet(dbRef(db, `users/${uid}`));
          const u = (uSnap.val() || {}) as any;
          if (mounted)
            setUserName(u.name || auth.currentUser?.email || "Unknown User");
        }
      } catch (e: any) {
        setMsg({ open: true, text: e.message, severity: "error" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [uid]);

  /** Drag & drop */
  const onDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!isAllowed(f)) {
      setMsg({
        open: true,
        text: "Allowed: PDF, PNG, JPG.",
        severity: "warning",
      });
      return;
    }
    setFile(f);
    setPreviewName(f.name);
  };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  /** Save a new entry without paperId (auto key) */
  const onSave = async () => {
    try {
      if (!signatoryName.trim()) throw new Error("Signatory name is required.");
      if (!dateRequired) throw new Error("Date required is mandatory.");
      if (!file)
        throw new Error(
          "Please attach the Ethics Clearance file (PDF/PNG/JPG)."
        );
      if (!isAllowed(file))
        throw new Error("Allowed file types: PDF, PNG, JPG.");

      setSaving(true);

      // 1) Create auto id in RTDB (no data yet, we only need the key)
      const listRef = dbRef(db, basePath);
      const newRef = push(listRef); // generates a key
      const key = newRef.key as string;

      // 2) Upload file to Supabase using the auto key in the path
      const ext = fileExt(file.name) || "pdf";
      const storagePath = `ClearanceEthics/${key}/clearance_${Date.now()}.${ext}`;
      const { publicUrl } = await uploadToSupabase({
        bucket: "papers-pdf",
        path: storagePath,
        file,
      });

      // 3) Compose payload
      const payload: ExistingClearance = {
        url: publicUrl,
        storagePath,
        fileName: file.name,
        fileSize: file.size,
        contentType:
          file.type || (ext === "pdf" ? "application/pdf" : `image/${ext}`),
        signatoryName: signatoryName.trim(),
        dateRequired,
        uploadedBy: uid || "anonymous",
        uploadedByName: userName || "",
        uploadedAt: serverTimestamp() as any,
        status: "uploaded",
      };

      // 4) Save to Papers/ClearanceEthics/<autoId>
      await set(newRef, payload);

      setCreated(payload);
      setMsg({
        open: true,
        text: "Ethics Clearance saved.",
        severity: "success",
      });
      setFile(null);
      setPreviewName("");
      setSignatoryName("");
      setDateRequired("");
    } catch (e: any) {
      setMsg({ open: true, text: e.message, severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, display: "flex", alignItems: "center", gap: 2 }}>
        <CircularProgress size={20} />
        <Typography>Loading…</Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Ethics Clearance
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enter the signatory’s name, attach the Ethics Clearance file, and set
        the required date.
      </Typography>

      <Grid container spacing={2} sx={{ width: "100%" }}>
        {/* TOP: Signatory Name */}
        <Grid size={{ xs: 12 }}>
          <TextField
            fullWidth
            label="Signatory Name"
            value={signatoryName}
            onChange={(e) => setSignatoryName(e.target.value)}
          />
        </Grid>

        {/* MIDDLE: Upload area */}
        <Grid size={{ xs: 12 }}>
          <Box
            onDrop={onDropFile}
            onDragOver={onDragOver}
            sx={{
              p: 2,
              border: "1px dashed",
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Upload Ethics Clearance (PDF/PNG/JPG)
            </Typography>

            {created?.url && !file && (
              <Box
                sx={{
                  mb: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  flexWrap: "wrap",
                }}
              >
                <MuiLink href={created.url} target="_blank" rel="noopener">
                  <Button size="small" startIcon={<FileDownloadOutlinedIcon />}>
                    Open Last Uploaded
                  </Button>
                </MuiLink>
                <Typography variant="body2">
                  {created.fileName} •{" "}
                  {(created.fileSize && (created.fileSize / 1024).toFixed(0)) ||
                    "?"}{" "}
                  KB
                </Typography>
              </Box>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const f = e.target.files?.[0] || null;
                if (!f) return;
                if (!isAllowed(f)) {
                  setMsg({
                    open: true,
                    text: "Allowed: PDF, PNG, JPG.",
                    severity: "warning",
                  });
                  return;
                }
                setFile(f);
                setPreviewName(f.name);
              }}
              hidden
            />

            <Button
              variant="outlined"
              onClick={() => fileInputRef.current?.click()}
              startIcon={<FileDownloadOutlinedIcon />}
              sx={{ mb: 1 }}
            >
              Choose File
            </Button>

            <Typography variant="body2" sx={{ display: "inline", ml: 1 }}>
              {previewName ? <strong>{previewName}</strong> : "No file chosen"}
            </Typography>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 1 }}
            >
              Or drag & drop a file here.
            </Typography>
          </Box>
        </Grid>

        {/* BOTTOM: Date Required */}
        <Grid size={{ xs: 12 }}>
          <TextField
            inputRef={dateRef}
            fullWidth
            type="date"
            label="Date required"
            value={dateRequired}
            onChange={(e) => setDateRequired(e.target.value)}
            InputLabelProps={{ shrink: true }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Open calendar">
                    <span>
                      <Button
                        onClick={() => openNativePicker(dateRef.current)}
                        size="small"
                        variant="text"
                        sx={{ minWidth: 0, p: 0.5 }}
                        aria-label="Open calendar"
                      >
                        <CalendarMonthIcon fontSize="small" />
                      </Button>
                    </span>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
        </Grid>

        {/* Save */}
        <Grid size={{ xs: 12 }}>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Ethics Clearance"}
            </Button>
          </Box>
        </Grid>
      </Grid>

      <Snackbar
        open={msg.open}
        autoHideDuration={3500}
        onClose={() => setMsg((m) => ({ ...m, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setMsg((m) => ({ ...m, open: false }))}
          severity={msg.severity}
          variant="filled"
        >
          {msg.text}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default EthicsClearanceUploader;
