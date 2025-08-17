import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

const DataPrivacyModal: React.FC<Props> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
      <div className="relative w-full max-w-2xl bg-white rounded-md shadow-lg border border-gray-300 overflow-hidden">
        <div className="w-full h-3 bg-[#6a1b1a]" />
        <div className="w-full h-[10px] bg-gray-700" />

        <div className="p-6 max-h-[70vh] overflow-y-auto text-gray-800 text-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Data Privacy</h2>
            <button
              onClick={onClose}
              className="rounded-full px-3 py-1 text-sm bg-[#6a1b1a] text-white hover:bg-[#541413] transition"
            >
              Close
            </button>
          </div>

          <p>
            – We collect and store your personal data including but not limited
            to: full name, employee ID, department, email address, and role
            assignment for the purpose of account creation and system use.
          </p>
          <p>
            – All data are stored securely in compliance with the Data Privacy
            Act of 2012 and will not be shared without your explicit consent.
          </p>
          <p>
            – By proceeding with registration, you agree to our use of the data
            solely for academic, administrative, and research repository
            purposes within the institution.
          </p>
          <p>
            – You have the right to access, modify, or request deletion of your
            data, subject to internal policies.
          </p>
          <p>
            – The system uses cookies and other tracking technologies to enhance
            user experience. These do not collect personal data and are used
            solely for functional and analytical purposes.
          </p>
          <p>
            – Continued use of this platform implies consent to the above
            policies.
          </p>
        </div>

        <div className="w-full h-[10px] bg-gray-700" />
        <div className="w-full h-3 bg-[#6a1b1a]" />
      </div>
    </div>
  );
};

export default DataPrivacyModal;
