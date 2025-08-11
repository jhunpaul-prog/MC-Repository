import { useState, useEffect } from "react";
import { ref, get } from "firebase/database";
import { db } from "../../../../Backend/firebase";

export const useUserMap = () => {
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchUserMap = async () => {
      const usersRef = ref(db, "users");
      const snapshot = await get(usersRef);
      const map: Record<string, string> = {};
      snapshot.forEach((snap) => {
        const val = snap.val();
        const fullName = `${val.firstName} ${val.middleInitial || ""} ${val.lastName} ${val.suffix || ""}`.replace(/\s+/g, " ").trim();
        map[snap.key || ""] = fullName;
      });
      setUserMap(map);
    };

    fetchUserMap();
  }, []);

  return userMap;
};
