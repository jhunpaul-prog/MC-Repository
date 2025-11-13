import React, { useState } from "react";
import { X, BookOpen } from "lucide-react";

const UserManualButton: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Text Button (About CobyCare Repository) */}
      <button
        onClick={() => setOpen(true)}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="
              bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh]
              flex flex-col border-t-8 border-red-900 overflow-hidden animate-fadeIn
            "
          >
            {/* Header */}
            <div className="flex justify-between items-center bg-red-900 text-white px-6 py-3">
              <h2 className="text-lg font-semibold">User Manual</h2>
              <button
                onClick={() => setOpen(false)}
                className="hover:text-gray-200 transition"
                type="button"
              >
                <X size={22} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-gray-50 text-gray-700 p-8 space-y-8 leading-relaxed">
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
                      <li>
                        Once authenticated, you will be redirected to the
                        dashboard.
                      </li>
                    </ol>
                    <p className="text-gray-700">
                      <strong>Expected Output:</strong> User successfully logs
                      in and is redirected to their designated dashboard.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900">
                      2. Manage Accounts (Admin)
                    </h3>
                    <p className="text-gray-700">
                      Purpose: To view and manage registered Resident Doctors.
                    </p>
                    <ol className="list-decimal list-inside text-gray-700">
                      <li>
                        From the sidebar, select{" "}
                        <strong>Manage Accounts</strong>.
                      </li>
                      <li>
                        View summary boxes displaying Resident Doctors, Active
                        Accounts, and Deactivated Accounts.
                      </li>
                      <li>
                        Use search or filters to locate specific users by name,
                        department, or status.
                      </li>
                      <li>
                        Click <strong>Export</strong> to download a report.
                      </li>
                      <li>
                        Click <strong>Add User</strong> to create a new Resident
                        Doctor account.
                      </li>
                    </ol>
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900">
                      3. Creating User Accounts
                    </h3>
                    <p className="text-gray-700">
                      Purpose: Register new users individually or in bulk.
                    </p>
                    <h4 className="text-gray-800 font-semibold">
                      A. Individual Registration
                    </h4>
                    <ol className="list-decimal list-inside text-gray-700">
                      <li>
                        Click <strong>Add User</strong> under Manage Accounts.
                      </li>
                      <li>
                        Fill out required fields (Employee ID, Name, Email,
                        Role, Department).
                      </li>
                      <li>Choose Account Type (Contractual or Regular).</li>
                      <li>Set Start and Expected Completion Date.</li>
                      <li>Check Data Privacy Policy and click Register.</li>
                    </ol>

                    <h4 className="text-gray-800 font-semibold">
                      B. Bulk Registration
                    </h4>
                    <ol className="list-decimal list-inside text-gray-700">
                      <li>
                        Select <strong>Bulk Registration</strong>.
                      </li>
                      <li>Download Excel Template.</li>
                      <li>Fill in details for multiple users.</li>
                      <li>
                        Upload completed file to register all users
                        simultaneously.
                      </li>
                    </ol>
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900">
                      4. Format Management
                    </h3>
                    <p className="text-gray-700">
                      Purpose: Allows Admins to create and manage metadata
                      formats used for research uploads.
                    </p>
                    <ol className="list-decimal list-inside text-gray-700">
                      <li>Navigate to Manage Resources → Create New Format.</li>
                      <li>
                        View existing formats such as Conference Paper, Journal
                        Article, Thesis.
                      </li>
                      <li>Click Create New Format to design a new template.</li>
                      <li>Provide Format Name and Description.</li>
                      <li>
                        Add or remove metadata fields (Title, Abstract, Authors,
                        Research Field).
                      </li>
                      <li>Click Save Format.</li>
                    </ol>
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900">
                      5. Ethics Clearance Management
                    </h3>
                    <p className="text-gray-700">
                      Purpose: Enables Admins to upload, track, and manage
                      ethics clearance files for research works.
                    </p>
                    <ol className="list-decimal list-inside text-gray-700">
                      <li>
                        Navigate to Manage Resources → Upload Ethics Clearance.
                      </li>
                      <li>
                        View existing clearances with details (Signatory, Date,
                        File Name, Uploader).
                      </li>
                      <li>Click Upload Ethics Clearance.</li>
                      <li>Upload file (PDF, PNG, or JPG).</li>
                      <li>Optionally tag clearance to a research paper.</li>
                      <li>Provide Signatory Name and Date Acquired.</li>
                      <li>Click Save Ethics Clearance.</li>
                    </ol>
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900">
                      6. Managing Research Resources
                    </h3>
                    <p className="text-gray-700">
                      Purpose: Upload and organize academic papers and research
                      studies.
                    </p>
                    <ol className="list-decimal list-inside text-gray-700">
                      <li>Click Manage Resources from sidebar.</li>
                      <li>
                        Choose between Create New Format, Upload New Resource,
                        or Upload Ethics Clearance.
                      </li>
                      <li>
                        Use search and filter tools to locate specific works.
                      </li>
                      <li>Click Export to download records.</li>
                    </ol>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-red-900 mb-3">
                  Settings & Policy Management
                </h2>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  <li>
                    <strong>Mission & Vision Management:</strong> Maintain
                    institution-wide mission and vision statements with version
                    control.
                  </li>
                  <li>
                    <strong>Watermark Settings (Global):</strong> Configure
                    watermark position, opacity, and access behavior.
                  </li>
                  <li>
                    <strong>Department Management:</strong> Add, rename, or
                    remove departments for author affiliation.
                  </li>
                  <li>
                    <strong>Role Management:</strong> Define roles, types, and
                    access rights.
                  </li>
                  <li>
                    <strong>Terms & Conditions:</strong> Publish
                    institution-wide terms with version history.
                  </li>
                  <li>
                    <strong>Privacy Policy Management:</strong> Create and
                    version privacy policies with effective dates and sections.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-red-900 mb-3">
                  Troubleshooting
                </h2>
                <table className="w-full border border-gray-300 text-gray-700 text-sm">
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
                        Upload PDF files only (max 50MB).
                      </td>
                    </tr>
                    <tr>
                      <td className="border p-2">Missing research details</td>
                      <td className="border p-2">Required fields left blank</td>
                      <td className="border p-2">
                        Complete all metadata fields.
                      </td>
                    </tr>
                    <tr>
                      <td className="border p-2">Access restriction</td>
                      <td className="border p-2">User role limitation</td>
                      <td className="border p-2">
                        Contact Admin for permission.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-red-900 mb-2">
                  Conclusion
                </h2>
                <p className="text-gray-700">
                  This manual provides a comprehensive guide for using the
                  Digital Research Repository. By following the outlined steps,
                  users can efficiently upload, manage, and monitor research
                  outputs, ensuring streamlined access, improved collaboration,
                  and secure data management across the institution.
                </p>
              </section>
            </div>

            {/* Footer – hardcoded text only */}
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
