import React, { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { Download, Eye, Target } from "lucide-react";

const MissionVision: React.FC = () => {
  const [mission, setMission] = useState<string>("Loading mission...");
  const [vision, setVision] = useState<string>("Loading vision...");

  useEffect(() => {
    const load = async () => {
      try {
        const r = ref(db, "components");
        const s = await get(r);
        if (s.exists()) {
          const v = s.val();
          setMission(v?.Mission || "Mission not available");
          setVision(v?.Vision || "Vision not available");
        } else {
          setMission("Mission not available");
          setVision("Vision not available");
        }
      } catch (e) {
        console.error(e);
        setMission("Unable to load mission.");
        setVision("Unable to load vision.");
      }
    };
    load();
  }, []);

  const download = (label: "Mission" | "Vision", text: string) => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CobyCare_${label}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section id="mission-vision" className="w-full">
      <h2 className="sr-only">Mission and Vision</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mission */}
        <article className="rounded-2xl overflow-hidden shadow-2xl bg-white border border-red-100">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-gradient-to-r from-red-900 to-red-700 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-white/15">
                <Target className="h-5 w-5" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold">Mission</h3>
            </div>
            <button
              onClick={() => download("Mission", mission)}
              className="inline-flex items-center gap-2 text-xs sm:text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition"
              title="Download Mission"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </button>
          </div>
          <div className="p-5 sm:p-6">
            <p className="text-slate-800 text-sm sm:text-base leading-7 whitespace-pre-line">
              {mission}
            </p>
          </div>
        </article>

        {/* Vision */}
        <article className="rounded-2xl overflow-hidden shadow-2xl bg-white border border-red-100">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-gradient-to-r from-red-900 to-red-700 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-white/15">
                <Eye className="h-5 w-5" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold">Vision</h3>
            </div>
            <button
              onClick={() => download("Vision", vision)}
              className="inline-flex items-center gap-2 text-xs sm:text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition"
              title="Download Vision"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </button>
          </div>
          <div className="p-5 sm:p-6">
            <p className="text-slate-800 text-sm sm:text-base leading-7 whitespace-pre-line">
              {vision}
            </p>
          </div>
        </article>
      </div>
    </section>
  );
};

export default MissionVision;
