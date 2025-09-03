import type { WizardData } from "./WizardContext";

export type Step = 1 | 2 | 3 | 4 | 5;

/** Allow jumping back always; forward only if prerequisites are met. */
export function canJump(wiz: WizardData, from: Step, to: Step) {
  if (to <= from) return true; // always OK to go back
  if (to >= 2 && !wiz.publicationType) return false; // chose type?
  if (to >= 3 && !wiz.fileBlob) return false; // uploaded a file?
  if (to >= 4 && (!wiz.uploadType || !wiz.verified)) return false; // access set + verified?
  return true;
}
