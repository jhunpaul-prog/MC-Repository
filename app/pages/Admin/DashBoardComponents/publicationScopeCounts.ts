// src/pages/Admin/DashBoardComponents/publicationScopeCounts.ts
import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../../../Backend/firebase";

const norm = (s: any) => String(s ?? "").trim().toLowerCase();

function getPublicationScope(p: any): "local" | "international" | "" {
  const candidates = [
    p?.publicationScope,
    p?.requiredFields?.publicationScope,
    p?.meta?.publicationScope,
  ];
  for (const c of candidates) {
    const v = norm(c);
    if (v === "local" || v === "international") return v;
  }
  // allow old flags like isLocal / isInternational
  if (p?.isLocal === true) return "local";
  if (p?.isInternational === true) return "international";
  return "";
}

export function usePublicationScopeCounts() {
  const [localCount, setLocal] = useState(0);
  const [intlCount, setIntl] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const unsub = onValue(ref(db, "Papers"), (snap) => {
      let loc = 0, intl = 0, tot = 0;
      if (snap.exists()) {
        snap.forEach((bucket) => {
          bucket.forEach((p) => {
            const val = p.val() || {};
            tot += 1;
            const scope = getPublicationScope(val);
            if (scope === "local") loc += 1;
            else if (scope === "international") intl += 1;
          });
        });
      }
      setLocal(loc);
      setIntl(intl);
      setTotal(tot);
    });
    return () => unsub();
  }, []);

  return { localCount, intlCount, total };
}
