import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaShieldAlt,
  FaUser,
  FaBullseye,
  FaEye,
  FaShareAlt,
  FaLock,
  FaDatabase,
  FaFileAlt,
  FaBars,
  FaTimes,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { ref, get } from "firebase/database";
import { db } from "../../../Backend/firebase";
import Navbar from "../components/Navbar";

/* ===================== Types ===================== */
type SectionItem = {
  sectionTitle?: string;
  heading?: string;
  title?: string;
  content?: string;
  body?: string;
  text?: string;
  [k: string]: any;
};

type PrivacyPolicy = {
  id?: string;
  title?: string;
  version?: string;
  effectiveDate?: string; // "YYYY-MM-DD"
  status?: string;
  uploadedBy?: string;
  createdAt?: number;
  lastModified?: number;
  sections?: Record<string, SectionItem> | SectionItem[];
};

type TermsDoc = {
  id?: string;
  title?: string;
  version?: string;
  effectiveDate?: string;
  content?: string; // HTML
  createdAt?: number;
  lastModified?: number;
};

/* ===================== Helpers ===================== */
const ACCENT = "rgb(148, 27, 27)"; // maroon

const formatDateYMD = (value?: string | number) => {
  if (!value && value !== 0) return "";
  const d =
    typeof value === "number"
      ? new Date(value)
      : /^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? new Date(String(value) + "T00:00:00")
      : new Date(String(value));
  if (isNaN(d.getTime())) return String(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const SectionHeader: React.FC<{ index: number; title: string }> = ({
  index,
  title,
}) => (
  <div className="mb-3">
    <div className="text-[11px] tracking-[0.35em] text-gray-400 font-medium select-none">
      {String(index).padStart(2, "0")}
    </div>
    <h2 className="text-xl sm:text-2xl font-serif font-semibold text-gray-900">
      {title}
    </h2>
  </div>
);

/* ===================== Component ===================== */
const GeneralPrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  // UI
  const [loading, setLoading] = useState(true);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  // Consent
  const [showConsent, setShowConsent] = useState(false);

  // Scroll spy / offset
  const HEADER_OFFSET = 120; // match scroll-mt below
  const [activeId, setActiveId] = useState<string>("about");
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);

  // Content
  const [mission, setMission] = useState("");
  const [vision, setVision] = useState("");

  // Privacy versions
  const [privacyList, setPrivacyList] = useState<PrivacyPolicy[]>([]);
  const [selectedPrivacyId, setSelectedPrivacyId] = useState<string | null>(
    null
  );
  const selectedPrivacy = useMemo(
    () => privacyList.find((p) => p.id === selectedPrivacyId) || null,
    [privacyList, selectedPrivacyId]
  );

  // Terms versions
  const [termsList, setTermsList] = useState<TermsDoc[]>([]);
  const [selectedTermsId, setSelectedTermsId] = useState<string | null>(null);
  const selectedTerms = useMemo(
    () => termsList.find((t) => t.id === selectedTermsId) || null,
    [termsList, selectedTermsId]
  );

  /* ===================== Fetch ===================== */
  useEffect(() => {
    const load = async () => {
      try {
        // Mission / Vision
        const compSnap = await get(ref(db, "components"));
        if (compSnap.exists()) {
          const c = compSnap.val() || {};
          setMission(c.Mission || "");
          setVision(c.Vision || "");
        }

        // PrivacyPolicies
        const ppSnap = await get(ref(db, "PrivacyPolicies"));
        if (ppSnap.exists()) {
          const raw: Record<string, any> = ppSnap.val() || {};
          const list: PrivacyPolicy[] = Object.entries(raw).map(([id, v]) => ({
            id,
            title: v.title,
            version: v.version,
            effectiveDate: v.effectiveDate,
            status: v.status,
            uploadedBy: v.uploadedBy,
            createdAt: v.createdAt,
            lastModified: v.lastModified,
            sections: v.sections,
          }));
          list.sort((a, b) => {
            const ak = (a.lastModified ?? a.createdAt ?? 0) as number;
            const bk = (b.lastModified ?? b.createdAt ?? 0) as number;
            return bk - ak;
          });
          setPrivacyList(list);
          if (list.length) setSelectedPrivacyId(list[0].id!);
        }

        // Terms & Conditions
        const tcSnap = await get(ref(db, "Terms & Conditions"));
        if (tcSnap.exists()) {
          const raw: Record<string, TermsDoc> = tcSnap.val() || {};
          const list: TermsDoc[] = Object.entries(raw).map(([id, v]) => ({
            id,
            title: v.title,
            version: v.version,
            effectiveDate: v.effectiveDate,
            content: v.content,
            createdAt: v.createdAt,
            lastModified: v.lastModified,
          }));
          list.sort((a, b) => {
            const ak = (a.lastModified ?? a.createdAt ?? 0) as number;
            const bk = (b.lastModified ?? b.createdAt ?? 0) as number;
            return bk - ak;
          });
          setTermsList(list);
          if (list.length) setSelectedTermsId(list[0].id!);
        }
      } catch (e) {
        console.error("Failed to load policy docs:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* ===================== Consent Bar ===================== */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("policy_consent");
      setShowConsent(!saved);
    } catch {
      setShowConsent(true);
    }
  }, []);

  const acceptConsent = () => {
    try {
      const payload = {
        acceptedAt: Date.now(),
        privacyVersion: selectedPrivacy?.version ?? null,
        termsVersion: selectedTerms?.version ?? null,
      };
      localStorage.setItem("policy_consent", JSON.stringify(payload));
    } catch {}
    setShowConsent(false);
  };
  const declineConsent = () => {
    setShowConsent(false);
    navigate(-1);
  };

  /* ===================== Section rendering ===================== */
  const renderSections = (sections?: PrivacyPolicy["sections"]) => {
    if (!sections) return null;

    const one = (v: SectionItem, key: React.Key) => {
      const heading =
        v.sectionTitle ??
        v.heading ??
        v.title ??
        (typeof key === "string" ? key : "");
      const body = v.content ?? v.body ?? v.text ?? "";
      return (
        <div key={key} className="space-y-2">
          {heading ? (
            <h4 className="font-semibold text-gray-900">{heading}</h4>
          ) : null}
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {String(body)}
          </p>
        </div>
      );
    };

    if (Array.isArray(sections)) {
      return (
        <div className="space-y-4">
          {sections.map((s, i) => one(s as SectionItem, i))}
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {Object.entries(sections).map(([k, v]) => one(v as SectionItem, k))}
      </div>
    );
  };

  /* ===================== Scroll spy (deterministic) ===================== */
  const sectionIds = [
    "about",
    "mission",
    "vision",
    "disclosure",
    "privacy",
    "dataprivacy",
    "terms",
  ];

  useEffect(() => {
    const onScroll = () => {
      if (isAutoScrolling) return; // don't override while programmatically scrolling
      let current = sectionIds[0];
      let min = Infinity;

      sectionIds.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const top = el.getBoundingClientRect().top - HEADER_OFFSET;
        // choose the closest section whose top is above/near the header
        if (top <= 8 && Math.abs(top) < min) {
          min = Math.abs(top);
          current = id;
        }
      });

      setActiveId(current);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isAutoScrolling]);

  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActiveId(id); // highlight immediately
    setIsAutoScrolling(true);

    const y = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top: y, behavior: "smooth" });

    window.setTimeout(() => setIsAutoScrolling(false), 450);
  };

  /* ===================== TOC items ===================== */
  const toc = [
    { id: "about", label: "About", icon: <FaUser className="w-3.5 h-3.5" /> },
    {
      id: "mission",
      label: "Mission",
      icon: <FaBullseye className="w-3.5 h-3.5" />,
    },
    { id: "vision", label: "Vision", icon: <FaEye className="w-3.5 h-3.5" /> },
    {
      id: "disclosure",
      label: "Information Sharing",
      icon: <FaShareAlt className="w-3.5 h-3.5" />,
    },
    {
      id: "privacy",
      label: "Privacy Policy",
      icon: <FaLock className="w-3.5 h-3.5" />,
    },
    {
      id: "dataprivacy",
      label: "Data Privacy",
      icon: <FaDatabase className="w-3.5 h-3.5" />,
    },
    {
      id: "terms",
      label: "Terms & Conditions",
      icon: <FaFileAlt className="w-3.5 h-3.5" />,
    },
  ];

  /* ===================== Render ===================== */
  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Title row */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-[#f9ecec]">
              <FaShieldAlt style={{ color: ACCENT }} className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900">
                Privacy & Policies
              </h1>
              <p className="text-gray-500 text-sm">
                Academic Portal Guidelines
              </p>
            </div>
          </div>

          {/* Version pickers
          <div className="flex items-end gap-4 w-full sm:w-auto">
            {privacyList.length > 0 && (
              <div className="w-full sm:w-auto">
                <label className="block text-xs text-gray-600 mb-1">
                  Privacy Version
                </label>
                <select
                  className="w-full sm:w-64 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#8f1f1f]"
                  value={selectedPrivacyId ?? ""}
                  onChange={(e) => setSelectedPrivacyId(e.target.value)}
                >
                  {privacyList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {`v${p.version ?? "—"} • ${
                        p.effectiveDate
                          ? formatDateYMD(p.effectiveDate)
                          : p.lastModified
                          ? formatDateYMD(p.lastModified)
                          : "date—"
                      }${p.status ? ` • ${p.status}` : ""}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {termsList.length > 0 && (
              <div className="w-full sm:w-auto">
                <label className="block text-xs text-gray-600 mb-1">
                  Terms Version
                </label>
                <select
                  className="w-full sm:w-64 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#8f1f1f]"
                  value={selectedTermsId ?? ""}
                  onChange={(e) => setSelectedTermsId(e.target.value)}
                >
                  {termsList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {`v${t.version ?? "—"} • ${
                        t.effectiveDate
                          ? formatDateYMD(t.effectiveDate)
                          : t.lastModified
                          ? formatDateYMD(t.lastModified)
                          : "date—"
                      }`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div> */}
        </div>

        <div className="mt-6 grid grid-cols-12 gap-6">
          {/* Sidebar (desktop) */}
          <aside className="hidden lg:block col-span-3">
            <div className="sticky top-24">
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-[#f9ecec] px-4 py-3">
                  <p className="text-xs font-medium text-gray-600">Sections</p>
                </div>
                <nav className="p-2">
                  {toc.map((item) => {
                    const active = activeId === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => goTo(item.id)}
                        className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                          active
                            ? "bg-[#8f1f1f]/10 text-[#7a1d1d] font-medium"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <span
                          className={`grid place-items-center w-4 h-4 rounded-sm border ${
                            active
                              ? "border-[#7a1d1d] bg-white"
                              : "border-gray-300"
                          }`}
                        >
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          </aside>

          {/* Mobile TOC */}
          <div className="lg:hidden col-span-12">
            <button
              onClick={() => setMobileTocOpen((v) => !v)}
              className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3"
            >
              <span className="font-medium text-gray-900">
                Table of Contents
              </span>
              {mobileTocOpen ? (
                <FaTimes className="text-gray-500" />
              ) : (
                <FaBars className="text-gray-500" />
              )}
            </button>
            {mobileTocOpen && (
              <div className="mt-2 bg-white border border-gray-200 rounded-lg p-2">
                <div className="grid grid-cols-2 gap-1">
                  {toc.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => goTo(t.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                        activeId === t.id
                          ? "bg-[#8f1f1f]/10 text-[#7a1d1d]"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {t.icon}
                      <span className="truncate">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <main className="col-span-12 lg:col-span-9 space-y-10">
            {/* About */}
            <section id="about" className="scroll-mt-[120px]">
              <SectionHeader index={1} title="About" />
              <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6">
                <p className="text-sm text-gray-700 leading-relaxed">
                  This Privacy & Policies page outlines our commitment to
                  protecting your personal information and maintaining the
                  highest standards of data security within our academic
                  environment. These policies apply to all users of our
                  educational platform, including students, faculty,
                  researchers, and administrative staff.
                </p>
                <p className="text-sm text-gray-700 leading-relaxed mt-4">
                  Our comprehensive approach ensures compliance with
                  international data protection regulations while fostering an
                  environment of trust and transparency essential for academic
                  excellence.
                </p>
              </div>
            </section>

            {/* Mission */}
            <section id="mission" className="scroll-mt-[120px]">
              <SectionHeader index={2} title="Mission" />
              <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {mission ||
                    "Our mission is to create a secure, transparent, and ethical framework for handling personal and academic data while enabling innovative research and educational excellence."}
                </p>
                <div className="mt-5">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Core Principles
                  </h4>
                  <ul className="list-disc pl-6 text-sm text-gray-700 space-y-1">
                    <li>
                      <span className="font-medium">Clarity:</span> Clear,
                      understandable information about our data practices
                    </li>
                    <li>
                      <span className="font-medium">Security:</span> Robust
                      technical and administrative safeguards
                    </li>
                    <li>
                      <span className="font-medium">Transparency:</span> Open
                      communication on data use and sharing
                    </li>
                    <li>
                      <span className="font-medium">Accountability:</span>{" "}
                      Responsibility in protecting your privacy
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Vision */}
            <section id="vision" className="scroll-mt-[120px]">
              <SectionHeader index={3} title="Vision" />
              <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {vision ||
                    "We envision a future where academic institutions set the gold standard for data privacy and protection, enabling groundbreaking research while maintaining the utmost respect for individual privacy rights."}
                </p>
                <div className="mt-5">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Our Commitment to Excellence
                  </h4>
                  <ul className="list-disc pl-6 text-sm text-gray-700 space-y-1">
                    <li>
                      <span className="font-medium">User Trust:</span>{" "}
                      Consistent, ethical data practices
                    </li>
                    <li>
                      <span className="font-medium">
                        Regulatory Compliance:
                      </span>{" "}
                      Exceeding legal requirements
                    </li>
                    <li>
                      <span className="font-medium">Academic Integrity:</span>{" "}
                      Supporting scholarship with strict ethics
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Information Sharing */}
            <section id="disclosure" className="scroll-mt-[120px]">
              <SectionHeader index={4} title="Information Sharing" />
              <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6">
                <p className="text-sm text-gray-700 leading-relaxed">
                  We do not sell, rent, or share personal data without explicit
                  consent except when required by law or necessary to provide
                  our services. Any data sharing is done in accordance with
                  applicable privacy laws and regulations.
                </p>
              </div>
            </section>

            {/* Privacy Policy (DB-driven) */}
            <section id="privacy" className="scroll-mt-[120px]">
              <SectionHeader index={5} title="Privacy Policy" />
              <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 space-y-5">
                {selectedPrivacy ? (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="bg-[#f9ecec] border border-gray-200 rounded-lg px-4 py-3">
                        <div className="font-semibold text-gray-900">
                          {selectedPrivacy.title || "Privacy Policy"}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {selectedPrivacy.version
                            ? `Version: ${selectedPrivacy.version}`
                            : null}
                          {selectedPrivacy.version &&
                          (selectedPrivacy.effectiveDate ||
                            selectedPrivacy.lastModified)
                            ? " • "
                            : ""}
                          {selectedPrivacy.effectiveDate
                            ? `Effective: ${formatDateYMD(
                                selectedPrivacy.effectiveDate
                              )}`
                            : selectedPrivacy.lastModified
                            ? `Updated: ${formatDateYMD(
                                selectedPrivacy.lastModified
                              )}`
                            : ""}
                        </div>
                      </div>

                      {privacyList.length > 1 && (
                        <div className="w-full sm:w-auto">
                          <label className="block text-xs text-gray-600 mb-1">
                            Version
                          </label>
                          <select
                            className="w-full sm:w-64 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#8f1f1f]"
                            value={selectedPrivacyId ?? ""}
                            onChange={(e) =>
                              setSelectedPrivacyId(e.target.value)
                            }
                          >
                            {privacyList.map((p) => (
                              <option key={p.id} value={p.id}>
                                {`v${p.version ?? "—"} • ${
                                  p.effectiveDate
                                    ? formatDateYMD(p.effectiveDate)
                                    : p.lastModified
                                    ? formatDateYMD(p.lastModified)
                                    : "date—"
                                }${p.status ? ` • ${p.status}` : ""}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {renderSections(selectedPrivacy.sections)}
                  </>
                ) : (
                  <p className="text-sm text-gray-500">
                    No Privacy Policy found.
                  </p>
                )}
              </div>
            </section>

            {/* Data Privacy */}
            <section id="dataprivacy" className="scroll-mt-[120px]">
              <SectionHeader index={6} title="Data Privacy" />
              <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6">
                <p className="text-sm text-gray-700 leading-relaxed">
                  We adhere to the Data Privacy Act of 2012 and international
                  data protection standards to protect your rights. Our data
                  processing activities are governed by principles of
                  transparency, lawfulness, and data minimization.
                </p>
              </div>
            </section>

            {/* Terms & Conditions (DB-driven) */}
            <section id="terms" className="scroll-mt-[120px]">
              <SectionHeader index={7} title="Terms & Conditions" />
              <div className="bg-white border border-orange-200 rounded-xl p-5 sm:p-6 space-y-5">
                {selectedTerms ? (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
                        <div className="font-semibold text-gray-900">
                          {selectedTerms.title || "Terms & Conditions"}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {selectedTerms.version
                            ? `Version: ${selectedTerms.version}`
                            : "—"}
                          {selectedTerms.version &&
                          (selectedTerms.effectiveDate ||
                            selectedTerms.lastModified)
                            ? " • "
                            : " "}
                          {selectedTerms.effectiveDate
                            ? `Effective: ${formatDateYMD(
                                selectedTerms.effectiveDate
                              )}`
                            : selectedTerms.lastModified
                            ? `Updated: ${formatDateYMD(
                                selectedTerms.lastModified
                              )}`
                            : ""}
                        </div>
                      </div>

                      {termsList.length > 1 && (
                        <div className="w-full sm:w-auto">
                          <label className="block text-xs text-gray-600 mb-1">
                            Version
                          </label>
                          <select
                            className="w-full sm:w-64 border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#8f1f1f]"
                            value={selectedTermsId ?? ""}
                            onChange={(e) => setSelectedTermsId(e.target.value)}
                          >
                            {termsList.map((t) => (
                              <option key={t.id} value={t.id}>
                                {`v${t.version ?? "—"} • ${
                                  t.effectiveDate
                                    ? formatDateYMD(t.effectiveDate)
                                    : t.lastModified
                                    ? formatDateYMD(t.lastModified)
                                    : "date—"
                                }`}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {selectedTerms.content ? (
                      <div
                        className="prose prose-sm max-w-none text-gray-800"
                        dangerouslySetInnerHTML={{
                          __html: selectedTerms.content,
                        }}
                      />
                    ) : (
                      <p className="text-sm text-gray-500">
                        No content available.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-500">
                    No Terms & Conditions found.
                  </p>
                )}
              </div>
            </section>

            {/* Loading */}
            {loading && (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8f1f1f] mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading policy documents…</p>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Sticky consent bar */}
      {showConsent && (
        <div className="fixed bottom-0 inset-x-0 z-30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-4">
            <div className="rounded-lg border border-gray-200 bg-white shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
                <p className="text-xs sm:text-sm text-gray-600 flex-1">
                  By continuing to use our platform, you acknowledge that you
                  have read and understood our Privacy Policy and Terms &
                  Conditions.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={declineConsent}
                    className="px-3 py-2 text-xs sm:text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Decline
                  </button>
                  <button
                    onClick={acceptConsent}
                    className="px-3 py-2 text-xs sm:text-sm rounded-md text-white bg-[#7a1d1d] hover:bg-[#8f1f1f]"
                  >
                    Accept
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-white mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-sm text-gray-300 text-center sm:text-left">
              Copyright © 2025 | Southwestern University PHINMA | CobyCare
              Repository
            </p>
            <div className="flex items-center gap-5">
              <button className="text-sm text-gray-300 hover:text-white transition">
                Privacy Policy
              </button>
              <button className="text-sm text-gray-300 hover:text-white transition">
                Terms of Service
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default GeneralPrivacyPolicy;
