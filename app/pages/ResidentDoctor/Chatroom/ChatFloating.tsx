import React, { useEffect, useMemo, useRef, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  ref,
  onValue,
  get,
  set,
  push,
  update,
  serverTimestamp,
} from "firebase/database";
// ⬇️ Adjust this path to your firebase init file
import { db } from "../../../Backend/firebase";

// ---------- Types ----------
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

type Message = { from: string; text: string; at: number | object };
type ChatPreview = {
  chatId: string;
  peerId: string;
  lastMessage?: { text?: string; at?: number; from?: string };
};

// ---------- Helpers ----------
const fullName = (u: UserRow) => {
  const mi = u.middleInitial ? ` ${u.middleInitial}.` : "";
  const suf = u.suffix ? ` ${u.suffix}` : "";
  return `${u.lastName || ""}, ${u.firstName || ""}${mi}${suf}`.trim();
};

const stableChatId = (a: string, b: string) =>
  a < b ? `${a}_${b}` : `${b}_${a}`;

const Avatar: React.FC<{ user: Partial<UserRow>; size?: number }> = ({
  user,
  size = 28,
}) => {
  const url =
    user.photoURL && user.photoURL !== "null"
      ? (user.photoURL as string)
      : "https://ui-avatars.com/api/?size=64&name=" +
        encodeURIComponent(`${user.firstName || ""} ${user.lastName || ""}`);
  return (
    <img
      src={url}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
      alt="avatar"
    />
  );
};

