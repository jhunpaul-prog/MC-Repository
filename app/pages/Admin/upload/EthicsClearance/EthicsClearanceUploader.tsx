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
  Stack,
} from "@mui/material";
import type { AlertColor } from "@mui/material";
import Grid from "@mui/material/Grid";
import SaveIcon from "@mui/icons-material/Save";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ReplayIcon from "@mui/icons-material/Replay";
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

/** Tailwind-ish tokens */
const RED_900 = "#7f1d1d";
const RED_800 = "#991b1b";
const GRAY_600 = "#4b5563";
const GRAY_300 = "#d1d5db";

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

const fileExt = (filename = "") => {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : "";
};
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

const openNativePicker = (input: HTMLInputElement | null) => {
  if (!input) return;
  const anyInput = input as any;
  if (typeof anyInput.showPicker === "function") anyInput.showPicker();
  else input.focus();
};

const EthicsClearanceUploader: React.FC = () => {
  const auth = getAuth();
  const uid = auth.currentUser?.uid ?? null;

  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // form
  const [file, setFile] = useState<File | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [signatoryName, setSignatoryName] = useState<string>("");
  const [dateRequired, setDateRequired] = useState<string>("");

  const [created, setCreated] = useState<ExistingClearance | null>(null);
  const [msg, setMsg] = useState<MsgState>({
    open: false,
    text: "",
    severity: "success",
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);

  const basePath = "ClearanceEthics/";

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

  // Clean up object URL when it changes / unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const clearSelected = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setPreviewName("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = ""; // allow same-name reselection
  };

  const handlePickedFile = (f: File | null) => {
    if (!f) return;
    if (!isAllowed(f)) {
      setMsg({
        open: true,
        text: "Allowed: PDF, PNG, JPG.",
        severity: "warning",
      });
      return;
    }
    // revoke old URL
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setFile(f);
    setPreviewName(f.name);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);

    // reset input so picking the same file name triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handlePickedFile(e.dataTransfer.files?.[0] || null);
  };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  const onSave = async () => {
    try {
      if (!signatoryName.trim()) throw new Error("Signatory name is required.");
      if (!dateRequired) throw new Error("Date acquired is mandatory.");
      if (!file)
        throw new Error(
          "Please attach the Ethics Clearance file (PDF/PNG/JPG)."
        );
      if (!isAllowed(file))
        throw new Error("Allowed file types: PDF, PNG, JPG.");

      setSaving(true);

      const listRef = dbRef(db, basePath);
      const newRef = push(listRef);
      const key = newRef.key as string;

      const ext = fileExt(file.name) || "pdf";
      const storagePath = `ClearanceEthics/${key}/clearance_${Date.now()}.${ext}`;
      const { publicUrl } = await uploadToSupabase({
        bucket: "papers-pdf",
        path: storagePath,
        file,
      });

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
      await set(newRef, payload);

      setCreated(payload);
      setMsg({
        open: true,
        text: "Ethics Clearance saved.",
        severity: "success",
      });

      // reset form
      clearSelected();
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
      <Paper
        sx={{
          p: 3,
          display: "flex",
          alignItems: "center",
          gap: 2,
          borderRadius: 2,
        }}
        elevation={1}
      >
        <CircularProgress size={20} sx={{ color: RED_900 }} />
        <Typography>Loading…</Typography>
      </Paper>
    );
  }

  const isImage =
    !!previewName &&
    (file
      ? file.type.startsWith("image/")
      : ["png", "jpg", "jpeg"].includes(fileExt(previewName)));
  const isPdf =
    !!previewName &&
    (file ? file.type === "application/pdf" : fileExt(previewName) === "pdf");

  return (
    <Paper
      sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, overflow: "hidden" }}
      elevation={1}
    >
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Ethics Clearance
        </Typography>
        <Typography variant="body2" sx={{ color: GRAY_600 }}>
          Upload the file, then fill in the details.
        </Typography>
      </Box>

      {/* Three sections: upload / fields / save */}
      <Grid container direction="column" spacing={3}>
        {/* Upload (centered) */}
        <Grid>
          <Box
            onClick={() => fileInputRef.current?.click()}
            onDrop={onDropFile}
            onDragOver={onDragOver}
            sx={{
              mx: "auto",
              maxWidth: 760,
              p: { xs: 2.5, md: 3 },
              border: "1px dashed",
              borderColor: GRAY_300,
              borderRadius: 2,
              cursor: "pointer",
              transition:
                "border-color .2s, background-color .2s, box-shadow .2s",
              "&:hover": {
                borderColor: RED_900,
                backgroundColor: "rgba(127,29,29,0.02)",
                boxShadow: "0 0 0 2px rgba(127,29,29,0.06) inset",
              },
            }}
            role="button"
            aria-label="Select or drop a file to upload"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handlePickedFile(e.target.files?.[0] || null)
              }
              hidden
            />

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems="center"
              justifyContent="space-between"
            >
              <Box sx={{ flex: 1, width: "100%" }}>
                <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
                  Upload Ethics Clearance (PDF/PNG/JPG)
                </Typography>

                {/* Live preview */}
                {!!previewUrl && (
                  <Box sx={{ mt: 1, mb: 1.5 }}>
                    {isImage && (
                      <Box
                        component="img"
                        src={previewUrl}
                        alt="Selected file preview"
                        sx={{
                          maxWidth: "100%",
                          maxHeight: 320,
                          borderRadius: 1.5,
                          border: "1px solid rgba(0,0,0,0.06)",
                          display: "block",
                        }}
                      />
                    )}
                    {isPdf && (
                      <Box
                        sx={{
                          height: 320,
                          borderRadius: 1.5,
                          overflow: "hidden",
                          border: "1px solid rgba(0,0,0,0.06)",
                        }}
                      >
                        <embed
                          src={previewUrl}
                          type="application/pdf"
                          width="100%"
                          height="100%"
                        />
                      </Box>
                    )}
                  </Box>
                )}

                {/* Last uploaded (only when no new file selected) */}
                {created?.url && !file && (
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    sx={{ mb: 1 }}
                  >
                    <MuiLink href={created.url} target="_blank" rel="noopener">
                      <Button
                        size="small"
                        startIcon={<FileDownloadOutlinedIcon />}
                        variant="outlined"
                        sx={{
                          borderColor: RED_900,
                          color: RED_900,
                          "&:hover": {
                            borderColor: RED_800,
                            backgroundColor: "rgba(127,29,29,0.04)",
                          },
                        }}
                      >
                        Open Last Uploaded
                      </Button>
                    </MuiLink>
                    <Typography variant="body2" sx={{ color: GRAY_600 }}>
                      {created.fileName} •{" "}
                      {(created.fileSize &&
                        (created.fileSize / 1024).toFixed(0)) ||
                        "?"}{" "}
                      KB
                    </Typography>
                  </Stack>
                )}

                {/* File name */}
                <Typography variant="body2" sx={{ color: GRAY_600 }}>
                  {previewName ? (
                    <strong>{previewName}</strong>
                  ) : (
                    "No file chosen"
                  )}
                </Typography>

                <Typography
                  variant="caption"
                  sx={{ display: "block", mt: 1, color: RED_900 }}
                >
                  Click anywhere in this box to select a file, or drag & drop a
                  file here.
                </Typography>
              </Box>

              {/* Actions: Select / Replace / Remove */}
              <Stack
                direction="column"
                spacing={1}
                sx={{ width: { xs: "100%", sm: "auto" } }}
              >
                <Button
                  variant="contained"
                  startIcon={<CloudUploadIcon />}
                  sx={{
                    backgroundColor: RED_900,
                    color: "#fff",
                    px: 3,
                    py: 1.25,
                    "&:hover": { backgroundColor: RED_800 },
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // reset first so the same file name triggers change
                    if (fileInputRef.current) fileInputRef.current.value = "";
                    fileInputRef.current?.click();
                  }}
                >
                  {file ? "Replace File" : "Select File"}
                </Button>

                {file && (
                  <Button
                    variant="outlined"
                    color="inherit"
                    startIcon={<DeleteOutlineIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSelected();
                    }}
                    sx={{
                      borderColor: "rgba(0,0,0,0.2)",
                      color: GRAY_600,
                      "&:hover": {
                        borderColor: "rgba(0,0,0,0.35)",
                        backgroundColor: "rgba(0,0,0,0.03)",
                      },
                    }}
                  >
                    Remove
                  </Button>
                )}

                {!file && previewName && (
                  <Button
                    variant="outlined"
                    startIcon={<ReplayIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (fileInputRef.current) fileInputRef.current.value = "";
                      fileInputRef.current?.click();
                    }}
                    sx={{
                      borderColor: RED_900,
                      color: RED_900,
                      "&:hover": {
                        borderColor: RED_800,
                        backgroundColor: "rgba(127,29,29,0.04)",
                      },
                    }}
                  >
                    Replace
                  </Button>
                )}
              </Stack>
            </Stack>
          </Box>
        </Grid>

        {/* Centered fields row */}
        <Grid>
          <Box sx={{ mx: "auto", maxWidth: 760 }}>
            <Grid
              container
              spacing={2}
              justifyContent="center"
              alignItems="center"
            >
              <Grid>
                <TextField
                  fullWidth
                  label="Signatory Name"
                  value={signatoryName}
                  onChange={(e) => setSignatoryName(e.target.value)}
                />
              </Grid>

              <Grid>
                <TextField
                  inputRef={dateRef}
                  fullWidth
                  type="date"
                  label="Date Acquired"
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
                              sx={{
                                minWidth: 0,
                                p: 0.5,
                                color: RED_900,
                                "&:hover": {
                                  backgroundColor: "rgba(127,29,29,0.06)",
                                },
                              }}
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
            </Grid>
          </Box>
        </Grid>

        {/* Bottom save */}
        <Grid>
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="contained"
              onClick={onSave}
              disabled={saving}
              startIcon={
                saving ? (
                  <CircularProgress size={16} sx={{ color: "#fff" }} />
                ) : (
                  <SaveIcon />
                )
              }
              sx={{
                backgroundColor: RED_900,
                color: "#fff",
                px: 2.5,
                "&:hover": { backgroundColor: RED_800 },
              }}
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
