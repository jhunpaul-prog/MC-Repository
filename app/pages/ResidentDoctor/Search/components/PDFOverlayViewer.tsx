import React from "react";
import { X, Eye } from "lucide-react";

const PDFOverlayViewer: React.FC<{
  open: boolean;
  fileUrl: string;
  onClose: () => void;
  label?: string;
}> = ({ open, fileUrl, onClose, label = "View Paper" }) => {
  if (!open) return null;

  // toolbar=0 hides default controls; users can still technically fetch a PDF from the web,
  // but this gives a clean "view-only" experience.
  const src = `${fileUrl}#toolbar=0&navpanes=0&statusbar=0&view=FitH`;

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between text-white px-4 py-3">
        <div className="inline-flex items-center gap-2">
          <Eye className="w-4 h-4" />
          <span className="font-semibold">{label}</span>
        </div>
        <button onClick={onClose} className="hover:bg-white/10 rounded-lg p-2">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1">
        <iframe
          title="PDF Viewer"
          src={src}
          className="w-full h-full border-0 bg-white"
        />
      </div>
    </div>
  );
};

export default PDFOverlayViewer;
