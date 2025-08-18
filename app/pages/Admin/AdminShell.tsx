import React from "react";
import { Outlet } from "react-router-dom";
import { WizardProvider } from "../../wizard/WizardContext";

const AdminShell: React.FC = () => {
  // Path: app/pages/Admin/AdminShell.tsx
  // Wrap all Admin pages that need wizard state (e.g., the modal) so useWizard works.
  return (
    <WizardProvider>
      <Outlet />
    </WizardProvider>
  );
};

export default AdminShell;
