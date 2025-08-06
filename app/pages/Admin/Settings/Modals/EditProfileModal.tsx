// EditProfileModal.tsx
import React, { useEffect, useState } from "react";
import type { ProfileProps } from "./profile";
import { db } from "../../../../Backend/firebase";
import { ref, get } from "firebase/database";
import PersonalInfo from "./profile";

type EditProfileModalProps = {
  open: boolean;
  onClose: () => void;
};

const EditProfileModal: React.FC<EditProfileModalProps> = ({ open, onClose }) => {
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
    if (!open) return;

    const uid = JSON.parse(sessionStorage.getItem("SWU_USER") || "{}")?.uid;
    if (!uid) return;

    const userRef = ref(db, `users/${uid}`);
    get(userRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setProfileData({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          middleName: data.middleName || "",
          suffix: data.suffix || "",
          email: data.email || "",
          onFirstNameChange: (e) =>
            setProfileData((prev) => ({ ...prev, firstName: e.target.value })),
          onLastNameChange: (e) =>
            setProfileData((prev) => ({ ...prev, lastName: e.target.value })),
          onMiddleNameChange: (e) =>
            setProfileData((prev) => ({ ...prev, middleName: e.target.value })),
          onSuffixChange: (e) =>
            setProfileData((prev) => ({ ...prev, suffix: e.target.value })),
        });
      }
    });
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-700 hover:text-red-700 text-xl font-bold"
        >
          &times;
        </button>
        <PersonalInfo {...profileData} />
      </div>
    </div>
  );
};

export default EditProfileModal;
