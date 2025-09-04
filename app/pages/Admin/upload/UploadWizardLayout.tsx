// UploadWizardLayout.tsx
import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { WizardProvider, useWizard } from "../../../wizard/WizardContext";

function ClearOnLeave() {
  const { pathname } = useLocation();
  const { reset } = useWizard();

  React.useEffect(() => {
    const inWizard = pathname.startsWith("/upload-research");
    if (!inWizard) {
      reset(); // clears session + state when leaving the flow
    }
  }, [pathname, reset]);

  // Also clean if the tab/window is closed/reloaded OUTSIDE the wizard
  React.useEffect(() => {
    const onBeforeUnload = () => {
      // if we are not on the wizard path, ensure the state is clean
      if (!window.location.pathname.startsWith("/upload-research")) reset();
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
