import React, { useState } from "react";
import { X, Copy, Quote, Check } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
// Import this CSS once in your app root (remove here if you already did it globally)
// import "react-toastify/dist/ReactToastify.css";

type Props = {
  open: boolean;
  onClose: () => void;
  authors: string[];
  title: string;
  year?: string | number;
  venue?: string;
};

const writeToClipboard = async (txt: string) => {
  try {
    await navigator.clipboard.writeText(txt);
  } catch {
    // noop
  }
};

// Join with Oxford comma (A, B, and C)
const oxfordJoin = (names: string[]) =>
  names.length <= 2
    ? names.join(" and ")
    : `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;

// Jane Marie Doe -> Jane M. D.
const toInitials = (full: string) =>
  full
    .trim()
    .split(/\s+/)
    .map((n, i) => (i === 0 ? n : `${n[0]?.toUpperCase()}.`))
    .join(" ")
    .trim();

// Jane Marie Doe -> Doe, Jane Marie
const lastFirst = (full: string) => {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts.pop();
  return `${last}, ${parts.join(" ")}`;
};

// "Jane Marie Doe" -> "Doe, J. M." (APA atom)
const toAPAName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  const last = parts.pop()!;
  const ini = parts.map((p) => `${p[0]?.toUpperCase()}.`).join(" ");
  return `${last}, ${ini}`.trim();
};

// APA author list w/ 20+ rule: first 19, …, last
const apaAuthors = (authors: string[]) => {
  if (authors.length === 0) return "";
  if (authors.length <= 20) return authors.map(toAPAName).join(", ");
  const first19 = authors.slice(0, 19).map(toAPAName).join(", ");
  const last = toAPAName(authors[authors.length - 1]);
  return `${first19}, …, ${last}`;
};

// Clean up spaces and dangling punctuation
const compact = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/\s+([,.:;()])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+\./g, ".")
    .trim();

const CitationModal: React.FC<Props> = ({
  open,
  onClose,
  authors,
  title,
  year,
  venue,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!open) return null;

  const yr = year ? String(year) : "";
  const ven = venue?.trim() ?? "";

  // Build raw strings (plain text), then "compact" them
  const mlaRaw = `${oxfordJoin(authors)}. "${title}." ${ven}, ${yr}.`;
  const apaRaw = `${apaAuthors(authors)} ${
    yr ? `(${yr}).` : ""
  } ${title}. ${ven}.`;
  const chicagoRaw = `${oxfordJoin(authors)}. "${title}." ${ven} ${
    yr ? `(${yr}).` : ""
  }`;
  const harvardRaw = `${oxfordJoin(authors.map(toInitials))} ${
    yr ? `(${yr})` : ""
  } ${title}. ${ven}.`;
  const vancouverRaw = `${authors
    .map((a) => lastFirst(a).replace(",", ""))
    .join(", ")}. ${title}. ${ven}. ${yr}.`;

  const rows = [
    { key: "MLA", text: compact(mlaRaw) },
    { key: "APA", text: compact(apaRaw) },
    { key: "Chicago", text: compact(chicagoRaw) },
    { key: "Harvard", text: compact(harvardRaw) },
    { key: "Vancouver", text: compact(vancouverRaw) },
  ];

  const handleCopy = async (key: string, text: string) => {
    await writeToClipboard(text);
    setCopiedKey(key);

    // Toast notify
    toast.success(`${key} citation copied`, {
      position: "top-right",
      autoClose: 1200,
      hideProgressBar: true,
      closeOnClick: true,
      pauseOnHover: false,
      draggable: false,
      theme: "colored",
    });

    setTimeout(() => setCopiedKey(null), 1200);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between bg-red-900 text-white px-5 py-3">
          <div className="flex items-center gap-2">
            <Quote className="w-4 h-4" />
            <h3 className="font-semibold">Cite</h3>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white/10 rounded-lg p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-3">
          {rows.map((r) => (
            <div key={r.key} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-red-900">{r.key}</span>
                <button
                  onClick={() => handleCopy(r.key, r.text)}
                  className="text-rose-700 hover:text-rose-800 text-sm inline-flex items-center gap-1"
                >
                  {copiedKey === r.key ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <p className="text-sm text-gray-800">{r.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Remove this if you already have a global ToastContainer */}
      <ToastContainer newestOnTop limit={3} />
    </div>
  );
};

export default CitationModal;
