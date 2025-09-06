import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type UploadType = "" | "Private" | "Public";
export type PaperType = "" | "Abstract Only" | "Full Text";

export type WizardData = {
  step: 1 | 2 | 3 | 4 | 5 | 6;
  fileBlob: File | null;
  fileName: string;
  uploadType: UploadType;
  /** NEW: persist the explicit choice made on Step 1 */
  chosenPaperType: PaperType;
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

export const STORAGE_KEY = "uploadWizard:v1";

/** Map any legacy values to the new union. */
function sanitizeUploadType(v: any): UploadType {
  if (v === "Private") return "Private";
  if (v === "Public" || v === "Public only" || v === "Private & Public") {
    return "Public";
  }
  return "";
}

const defaultData: WizardData = {
  step: 1,
  fileBlob: null,
  fileName: "",
  uploadType: "",
  chosenPaperType: "", // NEW
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
  setStep: (s: 1 | 2 | 3 | 4 | 5 | 6) => void;
  setFile: (file: File | null) => void;
  reset: () => void;
};

const C = createContext<Ctx | null>(null);

type ProviderProps = {
  children: React.ReactNode;
  /**
   * If true (default), the provider wipes sessionStorage on unmount.
   * Since this provider is only mounted under /upload-research,
   * navigating away from that URL automatically clears the wizard.
   */
  clearOnUnmount?: boolean;
};

export const WizardProvider: React.FC<ProviderProps> = ({
  children,
  clearOnUnmount = true,
}) => {
  const [data, setData] = useState<WizardData>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultData;
      const parsed = JSON.parse(raw) as Partial<WizardData>;
      // Never hydrate a File object; sanitize uploadType
      return {
        ...defaultData,
        ...parsed,
        uploadType: sanitizeUploadType((parsed as any)?.uploadType),
        fileBlob: null,
      };
    } catch {
      return defaultData;
    }
  });

  // Persist (excluding the File blob)
  useEffect(() => {
    const { fileBlob, ...serializable } = data;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch {}
  }, [data]);

  // Clear persisted state when provider unmounts (i.e., leaving /upload-research)
  useEffect(() => {
    return () => {
      if (clearOnUnmount) {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {}
      }
    };
  }, [clearOnUnmount]);

  const api = useMemo<Ctx>(
    () => ({
      data,
      merge: (patch) =>
        setData((d) => {
          const next: WizardData = { ...d, ...patch } as WizardData;
          if ("uploadType" in patch) {
            (next as any).uploadType = sanitizeUploadType(
              (patch as any).uploadType
            );
          }
          return next;
        }),
      setStep: (s) => setData((d) => (d.step === s ? d : { ...d, step: s })),
      setFile: (file) =>
        setData((d) => ({
          ...d,
          fileBlob: file,
          fileName: file ? file.name : "",
        })),
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
