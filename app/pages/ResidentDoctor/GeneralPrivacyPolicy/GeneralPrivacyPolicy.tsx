// pages/ResidentDoctor/GeneralPrivacyPolicy.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  FaShieldAlt,
  FaExclamationTriangle,
  FaUser,
  FaBullseye,
  FaEye,
  FaShareAlt,
  FaLock,
  FaDatabase,
  FaFileAlt,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { ref, get } from "firebase/database";
import { db } from "../../../Backend/firebase"; // ← adjust if needed

type PrivacyPolicy = {
  title?: string;
  version?: string;
  effectiveDate?: string;
  createdAt?: number;
  lastModified?: number;
  sections?: any; // array or object
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

const GeneralPrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // data
  const [mission, setMission] = useState<string>("");
  const [vision, setVision] = useState<string>("");
  const [privacy, setPrivacy] = useState<PrivacyPolicy | null>(null);
  const [terms, setTerms] = useState<TermsDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // ---------- fetch ----------
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

        // PrivacyPolicies → newest by lastModified/createdAt
        const ppSnap = await get(ref(db, "PrivacyPolicies"));
        if (ppSnap.exists()) {
          const all: Record<string, PrivacyPolicy> = ppSnap.val() || {};
          const entries = Object.values(all);
          if (entries.length) {
            entries.sort((a, b) => {
              const ak = (a.lastModified ?? a.createdAt ?? 0) as number;
              const bk = (b.lastModified ?? b.createdAt ?? 0) as number;
              return bk - ak;
            });
            setPrivacy(entries[0]);
          }
        }

        // Terms & Conditions (new structure): pick newest entry, render HTML
        const tcSnap = await get(ref(db, "Terms & Conditions"));
        if (tcSnap.exists()) {
          const raw: Record<string, TermsDoc> = tcSnap.val() || {};
          const list = Object.entries(raw).map(([id, v]) => ({
            id,
            title: v.title,
            version: v.version,
            effectiveDate: v.effectiveDate,
            content: v.content,
            createdAt: v.createdAt,
            lastModified: v.lastModified,
          }));
          if (list.length) {
            list.sort((a, b) => {
              const ak = (a.lastModified ?? a.createdAt ?? 0) as number;
              const bk = (b.lastModified ?? b.createdAt ?? 0) as number;
              return bk - ak;
            });
            setTerms(list[0]);
          }
        }
      } catch (e) {
        console.error("Failed to load policy docs:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ---------- helpers ----------
  const formatDate = (isoOrMs?: string | number) => {
    if (!isoOrMs) return "";
    try {
      const d =
        typeof isoOrMs === "number"
          ? new Date(isoOrMs)
          : new Date(String(isoOrMs));
      return isNaN(d.getTime()) ? String(isoOrMs) : d.toLocaleDateString();
    } catch {
      return String(isoOrMs);
    }
  };

  const renderSections = (sections: any) => {
    if (!sections) return null;

    if (Array.isArray(sections)) {
      return (
        <div className="space-y-3">
          {sections.map((s, i) => {
            const isObj = s && typeof s === "object";
            const heading = isObj ? s.heading || s.title : undefined;
            const body = isObj ? s.body || s.content : s;
            return (
              <div key={i} className="text-sm text-gray-700">
                {heading && <h4 className="font-semibold mb-1">{heading}</h4>}
                <p className="leading-relaxed whitespace-pre-wrap">
                  {String(body || "")}
                </p>
              </div>
            );
          })}
        </div>
      );
    }

    if (typeof sections === "object") {
      return (
        <div className="space-y-3">
          {Object.entries(sections).map(([k, v]: [string, any]) => {
            const isObj = v && typeof v === "object";
            const heading = isObj ? v.heading || v.title || k : k;
            const body = isObj ? v.body || v.content : v;
            return (
              <div key={k} className="text-sm text-gray-700">
                {heading && (
                  <h4 className="font-semibold mb-1">{String(heading)}</h4>
                )}
                <p className="leading-relaxed whitespace-pre-wrap">
                  {String(body || "")}
                </p>
              </div>
            );
          })}
        </div>
      );
    }

    return <p className="text-sm text-gray-700">{String(sections)}</p>;
  };

  // build accordion
  const accordionData = useMemo(
    () => [
      {
        id: "about",
        title: "About",
        icon: <FaUser className="text-blue-600" />,
        content:
          "This section contains general information about our organization and services.",
      },
      {
        id: "mission",
        title: "Mission",
        icon: <FaBullseye className="text-red-600" />,
        content: mission || "—",
      },
      {
        id: "vision",
        title: "Vision",
        icon: <FaEye className="text-yellow-600" />,
        content: vision || "—",
      },
      {
        id: "disclosure",
        title: "Information Sharing and Disclosure",
        icon: <FaShareAlt className="text-blue-600" />,
        content:
          "We do not sell, rent, or share personal data without consent except when required by law.",
      },
      {
        id: "privacy",
        title: "Privacy Policy",
        icon: <FaLock className="text-yellow-600" />,
        content: (
          <div className="space-y-3">
            {privacy ? (
              <>
                <div className="text-sm text-gray-700">
                  <div className="font-semibold">
                    {privacy.title || "Privacy Policy"}
                  </div>
                  <div className="text-gray-500">
                    {privacy.version ? `Version: ${privacy.version}` : null}
                    {privacy.version &&
                    (privacy.effectiveDate || privacy.lastModified)
                      ? " • "
                      : null}
                    {privacy.effectiveDate
                      ? `Effective: ${formatDate(privacy.effectiveDate)}`
                      : privacy.lastModified
                      ? `Updated: ${formatDate(privacy.lastModified)}`
                      : null}
                  </div>
                </div>
                {renderSections(privacy.sections)}
              </>
            ) : (
              <p className="text-sm text-gray-500">No Privacy Policy found.</p>
            )}
          </div>
        ),
      },
      {
        id: "dataprivacy",
        title: "Data Privacy",
        icon: <FaDatabase className="text-red-600" />,
        content:
          "We adhere to the Data Privacy Act of 2012 to protect your rights.",
      },
      {
        id: "terms",
        title: "Terms and Condition",
        icon: <FaFileAlt className="text-brown-600" />,
        content: (
          <div className="space-y-3">
            {terms ? (
              <>
                <div className="text-sm text-gray-700">
                  <div className="font-semibold">
                    {terms.title || "Terms & Conditions"}
                  </div>
                  <div className="text-gray-500">
                    {terms.version ? `Version: ${terms.version}` : "—"}
                    {terms.version &&
                    (terms.effectiveDate || terms.lastModified)
                      ? " • "
                      : " "}
                    {terms.effectiveDate
                      ? `Effective: ${terms.effectiveDate}`
                      : terms.lastModified
                      ? `Updated: ${formatDate(terms.lastModified)}`
                      : ""}
                  </div>
                </div>

                {/* Render HTML content */}
                {terms.content ? (
                  <div
                    className="text-sm text-gray-700 prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: terms.content }}
                  />
                ) : (
                  <p className="text-sm text-gray-500">No content available.</p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">
                No Terms & Conditions found.
              </p>
            )}
          </div>
        ),
      },
    ],
    [mission, vision, privacy, terms]
  );

  // ui handlers
  const toggleSection = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
    const sectionId = accordionData[index].id;
    setTimeout(() => {
      document
        .getElementById(sectionId)
        ?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleBack = () => navigate("/RDDashboard");

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top Bar */}
      <div className="bg-white shadow-md py-3 px-6 flex justify-between items-center">
        <img src="/assets/cobycare2.png" alt="CobyCare Logo" className="h-10" />
        <div className="flex gap-4">
          <img src="/assets/bell.png" alt="Notifications" className="h-5 w-5" />
          <img src="/assets/user.png" alt="User Icon" className="h-6 w-6" />
        </div>
      </div>

      {/* Back Button */}
      <div className="px-6 mt-4">
        <button
          onClick={handleBack}
          className="text-sm text-red-700 hover:text-red-900 font-medium flex items-center gap-1"
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Main Layout */}
      <div className="flex flex-grow p-6 gap-6">
        {/* Table of Contents */}
        <aside className="bg-white text-black shadow-md rounded-lg w-64 p-4 sticky top-4 h-fit">
          <h2 className="font-semibold mb-4">Table of Contents</h2>
          <ol className="space-y-2 list-decimal list-inside text-sm text-gray-700">
            {accordionData.map((item, i) => (
              <li
                key={item.id}
                className="hover:text-red-600 cursor-pointer transition"
                onClick={() => toggleSection(i)}
              >
                {item.title}
              </li>
            ))}
          </ol>
        </aside>

        {/* Main Content */}
        <section className="flex-grow bg-white rounded-lg shadow-md p-6">
          {/* Breadcrumb and Title */}
          <nav className="text-sm text-gray-500 mb-2">
            Home &gt; General Privacy Policy &gt;{" "}
            <span className="text-black">Privacy Policy</span>
          </nav>
          <div className="flex items-center gap-2 mb-4">
            <FaShieldAlt className="text-red-700" />
            <h1 className="text-xl font-bold text-gray-800">
              General Privacy Policy
            </h1>
          </div>

          {/* Info box */}
          <div className="bg-yellow-100 border-l-4 border-yellow-500 p-3 mb-6 text-sm text-gray-700">
            <div className="flex items-start gap-2">
              <FaExclamationTriangle className="mt-1 text-yellow-600" />
              <p>
                <strong>Important:</strong> This privacy policy explains how we
                collect, use, and protect your personal information. Please read
                it carefully.
              </p>
            </div>
          </div>

          {/* Loading */}
          {loading && <p className="text-gray-500 text-sm">Loading…</p>}

          {/* Accordion */}
          <div className="space-y-4">
            {accordionData.map((item, index) => (
              <div
                key={item.id}
                id={item.id}
                className="border rounded-md shadow-sm scroll-mt-20"
              >
                <button
                  onClick={() => toggleSection(index)}
                  className="flex justify-between items-center w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition duration-150"
                >
                  <div className="flex items-center gap-2 font-medium text-gray-700">
                    {item.icon}
                    {item.title}
                  </div>
                  <span className="text-gray-400">
                    {openIndex === index ? "▲" : "▼"}
                  </span>
                </button>
                {openIndex === index && (
                  <div className="px-4 py-3 text-sm text-gray-700 bg-white border-t">
                    {typeof item.content === "string" ? (
                      <p className="whitespace-pre-wrap">{item.content}</p>
                    ) : (
                      item.content
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-[#1E293B] text-white text-xs py-3 px-6 flex justify-between items-center">
        <p>
          Copyright © 2025 | Southwestern University PHINMA | CobyCare
          Repository
        </p>
        <div className="flex gap-4">
          <button className="hover:underline">Privacy Policy</button>
        </div>
      </footer>
    </div>
  );
};

export default GeneralPrivacyPolicy;
