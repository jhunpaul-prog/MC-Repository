import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/* ================= Types ================= */

export type UploadType = "" | "Private" | "Public";
export type PaperType = "" | "Abstract Only" | "Full Text";
export type PublicationScope = "" | "Local" | "International";

export type WizardData = {
  step: 1 | 2 | 3 | 4 | 5 | 6;

  // File
  fileBlob: File | null;
  fileName: string;

  // Access / type
  uploadType: UploadType;
  /** Persist the explicit choice made on Step 1 */
  chosenPaperType: PaperType;
  verified: boolean;

  // Format / meta (from Format chosen)
  formatId?: string;
  formatName?: string;
  description?: string;
  formatFields: string[];
  requiredFields: string[];
  publicationType?: string;

  // NEW: publication scope (Local/International)
  publicationScope: PublicationScope;

  // Extracted / entered
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

  // Ethics tagging (optional)
  /**
   * Use "Yes" to indicate an ethics record is tagged,
   * or "" (empty) when none.
   */
  hasEthics?: string;
  ethicsId?: string;
  ethicsMeta?: {
    title?: string;
    status?: string;
    url?: string;
    signatoryName?: string;
    dateRequired?: string;
    contentType?: string;
    fileName?: string;
  };

  // Media
  keywords?: string[];
  figures?: File[];
  figurePreviews?: string[];
};

export const STORAGE_KEY = "uploadWizard:v1";

/* ================= Helpers ================= */

/** Map any legacy values to the new union. */
function sanitizeUploadType(v: any): UploadType {
  if (v === "Private") return "Private";
  if (v === "Public" || v === "Public only" || v === "Private & Public") {
    return "Public";
  }
  return "";
}

/** Coerce hasEthics to our string flag ("Yes" | "") for consistency. */
function sanitizeHasEthics(v: any): string {
  if (v === "Yes") return "Yes";
  if (v === true) return "Yes";
  return "";
}

const defaultData: WizardData = {
  step: 1,

  // File
  fileBlob: null,
  fileName: "",

  // Access / type
  uploadType: "",
  chosenPaperType: "",
  verified: false,

  // Format
  formatFields: [],
  requiredFields: [],
  description: "",

  // Extracted / entered defaults
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

  // Media
  keywords: [],
  figures: [],
  figurePreviews: [],

  // Publication scope
  publicationScope: "",

  // Ethics
  hasEthics: "",
  ethicsId: "",
  ethicsMeta: {},
};

/* ================= Context ================= */

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
   * navigating away automatically clears the wizard.
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

      // Build from defaults, layering in persisted values.
      const hydrated: WizardData = {
        ...defaultData,
        ...parsed,
        // Never hydrate a File object; sanitize uploadType & hasEthics
        uploadType: sanitizeUploadType((parsed as any)?.uploadType),
        hasEthics: sanitizeHasEthics((parsed as any)?.hasEthics),
        fileBlob: null,
      };

      // Normalize missing nested ethicsMeta to empty object (avoids undefined access)
      if (!hydrated.ethicsMeta) hydrated.ethicsMeta = {};

      // Normalize arrays to avoid "undefined" surprises
      hydrated.authorUIDs = Array.isArray(hydrated.authorUIDs)
        ? hydrated.authorUIDs
        : [];
      hydrated.manualAuthors = Array.isArray(hydrated.manualAuthors)
        ? hydrated.manualAuthors
        : [];
      hydrated.indexed = Array.isArray(hydrated.indexed)
        ? hydrated.indexed
        : [];
      hydrated.keywords = Array.isArray(hydrated.keywords)
        ? hydrated.keywords
        : [];
      hydrated.figures = Array.isArray(hydrated.figures)
        ? (hydrated.figures as File[])
        : [];
      hydrated.figurePreviews = Array.isArray(hydrated.figurePreviews)
        ? hydrated.figurePreviews
        : [];

      // Normalize maps
      hydrated.authorLabelMap =
        hydrated.authorLabelMap && typeof hydrated.authorLabelMap === "object"
          ? hydrated.authorLabelMap
          : {};
      hydrated.fieldsData =
        hydrated.fieldsData && typeof hydrated.fieldsData === "object"
          ? hydrated.fieldsData
          : {};

      return hydrated;
    } catch {
      return defaultData;
    }
  });

  // Persist (excluding the File blob)
  useEffect(() => {
    const { fileBlob, ...serializable } = data;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      /* no-op */
    }
  }, [data]);

  // Clear persisted state when provider unmounts (i.e., leaving /upload-research)
  useEffect(() => {
    return () => {
      if (clearOnUnmount) {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          /* no-op */
        }
      }
    };
  }, [clearOnUnmount]);

  const api = useMemo<Ctx>(
    () => ({
      data,
      merge: (patch) =>
        setData((d) => {
          const next: WizardData = { ...d, ...patch } as WizardData;

          // Sanitize uploadType when patched
          if ("uploadType" in patch) {
            (next as any).uploadType = sanitizeUploadType(
              (patch as any).uploadType
            );
          }

          // Sanitize hasEthics flag when patched
          if ("hasEthics" in patch) {
            (next as any).hasEthics = sanitizeHasEthics(
              (patch as any).hasEthics
            );
          }

          // Ensure nested objects/arrays remain well-formed if partially patched
          if ("ethicsMeta" in patch && !next.ethicsMeta) {
            next.ethicsMeta = {};
          }
          if ("authorUIDs" in patch && !Array.isArray(next.authorUIDs)) {
            next.authorUIDs = [];
          }
          if ("manualAuthors" in patch && !Array.isArray(next.manualAuthors)) {
            next.manualAuthors = [];
          }
          if ("keywords" in patch && !Array.isArray(next.keywords)) {
            next.keywords = [];
          }
          if ("indexed" in patch && !Array.isArray(next.indexed)) {
            next.indexed = [];
          }
          if ("figures" in patch && !Array.isArray(next.figures)) {
            next.figures = [];
          }
          if (
            "authorLabelMap" in patch &&
            (!next.authorLabelMap || typeof next.authorLabelMap !== "object")
          ) {
            next.authorLabelMap = {};
          }
          if (
            "fieldsData" in patch &&
            (!next.fieldsData || typeof next.fieldsData !== "object")
          ) {
            next.fieldsData = {};
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
        } catch {
          /* no-op */
        }
        setData(defaultData);
      },
    }),
    [data]
  );

  return <C.Provider value={api}>{children}</C.Provider>;
};
("");
export const useWizard = () => {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
};
