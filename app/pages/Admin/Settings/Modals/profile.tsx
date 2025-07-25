// Profile.tsx or PersonalInfo.tsx
import React from "react";

// Define types for props
export type ProfileProps = {
  firstName: string;
  lastName: string;
  email: string;
  onFirstNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLastNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSaveChanges: () => void;
};

const PersonalInfo: React.FC<ProfileProps> = ({ 
  firstName,
  lastName,
  email,
  onFirstNameChange,
  onLastNameChange,
  onEmailChange,
  onSaveChanges,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-4 px-4 py-3 bg-white border rounded-md shadow-md hover:bg-gray-100">
        <label className="text-lg font-semibold text-gray-800">First Name:</label>
        <input
          type="text"
          value={firstName}
          onChange={onFirstNameChange}
          className="text-sm text-gray-700 p-2 border rounded-md w-full"
        />
      </div>

      <div className="flex flex-col space-y-4 px-4 py-3 bg-white border rounded-md shadow-md hover:bg-gray-100">
        <label className="text-lg font-semibold text-gray-800">Last Name:</label>
        <input
          type="text"
          value={lastName}
          onChange={onLastNameChange}
          className="text-sm text-gray-700 p-2 border rounded-md w-full"
        />
      </div>

      <div className="flex flex-col space-y-4 px-4 py-3 bg-white border rounded-md shadow-md hover:bg-gray-100">
        <label className="text-lg font-semibold text-gray-800">Email:</label>
        <input
          type="email"
          value={email}
          onChange={onEmailChange}
          className="text-sm text-gray-700 p-2 border rounded-md w-full"
        />
      </div>

      <button
        onClick={onSaveChanges}
        className="w-full py-3 bg-red-500 text-white rounded-md hover:bg-red-600"
      >
        Save Changes
      </button>
    </div>
  );
};

export default PersonalInfo;
