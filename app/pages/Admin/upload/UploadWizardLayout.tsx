import React from "react";
import { Outlet } from "react-router-dom";
import { WizardProvider } from "../../../wizard/WizardContext";

/**
 * This layout wraps all /upload-research routes.
 * When you navigate away from /upload-research, this component (and the WizardProvider)
 * unmounts — and the provider clears sessionStorage so the wizard starts fresh next time.
 */
export default function UploadWizardLayout() {
  return (
    <WizardProvider clearOnUnmount>
      <div className="min-h-screen bg-white">
        <Outlet />
      </div>
    </WizardProvider>
  );
}