// ---------- Component ----------
const ChatFloating: React.FC = () => {
  const auth = getAuth();

  const [me, setMe] = useState(auth.currentUser);
  const [meRole, setMeRole] = useState<string>("");

  const [isOpen, setIsOpen] = useState(false);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");

  const [selectedPeer, setSelectedPeer] = useState<UserRow | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [recents, setRecents] = useState<ChatPreview[]>([]);

  // Keep auth synced
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setMe(u));
    return unsub;
  }, [auth]);

  // My role + recent chats
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
  }, [me]);

  // Load users with role-aware visibility
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
        if ((meRole || "").toLowerCase() === "admin") return true; // Admin sees all
        return (u.role || "").toLowerCase() !== "admin"; // Others cannot see Admins
      });

      setUsers(filtered);
    });
    return () => unsub();
  }, [me, meRole]);

  // In-memory search
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
      return (
        name.includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q)
      );
    });
  }, [users, query]);

  // Listen for global "open" events
  useEffect(() => {
    const handler = (e: any) => {
      const peerId: string | undefined = e?.detail?.peerId;
      if (peerId) {
        const target = users.find((u) => u.id === peerId);
        if (target) {
          (async () => {
            await openChatWith(target);
          })();
          return;
        }
      }
      setIsOpen(true);
    };
    window.addEventListener("chat:open", handler as any);
    return () => window.removeEventListener("chat:open", handler as any);
  }, [users]);

  // Subscribe to messages
  useEffect(() => {
    if (!chatId) return;
    const unsub = onValue(ref(db, `chats/${chatId}/messages`), (snap) => {
      const val = snap.val() || {};
      const list: Message[] = Object.values(val);
      list.sort((a: any, b: any) => (a.at || 0) - (b.at || 0));
      setMessages(list);
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        0
      );
    });
    return () => unsub();
  }, [chatId]);

  const openChatWith = async (peer: UserRow) => {
    if (!me) return;
    const cid = stableChatId(me.uid, peer.id);

    const roomRef = ref(db, `chats/${cid}`);
    const roomSnap = await get(roomRef);
    if (!roomSnap.exists()) {
      await set(roomRef, {
        members: { [me.uid]: true, [peer.id]: true },
        lastMessage: {},
      });
    }
    await update(ref(db, `userChats/${me.uid}/${cid}`), { peerId: peer.id });
    await update(ref(db, `userChats/${peer.id}/${cid}`), { peerId: me.uid });

    setSelectedPeer(peer);
    setChatId(cid);
    setIsOpen(true);
  };

  const sendMessage = async () => {
    if (!me || !chatId) return;
    const text = input.trim();
    if (!text) return;

    const msgRef = push(ref(db, `chats/${chatId}/messages`));
    await set(msgRef, { from: me.uid, text, at: serverTimestamp() });

    const last = { text, at: Date.now(), from: me.uid };
    await update(ref(db, `chats/${chatId}`), { lastMessage: last });
    await update(ref(db, `userChats/${me.uid}/${chatId}`), {
      lastMessage: last,
    });
    if (selectedPeer) {
      await update(ref(db, `userChats/${selectedPeer.id}/${chatId}`), {
        lastMessage: last,
      });
    }

    setInput("");
  };

  // Hide entirely if not signed in
  if (!me) return null;

  return (
    <>
      {/* Widget panel (no built-in FAB; opened by external icon) */}
      {isOpen && (
        <div className="fixed bottom-24 text-gray-600 right-5 z-[60] w-[360px] max-h-[560px] bg-white border rounded-2xl shadow-2xl flex flex-col">
          {/* Header */}
          <div className="h-12 px-4 border-b flex items-center justify-between">
            <div className="font-semibold text-sm">Messages</div>
            {selectedPeer ? (
              <button
                className="text-xs text-gray-500 hover:text-gray-700"
                onClick={() => setSelectedPeer(null)}
              >
                Back
              </button>
            ) : (
              <button
                className="text-xs text-gray-500 hover:text-gray-700"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            )}
          </div>

          {/* Body */}
          {!selectedPeer ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search */}
              <div className="p-3 border-b">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search users…"
                  className="w-full text-sm outline-none border rounded-lg px-3 py-2"
                />
              </div>

              {/* Recents */}
              <div className="px-3 pt-2 pb-1 text-[11px] uppercase text-gray-500">
                Recent
              </div>
              <div className="overflow-auto">
                {recents.length === 0 && (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    No recent chats
                  </div>
                )}
                {recents.map((c) => {
                  const peer = users.find((u) => u.id === c.peerId);
                  if (!peer) return null;
                  return (
                    <button
                      key={c.chatId}
                      onClick={() => openChatWith(peer)}
                      className="w-full px-3 py-2 hover:bg-gray-50 flex items-center gap-3 border-b"
                    >
                      <Avatar user={peer} />
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium leading-tight">
                          {fullName(peer)}
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-1">
                          {c.lastMessage?.text || "No messages yet"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* People */}
              <div className="px-3 pt-3 pb-1 text-[11px] uppercase text-gray-500 border-t">
                People
              </div>
              <div className="overflow-auto">
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => openChatWith(u)}
                    className="w-full px-3 py-2 hover:bg-gray-50 flex items-center gap-3 border-b"
                  >
                    <Avatar user={u} />
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium leading-tight">
                        {fullName(u)}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {u.role || "User"}
                      </div>
                    </div>
                  </button>
                ))}
                {searchResults.length === 0 && (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    No matches
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Conversation view
            <div className="flex-1 flex flex-col">
              <div className="h-14 px-4 border-b flex items-center gap-3">
                <Avatar user={selectedPeer} size={32} />
                <div>
                  <div className="text-sm font-semibold leading-tight">
                    {fullName(selectedPeer)}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {selectedPeer.role}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto px-4 py-3 bg-gray-50">
                {messages.map((m: any, idx) => {
                  const mine = m.from === me?.uid;
                  return (
                    <div
                      key={idx}
                      className={`w-full flex ${
                        mine ? "justify-end" : "justify-start"
                      } mb-2`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow ${
                          mine ? "bg-red-700 text-white" : "bg-white border"
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">
                          {m.text}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="border-t p-2 flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Write a message…"
                  className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={input.trim() === ""}
                  className="rounded-xl bg-red-700 text-white px-3 py-2 text-sm disabled:opacity-60"
                  title="Send"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ChatFloating;
