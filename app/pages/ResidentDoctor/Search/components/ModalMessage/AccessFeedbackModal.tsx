// Reusable lightweight modal
export const AccessFeedbackModal: React.FC<{
  open: boolean;
  title?: string;
  message: React.ReactNode;
  onClose: () => void;
  confirmLabel?: string;
}> = ({
  open,
  title = "Request Sent",
  message,
  onClose,
  confirmLabel = "OK",
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200">
        <div className="px-5 pt-5">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="mt-2 text-sm text-gray-600">{message}</p>
        </div>

        <div className="px-5 pb-5 pt-4 flex justify-center">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-red-900 text-white hover:bg-red-800 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
