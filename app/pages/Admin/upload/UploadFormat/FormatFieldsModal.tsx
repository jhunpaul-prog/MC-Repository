import React from "react";

interface Props {
  formatName: string;
  fields: string[];
  requiredFields: string[];
  onClose: () => void;
  onAddResource: () => void;
}

const FormatFieldsModal: React.FC<Props> = ({ formatName, fields, requiredFields, onClose, onAddResource }) => {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center">
      <div className="bg-white w-[600px] max-h-[90vh] overflow-y-auto rounded-xl p-6 space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="text-xl font-bold text-gray-800">{formatName} Fields</h2>
          <button className="text-red-800 font-semibold" onClick={onClose}>✕</button>
        </div>

        <div className="space-y-3">
          {fields.map((field, idx) => (
            <div key={idx}>
              <label className="block text-gray-800 font-medium">
                {field}
                {requiredFields.includes(field) && <span className="text-red-600"> *</span>}
              </label>
              <input
                type="text"
                readOnly
                placeholder={`Field: ${field}`}
                className="w-full px-4 py-2 border rounded bg-gray-100 text-gray-600 cursor-not-allowed"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Close</button>
          <button onClick={onAddResource} className="px-4 py-2  bg-red-800 text-white rounded hover:bg-red-900">Add Resource</button>
        </div>
      </div>
    </div>
  );
};

export default FormatFieldsModal;
