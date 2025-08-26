import React from "react";
import { X, Copy, Quote } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  authors: string[];
  title: string;
  year?: string | number;
  venue?: string;
};

const copy = async (txt: string) => {
  try {
    await navigator.clipboard.writeText(txt);
  } catch {}
};

const oxfordJoin = (names: string[]) =>
  names.length <= 2
    ? names.join(" and ")
    : `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;

const initials = (full: string) =>
  full
    .split(/\s+/)
    .map((n, i) => (i === 0 ? n : `${n[0].toUpperCase()}.`))
    .join(" ");

const lastFirst = (full: string) => {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts.pop();
  return `${last}, ${parts.join(" ")}`;
};

const apaAuthors = (authors: string[]) =>
  authors
    .map((a) => {
      const parts = a.trim().split(/\s+/);
      const last = parts.pop()!;
      const ini = parts.map((p) => `${p[0].toUpperCase()}.`).join(" ");
      return `${last}, ${ini}`;
    })
    .join(", ");

const CitationModal: React.FC<Props> = ({
  open,
  onClose,
  authors,
  title,
  year,
  venue,
}) => {
  if (!open) return null;
  const yr = year ? String(year) : "";

  const mla = `${oxfordJoin(authors)}. "${title}." ${
    venue ?? ""
  }, ${yr}.`.replace(/\s+,/g, ",");
  const apa = `${apaAuthors(authors.slice(0, 6))}${
    authors.length > 6 ? ", et al." : ""
  } (${yr}). ${title}. ${venue ?? ""}.`;
  const chicago = `${oxfordJoin(authors)}. "${title}." ${venue ?? ""} (${yr}).`;
  const harvard = `${oxfordJoin(authors.map(initials))} (${yr}) ${title}. ${
    venue ?? ""
  }.`;
  const vancouver = `${authors
    .map((a) => lastFirst(a).replace(",", ""))
    .join(", ")}. ${title}. ${venue ?? ""}. ${yr}.`;

  const rows = [
    { name: "MLA", text: mla },
    { name: "APA", text: apa },
    { name: "Chicago", text: chicago },
    { name: "Harvard", text: harvard },
    { name: "Vancouver", text: vancouver },
  ];

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
            <div key={r.name} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-red-900">{r.name}</span>
                <button
                  onClick={() => copy(r.text)}
                  className="text-rose-700 hover:text-rose-800 text-sm inline-flex items-center gap-1"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
              </div>
              <p className="text-sm text-gray-800">{r.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CitationModal;
