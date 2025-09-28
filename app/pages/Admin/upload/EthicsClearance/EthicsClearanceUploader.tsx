// src/pages/admin/components/EthicsClearanceUploader.tsx
import React, { useEffect, useRef, useState, useMemo } from "react";
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
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
} from "@mui/material";
import type { AlertColor } from "@mui/material";
import Grid from "@mui/material/Grid";
import SaveIcon from "@mui/icons-material/Save";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ReplayIcon from "@mui/icons-material/Replay";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { getAuth } from "firebase/auth";
import {
  ref as dbRef,
  set,
  serverTimestamp,
  push,
  get as dbGet,
  onValue,
  update,
} from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { supabase } from "../../../../Backend/supabaseClient";
import { useNavigate } from "react-router-dom";

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
  linkedPaper?: {
    id: string;
    publicationType: string;
    title?: string;
  } | null;
}

interface MsgState {
  open: boolean;
  text: string;
  severity: AlertColor;
}

type PaperLite = {
  id: string;
  title: string;
  publicationType: string;
};

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
  const navigate = useNavigate();

  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // form
  const [file, setFile] = useState<File | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [signatoryName, setSignatoryName] = useState<string>("");
  const [dateRequired, setDateRequired] = useState<string>("");

  // optional link to a Paper
  const [allPapers, setAllPapers] = useState<PaperLite[]>([]);
  const [paperQuery, setPaperQuery] = useState("");
  const [selectedPaper, setSelectedPaper] = useState<PaperLite | null>(null);

  const [created, setCreated] = useState<ExistingClearance | null>(null);
  const [msg, setMsg] = useState<MsgState>({
    open: false,
    text: "",
    severity: "success",
  });

  // ✅ Success modal with countdown
  const [successOpen, setSuccessOpen] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const successIntervalRef = useRef<number | null>(null);
  const successTimeoutRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);

  const basePath = "ClearanceEthics/";

  // Load user display name
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
  }, [uid, auth.currentUser?.email]);

  // Build a lightweight searchable index of Papers
  useEffect(() => {
    const papersRef = dbRef(db, "Papers");
    return onValue(
      papersRef,
      (snap) => {
        const v = snap.val() || {};
        const list: PaperLite[] = [];
        Object.entries<any>(v).forEach(([category, group]) => {
          Object.entries<any>(group || {}).forEach(([id, p]) => {
            const title =
              p?.title ||
              p?.fieldsData?.Title ||
              p?.fieldsData?.title ||
              "Untitled";
            list.push({
              id,
              title,
              publicationType: p?.publicationType || category,
            });
          });
        });
        setAllPapers(list);
      },
      { onlyOnce: true }
    );
  }, []);

  // Clean up object URL + timers
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (successIntervalRef.current)
        window.clearInterval(successIntervalRef.current);
      if (successTimeoutRef.current)
        window.clearTimeout(successTimeoutRef.current);
    };
  }, [previewUrl]);

  // ===== Success modal countdown / redirect logic =====
  const goNow = () => {
    setSuccessOpen(false);
    // next tick to unmount dialog cleanly
    requestAnimationFrame(() => navigate("/ethics"));
  };

  useEffect(() => {
    if (!successOpen) return;

    setCountdown(3);

    // main countdown (reliable even if tab is active)
    successIntervalRef.current = window.setInterval(() => {
      setCountdown((s) => {
        if (s <= 1) {
          if (successIntervalRef.current)
            window.clearInterval(successIntervalRef.current);
          if (successTimeoutRef.current)
            window.clearTimeout(successTimeoutRef.current);
          goNow();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    // extra safety in case timers get throttled
    successTimeoutRef.current = window.setTimeout(goNow, 3500);

    return () => {
      if (successIntervalRef.current)
        window.clearInterval(successIntervalRef.current);
      if (successTimeoutRef.current)
        window.clearTimeout(successTimeoutRef.current);
    };
  }, [successOpen]);
  // ====================================================

  const clearSelected = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setPreviewName("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewName(f.name);
    setPreviewUrl(URL.createObjectURL(f));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handlePickedFile(e.dataTransfer.files?.[0] || null);
  };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  // Fuzzy-ish local search by title or id
  const filteredPapers = useMemo(() => {
    const q = paperQuery.trim().toLowerCase();
    if (!q) return allPapers.slice(0, 20);
    return allPapers
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [allPapers, paperQuery]);

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

      // 1) Create a new entry
      const listRef = dbRef(db, basePath);
      const newRef = push(listRef);
      const ethicsId = newRef.key as string;

      const ext = fileExt(file.name) || "pdf";
      const storagePath = `ClearanceEthics/${ethicsId}/clearance_${Date.now()}.${ext}`;
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
        linkedPaper: selectedPaper
          ? {
              id: selectedPaper.id,
              publicationType: selectedPaper.publicationType,
              title: selectedPaper.title,
            }
          : null,
      };

      await set(newRef, payload);

      // 2) If a Paper was selected, mirror a compact node on the Paper
      if (selectedPaper) {
        const ethicsNode = {
          id: ethicsId,
          url: publicUrl,
          signatoryName: payload.signatoryName || "",
          dateRequired: payload.dateRequired || "",
          linkedAt: serverTimestamp() as any,
        };
        const paperPath = `Papers/${selectedPaper.publicationType}/${selectedPaper.id}/ethics`;
        await update(dbRef(db, paperPath), ethicsNode);
      }

      setCreated(payload);
      setMsg({
        open: true,
        text: "Ethics Clearance saved.",
        severity: "success",
      });

      // reset form (keep selectedPaper so user still sees linkage)
      clearSelected();
      setSignatoryName("");
      setDateRequired("");

      // ✅ open success modal (auto-redirect handled by useEffect)
      setSuccessOpen(true);
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
          Upload the file, then (optionally) tag a Paper to auto-link this
          Ethics to it.
        </Typography>
      </Box>

      {/* Three sections: upload / fields / save */}
      <Grid container direction="column" spacing={3}>
        {/* Upload */}
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

        {/* CENTERED optional Paper tag section */}
        <Grid>
          <Box sx={{ mx: "auto", maxWidth: 760 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5, color: GRAY_600 }}>
              Optional: Tag to an existing Paper
            </Typography>
            <Autocomplete
              options={filteredPapers}
              fullWidth
              getOptionLabel={(opt) =>
                `${opt.title} — [${opt.publicationType}] (${opt.id})`
              }
              value={selectedPaper}
              onChange={(_, v) => setSelectedPaper(v)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search by title or ID"
                  placeholder="Start typing a title or paste a Paper ID…"
                  onChange={(e) => setPaperQuery(e.target.value)}
                  helperText={
                    selectedPaper
                      ? `Linked to: ${selectedPaper.title} — [${selectedPaper.publicationType}] (${selectedPaper.id})`
                      : "Leave empty if you don't want to link right now."
                  }
                />
              )}
              clearOnBlur={false}
              blurOnSelect
            />
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

      {/* Snackbar (kept) */}
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

      {/* ✅ Success Modal with countdown + click/Enter to go */}
      <Dialog
        open={successOpen}
        onClose={goNow} // backdrop click or ESC
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: { p: 3, borderRadius: 2, textAlign: "center", cursor: "pointer" },
          onClick: goNow, // click anywhere on dialog
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter") goNow();
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <CheckCircleOutlineIcon
            sx={{ fontSize: 56, color: "#16a34a", mb: 1 }}
          />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Upload successful!
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Typography variant="body2" sx={{ color: GRAY_600 }}>
            The ethics clearance has been saved.
          </Typography>
          <Typography variant="body2" sx={{ color: GRAY_600, mt: 0.5 }}>
            Redirecting in <strong>{countdown}</strong>…
          </Typography>
          <Button
            onClick={goNow}
            size="small"
            variant="contained"
            sx={{
              mt: 2,
              backgroundColor: RED_900,
              "&:hover": { backgroundColor: RED_800 },
            }}
          >
            Go now
          </Button>
        </DialogContent>
      </Dialog>
    </Paper>
  );
};

export default EthicsClearanceUploader;
