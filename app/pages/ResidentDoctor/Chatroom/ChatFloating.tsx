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
import { db } from "../../../Backend/firebase";
import { NotificationService } from "../components/utils/notificationService";
import { MessageCircle } from "lucide-react";

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
      className="rounded-full object-cover border-2 border-gray-200 shadow-sm"
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
  const [myDisplayName, setMyDisplayName] = useState<string>("");

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

  // Load my display name from /users/{uid}
  useEffect(() => {
    if (!me) return;
    const uRef = ref(db, `users/${me.uid}`);
    const unsub = onValue(uRef, (snap) => {
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
    return () => unsub();
  }, [me]);

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
        if ((meRole || "").toLowerCase() === "admin") return true;
        return (u.role || "").toLowerCase() !== "admin";
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

    const logTry = async (label: string, fn: () => Promise<any>) => {
      try {
        console.log("[CHAT WRITE] start:", label);
        const res = await fn();
        console.log("[CHAT WRITE] ok   :", label);
        return res;
      } catch (e) {
        console.error("[CHAT WRITE] FAIL :", label, e);
        return null;
      }
    };

    // 1) Ensure room + memberships (step-by-step for rules)
    const myMemberPath = `chats/${cid}/members/${me.uid}`;
    const peerMemberPath = `chats/${cid}/members/${peer.id}`;
    const lastMessagePath = `chats/${cid}/lastMessage`;

    await logTry(`SET ${myMemberPath} = true`, () =>
      set(ref(db, myMemberPath), true)
    );

    await logTry(`SET ${peerMemberPath} = true`, () =>
      set(ref(db, peerMemberPath), true)
    );

    await logTry(`SET ${lastMessagePath} = {}`, () =>
      set(ref(db, lastMessagePath), {})
    );

    // 2) Per-user chat previews
    await logTry(
      `UPDATE userChats/${me.uid}/${cid} = {peerId:${peer.id}}`,
      () => update(ref(db, `userChats/${me.uid}/${cid}`), { peerId: peer.id })
    );
    await logTry(
      `UPDATE userChats/${peer.id}/${cid} = {peerId:${me.uid}}`,
      () => update(ref(db, `userChats/${peer.id}/${cid}`), { peerId: me.uid })
    );

    setSelectedPeer(peer);
    setChatId(cid);
    setIsOpen(true);
  };

  const sendMessage = async () => {
    if (!me || !chatId || !selectedPeer) return;
    const text = input.trim();
    if (!text) return;

    try {
      // 1) Write the chat message
      const msgRef = push(ref(db, `chats/${chatId}/messages`));
      await set(msgRef, { from: me.uid, text, at: serverTimestamp() });

      // 2) Update lastMessage + chat previews
      const last = { text, at: Date.now(), from: me.uid };
      await update(ref(db, `chats/${chatId}`), { lastMessage: last });

      await update(ref(db, `userChats/${me.uid}/${chatId}`), {
        lastMessage: last,
      });

      try {
        await update(ref(db, `userChats/${selectedPeer.id}/${chatId}`), {
          lastMessage: last,
        });
      } catch (e) {
        console.warn("Failed updating peer lastMessage (non-fatal):", e);
      }

      // 3) Send the notification to the recipient (tag as 'chat')
      try {
        const preview =
          text.length > 120 ? text.slice(0, 120).trimEnd() + "…" : text;

        await NotificationService.sendNotification(selectedPeer.id, {
          title: "New Message",
          message: `${myDisplayName}: ${preview}`,
          type: "info",
          actionUrl: `/chat/${chatId}`,
          actionText: "Reply",
          source: "chat",
        });
      } catch (e) {
        console.warn("Failed to send notification (non-fatal):", e);
      }

      setInput("");
    } catch (e) {
      console.error("Failed sending message:", e);
    }
  };

  if (!me) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative mb-25"
        aria-label={isOpen ? "Close chat" : "Open chat"}
        title={isOpen ? "Close chat" : "Open chat"}
      >
        <div className="relative">
          <div className="absolute inset-0 bg-red-900 rounded-full animate-ping opacity-20"></div>
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-red-800 to-red-900 hover:from-red-700 hover:to-red-800 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center group-hover:scale-110 group-active:scale-95">
            <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
        </div>
      </button>

      {isOpen && (
        <div className="w-[280px] sm:w-[300px] md:w-[320px] max-w-[90vw] h-[350px] sm:h-[380px] md:h-[400px] bg-white border rounded-lg shadow-xl flex flex-col">
          {/* Header */}
          <div className="h-8 sm:h-10 px-2 sm:px-3 border-b flex items-center justify-between bg-gradient-to-r from-red-600 to-red-700 text-white rounded-t-lg">
            <div className="font-semibold text-xs flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
              Messages
            </div>
            {selectedPeer ? (
              <button
                className="text-xs text-red-100 hover:text-white bg-white/20 hover:bg-white/30 px-1.5 py-0.5 rounded transition-all duration-200"
                onClick={() => setSelectedPeer(null)}
              >
                ← Back
              </button>
            ) : (
              <button
                className="text-xs text-red-100 hover:text-white bg-white/20 hover:bg-white/30 px-1.5 py-0.5 rounded transition-all duration-200"
                onClick={() => setIsOpen(false)}
              >
                ✕ Close
              </button>
            )}
          </div>

          {/* Body */}
          {!selectedPeer ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search */}
              <div className="p-2 border-b bg-gray-50">
                <div className="relative">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search users…"
                    className="w-full text-xs outline-none border text-black border-gray-300 focus:border-red-500 focus:ring-1 focus:ring-red-200 rounded px-2 py-1.5 pl-6 transition-all duration-200"
                  />
                  <div className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs">
                    🔍
                  </div>
                </div>
              </div>

              {/* Recents */}
              <div className="px-2 pt-1.5 pb-1 text-[9px] uppercase text-gray-500 font-semibold tracking-wider bg-gray-50 border-b">
                Recent Conversations
              </div>
              <div className="overflow-auto flex-1">
                {recents.length === 0 && (
                  <div className="px-2 py-3 text-center">
                    <div className="text-xl mb-1">💬</div>
                    <div className="text-xs text-gray-500 font-medium">
                      No recent chats
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      Start a conversation below
                    </div>
                  </div>
                )}
                {recents.map((c) => {
                  const peer = users.find((u) => u.id === c.peerId);
                  if (!peer) return null;
                  return (
                    <button
                      key={c.chatId}
                      onClick={() => openChatWith(peer)}
                      className="w-full px-2 py-2 hover:bg-red-50 active:bg-red-100 flex items-center gap-2 border-b border-gray-100 transition-all duration-200 group"
                    >
                      <div className="relative">
                        <Avatar user={peer} size={24} />
                        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-400 border border-white rounded-full"></div>
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-xs font-semibold leading-tight text-gray-900 group-hover:text-red-700 transition-colors truncate">
                          {fullName(peer)}
                        </div>
                        <div className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">
                          {c.lastMessage?.text || "No messages yet"}
                        </div>
                        <div className="text-[9px] text-gray-400 mt-0.5">
                          {c.lastMessage?.at
                            ? new Date(c.lastMessage.at).toLocaleTimeString(
                                [],
                                { hour: "2-digit", minute: "2-digit" }
                              )
                            : ""}
                        </div>
                      </div>
                      <div className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        →
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* People */}
              <div className="px-2 pt-1.5 pb-1 text-[9px] uppercase text-gray-500 font-semibold tracking-wider bg-gray-50 border-t border-b">
                All Users
              </div>
              <div className="overflow-auto flex-1">
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => openChatWith(u)}
                    className="w-full px-2 py-2 hover:bg-blue-50 active:bg-blue-100 flex items-center gap-2 border-b border-gray-100 transition-all duration-200 group"
                  >
                    <div className="relative">
                      <Avatar user={u} size={22} />
                      <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-gray-400 border border-white rounded-full"></div>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-xs font-semibold leading-tight text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                        {fullName(u)}
                      </div>
                      <div className="text-[9px] text-gray-500 uppercase tracking-wide mt-0.5">
                        {u.role || "User"}
                      </div>
                    </div>
                    <div className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      💬
                    </div>
                  </button>
                ))}
                {searchResults.length === 0 && (
                  <div className="px-2 py-3 text-center">
                    <div className="text-xl mb-1">🔍</div>
                    <div className="text-xs text-gray-500 font-medium">
                      No matches found
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      Try a different search term
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Conversation view
            <div className="flex-1 flex flex-col">
              <div className="h-9 px-2 border-b flex items-center gap-2 bg-gradient-to-r from-gray-50 to-white">
                <Avatar user={selectedPeer} size={24} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold leading-tight text-gray-900 truncate">
                    {fullName(selectedPeer)}
                  </div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-wide">
                    {selectedPeer.role} • Online
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-[9px] text-gray-500">Active</span>
                </div>
              </div>

              <div className="flex-1 overflow-auto px-2 py-2 bg-gradient-to-b from-gray-50 to-white space-y-2">
                {messages.length === 0 && (
                  <div className="text-center py-4">
                    <div className="text-2xl mb-2">👋</div>
                    <div className="text-xs text-gray-500 font-medium">
                      Start your conversation
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      Send a message to {fullName(selectedPeer)}
                    </div>
                  </div>
                )}
                {messages.map((m: any, idx) => {
                  const mine = m.from === me?.uid;
                  return (
                    <div
                      key={idx}
                      className={`w-full flex ${
                        mine ? "justify-end" : "justify-start"
                      } mb-1.5`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl px-2 py-1.5 text-xs shadow-md ${
                          mine
                            ? "bg-gradient-to-r from-red-600 to-red-700 text-white"
                            : "bg-white border border-gray-200 text-gray-800"
                        } transition-transform duration-200`}
                      >
                        <div className="whitespace-pre-wrap break-words leading-relaxed">
                          {m.text}
                        </div>
                        <div
                          className={`text-[9px] mt-1 ${
                            mine ? "text-red-100" : "text-gray-400"
                          }`}
                        >
                          {new Date(
                            (m.at as number) || Date.now()
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="border-t bg-white p-1.5 flex gap-1.5">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && sendMessage()
                  }
                  placeholder="Write a message…"
                  className="flex-1 rounded-lg border text-black border-gray-300 focus:border-red-500 focus:ring-1 focus:ring-red-200 px-2 py-1.5 text-xs outline-none transition-all duration-200 resize-none"
                  style={{ minHeight: "28px" }}
                />
                <button
                  onClick={sendMessage}
                  disabled={input.trim() === ""}
                  className="rounded-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-300 disabled:to-gray-400 text-white px-2 py-1.5 text-xs font-medium disabled:opacity-60 transition-all duration-200 hover:shadow-lg active:scale-95 min-w-[45px]"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatFloating;
