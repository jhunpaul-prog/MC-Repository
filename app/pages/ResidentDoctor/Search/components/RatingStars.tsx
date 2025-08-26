import React, { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { ref, onValue, off, set } from "firebase/database";
import { db } from "app/Backend/firebase";
import { Star } from "lucide-react";

type Props = {
  paperId: string;
  dense?: boolean;
  alignLeft?: boolean;
};

const StarIcon: React.FC<{
  filled: boolean;
  onClick?: () => void;
  size?: number;
}> = ({ filled, onClick, size = 16 }) => (
  <button
    onClick={onClick}
    className="group"
    title={filled ? "Update rating" : "Rate"}
  >
    <Star
      style={{ width: size, height: size }}
      color={filled ? "#f59e0b" : "#d1d5db"}
      fill={filled ? "#f59e0b" : "transparent"}
      className="transition-transform group-active:scale-95"
    />
  </button>
);

const RatingStars: React.FC<Props> = ({
  paperId,
  dense = false,
  alignLeft = false,
}) => {
  const auth = getAuth();
  const [mine, setMine] = useState<number>(0);
  const [all, setAll] = useState<Record<string, number>>({});
  const size = dense ? 16 : 18;

  // Listen to everyone’s ratings for this paper
  useEffect(() => {
    const ratingsRef = ref(db, `ratings/${paperId}`);
    const cb = (snap: any) =>
      setAll((snap.val() as Record<string, number>) || {});
    onValue(ratingsRef, cb);
    return () => off(ratingsRef, "value", cb);
  }, [paperId]);

  // Listen to mine
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const myRef = ref(db, `ratings/${paperId}/${uid}`);
    const cb = (snap: any) => setMine(Number(snap.val() || 0));
    onValue(myRef, cb);
    return () => off(myRef, "value", cb);
  }, [auth.currentUser, paperId]);

  const avg = useMemo(() => {
    const vals = Object.values(all || {})
      .map((n) => Number(n))
      .filter(Boolean);
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [all]);

  const count = Object.keys(all || {}).length;
  const rounded = count ? Math.round(avg * 10) / 10 : 0;

  const handleRate = async (val: number) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      alert("Please sign in to rate.");
      return;
    }
    await set(ref(db, `ratings/${paperId}/${uid}`), val);
  };

  return (
    <div
      className={`flex items-center ${alignLeft ? "" : "justify-start"} gap-2`}
    >
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <StarIcon
            key={i}
            size={size}
            filled={i <= (mine || Math.round(avg))}
            onClick={() => handleRate(i)}
          />
        ))}
      </div>
      <span className={`text-[12px] text-gray-600 ${dense ? "" : "ml-1"}`}>
        {count ? `(${rounded} / ${count} ratings)` : "(no ratings yet)"}
      </span>
    </div>
  );
};

export default RatingStars;
