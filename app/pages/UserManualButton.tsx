import React, { useState, useEffect } from "react";
import { X, BookOpen } from "lucide-react";

const UserManualButton: React.FC<{
  onOpen?: () => void;
  onClose?: () => void;
}> = ({ onOpen, onClose }) => {
  const [open, setOpen] = useState(false);

  // Disable page scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "auto";
  }, [open]);

  return (
    <>
      {/* Text Button (About CobyCare Repository) */}
      <button
        onClick={() => {
          setOpen(true);
          onOpen?.();
        }}
        className="
          inline-flex items-center gap-1
          text-gray-100 hover:text-white
          underline-offset-2 hover:underline
          text-[10px] sm:text-xs
        "
        title="Open User Manual"
        type="button"
      >
        <BookOpen size={14} className="hidden sm:inline-block" />
        <span>About CobyCare Repository</span>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="
            fixed  inset-0 
            bg-black/60 
            backdrop-blur-sm 
            z-[1000000]
            flex 
            items-center 
            justify-center 
            p-4 
            rounded-2xl 
            pointer-events-auto
          "
        >
          <div
            className="
              bg-black/30 rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh]
              flex flex-col border-t-8 border-red-900 
              overflow-hidden animate-fadeIn
              relative z-[100000]
            "
          >
            {/* Header */}
            <div className="flex justify-between items-center bg-red-900 text-white px-6 py-3">
              <h2 className="text-lg font-semibold">User Manual</h2>
              <button
                onClick={() => {
                  setOpen(false);
                  onClose?.();
                }}
                className="hover:text-gray-200 transition"
                type="button"
              >
                <X size={22} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-gray-50 text-gray-700 p-8 space-y-8 leading-relaxed">
              {/* ------------------------------------------- */}
              {/* EVERYTHING BELOW IS YOUR ORIGINAL CONTENT    */}
              {/* ------------------------------------------- */}

              <section>
                <h1 className="text-2xl font-bold text-red-900 mb-4">
                  User Manual – Digital Research Repository for Southwestern
                  Medical Center Research Department
                </h1>
                <p className="text-gray-600">
                  <strong>Authors:</strong> Ceniza, Dotillos, Martinez <br />
                  <strong>Institution:</strong> Southwestern University PHINMA –
                  College of Information Technology <br />
                  <strong>Version:</strong> 1.0 <br />
                  <strong>Release Date:</strong> 2025-10-24
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-red-900 mb-2">
                  Introduction
                </h2>
                <p className="text-gray-700">
                  This manual serves as a comprehensive guide for all users —
                  Super Admin, Admin (Research Consultant), and Resident Doctor
                  (End User) — to effectively navigate, manage, and utilize the
                  Digital Research Repository. It covers system processes from
                  login to analytics and provides detailed, step-by-step
                  instructions supported with screenshots.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-red-900 mb-2">
                  System Overview
                </h2>
                <p className="text-gray-700">
                  The Digital Research Repository centralizes all academic and
                  clinical research outputs of the Southwestern Medical Center
                  Research Department. It promotes accessibility, organization,
                  and collaboration by allowing digital submission,
                  classification, and reporting of research works. Users can
                  upload research files, manage metadata, and monitor analytics
                  in real time.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-red-900 mb-3">
                  User Roles and Access Levels
                </h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-gray-900">Super Admin</h3>
                    <ul className="list-disc list-inside text-gray-700">
                      <li>Create and manage Admin accounts.</li>
                      <li>Configure global system settings.</li>
                      <li>
                        View complete analytics and generate institution-level
                        reports.
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900">
                      Admin (Research Consultant)
                    </h3>
                    <ul className="list-disc list-inside text-gray-700">
                      <li>Manage Resident Doctor accounts.</li>
                      <li>Upload and tag research outputs.</li>
                      <li>
                        Review publication requests and manage metadata
                        templates.
                      </li>
                      <li>Monitor usage statistics and research analytics.</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900">
                      Resident Doctor (End User)
                    </h3>
                    <ul className="list-disc list-inside text-gray-700">
                      <li>Upload and manage personal research files.</li>
                      <li>Tag publications and request approvals.</li>
                      <li>
                        Access, bookmark, and collaborate on available research
                        works.
                      </li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-red-900 mb-3">
                  Step-by-Step User Instructions
                </h2>

                <div className="space-y-6">
                  {/* LOGIN */}
                  <div>
                    <h3 className="font-bold text-gray-900">
                      1. Login and Authentication
                    </h3>
                    <p className="text-gray-700">
                      Purpose: Securely access the repository using
                      institutional credentials.
                    </p>
                    <ol className="list-decimal list-inside text-gray-700">
                      <li>Go to the official repository web link.</li>
                      <li>Enter your Email Address and Password.</li>
                      <li>
                        Click <strong>Sign In</strong>.
                      </li>
                      <li>
                        If OTP is enabled, check your email and input the code.
                      </li>
                      <li>You will be redirected to the dashboard.</li>
                    </ol>
                    <p className="text-gray-700">
                      <strong>Expected Output:</strong> User successfully logs
                      in.
                    </p>
                  </div>

                  {/* MANAGE ACCOUNTS */}
                  <div>
                    <h3 className="font-bold text-gray-900">
                      2. Manage Accounts (Admin)
                    </h3>
                    <p className="text-gray-700">
                      Purpose: To view and manage registered Resident Doctors.
                    </p>
                    <ol className="list-decimal list-inside text-gray-700">
                      <li>
                        Select <strong>Manage Accounts</strong>.
                      </li>
                      <li>View summary boxes.</li>
                      <li>Use search or filters.</li>
                      <li>
                        Click <strong>Export</strong>.
                      </li>
                      <li>
                        Click <strong>Add User</strong>.
                      </li>
                    </ol>
                  </div>

                  {/* CREATING ACCOUNTS */}
                  <div>
                    <h3 className="font-bold text-gray-900">
                      3. Creating User Accounts
                    </h3>
                    <p className="text-gray-700">
                      Purpose: Register new users.
                    </p>

                    <h4 className="text-gray-800 font-semibold">
                      A. Individual Registration
                    </h4>
                    <ol className="list-decimal list-inside text-gray-700">
                      <li>Click Add User.</li>
                      <li>Fill out all required fields.</li>
                      <li>Select account type.</li>
                      <li>Set contract dates.</li>
                      <li>Click Register.</li>
                    </ol>

                    <h4 className="text-gray-800 font-semibold mt-2">
                      B. Bulk Registration
                    </h4>
                    <ol className="list-decimal list-inside text-gray-700">
                      <li>Select Bulk Registration.</li>
                      <li>Download template.</li>
                      <li>Fill Excel file.</li>
                      <li>Upload to register users.</li>
                    </ol>
                  </div>

                  {/* FORMAT MGMT */}
                  <div>
                    <h3 className="font-bold text-gray-900">
                      4. Format Management
                    </h3>
                    <p>Purpose: Manage metadata formats.</p>
                    <ol className="list-decimal list-inside text-gray-700">
                      <li>Go to Manage Resources → Create New Format.</li>
                      <li>View existing templates.</li>
                      <li>Create new format.</li>
                      <li>Add/remove fields.</li>
                      <li>Save.</li>
                    </ol>
                  </div>

                  {/* ETHICS */}
                  <div>
                    <h3 className="font-bold text-gray-900">
                      5. Ethics Clearance Management
                    </h3>
                    <p>Purpose: Track and store ethics approvals.</p>
                    <ol className="list-decimal list-inside">
                      <li>Upload new clearance.</li>
                      <li>View list.</li>
                      <li>Tag to research.</li>
                      <li>Save.</li>
                    </ol>
                  </div>

                  {/* RESEARCH MGMT */}
                  <div>
                    <h3 className="font-bold text-gray-900">
                      6. Managing Research Resources
                    </h3>
                    <ol className="list-decimal list-inside">
                      <li>Click Manage Resources.</li>
                      <li>Select type (Format, Upload, Ethics).</li>
                      <li>Search or filter.</li>
                      <li>Export.</li>
                    </ol>
                  </div>
                </div>
              </section>

              {/* SETTINGS */}
              <section>
                <h2 className="text-xl font-semibold text-red-900 mb-3">
                  Settings & Policy Management
                </h2>
                <ul className="list-disc list-inside space-y-2">
                  <li>
                    <strong>Mission & Vision</strong> version control.
                  </li>
                  <li>
                    <strong>Watermark</strong> global settings.
                  </li>
                  <li>
                    <strong>Department</strong> management.
                  </li>
                  <li>
                    <strong>Role</strong> management.
                  </li>
                  <li>
                    <strong>Terms & Conditions</strong> publishing.
                  </li>
                  <li>
                    <strong>Privacy Policy</strong> versioning.
                  </li>
                </ul>
              </section>

              {/* TROUBLESHOOTING */}
              <section>
                <h2 className="text-xl font-semibold text-red-900 mb-3">
                  Troubleshooting
                </h2>

                <table className="w-full border text-sm">
                  <thead className="bg-red-100 text-red-900 font-semibold">
                    <tr>
                      <th className="p-2 border">Problem</th>
                      <th className="p-2 border">Possible Cause</th>
                      <th className="p-2 border">Solution</th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td className="border p-2">Login failed</td>
                      <td className="border p-2">
                        Incorrect email or OTP expired
                      </td>
                      <td className="border p-2">
                        Reset password or request new OTP.
                      </td>
                    </tr>
                    <tr>
                      <td className="border p-2">File not uploading</td>
                      <td className="border p-2">
                        Invalid format or size exceeded
                      </td>
                      <td className="border p-2">
                        Upload PDF only (max 50MB).
                      </td>
                    </tr>
                    <tr>
                      <td className="border p-2">Missing research details</td>
                      <td className="border p-2">Required fields empty</td>
                      <td className="border p-2">Complete all fields.</td>
                    </tr>
                    <tr>
                      <td className="border p-2">Access restriction</td>
                      <td className="border p-2">Role limitation</td>
                      <td className="border p-2">Contact Admin.</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              {/* CONCLUSION */}
              <section>
                <h2 className="text-xl font-semibold text-red-900 mb-2">
                  Conclusion
                </h2>
                <p className="text-gray-700">
                  This manual provides a complete guide for using the Digital
                  Research Repository. Following the steps ensures secure,
                  organized, and efficient management of research outputs.
                </p>
              </section>
            </div>

            {/* Footer */}
            <div className="bg-gray-100 text-gray-600 text-sm text-center py-3 border-t border-gray-200">
              <p className="font-semibold text-red-900">
                © 2025 CobyCare Repository
              </p>
              <p>Powered by SWU PHINMA College of Information Technology</p>
              <p>All Rights Reserved.</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
      `}</style>
    </>
  );
};

export default UserManualButton;
