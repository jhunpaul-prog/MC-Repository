// src/pages/Admin/DashBoardComponents/screenshotAnalytics.ts
import { useEffect, useMemo, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../../../Backend/firebase";

const dayKey = (d: Date) => {
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  return `${Y}-${M}-${D}`;
};
const toMs = (v: any) => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return parseInt(v, 10);
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
};

const isScreenshotEvent = (e: any) => {
  const ev = String(e?.event || e?.type || "").toLowerCase();
  // match your watermark events
  return ev === "printscreen_key" || ev === "snipping_tool_suspected";
};

export type TopUser = { uid: string; attempts: number };

export function useScreenshotAnalytics(
  userMap?: Record<string, string>,
  daysWindow = 30
) {
  const [perDayCounts, setPerDayCounts] = useState<
    { date: string; count: number }[]
  >([]);
  const [todayTop, setTodayTop] = useState<TopUser[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);

  useEffect(() => {
    const unsub = onValue(ref(db, "Watermark"), (snap) => {
      const todayKey = dayKey(new Date());
      const dayMap = new Map<string, number>(); // date -> count
      const todayUserMap: Record<string, number> = {};

      // seed last N days (so zeros render)
      for (let i = daysWindow - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 3600_000);
        dayMap.set(dayKey(d), 0);
      }

      if (snap.exists()) {
        snap.forEach((userNode) => {
          const uid = userNode.key as string;
          const logs = userNode.child("logs");
          logs.forEach((l) => {
            const v = l.val() || {};
            if (!isScreenshotEvent(v)) return;
            const ts = toMs(v.timestamp);
            if (!ts) return;
            const k = dayKey(new Date(ts));
            if (dayMap.has(k)) dayMap.set(k, dayMap.get(k)! + 1);
            if (k === todayKey) {
              todayUserMap[uid] = (todayUserMap[uid] || 0) + 1;
            }
          });
        });
      }

      const series = Array.from(dayMap.entries()).map(([date, count]) => ({
        date,
        count,
      }));
      setPerDayCounts(series);
      const top = Object.entries(todayUserMap)
        .map(([uid, attempts]) => ({ uid, attempts }))
        .sort((a, b) => b.attempts - a.attempts);
      setTodayTop(top);
      setTodayTotal(top.reduce((s, x) => s + x.attempts, 0));
    });

    return () => unsub();
  }, [daysWindow]);

  const withDisplay = useMemo(() => {
    if (!userMap) return todayTop;
    return todayTop.map((t) => ({ ...t, name: userMap[t.uid] || t.uid }));
  }, [todayTop, userMap]);

  return { perDayCounts, todayTop: withDisplay, todayTotal };
}
