import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type UploadType = "" | "Private" | "Public only" | "Private & Public";

export type WizardData = {
  step: 1 | 2 | 3 | 4 | 5;
  fileBlob: File | null;
  fileName: string;
  uploadType: UploadType;
  verified: boolean;
  formatId?: string;
  formatName?: string;
  description?: string;
  formatFields: string[];
  requiredFields: string[];
  publicationType?: string;
  abstract?: string;
  text?: string;
  pageCount?: number;
  title: string;
  authorUIDs: string[];
  manualAuthors: string[];
  authorLabelMap: Record<string, string>;
  publicationDate: string;
  doi: string;
  fieldsData: Record<string, string>;
  indexed: string[];
  pages: number;
  researchField?: string;
  otherField?: string;
  keywords?: string[];
  figures?: File[];
  figurePreviews?: string[];
};

const STORAGE_KEY = "uploadWizard:v1";

const defaultData: WizardData = {
  step: 1,
  fileBlob: null,
  fileName: "",
  uploadType: "",
  verified: false,
  formatFields: [],
  requiredFields: [],
  text: "",
  pageCount: 0,
  abstract: "",
  title: "",
  authorUIDs: [],
  manualAuthors: [],
  authorLabelMap: {},
  publicationDate: "",
  doi: "",
  fieldsData: {},
  indexed: [],
  pages: 0,
  researchField: "",
  otherField: "",
  keywords: [],
  figures: [],
  figurePreviews: [],
};

type Ctx = {
  data: WizardData;
  merge: (patch: Partial<WizardData>) => void;
  setStep: (s: 1 | 2 | 3 | 4 | 5) => void;
  setFile: (file: File | null) => void;
  reset: () => void;
};

const C = createContext<Ctx | null>(null);

export const WizardProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [data, setData] = useState<WizardData>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultData;
      const parsed = JSON.parse(raw) as WizardData;
      // never hydrate a File object from storage
      return { ...defaultData, ...parsed, fileBlob: null };
    } catch {
      return defaultData;
    }
  });

  // persist (excluding the File)
  useEffect(() => {
    const { fileBlob, ...serializable } = data;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch {}
  }, [data]);

  const api = useMemo<Ctx>(
    () => ({
      data,
      merge: (patch) => setData((d) => ({ ...d, ...patch })),
      setStep: (s) => setData((d) => (d.step === s ? d : { ...d, step: s })),
      setFile: (file) =>
        setData((d) => ({
          ...d,
          fileBlob: file,
          fileName: file ? file.name : "",
        })),
      // ✅ clear both sessionStorage snapshot and in-memory state
      reset: () => {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {}
        setData(defaultData);
      },
    }),
    [data]
  );

  return <C.Provider value={api}>{children}</C.Provider>;
};

export const useWizard = () => {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
};
