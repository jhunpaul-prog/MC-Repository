import React from "react";
import { Outlet } from "react-router-dom";
import { WizardProvider } from "../../../wizard/WizardContext";

export default function UploadWizardLayout() {
  return (
    <WizardProvider>
      <div className="min-h-screen bg-white">
        <Outlet />
      </div>
    </WizardProvider>
  );
}
