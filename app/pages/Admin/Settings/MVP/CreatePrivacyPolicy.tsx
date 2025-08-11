import React, { useEffect, useState, useRef } from "react";
import { ref, get, push, set, update, serverTimestamp } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { FaRegCalendarAlt } from "react-icons/fa";
import successImg from "../../../../../assets/check.png";
import errorImg from "../../../../../assets/error.png";
import { getAuth } from "firebase/auth";

interface Policy {
  id: string;
  title: string;
  version: string;
  effectiveDate: string;
  sections: { sectionTitle: string; content: string }[];
  createdAt?: string;
  lastModified?: string;
  status?: string;
  uploadedBy?: string;
}

interface CreatePrivacyPolicyProps {
  editData?: Policy;
  onClose?: () => void;
}

const CreatePrivacyPolicy: React.FC<CreatePrivacyPolicyProps> = ({ editData, onClose }) => {
  const [title, setTitle] = useState(editData?.title || "");
  const [version, setVersion] = useState(editData?.version || "2.0");
  const [effectiveDate, setEffectiveDate] = useState(editData?.effectiveDate || "");
  const [sections, setSections] = useState(editData?.sections || [{ sectionTitle: "", content: "" }]);
  const [loadingVersion, setLoadingVersion] = useState(true);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [createdPolicyInfo, setCreatedPolicyInfo] = useState({
    title: "",
    version: "",
    effectiveDate: "",
    userName: "",
    location: "Admin Settings > Privacy & Policy"
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchLatestVersion = async () => {
      if (editData) {
        setLoadingVersion(false);
        return;
      }
      const snapshot = await get(ref(db, "PrivacyPolicies"));
      if (snapshot.exists()) {
        const data = snapshot.val();
        const versions = Object.values(data)
          .map((p: any) => parseFloat(p.version))
          .filter(v => !isNaN(v))
          .sort((a, b) => b - a);

        const latestVersion = versions.length ? versions[0] : 2.0;
        const nextVersion = (latestVersion + 0.1).toFixed(1);
        setVersion(nextVersion);
      }
      setLoadingVersion(false);
    };

    fetchLatestVersion();
  }, [editData]);

  const handleAddSection = () => {
    setSections([...sections, { sectionTitle: "", content: "" }]);
  };

  const handleRemoveSection = (index: number) => {
    const updated = sections.filter((_, i) => i !== index);
    setSections(updated);
  };

  const handleChange = (
    index: number,
    field: keyof typeof sections[number],
    value: string
  ) => {
    const updatedSections = [...sections];
    updatedSections[index][field] = value;
    setSections(updatedSections);
  };

  const handleSubmit = async () => {
    if (!title || !version || !effectiveDate || sections.some(sec => !sec.sectionTitle || !sec.content)) {
      alert("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      const userName = currentUser?.displayName || currentUser?.email || "Unknown";

      const policyRef = editData
        ? ref(db, `PrivacyPolicies/${editData.id}`)
        : push(ref(db, "PrivacyPolicies"));

      const dataToSave = {
        title,
        version,
        effectiveDate,
        sections,
        ...(editData
          ? { lastModified: serverTimestamp() }
          : { createdAt: serverTimestamp() }),
        uploadedBy: userName,
      };

      if (editData) {
        await update(policyRef, dataToSave);
      } else {
        await set(policyRef, dataToSave);
      }

      setCreatedPolicyInfo({
        title,
        version,
        effectiveDate,
        userName,
        location: "Admin Settings > Privacy & Policy"
      });

      setShowSuccessModal(true);
    } catch (error: any) {
      console.error("Error:", error);
      setErrorMessage(error.message || "Something went wrong.");
      setShowErrorModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return <></>; // You can render your modal form and success/error modals here.
};

export default CreatePrivacyPolicy;
