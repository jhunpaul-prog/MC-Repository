import React, { useEffect, useMemo, useRef, useState } from "react";
import { getAuth } from "firebase/auth";
import {
  ref,
  onValue,
  get,
  set,
  push,
  serverTimestamp,
  update,
} from "firebase/database";
import { db } from "../../../Backend/firebase"; // adjust path
import { FiSearch } from "react-icons/fi";

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

type Message = {
  from: string;
  text: string;
  at: number | object;
};

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

const ChatMessageBubble: React.FC<{ msg: Message; mine: boolean }> = ({
  msg,
  mine,
}) => {
  return (
    <div
      className={`w-full flex ${mine ? "justify-end" : "justify-start"} mb-2`}
    >
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow
          ${mine ? "bg-red-600 text-white" : "bg-white border text-gray-900"}`}
      >
        <div className="whitespace-pre-wrap break-words">{msg.text}</div>
      </div>
    </div>
  );
};

const ChatRoom: React.FC = () => {
  const auth = getAuth();
  const me = auth.currentUser;
  const [meRole, setMeRole] = useState<string>("");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [selectedPeer, setSelectedPeer] = useState<UserRow | null>(null);

  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [myChats, setMyChats] = useState<
    {
      chatId: string;
      peerId: string;
      lastMessage?: { text?: string; at?: number; from?: string };
    }[]
  >([]);

  // force readable base color for whole page (prevents inherited white text)
  // and set explicit backgrounds to match your mock
  return (
    <div className="w-full h-screen grid grid-cols-12 bg-white text-gray-900">
      {/* LEFT: conversations & people */}
      <aside className="col-span-3 border-r overflow-hidden flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2">
            <FiSearch className="text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users…"
              className="w-full text-sm outline-none placeholder:text-gray-400 text-gray-900 bg-transparent"
            />
          </div>
        </div>

        <div className="px-4 py-2 text-xs uppercase text-gray-500">Recent</div>
        <div className="overflow-auto">
          {myChats.map((c) => {
            const peer = users.find((u) => u.id === c.peerId) || null;
            const title = peer ? fullName(peer) : "Conversation";
            return (
              <button
                key={c.chatId}
                onClick={() => peer && openChatWith(peer)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b"
              >
                <div className="text-sm font-medium text-gray-900">{title}</div>
                <div className="text-xs text-gray-500 line-clamp-1">
                  {c.lastMessage?.text || "No messages"}
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-4 py-2 text-xs uppercase text-gray-500 border-t">
          People
        </div>
        <PeopleList
          meId={me?.uid || ""}
          meRole={meRole}
          users={users}
          query={query}
          onOpen={openChatWith}
        />
      </aside>

      {/* CENTER: chat */}
      <main className="col-span-6 flex flex-col">
        <div className="h-16 border-b flex items-center px-5 bg-white">
          {selectedPeer ? (
            <>
              <Avatar user={selectedPeer} size={36} />
              <div className="ml-3">
                <div className="text-sm font-semibold text-gray-900">
                  {fullName(selectedPeer)}
                </div>
                <div className="text-xs text-gray-500">{selectedPeer.role}</div>
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500">
              Select a person to start chatting
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 bg-gray-50">
          {messages.map((m, idx) => (
            <ChatMessageBubble key={idx} msg={m} mine={m.from === me?.uid} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="border-t p-3 flex gap-2 bg-white">
          <input
            disabled={!selectedPeer}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={
              selectedPeer ? "Write a message…" : "Pick a conversation…"
            }
            className="flex-1 rounded-xl border px-3 py-2 text-sm placeholder:text-gray-400 text-gray-900 disabled:opacity-60"
          />
          <button
            onClick={sendMessage}
            disabled={!selectedPeer || input.trim() === ""}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </main>

      {/* RIGHT: details */}
      <aside className="col-span-3 border-l p-5 bg-white">
        {selectedPeer ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar user={selectedPeer} size={64} />
              <div>
                <div className="font-semibold text-gray-900">
                  {fullName(selectedPeer)}
                </div>
                <div className="text-sm text-gray-600">
                  {selectedPeer.email}
                </div>
                <div className="text-xs mt-1 inline-flex px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                  {selectedPeer.role || "User"}
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-700">
              Status:{" "}
              <span className="font-medium">{selectedPeer.status || "—"}</span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">User details</div>
        )}
      </aside>
    </div>
  );

  // ---- side effects & handlers below ----

  function useInit() {
    // role
    useEffect(() => {
      if (!me) return;
      const roleRef = ref(db, `users/${me.uid}/role`);
      const unsub = onValue(roleRef, (snap) => setMeRole(snap.val() || ""));
      return () => unsub();
    }, [me]);

    // my chats
    useEffect(() => {
      if (!me) return;
      const myChatsRef = ref(db, `userChats/${me.uid}`);
      const unsub = onValue(myChatsRef, (snap) => {
        const val = snap.val() || {};
        const list = Object.entries(val).map(([cid, data]: any) => ({
          chatId: cid,
          peerId: data.peerId,
          lastMessage: data.lastMessage || undefined,
        }));
        list.sort(
          (a: any, b: any) =>
            (b.lastMessage?.at || 0) - (a.lastMessage?.at || 0)
        );
        setMyChats(list);
      });
      return () => unsub();
    }, [me]);

    // users (role-aware)
    useEffect(() => {
      const usersRef = ref(db, "users");
      const unsub = onValue(usersRef, (snap) => {
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

    // messages feed
    useEffect(() => {
      if (!chatId) return;
      const msgsRef = ref(db, `chats/${chatId}/messages`);
      const unsub = onValue(msgsRef, (snap) => {
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
  }
  // run init hooks
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useInit();

  async function openChatWith(peer: UserRow) {
    if (!me) return;
    const cid = stableChatId(me.uid, peer.id);
    const chatRef = ref(db, `chats/${cid}`);
    const snap = await get(chatRef);
    if (!snap.exists()) {
      await set(chatRef, {
        members: { [me.uid]: true, [peer.id]: true },
        lastMessage: {},
      });
    }
    await update(ref(db, `userChats/${me.uid}/${cid}`), { peerId: peer.id });
    await update(ref(db, `userChats/${peer.id}/${cid}`), { peerId: me.uid });
    setSelectedPeer(peer);
    setChatId(cid);
  }

  async function sendMessage() {
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
  }
};

// separate list to keep main readable
const PeopleList: React.FC<{
  meId: string;
  meRole: string;
  users: UserRow[];
  query: string;
  onOpen: (u: UserRow) => void;
}> = ({ users, query, onOpen }) => {
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return users;
    return users.filter((u) => {
      const name = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
      return (
        name.includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q)
      );
    });
  }, [users, q]);

  return (
    <div className="overflow-auto">
      {results.map((u) => (
        <button
          key={u.id}
          onClick={() => onOpen(u)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b"
        >
          <Avatar user={u} />
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-gray-900">
              {fullName(u)}
            </div>
            <div className="text-xs text-gray-500">{u.role || "User"}</div>
          </div>
        </button>
      ))}
      {results.length === 0 && (
        <div className="px-4 py-6 text-sm text-gray-500">No matches</div>
      )}
    </div>
  );
};

export default ChatRoom;
