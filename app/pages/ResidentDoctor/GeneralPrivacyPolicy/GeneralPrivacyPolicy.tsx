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
  FaBars,
  FaTimes,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { ref, get } from "firebase/database";
import { db } from "../../../Backend/firebase";
import Navbar from "../components/Navbar";

type PrivacyPolicy = {
  title?: string;
  version?: string;
  effectiveDate?: string;
  createdAt?: number;
  lastModified?: number;
  sections?: any;
};

type TermsDoc = {
  id?: string;
  title?: string;
  version?: string;
  effectiveDate?: string;
  content?: string;
  createdAt?: number;
  lastModified?: number;
};

const GeneralPrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
        <div className="space-y-4">
          {sections.map((s, i) => {
            const isObj = s && typeof s === "object";
            const heading = isObj ? s.heading || s.title : undefined;
            const body = isObj ? s.body || s.content : s;
            return (
              <div key={i} className="text-sm text-gray-700 leading-relaxed">
                {heading && (
                  <h4 className="font-semibold mb-2 text-gray-900">
                    {heading}
                  </h4>
                )}
                <p className="whitespace-pre-wrap">{String(body || "")}</p>
              </div>
            );
          })}
        </div>
      );
    }

    if (typeof sections === "object") {
      return (
        <div className="space-y-4">
          {Object.entries(sections).map(([k, v]: [string, any]) => {
            const isObj = v && typeof v === "object";
            const heading = isObj ? v.heading || v.title || k : k;
            const body = isObj ? v.body || v.content : v;
            return (
              <div key={k} className="text-sm text-gray-700 leading-relaxed">
                {heading && (
                  <h4 className="font-semibold mb-2 text-gray-900">
                    {String(heading)}
                  </h4>
                )}
                <p className="whitespace-pre-wrap">{String(body || "")}</p>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <p className="text-sm text-gray-700 leading-relaxed">
        {String(sections)}
      </p>
    );
  };

  // build accordion
  const accordionData = useMemo(
    () => [
      {
        id: "about",
        title: "About",
        icon: <FaUser className="text-blue-600 h-5 w-5" />,
        content:
          "This section contains general information about our organization and services. We are committed to providing high-quality healthcare services while maintaining the highest standards of privacy and data protection.",
      },
      {
        id: "mission",
        title: "Mission",
        icon: <FaBullseye className="text-red-600 h-5 w-5" />,
        content: mission || "—",
      },
      {
        id: "vision",
        title: "Vision",
        icon: <FaEye className="text-yellow-600 h-5 w-5" />,
        content: vision || "—",
      },
      {
        id: "disclosure",
        title: "Information Sharing and Disclosure",
        icon: <FaShareAlt className="text-blue-600 h-5 w-5" />,
        content:
          "We do not sell, rent, or share personal data without explicit consent except when required by law or necessary to provide our services. Any data sharing is done in accordance with applicable privacy laws and regulations.",
      },
      {
        id: "privacy",
        title: "Privacy Policy",
        icon: <FaLock className="text-green-600 h-5 w-5" />,
        content: (
          <div className="space-y-4">
            {privacy ? (
              <>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="font-semibold text-green-800">
                    {privacy.title || "Privacy Policy"}
                  </div>
                  <div className="text-sm text-green-600 mt-1">
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
        icon: <FaDatabase className="text-purple-600 h-5 w-5" />,
        content:
          "We adhere to the Data Privacy Act of 2012 and international data protection standards to protect your rights. Our data processing activities are governed by principles of transparency, lawfulness, and data minimization.",
      },
      {
        id: "terms",
        title: "Terms and Conditions",
        icon: <FaFileAlt className="text-orange-600 h-5 w-5" />,
        content: (
          <div className="space-y-4">
            {terms ? (
              <>
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="font-semibold text-orange-800">
                    {terms.title || "Terms & Conditions"}
                  </div>
                  <div className="text-sm text-orange-600 mt-1">
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
                    className="text-sm text-gray-700 prose prose-sm max-w-none"
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
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleBack = () => navigate("/RDDashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar />

      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <button
          onClick={handleBack}
          className="inline-flex items-center text-sm text-red-600 hover:text-red-800 font-medium transition-colors group"
        >
          <span className="mr-1 group-hover:-translate-x-1 transition-transform">
            ←
          </span>
          Back to Dashboard
        </button>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Desktop Sidebar - Table of Contents */}
          <aside className="hidden lg:block lg:col-span-3 xl:col-span-2">
            <div className="sticky top-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">
                Table of Contents
              </h2>
              <nav className="space-y-2">
                {accordionData.map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => toggleSection(i)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-all ${
                      openIndex === i
                        ? "bg-red-50 text-red-700 font-medium border-l-2 border-red-600"
                        : "text-gray-600 hover:text-red-600 hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex items-center space-x-2">
                      {item.icon}
                      <span className="truncate">{item.title}</span>
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="lg:col-span-9 xl:col-span-10 space-y-6">
            {/* Page Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              {/* Breadcrumb
              <nav className="text-sm text-gray-500 mb-4">
                <span>Home</span>
                <span className="mx-2">›</span>
                <span>General Privacy Policy</span>
                <span className="mx-2">›</span>
                <span className="text-gray-900 font-medium">
                  Privacy Policy
                </span>
              </nav> */}

              {/* Title */}
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-red-100 rounded-lg">
                  <FaShieldAlt className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                    General Privacy Policy
                  </h1>
                  <p className="text-gray-600 mt-1 text-sm sm:text-base">
                    Comprehensive privacy and data protection guidelines
                  </p>
                </div>
              </div>

              {/* Important Notice */}
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <FaExclamationTriangle className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-800">
                      <strong>Important:</strong> This privacy policy explains
                      how we collect, use, and protect your personal
                      information. Please read it carefully to understand your
                      rights and our responsibilities.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                <p className="text-gray-500 mt-4">
                  Loading policy documents...
                </p>
              </div>
            )}

            {/* Mobile Table of Contents */}
            <div className="lg:hidden bg-white rounded-lg shadow-sm border border-gray-200">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <h3 className="font-medium text-gray-900">Quick Navigation</h3>
                {isSidebarOpen ? (
                  <FaTimes className="h-5 w-5 text-gray-500" />
                ) : (
                  <FaBars className="h-5 w-5 text-gray-500" />
                )}
              </button>

              {isSidebarOpen && (
                <div className="border-t border-gray-200 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {accordionData.map((item, i) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          toggleSection(i);
                          setIsSidebarOpen(false);
                        }}
                        className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md transition-all ${
                          openIndex === i
                            ? "bg-red-50 text-red-700 font-medium"
                            : "text-gray-600 hover:text-red-600 hover:bg-gray-50"
                        }`}
                      >
                        {item.icon}
                        <span className="truncate">{item.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Accordion Content */}
            <div className="space-y-4">
              {accordionData.map((item, index) => (
                <div
                  key={item.id}
                  id={item.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden scroll-mt-8"
                >
                  <button
                    onClick={() => toggleSection(index)}
                    className="flex justify-between items-center w-full px-4 sm:px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
                  >
                    <div className="flex items-center space-x-3">
                      {item.icon}
                      <span className="font-medium text-gray-900 text-left text-sm sm:text-base">
                        {item.title}
                      </span>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="text-gray-500 text-lg">
                        {openIndex === index ? "▲" : "▼"}
                      </span>
                    </div>
                  </button>

                  {openIndex === index && (
                    <div className="px-4 sm:px-6 py-6 bg-white border-t border-gray-100 animate-in slide-in-from-top-2 duration-300">
                      {typeof item.content === "string" ? (
                        <div className="prose prose-sm max-w-none">
                          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {item.content}
                          </p>
                        </div>
                      ) : (
                        <div className="prose prose-sm max-w-none">
                          {item.content}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <p className="text-sm text-gray-300 text-center sm:text-left">
              Copyright © 2025 | Southwestern University PHINMA | CobyCare
              Repository
            </p>
            <div className="flex items-center space-x-6">
              <button className="text-sm text-gray-300 hover:text-white transition-colors">
                Privacy Policy
              </button>
              <button className="text-sm text-gray-300 hover:text-white transition-colors">
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
