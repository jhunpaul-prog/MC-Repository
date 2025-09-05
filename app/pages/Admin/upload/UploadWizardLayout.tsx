// UploadWizardLayout.tsx
import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { WizardProvider, useWizard } from "../../../wizard/WizardContext";

const WIZARD_BASE = /^\/upload-research(\/|$)/;

function ClearOnLeave() {
  const { pathname } = useLocation();
  const { reset } = useWizard();
  const prevInsideRef = React.useRef<boolean>(WIZARD_BASE.test(pathname));

  React.useEffect(() => {
    const inside = WIZARD_BASE.test(pathname);

    // 🔴 Only reset when we were inside before and now moved outside
    if (prevInsideRef.current && !inside) {
      reset();
    }

    prevInsideRef.current = inside;
  }, [pathname, reset]);

  // Reset if tab/window is closed/reloaded
  React.useEffect(() => {
    const onBeforeUnload = () => {
      if (!WIZARD_BASE.test(window.location.pathname)) {
        reset();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [reset]);

  return null;
}

export default function UploadWizardLayout() {
  return (
    <WizardProvider>
      <ClearOnLeave />
      <div className="min-h-screen bg-white">
        <Outlet />
      </div>
    </WizardProvider>
  );
}
