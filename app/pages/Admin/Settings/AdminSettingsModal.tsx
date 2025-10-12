import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaShieldAlt,
  FaBullseye,
  FaFileAlt,
  FaBuilding,
  FaClipboardList,
} from "react-icons/fa";
import type { IconType } from "react-icons";

import AdminNavbar from "../components/AdminNavbar";
import AdminSidebar from "../components/AdminSidebar";

import type { ProfileProps } from "./Modals/profile";
import RoleManagement from "./Modals/RoleManagement";
import DepartmentManagement from "./MVP/Department";
import MisionVision from "./MVP/MissionVisionModal";
import TermsConditions from "./Modals/termscondition";
import PrivacyPolicy from "./MVP/PrivacyPolicyManagement";
import WatermarkSettings from "./MVP/WatermarkSettings";

import { getAuth } from "firebase/auth";
import { ref, get, update } from "firebase/database";
import { db } from "../../../Backend/firebase";

/* ---------- click-outside helper (accepts null) ---------- */
function useOnClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void
) {
  useEffect(() => {
    const listener = (e: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el || el.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

/* ---------- Types ---------- */
type SettingsItem = {
  key: string;
  label: string;
  icon: IconType; // react-icons component type
};

const AdminSettingsModal: React.FC = () => {
  const navigate = useNavigate();

  /* visible panel */
  const [selected, setSelected] = useState<string>("mission/vision");

  /* responsive sidebar like AdminDashboard */
  const initialOpen =
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true; // lg breakpoint
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(initialOpen);
  const [viewportIsDesktop, setViewportIsDesktop] =
    useState<boolean>(initialOpen);

  useEffect(() => {
    const onResize = () => {
      const isDesktop = window.innerWidth >= 1024;
      setViewportIsDesktop(isDesktop);
      setIsSidebarOpen(isDesktop ? true : false);
      document.body.style.overflowX = "hidden";
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      document.body.style.overflowX = "";
    };
  }, []);

  /* profile (kept for future personal info section) */
  const [profileData, setProfileData] = useState<ProfileProps>({
    firstName: "",
    lastName: "",
    middleName: "",
    suffix: "",
    email: "",
    onFirstNameChange: () => {},
    onLastNameChange: () => {},
    onMiddleNameChange: () => {},
    onSuffixChange: () => {},
  });

  useEffect(() => {
    const auth = getAuth();
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const userRef = ref(db, `users/${uid}`);

    get(userRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setProfileData((prev) => ({
            ...prev,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            middleName: data.middleName || "",
            suffix: data.suffix || "",
            email: data.email || "",
            onFirstNameChange: (e) =>
              setProfileData((pd) => ({ ...pd, firstName: e.target.value })),
            onLastNameChange: (e) =>
              setProfileData((pd) => ({ ...pd, lastName: e.target.value })),
            onMiddleNameChange: (e) =>
              setProfileData((pd) => ({ ...pd, middleName: e.target.value })),
            onSuffixChange: (e) =>
              setProfileData((pd) => ({ ...pd, suffix: e.target.value })),
            onSaveChanges: () => {
              update(userRef, {
                firstName: profileData.firstName,
                lastName: profileData.lastName,
                middleName: profileData.middleName,
                suffix: profileData.suffix,
              }).catch(console.error);
            },
          }));
        }
      })
      .catch(console.error);
  }, []);

  /* left nav items (desktop) + mobile dropdown items */
  const SETTINGS: SettingsItem[] = [
    { key: "mission/vision", label: "Mission & Vision", icon: FaBullseye },
    { key: "watermark", label: "Watermark Settings", icon: FaFileAlt },
    { key: "department", label: "Department", icon: FaBuilding },
    { key: "roleManagement", label: "Role Management", icon: FaClipboardList },
    { key: "terms", label: "Terms & Conditions", icon: FaFileAlt },
    { key: "privacy", label: "Privacy & Policy", icon: FaShieldAlt },
  ];

  /* desktop sidebar item */
  const navItem = (s: SettingsItem) => {
    const active = selected === s.key;
    const Icon = s.icon;
    return (
      <button
        key={s.key}
        type="button"
        onClick={() => setSelected(s.key)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition text-left
          ${
            active
              ? "bg-red-50 text-red-700 ring-1 ring-red-200"
              : "text-gray-700 hover:bg-gray-100"
          }`}
      >
        <Icon
          className={`text-[15px] ${active ? "text-red-600" : "text-gray-600"}`}
        />
        <span className="text-sm">{s.label}</span>
      </button>
    );
  };

  /* mobile accordion dropdown (no overlay) */
  const [openPicker, setOpenPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  useOnClickOutside(pickerRef, () => setOpenPicker(false));

  const selectedItem = SETTINGS.find((s) => s.key === selected) || SETTINGS[0];
  const SelectedIcon = selectedItem.icon;

  return (
    <div className="flex bg-gradient-to-br from-gray-50 to-red-50 min-h-screen relative overflow-x-hidden">
      {/* Sidebar */}
      <AdminSidebar
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen((v) => !v)}
        notifyCollapsed={() => setIsSidebarOpen(false)}
      />

      {/* Mobile overlay */}
      {isSidebarOpen && !viewportIsDesktop && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Content wrapper */}
      <div
        className={`flex-1 transition-all duration-300 w-full ${
          viewportIsDesktop ? (isSidebarOpen ? "lg:ml-64" : "lg:ml-16") : "ml-0"
        }`}
      >
        <AdminNavbar
          isSidebarOpen={isSidebarOpen}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />

        {/* Main */}
        <main className="pt-16 sm:pt-20 p-4 md:p-6 max-w-[1400px] mx-auto w-full">
          <div className="flex flex-col md:flex-row gap-6">
            {/* --- Mobile: accordion selector --- */}
            <div className="md:hidden" ref={pickerRef}>
              <div className="text-xs uppercase text-gray-400 mb-2">
                General
              </div>

              {/* Trigger */}
              <button
                type="button"
                aria-controls="settings-accordion"
                aria-expanded={openPicker}
                onClick={() => setOpenPicker((v) => !v)}
                className={`w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm shadow-sm
                  bg-white transition ring-1 ring-transparent
                  ${openPicker ? "ring-red-200" : "hover:ring-gray-200"}`}
              >
                <span className="flex items-center gap-2">
                  <SelectedIcon className="text-[15px] text-red-600" />
                  <span className="font-medium text-gray-800">
                    {selectedItem.label}
                  </span>
                </span>

                {/* single chevron that rotates */}
                <svg
                  className={`w-4 h-4 transition-transform ${
                    openPicker ? "rotate-180" : ""
                  }`}
                  viewBox="0 0 20 20"
                >
                  <path fill="currentColor" d="M5.5 7.5L10 12l4.5-4.5H5.5z" />
                </svg>
              </button>

              {/* Collapsing list (no absolute/overlay) */}
              <div
                id="settings-accordion"
                aria-hidden={!openPicker}
                className={`overflow-hidden transition-[max-height,opacity,transform] duration-200 ease-out
                  ${
                    openPicker
                      ? "max-h-72 opacity-100 translate-y-0"
                      : "max-h-0 opacity-0 -translate-y-1"
                  }`}
              >
                <div className="mt-2 rounded-xl border border-gray-200 bg-white shadow-md">
                  <ul className="max-h-72 overflow-y-auto py-1">
                    {SETTINGS.map((s) => {
                      const active = selected === s.key;
                      const Icon = s.icon;
                      return (
                        <li key={s.key}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(s.key);
                              setOpenPicker(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition
                              ${
                                active
                                  ? "bg-red-50 text-red-700"
                                  : "text-gray-700 hover:bg-gray-50"
                              }`}
                          >
                            <Icon
                              className={`text-[15px] ${
                                active ? "text-red-600" : "text-gray-600"
                              }`}
                            />
                            <span>{s.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>

            {/* --- Desktop: left nav list --- */}
            <aside className="hidden md:block w-64 bg-white rounded-lg shadow p-5 space-y-6 md:self-start md:sticky md:top-24">
              <div>
                <h4 className="text-xs uppercase text-gray-400 mb-2">
                  General
                </h4>
                <div className="space-y-1">
                  {SETTINGS.map((s) => navItem(s))}
                </div>
              </div>
            </aside>

            {/* Right content */}
            <section className="flex-1 bg-white rounded-lg shadow p-4 sm:p-6">
              {selected === "roleManagement" && <RoleManagement />}
              {selected === "mission/vision" && <MisionVision />}
              {selected === "watermark" && <WatermarkSettings />}
              {selected === "department" && <DepartmentManagement />}
              {selected === "privacy" && <PrivacyPolicy />}
              {selected === "terms" && <TermsConditions />}
            </section>
          </div>
        </main>
      </div>

      <style>{`html, body, #root { overflow-x: hidden; }`}</style>
    </div>
  );
};

export default AdminSettingsModal;
