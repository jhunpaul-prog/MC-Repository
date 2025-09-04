// pages/ResidentDoctor/Chatroom/ChatFloating.tsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  ref,
  onValue,
  off,
  get,
  set,
  push,
  update,
  serverTimestamp,
  runTransaction,
} from "firebase/database";
import { db } from "../../../Backend/firebase";
import { supabase } from "../../../Backend/supabaseClient";
import {
  MessageCircle,
  X as XIcon,
  Search as SearchIcon,
  BellOff,
  Paperclip,
  Smile,
  Send,
  Camera,
  Image as ImageIcon,
  FileText,
  ChevronUp,
  ChevronDown,
  Plus,
  X,
} from "lucide-react";
import { NotificationService } from "../components/utils/notificationServiceChat";
import CameraModal from "./CameraModal";

/* ------------------ types ------------------ */
type UserRow = {
  id: string;
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  suffix?: string;
  role?: string;
  email?: string;
  photoURL?: string | null;
  status?: string;
};

type FileMeta = { url: string; name: string; mime: string; size: number };
type Message = {
  from: string;
  text?: string;
  at: number | object;
  file?: { url: string; name: string; mime: string; size: number };
};
type ChatPreview = {
  chatId: string;
  peerId: string;
  lastMessage?: { text?: string; at?: number; from?: string };
};
type RoleMap = Record<string, string>;

type Props = { variant?: "modal" | "panel"; showTrigger?: boolean };

/* ------------------ helpers ------------------ */
const fullName = (u: Partial<UserRow>) => {
  const mi = u.middleInitial ? ` ${u.middleInitial}.` : "";
  const suf = u.suffix ? ` ${u.suffix}` : "";
  return `${u.firstName || ""}${mi} ${u.lastName || ""}${suf}`.trim();
};
const stableChatId = (a: string, b: string) =>
  a < b ? `${a}_${b}` : `${b}_${a}`;
const Avatar: React.FC<{ user: Partial<UserRow>; size?: number }> = ({
  user,
  size = 32,
}) => {
  const url =
    user.photoURL && user.photoURL !== "null"
      ? (user.photoURL as string)
      : "https://ui-avatars.com/api/?size=96&name=" +
        encodeURIComponent(`${user.firstName || ""} ${user.lastName || ""}`);
  return (
    <img
      src={url}
      className="rounded-full object-cover border-2 border-white shadow-sm"
      style={{ width: size, height: size }}
      alt="avatar"
    />
  );
};
const EMOJIS =
  "😀 😁 😂 🤣 😊 😉 😍 😘 🤗 🤔 😴 😎 🥳 🤩 😇 😅 🙃 😌 🤤 🤓 😭 😤 😱 😜 🤪 😏 🙏 👍 👏 💪 👀 💯 ✅ ❌ 🔥 ✨ 🌟 🎉 🎯 📚 🧠 ❤️ 🩺".split(
    " "
  );
const CHAT_BUCKET = "ChatsImage";

/* ----- local mute helper for UI ----- */
const isMuteActive = (node: any): boolean => {
  if (!node || !node.muted) return false;
  const until = node.muteUntil;
  if (typeof until !== "number") return true;
  return until > Date.now();
};

/* ---------- IndexedDB helpers (read latest capture) ---------- */
const DB_NAME = "SWU_REPOSITORY_MEDIA";
const STORE_CAPTURES = "captures";
const DB_VERSION = 2;

