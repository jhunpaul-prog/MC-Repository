import React, { useEffect, useRef, useState } from "react";
import { ref, get } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { Download, Eye, Target, Copy, Check, Printer } from "lucide-react";

// subtle brand accent (used sparingly)
const BRAND = "#8D1E1E";

const MissionVision: React.FC = () => {
  const [mission, setMission] = useState<string>("Loading mission...");
  const [vision, setVision] = useState<string>("Loading vision...");
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<"Mission" | "Vision" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const missionRef = useRef<HTMLDivElement | null>(null);
  const visionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = ref(db, "components");
        const s = await get(r);
        if (s.exists()) {
          const v = s.val();
          setMission(v?.Mission || "Mission not available");
          setVision(v?.Vision || "Vision not available");
        } else {
          setMission("Mission not available");
          setVision("Vision not available");
        }
      } catch (e) {
        console.error(e);
        setError("Unable to load content right now.");
        setMission("Unable to load mission.");
        setVision("Unable to load vision.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const download = (label: "Mission" | "Vision", text: string) => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CobyCare_${label}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copyText = async (label: "Mission" | "Vision", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    }
  };

  const printBlock = (label: "Mission" | "Vision") => {
    const w = window.open(
      "",
      "_blank",
      "noopener,noreferrer,width=900,height=700"
    );
    if (!w) return;
    const content = label === "Mission" ? mission : vision;

    const html = `
      <html>
        <head>
          <title>${label}</title>
          <style>
            :root{ --fz: clamp(14px, 0.5vw + 12px, 18px); --lh: 1.65; }
            body{ margin:0; padding:28px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial; color:#0f172a; background:#fff; font-size: var(--fz); line-height: var(--lh); }
            h1{ margin:0 0 16px; font-size: clamp(20px, 1.2vw + 18px, 28px); color:${BRAND}; }
            .box{ border:1px solid #e5e7eb; border-radius:14px; padding:20px; }
          </style>
        </head>
        <body>
          <h1>${label}</h1>
          <div class="box">${content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br/>")}</div>
          <script>window.print();</script>
        </body>
      </html>
    `;
    w.document.write(html);
    w.document.close();
  };

  const HeaderBar: React.FC<{
    title: "Mission" | "Vision";
    Icon: any;
    text: string;
  }> = ({ title, Icon, text }) => (
    <div
      className="flex items-center justify-between px-4 sm:px-6 py-3
                    bg-gradient-to-r from-stone-50 via-white to-stone-50
                    text-slate-900 border-b border-stone-200"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white shadow-sm ring-1 ring-stone-200">
          <Icon
            className="h-5 w-5"
            style={{ color: BRAND }}
            aria-hidden="true"
          />
        </div>
        <h3
          className="font-semibold tracking-wide"
          style={{ fontSize: "clamp(1rem, 0.45vw + 0.95rem, 1.5rem)" }}
        >
          {title}
        </h3>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => copyText(title, text)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md
                     bg-white hover:bg-stone-50 ring-1 ring-stone-200 text-slate-700 text-xs sm:text-sm transition"
          aria-label={`Copy ${title}`}
          title={`Copy ${title}`}
        >
          {copied === title ? (
            <>
              <Check className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" style={{ color: BRAND }} />
              <span className="hidden sm:inline">Copy</span>
            </>
          )}
        </button>

        <button
          onClick={() => download(title, text)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md
                     bg-white hover:bg-stone-50 ring-1 ring-stone-200 text-slate-700 text-xs sm:text-sm transition"
          aria-label={`Download ${title}`}
          title={`Download ${title}`}
        >
          <Download className="h-4 w-4" style={{ color: BRAND }} />
          <span className="hidden sm:inline">Download</span>
        </button>

        <button
          onClick={() => printBlock(title)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md
                     bg-white hover:bg-stone-50 ring-1 ring-stone-200 text-slate-700 text-xs sm:text-sm transition"
          aria-label={`Print ${title}`}
          title={`Print ${title}`}
        >
          <Printer className="h-4 w-4" style={{ color: BRAND }} />
          <span className="hidden sm:inline">Print</span>
        </button>
      </div>
    </div>
  );

  const CardShell: React.FC<{
    header: React.ReactNode;
    innerRef?: React.Ref<HTMLDivElement>;
    children: React.ReactNode;
  }> = ({ header, innerRef, children }) => (
    <article
      className="group overflow-hidden rounded-2xl bg-white
                 border border-stone-200
                 shadow-[0_8px_24px_rgba(16,24,40,0.06)]
                 hover:shadow-[0_10px_28px_rgba(16,24,40,0.08)] transition
                 h-full"
      ref={innerRef as any}
    >
      {/* ultra-thin brand accent only */}
      <div
        className="h-0.5 w-full"
        style={{ background: BRAND, opacity: 0.15 }}
      />
      {header}
      <div className="p-5 sm:p-6 lg:p-7 2xl:p-8 bg-gradient-to-b from-white via-white to-stone-50/40">
        {children}
      </div>
    </article>
  );

  const Skeleton: React.FC = () => (
    <div className="animate-pulse">
      <div className="h-6 w-28 bg-stone-200 rounded mb-4" />
      <div className="space-y-3">
        <div className="h-4 w-[92%] bg-stone-200/70 rounded" />
        <div className="h-4 w-[88%] bg-stone-200/70 rounded" />
        <div className="h-4 w-[94%] bg-stone-200/70 rounded" />
        <div className="h-4 w-[75%] bg-stone-200/70 rounded" />
      </div>
    </div>
  );

  return (
    <section
      id="mission-vision"
      className="w-full"
      aria-labelledby="mv-heading"
    >
      <h2 id="mv-heading" className="sr-only">
        Mission and Vision
      </h2>

      <div className="min-h-[calc(100vh-160px)] flex">
        <div className="container mx-auto px-4 lg:px-6 2xl:px-8 max-w-[1400px] flex-1 py-6 md:py-10 lg:py-12">
          <div
            className="rounded-3xl p-3 sm:p-4 lg:p-6 xl:p-8
                          bg-gradient-to-br from-white via-stone-50 to-white"
          >
            {error && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-stone-300 bg-stone-50 text-slate-800 px-4 py-3 text-sm"
              >
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 auto-rows-fr">
              <CardShell
                header={
                  <HeaderBar title="Mission" Icon={Target} text={mission} />
                }
                innerRef={missionRef}
              >
                {loading ? (
                  <Skeleton />
                ) : (
                  <p
                    className="text-slate-800 whitespace-pre-wrap break-words"
                    style={{
                      fontSize: "clamp(1rem, 0.5vw + 0.95rem, 1.25rem)",
                      lineHeight: "clamp(1.6, 0.25vw + 1.55, 1.85)",
                    }}
                  >
                    {mission}
                  </p>
                )}
              </CardShell>

              <CardShell
                header={<HeaderBar title="Vision" Icon={Eye} text={vision} />}
                innerRef={visionRef}
              >
                {loading ? (
                  <Skeleton />
                ) : (
                  <p
                    className="text-slate-800 whitespace-pre-wrap break-words"
                    style={{
                      fontSize: "clamp(1rem, 0.5vw + 0.95rem, 1.25rem)",
                      lineHeight: "clamp(1.6, 0.25vw + 1.55, 1.85)",
                    }}
                  >
                    {vision}
                  </p>
                )}
              </CardShell>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MissionVision;