async function idbOpenRead(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetLatestCapture(): Promise<{
  id: number;
  created: number;
  name: string;
  mime: string;
  blob: Blob;
} | null> {
  try {
    const db = await idbOpenRead();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CAPTURES, "readonly");
      const store = tx.objectStore(STORE_CAPTURES);
      const idx = store.index("created");
      const req = idx.openCursor(null, "prev"); // latest first
      req.onsuccess = () => {
        const cur = req.result;
        resolve(cur ? (cur.value as any) : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/* ---------- capture stamp helpers (dedupe) ---------- */
const extractStampFromName = (name?: string | null): number | null => {
  if (!name) return null;
  const m = name.match(/photo_(\d{10,})/);
  return m ? Number(m[1]) : null;
};
const stampFromFile = (f: File): number => {
  return (
    extractStampFromName(f.name) ||
    (typeof (f as any).lastModified === "number"
      ? (f as any).lastModified
      : 0) ||
    Date.now()
  );
};

/* ------------------ main ------------------ */
const ChatFloating: React.FC<Props> = ({
  variant = "modal",
  showTrigger = false,
}) => {
  const auth = getAuth();

  const [me, setMe] = useState(auth.currentUser);
  const [meRole, setMeRole] = useState<string>("");
  const [myDisplayName, setMyDisplayName] = useState<string>("");

  const [isOpen, setIsOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  // If a picture is taken but no chat is selected yet, queue it here.
  const [queuedCameraFile, setQueuedCameraFile] = useState<File | null>(null);

  // DEDUPE: stamps that have already been sent; and currently queued stamp
  const sentStampsRef = useRef<Set<number>>(new Set());
  const queuedStampRef = useRef<number | null>(null);

  // Track camera open/close to run fallback on close
  const prevCamOpenRef = useRef(false);

  // Sidebar search
  const [searchDraft, setSearchDraft] = useState("");
  const [query, setQuery] = useState("");
  const sidebarSearchRef = useRef<HTMLInputElement | null>(null);
  const sidebarContainerRef = useRef<HTMLDivElement | null>(null);

  // 👇 tracks when user is typing in the sidebar search (shared downwards)
  const typingSidebarRef = useRef<boolean>(false);

  useEffect(() => {
    const id = setTimeout(() => setQuery(searchDraft), 180);
    return () => clearTimeout(id);
  }, [searchDraft]);

  const [selectedPeer, setSelectedPeer] = useState<UserRow | null>(null);

  const [lockComposerFocus, setLockComposerFocus] = useState(false);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [recents, setRecents] = useState<ChatPreview[]>([]);
  const [isMuteOpen, setIsMuteOpen] = useState(false);
  const [muteInfo, setMuteInfo] = useState<{
    muted?: boolean;
    muteUntil?: number;
  } | null>(null);

  // New message picker
  const [roleTypeMap, setRoleTypeMap] = useState<RoleMap>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const pickerSearchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const el = pickerSearchRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? el.value.length;
    el.focus();
    const p = Math.min(pos, el.value.length);
    el.setSelectionRange(p, p);
  }, [pickerQuery, pickerOpen]);

  // composer
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState("");
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  /* ---------- auth ---------- */
  useEffect(() => onAuthStateChanged(auth, (u) => setMe(u)), [auth]);

  /* ---------- my name ---------- */
  useEffect(() => {
    if (!me) return;
    const uRef = ref(db, `users/${me.uid}`);
    return onValue(uRef, (snap) => {
      const v = snap.val() || {};
      const composed = [
        v.firstName,
        v.middleInitial ? v.middleInitial + "." : "",
        v.lastName,
        v.suffix,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
      setMyDisplayName(composed || me.displayName || me.email || "Someone");
    });
  }, [me]);

  /* ---------- role + recents ---------- */
  useEffect(() => {
    if (!me) return;

    const unsubRole = onValue(ref(db, `users/${me.uid}/role`), (s) =>
      setMeRole(s.val() || "")
    );

    const unsubRecents = onValue(ref(db, `userChats/${me.uid}`), (snap) => {
      const val = snap.val() || {};
      const list: ChatPreview[] = Object.entries(val).map(
        ([cid, data]: any) => ({
          chatId: cid,
          peerId: data.peerId,
          lastMessage: data.lastMessage || undefined,
        })
      );
      list.sort((a, b) => (b.lastMessage?.at || 0) - (a.lastMessage?.at || 0));
      setRecents(list);
    });

    return () => {
      unsubRole();
      unsubRecents();
    };
  }, [me, isOpen, selectedPeer]);

  /* ---------- users (role-aware) ---------- */
  useEffect(() => {
    const unsub = onValue(ref(db, "users"), (snap) => {
      const val = snap.val() || {};
      const list: UserRow[] = Object.entries(val).map(([id, u]: any) => ({
        id,
        ...u,
      }));

      const filtered = list.filter((u) => {
        if (!me) return false;
        if (u.id === me.uid) return false;
        if ((meRole || "").toLowerCase() === "admin") return true;
        return (u.role || "").toLowerCase() !== "admin";
      });

      setUsers(filtered);
    });
    return () => unsub();
  }, [me, meRole]);

  /* ---------- Role map for picker ---------- */
  useEffect(() => {
    const unsub = onValue(ref(db, "Role"), (snap) => {
      const val = snap.val() || {};
      const map: RoleMap = {};
      Object.values<any>(val).forEach((node: any) => {
        const n = node?.Access?.Name || node?.Name;
        const t = node?.Access?.Type || node?.Type;
        if (n) map[String(n)] = String(t || "");
      });
      setRoleTypeMap(map);
    });
    return () => unsub();
  }, []);

  /* ---------- role name -> role type helper ---------- */
  const roleTypeOf = useCallback(
    (roleName?: string) => {
      const n = (roleName || "").trim();
      if (!n) return "";
      const direct = roleTypeMap[n];
      if (direct) return String(direct).trim();
      const lower = n.toLowerCase();
      for (const [k, v] of Object.entries(roleTypeMap)) {
        if (k.toLowerCase() === lower) return String(v).trim();
      }
      return "";
    },
    [roleTypeMap]
  );

  /* ---------- eligible users for UserPicker (by role TYPE) ---------- */
  const eligibleUsers = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const TARGET_TYPE = "resident doctor";
    return users
      .filter((u) => roleTypeOf(u.role).toLowerCase() === TARGET_TYPE)
      .filter((u) => {
        if (!q) return true;
        const name = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
        const email = (u.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 20);
  }, [users, pickerQuery, roleTypeOf]);

  /* ---------- keep my userChats/<me>/<cid>/lastMessage in sync ---------- */
  useEffect(() => {
    if (!me) return;
    const tracked: Array<{ path: string; cb: any }> = [];
    recents.forEach((r) => {
      const p = `chats/${r.chatId}/lastMessage`;
      const rref = ref(db, p);
      const cb = (snap: any) => {
        const v = snap.val();
        const curAt = r.lastMessage?.at ?? null;
        const newAt = v?.at ?? null;
        if (v && newAt !== curAt) {
          update(ref(db, `userChats/${me.uid}/${r.chatId}`), {
            lastMessage: v,
          }).catch(() => {});
        }
      };
      onValue(rref, cb);
      tracked.push({ path: p, cb });
    });
    return () => {
      tracked.forEach(({ path, cb }) => off(ref(db, path), "value", cb));
    };
  }, [me, recents]);

  /* ---------- unread per chat for me ---------- */
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!me) return;
    const tracked: Array<{ path: string; cb: any }> = [];

    recents.forEach((r) => {
      const p = `chats/${r.chatId}/unread/${me.uid}`;
      const rref = ref(db, p);
      const cb = (snap: any) => {
        const v = snap.val();
        setUnreadMap((prev) => ({
          ...prev,
          [r.chatId]: typeof v === "number" ? v : 0,
        }));
      };
      onValue(rref, cb);
      tracked.push({ path: p, cb });
    });

    return () => {
      tracked.forEach(({ path, cb }) => off(ref(db, path), "value", cb));
    };
  }, [me, recents]);

  /* ---------- helpers ---------- */
  const fetchUser = async (uid: string): Promise<UserRow | null> => {
    const s = await get(ref(db, `users/${uid}`));
    const v = s.val();
    if (!v) return null;
    return { id: uid, ...v };
  };

  const loadMuteState = async (cid: string) => {
    if (!me) return;
    const s = await get(ref(db, `userChats/${me.uid}/${cid}`));
    const v = s.val() || {};
    const active = isMuteActive(v);

    if (!active && v?.muted) {
      await update(ref(db, `userChats/${me.uid}/${cid}`), {
        muted: false,
        muteUntil: null,
      }).catch(() => {});
    }

    setMuteInfo({
      muted: active,
      muteUntil: typeof v.muteUntil === "number" ? v.muteUntil : undefined,
    });
  };

  const resetMyUnread = async (cid: string) => {
    if (!me) return;
    await set(ref(db, `chats/${cid}/unread/${me.uid}`), 0).catch(() => {});
  };

  const openChatWith = async (peer: UserRow) => {
    if (!me) return;
    const cid = stableChatId(me.uid, peer.id);
    await set(ref(db, `chats/${cid}/members/${me.uid}`), true).catch(() => {});
    await set(ref(db, `chats/${cid}/members/${peer.id}`), true).catch(() => {});
    await set(ref(db, `chats/${cid}/lastMessage`), {}).catch(() => {});

    // mine
    await update(ref(db, `userChats/${me.uid}/${cid}`), {
      peerId: peer.id,
    }).catch(() => {});

    // ✅ mirror to peer so their sidebar shows the chat immediately
    await update(ref(db, `userChats/${peer.id}/${cid}`), {
      peerId: me.uid,
    }).catch(() => {});

    setSelectedPeer(peer);
    setChatId(cid);
    setIsOpen(true);
    loadMuteState(cid);
    resetMyUnread(cid);
    setTimeout(() => {
      if (
        !typingSidebarRef.current &&
        document.activeElement !== sidebarSearchRef.current
      ) {
        inputRef.current?.focus();
      }
    }, 0);
    setPickerOpen(false);
  };

  const openChatById = async (cid: string) => {
    if (!me) return;
    const membersSnap = await get(ref(db, `chats/${cid}/members`));
    const members = membersSnap.val() || {};
    const ids: string[] = Object.keys(members);
    const peerId = ids.find((id) => id !== me.uid) || "";
    let peer: UserRow | null = null;
    if (peerId)
      peer = users.find((u) => u.id === peerId) || (await fetchUser(peerId));
    setSelectedPeer(peer || null);
    setChatId(cid);
    setIsOpen(true);
    loadMuteState(cid);
    resetMyUnread(cid);
    setTimeout(() => {
      if (
        !typingSidebarRef.current &&
        document.activeElement !== sidebarSearchRef.current
      ) {
        inputRef.current?.focus();
      }
    }, 0);
  };

  const openBlank = () => {
    setSelectedPeer(null);
    setChatId(null);
    setIsOpen(true);
    setTimeout(() => {
      const el = sidebarSearchRef.current;
      el?.focus();
      if (el) {
        const end = el.value.length;
        el.setSelectionRange(end, end);
      }
    }, 0);
  };

  useEffect(() => {
    const handler = (e: any) => {
      const { peerId, chatId: cid } = e?.detail || {};
      if (peerId) {
        const target = users.find((u) => u.id === peerId);
        if (target) openChatWith(target);
        else fetchUser(peerId).then((u) => u && openChatWith(u));
        return;
      }
      if (cid) {
        openChatById(cid);
        return;
      }
      openBlank();
    };
    window.addEventListener("chat:open", handler as any);
    return () => window.removeEventListener("chat:open", handler as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, me]);

  /* ---------- messages subscription ---------- */
  useEffect(() => {
    if (!chatId) return;
    const unsub = onValue(ref(db, `chats/${chatId}/messages`), (snap) => {
      const val = snap.val() || {};
      const list: Message[] = Object.values(val);
      list.sort((a: any, b: any) => (a.at || 0) - (b.at || 0));
      setMessages(list);
    });
    return () => unsub();
  }, [chatId]);

  /* ---------- send text ---------- */
  const sendTextMessage = async (text: string) => {
    if (!me || !selectedPeer || !chatId) return;
    const msg = text.trim();
    if (!msg) return;

    const msgRef = push(ref(db, `chats/${chatId}/messages`));
    await set(msgRef, { from: me.uid, text: msg, at: serverTimestamp() });

    const last = { text: msg, at: Date.now(), from: me.uid };
    await update(ref(db, `chats/${chatId}`), { lastMessage: last });

    // mine
    await update(ref(db, `userChats/${me.uid}/${chatId}`), {
      lastMessage: last,
    }).catch(() => {});
    // ✅ peer mirror
    await update(ref(db, `userChats/${selectedPeer.id}/${chatId}`), {
      peerId: me.uid,
      lastMessage: last,
    }).catch(() => {});

    await runTransaction(
      ref(db, `chats/${chatId}/unread/${selectedPeer.id}`),
      (cur) => (typeof cur === "number" ? cur : 0) + 1
    ).catch(() => {});

    NotificationService.addChatNotificationFlat({
      toUid: selectedPeer.id,
      chatId,
      fromName: myDisplayName,
      preview: msg,
      fromUid: me.uid,
    }).catch(() => {});
  };

  /* ---------- upload via Supabase ---------- */
  const sanitize = (s: string) => s.replace(/[^\w.\-]+/g, "_");
  const uploadAndSend = async (file: File) => {
    if (!me || !chatId || !selectedPeer || !file) return;

    const base = `${chatId}/${me.uid}`;
    const unique = `${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}_${sanitize(file.name)}`;
    const path = `${base}/${unique}`;

    const { error: upErr } = await supabase.storage
      .from(CHAT_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) {
      console.error(upErr);
      return;
    }

    const { data: pub } = supabase.storage.from(CHAT_BUCKET).getPublicUrl(path);
    const url = pub?.publicUrl;
    if (!url) return;

    const meta: FileMeta = {
      url,
      name: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
    };

    const msgRef = push(ref(db, `chats/${chatId}/messages`));
    await set(msgRef, {
      from: me.uid,
      file: meta,
      text: "",
      at: serverTimestamp(),
    });

    const isImg = meta.mime.startsWith("image/");
    const preview = isImg ? "[Image]" : `[File] ${meta.name}`;

    const last = { text: preview, at: Date.now(), from: me.uid };
    await update(ref(db, `chats/${chatId}`), { lastMessage: last });

    // mine
    await update(ref(db, `userChats/${me.uid}/${chatId}`), {
      lastMessage: last,
    }).catch(() => {});
    // ✅ peer mirror
    await update(ref(db, `userChats/${selectedPeer.id}/${chatId}`), {
      peerId: me.uid,
      lastMessage: last,
    }).catch(() => {});

    await runTransaction(
      ref(db, `chats/${chatId}/unread/${selectedPeer.id}`),
      (cur) => (typeof cur === "number" ? cur : 0) + 1
    ).catch(() => {});

    NotificationService.addChatNotificationFlat({
      toUid: selectedPeer.id,
      chatId,
      fromName: myDisplayName,
      preview,
      fromUid: me.uid,
    }).catch((err) => console.error("[notif] write failed:", err));
  };

  /* ---------- mute ---------- */
  const muteFor = async (ms?: number) => {
    if (!me || !chatId) return;
    const until = typeof ms === "number" ? Date.now() + ms : null;
    await NotificationService.setChatMute(me.uid, chatId, until);
    setMuteInfo({ muted: true, muteUntil: until ?? undefined });
    setIsMuteOpen(false);
  };

  const unmute = async () => {
    if (!me || !chatId) return;
    await NotificationService.clearChatMute(me.uid, chatId);
    setMuteInfo({ muted: false, muteUntil: undefined });
    setIsMuteOpen(false);
  };

  const ModalShell = ({ children }: { children: React.ReactNode }) =>
    variant === "modal" ? (
      <div className="fixed inset-0 z-[200]">
        <div
          className="absolute inset-0 bg-gray-900/60 backdrop-blur-[2px]"
          onClick={() => setIsOpen(false)}
        />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          {children}
        </div>
      </div>
    ) : (
      <div className="fixed z-[200] right-2 top-20 md:right-4 md:top-24">
        {children}
      </div>
    );

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node))
        setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  /* ---------- Auto-send when camera closes (fallback) with dedupe ---------- */
  useEffect(() => {
    const wasOpen = prevCamOpenRef.current;
    if (wasOpen && !cameraOpen) {
      (async () => {
        const rec = await idbGetLatestCapture();
        if (!rec) return;

        const RECENT_MS = 60 * 1000;
        const stamp = extractStampFromName(rec.name) ?? (rec.created as number);

        if (sentStampsRef.current.has(stamp)) return;
        if (queuedStampRef.current === stamp) return;

        if (Date.now() - rec.created > RECENT_MS) return;

        const file = new File(
          [rec.blob],
          rec.name || `photo_${rec.created}.jpg`,
          {
            type: rec.mime || "image/jpeg",
            lastModified: rec.created,
          }
        );

        if (selectedPeer && chatId) {
          sentStampsRef.current.add(stamp);
          try {
            await uploadAndSend(file);
          } catch (e) {
            sentStampsRef.current.delete(stamp);
          }
        } else if (!queuedCameraFile) {
          setQueuedCameraFile(file);
          queuedStampRef.current = stamp;
        }
      })();
    }
    prevCamOpenRef.current = cameraOpen;
  }, [cameraOpen, selectedPeer, chatId, queuedCameraFile]);

  /* ---------- If we queued a photo (no chat yet), send once chat is ready (dedupe) ---------- */
  useEffect(() => {
    if (!queuedCameraFile || !selectedPeer || !chatId) return;
    (async () => {
      const stamp = stampFromFile(queuedCameraFile);
      if (!sentStampsRef.current.has(stamp)) {
        await uploadAndSend(queuedCameraFile);
        sentStampsRef.current.add(stamp);
      }
      setQueuedCameraFile(null);
      queuedStampRef.current = null;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedCameraFile, selectedPeer, chatId]);

  /* ------------------ UI ------------------ */
  return (
    <>
      {showTrigger && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 group"
          aria-label="Open chat"
          title="Open chat"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-red-900 rounded-full animate-ping opacity-20" />
            <div className="relative w-14 h-14 bg-red-900 hover:bg-red-800 rounded-full shadow-xl flex items-center justify-center group-hover:scale-110 group-active:scale-95">
              <MessageCircle className="w-7 h-7 text-white" />
            </div>
          </div>
        </button>
      )}

      <CameraModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={async (file) => {
          // Auto-send right away if a chat is open; otherwise queue it.
          setIsOpen(true);
          const stamp = stampFromFile(file);

          if (sentStampsRef.current.has(stamp)) return;
          if (queuedStampRef.current === stamp) return;

          if (selectedPeer && chatId) {
            sentStampsRef.current.add(stamp);
            try {
              await uploadAndSend(file);
            } catch (e) {
              sentStampsRef.current.delete(stamp);
              throw e;
            }
          } else {
            setQueuedCameraFile(file);
            queuedStampRef.current = stamp;
          }

          setTimeout(() => {
            if (
              !typingSidebarRef.current &&
              document.activeElement !== sidebarSearchRef.current
            ) {
              inputRef.current?.focus();
            }
          }, 0);
        }}
      />

      {isOpen && (
        <ModalShell>
          <div
            className="relative w-[95vw] max-w-[900px] h-[82vh] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col min-h-0"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Title */}
            <div className="h-14 bg-red-900 text-white px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedPeer ? (
                  <>
                    <Avatar user={selectedPeer} size={32} />
                    <div className="leading-tight">
                      <div className="font-semibold">
                        {fullName(selectedPeer)}
                      </div>
                      <div className="text-[11px] text-gray-200">
                        {muteInfo?.muted && muteInfo.muteUntil
                          ? `Muted until ${new Date(
                              muteInfo.muteUntil
                            ).toLocaleString()}`
                          : muteInfo?.muted
                          ? "Muted"
                          : "Online"}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-white/20 grid place-items-center font-bold">
                      💬
                    </div>
                    <div className="leading-tight">
                      <div className="font-semibold">Messages</div>
                      <div className="text-[11px] text-gray-200">
                        Select a conversation
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1">
                {selectedPeer && (
                  <button
                    onClick={() => setIsMuteOpen(true)}
                    className="p-2 rounded-lg hover:bg-white/10"
                    title="Mute notifications"
                  >
                    <BellOff className="w-5 h-5 text-white" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/10"
                  title="Close"
                >
                  <XIcon className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 flex">
              {/* Sidebar */}
              <aside
                ref={sidebarContainerRef}
                className="hidden md:flex w-72 shrink-0 flex-col border-r border-gray-200 min-h-0 bg-gray-50"
              >
                <div className="p-3 border-b border-gray-200 bg-white relative">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        id="sidebarSearch"
                        ref={sidebarSearchRef}
                        value={searchDraft}
                        onChange={(e) => setSearchDraft(e.target.value)}
                        placeholder="Search conversations..."
                        className="w-full rounded-lg border border-gray-400 focus:border-red-900 focus:ring-1 focus:ring-red-900/20 pl-9 pr-3 py-2 text-sm outline-none text-gray-900 placeholder:text-gray-500"
                        onKeyDown={(e) => e.stopPropagation()}
                        onFocus={() => {
                          setLockComposerFocus(true);
                          typingSidebarRef.current = true;
                        }}
                        onBlur={() => {
                          setLockComposerFocus(false);
                          typingSidebarRef.current = false;
                        }}
                        type="text"
                        inputMode="search"
                      />
                      <SearchIcon className="w-4 h-4 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* New message button */}
                    <button
                      className="h-10 w-10 rounded-lg bg-red-900 text-white grid place-items-center hover:bg-red-800"
                      title="New message"
                      onClick={() => {
                        setPickerOpen((v) => !v);
                        setPickerQuery("");
                        setTimeout(() => pickerSearchRef.current?.focus(), 0);
                      }}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* User picker */}
                  {pickerOpen && (
                    <UserPicker
                      pickerRef={pickerRef}
                      pickerQuery={pickerQuery}
                      setPickerQuery={setPickerQuery}
                      onClose={() => setPickerOpen(false)}
                      onSelect={openChatWith}
                      pickerSearchRef={pickerSearchRef}
                      eligibleUsers={eligibleUsers}
                      getRoleType={roleTypeOf}
                    />
                  )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto">
                  {(() => {
                    const q = query.trim().toLowerCase();
                    const filteredRecents = q
                      ? recents.filter((r) => {
                          const u =
                            users.find((x) => x.id === r.peerId) ||
                            ({} as UserRow);
                          const name = `${u.firstName || ""} ${
                            u.lastName || ""
                          }`.toLowerCase();
                          const last = (
                            r.lastMessage?.text || ""
                          ).toLowerCase();
                          return name.includes(q) || last.includes(q);
                        })
                      : recents;

                    return filteredRecents.length > 0 ? (
                      filteredRecents.map((c) => {
                        const peer = users.find((u) => u.id === c.peerId);
                        if (!peer) return null;
                        const active = chatId === c.chatId;
                        const unread = unreadMap[c.chatId] || 0;
                        return (
                          <button
                            key={c.chatId}
                            onClick={() => openChatWith(peer)}
                            className={`w-full text-left px-3 py-3 flex gap-3 items-center border-b border-gray-200 transition ${
                              active
                                ? "bg-gray-100"
                                : unread > 0
                                ? "bg-white hover:bg-red-50"
                                : "bg-transparent hover:bg-gray-50"
                            }`}
                          >
                            <div className="relative">
                              <Avatar user={peer} size={36} />
                              {unread > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-red-700 text-white grid place-items-center">
                                  {unread > 99 ? "99+" : unread}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-sm truncate text-gray-900">
                                  <span
                                    className={
                                      unread > 0 ? "font-extrabold" : ""
                                    }
                                  >
                                    {fullName(peer)}
                                  </span>
                                </div>
                                <div className="text-[10px] text-gray-500">
                                  {c.lastMessage?.at
                                    ? new Date(
                                        c.lastMessage.at
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : ""}
                                </div>
                              </div>
                              <div
                                className={`text-xs truncate ${
                                  unread > 0
                                    ? "text-gray-900 font-semibold"
                                    : "text-gray-600"
                                }`}
                              >
                                {c.lastMessage?.text || "No messages yet"}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-sm text-gray-600">
                        No conversations found.
                      </div>
                    );
                  })()}
                </div>
              </aside>

              {/* Conversation */}
              <section className="flex-1 min-h-0 flex flex-col">
                {!selectedPeer ? (
                  <EmptyState />
                ) : (
                  <Conversation
                    meId={me!.uid}
                    peer={selectedPeer}
                    messages={messages}
                    bottomRef={bottomRef}
                    onSendText={sendTextMessage}
                    onUploadFile={uploadAndSend}
                    inputRef={inputRef}
                    onOpenCamera={() => setCameraOpen(true)}
                    // ✅ pass the ref so Composer won’t steal focus
                    sidebarTypingRef={typingSidebarRef}
                  />
                )}
              </section>
            </div>
          </div>

          {/* Mute modal */}
          {isMuteOpen && (
            <div className="fixed inset-0 z-[210]">
              <div
                className="absolute inset-0 bg-gray-900/50"
                onClick={() => setIsMuteOpen(false)}
              />
              <div className="absolute inset-0 flex items-end md:items-center justify-center p-4">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <div className="font-semibold text-gray-900">
                      Mute Notifications
                    </div>
                    <div className="text-sm text-gray-600">
                      You won't receive notifications for this conversation.
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <button
                      onClick={() => muteFor(60 * 60 * 1000)}
                      className="w-full px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-800"
                    >
                      For 1 hour
                    </button>
                    <button
                      onClick={() => muteFor(8 * 60 * 60 * 1000)}
                      className="w-full px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-800"
                    >
                      For 8 hours
                    </button>
                    <button
                      onClick={() => muteFor(24 * 60 * 60 * 1000)}
                      className="w-full px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-800"
                    >
                      For 1 day
                    </button>
                    <button
                      onClick={() => muteFor(undefined)}
                      className="w-full px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-800"
                    >
                      Until I turn it back on
                    </button>
                  </div>
                  <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
                    <button
                      onClick={() => setIsMuteOpen(false)}
                      className="px-4 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-800"
                    >
                      Cancel
                    </button>
                    {muteInfo?.muted ? (
                      <button
                        onClick={unmute}
                        className="px-4 py-2 rounded-lg text-sm bg-red-900 text-white hover:bg-red-800"
                      >
                        Unmute
                      </button>
                    ) : (
                      <button
                        onClick={() => muteFor(24 * 60 * 60 * 1000)}
                        className="px-4 py-2 rounded-lg text-sm bg-red-900 text-white hover:bg-red-800"
                      >
                        Mute
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </ModalShell>
      )}
    </>
  );
};

/* ---------- User Picker ---------- */
const UserPicker: React.FC<{
  pickerRef: React.RefObject<HTMLDivElement | null>;
  pickerQuery: string;
  setPickerQuery: (v: string) => void;
  onClose: () => void;
  onSelect: (u: UserRow) => void;
  pickerSearchRef: React.RefObject<HTMLInputElement | null>;
  eligibleUsers: UserRow[];
  getRoleType: (name?: string) => string;
}> = ({
  pickerRef,
  pickerQuery,
  setPickerQuery,
  onClose,
  onSelect,
  pickerSearchRef,
  eligibleUsers,
  getRoleType,
}) => {
  return (
    <div
      ref={pickerRef}
      className="absolute right-3 top-[62px] z-30 w-[calc(100%-24px)] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-2">
        <SearchIcon className="w-4 h-4 text-gray-600" />
        <input
          ref={pickerSearchRef}
          value={pickerQuery}
          onChange={(e) => setPickerQuery(e.target.value)}
          placeholder="Search people…"
          className="flex-1 text-sm outline-none text-gray-700 placeholder:text-gray-500"
          onKeyDown={(e) => e.stopPropagation()}
        />
        <button className="p-1 rounded hover:bg-gray-100" onClick={onClose}>
          <X className="w-4 h-4 text-gray-600" />
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {eligibleUsers.map((u) => (
          <button
            key={u.id}
            onClick={() => onSelect(u)}
            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 border-b last:border-b-0"
          >
            <Avatar user={u} size={28} />
            <div className="min-w-0 flex-1 text-left">
              <div className="text-sm font-medium text-gray-900 truncate">
                {fullName(u)}
              </div>
              <div className="text-[11px] text-gray-600 truncate">
                {u.email}
              </div>
            </div>
            <div className="text-[10px] text-gray-500 uppercase">
              {getRoleType(u.role) || "—"}
            </div>
          </button>
        ))}
        {eligibleUsers.length === 0 && (
          <div className="p-4 text-sm text-gray-600">No matches.</div>
        )}
      </div>
    </div>
  );
};

/* ---------- Empty ---------- */
const EmptyState: React.FC = () => (
  <div className="flex-1 min-h-0 grid place-items-center bg-white">
    <div className="text-center">
      <div className="text-4xl mb-2">💬</div>
      <div className="text-lg font-semibold text-gray-900">
        Select a conversation
      </div>
      <div className="text-sm text-gray-600">
        Choose a conversation from the sidebar to start messaging
      </div>
    </div>
  </div>
);

/* ---------- Image Preview Modal ---------- */
const ImagePreviewModal: React.FC<{
  url: string;
  name?: string;
  onClose: () => void;
}> = ({ url, name, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[250]">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full h-full max-w-5xl max-h-[90vh]">
          <button
            onClick={onClose}
            className="absolute -top-3 right-0 z-10 px-3 py-1.5 rounded-lg bg-white/90 text-gray-900 hover:bg-white"
            title="Close"
          >
            Close
          </button>
          <div className="w-full h-full bg-black rounded-xl overflow-hidden border border-white/20 grid place-items-center">
            <img
              src={url}
              className="max-h-full max-w-full object-contain"
              draggable={false}
              alt=""
            />
          </div>
          {name && (
            <div className="mt-2 text-center text-xs text-white/80 truncate">
              {name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------- Conversation ---------- */
type ComposerHandle = { stageFiles?: (files: File[]) => void };

const Conversation: React.FC<{
  meId: string;
  peer: UserRow;
  messages: Message[];
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onSendText: (text: string) => Promise<void>;
  onUploadFile: (file: File) => Promise<void>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onOpenCamera: () => void;
  // ✅ receive the sidebar typing ref from parent
  sidebarTypingRef?: React.MutableRefObject<boolean>;
}> = ({
  meId,
  peer,
  messages,
  onSendText,
  onUploadFile,
  inputRef,
  onOpenCamera,
  sidebarTypingRef,
}) => {
  const [msgQuery, setMsgQuery] = useState("");
  const msgRefs = useRef<Array<HTMLDivElement | null>>([]);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Collapsed search state + ref (default hidden)
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const msgSearchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (showMsgSearch) {
      requestAnimationFrame(() => {
        msgSearchRef.current?.focus();
        msgSearchRef.current?.select();
      });
    }
  }, [showMsgSearch]);

  const [imgPreview, setImgPreview] = useState<{
    url: string;
    name?: string;
  } | null>(null);

  const matchIndexes = useMemo(() => {
    const q = msgQuery.trim().toLowerCase();
    if (!q) return [] as number[];
    const idxs: number[] = [];
    messages.forEach((m, i) => {
      const hay = (m.text || "") + " " + (m.file?.name || "");
      if (hay.toLowerCase().includes(q)) idxs.push(i);
    });
    return idxs;
  }, [messages, msgQuery]);

  const [activeMatch, setActiveMatch] = useState<number>(-1);
  useEffect(() => {
    if (matchIndexes.length === 0) setActiveMatch(-1);
    else if (activeMatch === -1 || !matchIndexes.includes(activeMatch))
      setActiveMatch(matchIndexes[0]);
  }, [matchIndexes.length, activeMatch, matchIndexes]);

  const scrollToMessage = (i: number, smooth = true) => {
    const el = msgRefs.current[i];
    if (!el) return;
    el.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "center",
    });
  };
  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };
  useEffect(() => {
    const id = requestAnimationFrame(() => scrollToBottom("auto"));
    return () => cancelAnimationFrame(id);
  }, [peer]);
  useEffect(() => {
    if (msgQuery.trim() && activeMatch >= 0) scrollToMessage(activeMatch, true);
    else scrollToBottom("smooth");
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextMatch = () => {
    if (matchIndexes.length === 0) return;
    const idx = matchIndexes.indexOf(activeMatch);
    const next = matchIndexes[(idx + 1) % matchIndexes.length];
    setActiveMatch(next);
    setTimeout(() => scrollToMessage(next, true), 0);
  };
  const prevMatch = () => {
    if (matchIndexes.length === 0) return;
    const idx = matchIndexes.indexOf(activeMatch);
    const prev =
      matchIndexes[(idx - 1 + matchIndexes.length) % matchIndexes.length];
    setActiveMatch(prev);
    setTimeout(() => scrollToMessage(prev, true), 0);
  };

  const composerRef = useRef<{ stageFiles?: (files: File[]) => void } | null>(
    null
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* message search (collapsed by default) */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        {showMsgSearch ? (
          <div className="relative">
            <input
              ref={msgSearchRef}
              value={msgQuery}
              onChange={(e) => setMsgQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setMsgQuery("");
                  setShowMsgSearch(false);
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  nextMatch();
                } else if (e.key === "Enter" && e.shiftKey) {
                  e.preventDefault();
                  prevMatch();
                }
              }}
              placeholder="Search messages..."
              className="w-full rounded-lg border border-gray-400 focus:border-red-900 focus:ring-1 focus:ring-red-900/20 pl-9 pr-28 py-2 text-sm outline-none text-gray-900 placeholder:text-gray-500"
            />
            <SearchIcon className="w-4 h-4 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="text-[11px] text-gray-600 mr-1">
                {matchIndexes.length > 0
                  ? `${matchIndexes.indexOf(activeMatch) + 1}/${
                      matchIndexes.length
                    }`
                  : "0/0"}
              </span>
              <button
                onClick={prevMatch}
                disabled={matchIndexes.length === 0}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
                title="Previous"
              >
                <ChevronUp className="w-4 h-4 text-gray-700" />
              </button>
              <button
                onClick={nextMatch}
                disabled={matchIndexes.length === 0}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-40"
                title="Next"
              >
                <ChevronDown className="w-4 h-4 text-gray-700" />
              </button>
              {msgQuery && (
                <button
                  onClick={() => setMsgQuery("")}
                  className="ml-1 p-1 rounded hover:bg-gray-100"
                  title="Clear"
                >
                  <XIcon className="w-4 h-4 text-gray-700" />
                </button>
              )}
              {/* Hide search bar */}
              <button
                onClick={() => {
                  setMsgQuery("");
                  setShowMsgSearch(false);
                }}
                className="ml-1 p-1 rounded hover:bg-gray-100"
                title="Hide search"
              >
                <X className="w-4 h-4 text-gray-700" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-900">
              Conversation
            </div>
            <button
              onClick={() => setShowMsgSearch(true)}
              className="p-2 rounded hover:bg-gray-100"
              title="Search messages"
            >
              <SearchIcon className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        )}
      </div>

      {/* viewport */}
      <div
        ref={viewportRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 bg-gray-50 space-y-3"
      >
        {messages.length === 0 && (
          <div className="text-center py-10">
            <div className="text-2xl mb-2">👋</div>
            <div className="text-sm text-gray-600">Start your conversation</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Send a message to {fullName(peer)}
            </div>
          </div>
        )}

        {messages.map((m: any, idx) => {
          const mine = m.from === meId;
          const hasFile = !!m.file;
          const isImg = hasFile && (m.file.mime as string).startsWith("image/");
          const isActive = idx === activeMatch;
          return (
            <div
              key={idx}
              ref={(el) => {
                msgRefs.current[idx] = el;
              }}
              className={`w-full flex ${
                mine ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow transition ${
                  mine
                    ? "bg-red-900 text-white rounded-br-md"
                    : "bg-white border border-gray-300 text-gray-900 rounded-bl-md"
                } ${isActive ? "outline outline-2 outline-red-900/70" : ""}`}
              >
                {hasFile &&
                  (isImg ? (
                    <button
                      type="button"
                      onClick={() =>
                        setImgPreview({ url: m.file.url, name: m.file.name })
                      }
                      className="block focus:outline-none"
                      title="View image"
                    >
                      <img
                        src={m.file.url}
                        className="rounded-lg max-h-64 object-contain mb-2"
                        alt=""
                      />
                    </button>
                  ) : (
                    <a
                      href={m.file.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                        mine
                          ? "border-red-200 bg-red-800/40"
                          : "border-gray-300 bg-gray-100"
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span className="text-xs truncate max-w-[220px]">
                        {m.file.name}
                      </span>
                    </a>
                  ))}

                {m.text && (
                  <div className="whitespace-pre-wrap leading-relaxed break-words mt-1">
                    {m.text}
                  </div>
                )}

                <div
                  className={`text-[11px] mt-2 ${
                    mine ? "text-red-200" : "text-gray-600"
                  }`}
                >
                  {new Date((m.at as number) || Date.now()).toLocaleTimeString(
                    [],
                    { hour: "2-digit", minute: "2-digit" }
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div />
      </div>

      {/* composer */}
      <Composer
        ref={null as unknown as React.Ref<ComposerHandle>}
        inputRef={inputRef}
        onSendText={onSendText}
        onUploadFile={onUploadFile}
        onOpenCamera={onOpenCamera}
        // ✅ pass down the ref we received so focus is respected
        sidebarTypingRef={sidebarTypingRef}
      />

      {/* Lightbox */}
      {imgPreview && (
        <ImagePreviewModal
          url={imgPreview.url}
          name={imgPreview.name}
          onClose={() => setImgPreview(null)}
        />
      )}
    </div>
  );
};

const Composer = React.forwardRef<
  ComposerHandle,
  {
    inputRef: React.RefObject<HTMLInputElement | null>;
    onSendText: (text: string) => Promise<void>;
    onUploadFile: (f: File) => Promise<void>;
    onOpenCamera: () => void;
    // keep simple: optional ref from parent
    sidebarTypingRef?: React.MutableRefObject<boolean>;
  }
>(
  (
    { inputRef, onSendText, onUploadFile, onOpenCamera, sidebarTypingRef },
    ref
  ) => {
    const [draft, setDraft] = useState("");
    const [isEmojiOpen, setIsEmojiOpen] = useState(false);
    const [staged, setStaged] = useState<File[]>([]);
    const attachRef = useRef<HTMLDivElement | null>(null);
    const [showAttach, setShowAttach] = useState(false);

    const safeFocusComposer = () => {
      setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        const sidebarTyping = !!sidebarTypingRef?.current;
        if (!sidebarTyping && (!active || active.id !== "sidebarSearch")) {
          inputRef.current?.focus();
        }
      }, 0);
    };

    React.useImperativeHandle(ref, () => ({
      stageFiles: (files: File[]) => {
        if (!files || files.length === 0) return;
        const withPreviews = files.map((f) => {
          (f as any).__previewUrl = URL.createObjectURL(f);
          return f;
        });
        setStaged((prev) => [...prev, ...withPreviews]);
        safeFocusComposer();
      },
    }));

    useEffect(() => {
      const onDocClick = (e: MouseEvent) => {
        if (attachRef.current && !attachRef.current.contains(e.target as Node))
          setShowAttach(false);
      };
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    useEffect(() => {
      return () => {
        staged.forEach((f) => {
          const u = (f as any).__previewUrl;
          if (u) URL.revokeObjectURL(u);
        });
      };
    }, [staged]);

    const stageFile = (file: File) => {
      (file as any).__previewUrl = URL.createObjectURL(file);
      setStaged((prev) => [...prev, file]);
      safeFocusComposer();
    };
    const removeStaged = (idx: number) => {
      const f = staged[idx];
      const u = (f as any).__previewUrl;
      if (u) URL.revokeObjectURL(u);
      setStaged((prev) => prev.filter((_, i) => i !== idx));
      safeFocusComposer();
    };

    const sendAll = async () => {
      const t = draft.trim();
      if (t) await onSendText(t);
      for (const f of staged) await onUploadFile(f);
      if (!t && staged.length === 0) return;
      setDraft("");
      setStaged([]);
      safeFocusComposer();
    };

    return (
      <div className="border-t border-gray-200 bg-white px-3 pt-2">
        {staged.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2">
            {staged.map((f, i) => {
              const isImg = f.type.startsWith("image/");
              const url = (f as any).__previewUrl as string | undefined;
              return (
                <div
                  key={`${f.name}-${i}`}
                  className="group relative border rounded-lg overflow-hidden bg-gray-50"
                >
                  <button
                    onClick={() => removeStaged(i)}
                    className="absolute -top-2 -right-2 z-10 h-6 w-6 rounded-full bg-red-900 text-white grid place-items-center shadow"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="flex items-center gap-2 p-2 pr-7">
                    {isImg && url ? (
                      <img
                        src={url}
                        className="h-10 w-10 object-cover rounded"
                        alt=""
                      />
                    ) : (
                      <FileText className="w-6 h-6 text-gray-700" />
                    )}
                    <div className="text-xs text-gray-800 max-w-[180px] truncate">
                      {f.name}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="py-2 flex items-center gap-2 relative">
          {/* Attach popover */}
          <div className="relative" ref={attachRef}>
            <button
              onClick={() => setShowAttach((v) => !v)}
              className="p-2 rounded-lg hover:bg-gray-100"
              title="Attach"
            >
              <Paperclip className="w-5 h-5 text-gray-600" />
            </button>
            {showAttach && (
              <div className="absolute bottom-12 left-0 z-30 w-[300px] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 font-semibold text-gray-900">
                  Add Attachment
                </div>
                <div className="p-3 grid grid-cols-3 gap-2">
                  {/* Camera */}
                  <button
                    onClick={() => {
                      onOpenCamera();
                      setShowAttach(false);
                    }}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-900"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-xs font-medium">Camera</span>
                  </button>

                  {/* Gallery */}
                  <button
                    onClick={() =>
                      document.getElementById("cf_gallery")?.click()
                    }
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700"
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-xs font-medium">Gallery</span>
                  </button>

                  {/* Document */}
                  <button
                    onClick={() => document.getElementById("cf_docs")?.click()}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700"
                  >
                    <FileText className="w-5 h-5" />
                    <span className="text-xs font-medium">Document</span>
                  </button>
                </div>

                {/* Hidden inputs */}
                <input
                  id="cf_gallery"
                  type="file"
                  accept="image/*,video/*"
                  multiple={false}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      (f as any).__previewUrl = URL.createObjectURL(f);
                      setStaged((prev) => [...prev, f]);
                      setShowAttach(false);
                    }
                  }}
                />

                <input
                  id="cf_docs"
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                  multiple={false}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      (f as any).__previewUrl = URL.createObjectURL(f);
                      setStaged((prev) => [...prev, f]);
                      setShowAttach(false);
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Emoji popover */}
          <div className="relative">
            <button
              onClick={() => setIsEmojiOpen(!isEmojiOpen)}
              className="p-2 rounded-lg hover:bg-gray-100"
              title="Emoji"
            >
              <Smile className="w-5 h-5 text-gray-600" />
            </button>
            {isEmojiOpen && (
              <div className="absolute bottom-12 left-0 z-20 w-64 p-2 rounded-xl border border-gray-200 bg-white shadow-xl">
                <div className="grid grid-cols-8 gap-1">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => {
                        const el = inputRef.current;
                        if (!el) return;
                        const pos = el.selectionStart ?? el.value.length;
                        const before = el.value.slice(0, pos);
                        const after = el.value.slice(pos);
                        const next = before + e + after;
                        // update controlled value + keep caret
                        setDraft(next);
                        requestAnimationFrame(() => {
                          el.setSelectionRange(
                            (before + e).length,
                            (before + e).length
                          );
                          el.focus();
                        });
                      }}
                      className="text-xl hover:bg-gray-100 rounded"
                      title={e}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendAll();
              }
            }}
            placeholder="Type your message..."
            className="flex-1 rounded-full border border-red-900 focus:border-red-900 focus:ring-1 focus:ring-red-900/20 px-4 py-2 text-sm outline-none text-gray-900 placeholder:text-gray-600"
          />

          <button
            onClick={() => void sendAll()}
            disabled={draft.trim() === "" && staged.length === 0}
            className="h-10 w-10 rounded-full bg-red-900 text-white grid place-items-center disabled:opacity-50 hover:bg-red-800"
            title="Send"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }
);
Composer.displayName = "Composer";

export default ChatFloating;
