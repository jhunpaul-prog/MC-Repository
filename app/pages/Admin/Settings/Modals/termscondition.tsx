import React, { useEffect, useMemo, useRef, useState } from "react";
import { ref, onValue, push, remove, set, get } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { format } from "date-fns";
import {
  FaEdit,
  FaTrash,
  FaUndo,
  FaClock,
  FaEye,
  FaPen,
  FaBroom,
  FaHeading,
  FaQuoteRight,
  FaListUl,
  FaListOl,
  FaMinus,
  FaFileAlt,
  FaPlusSquare,
  FaCode,
  FaParagraph,
  FaHistory,
  FaPlus,
  FaSave,
  FaTimes,
  FaCheckCircle,
  FaExpand,
  FaCompress,
} from "react-icons/fa";
import {
  Button,
  TextInput,
  Badge,
  SegmentedControl,
  Divider,
  Tooltip,
  Paper,
  Group,
} from "@mantine/core";

import { RichTextEditor } from "@mantine/tiptap";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import HeadingExt from "@tiptap/extension-heading";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import type { AnyExtension } from "@tiptap/react";
import type { CommandProps } from "@tiptap/core";

/* ------------------ Custom PageBreak extension ------------------ */
const PageBreak = HorizontalRule.extend({
  name: "pageBreak",
  renderHTML() {
    return ["hr", { class: "page-break" }];
  },
  parseHTML() {
    return [{ tag: "hr.page-break" }];
  },
  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ commands }: CommandProps) =>
          commands.insertContent({ type: this.name }),
    };
  },
});

// 👇 Teach TypeScript about commands we call (provided by StarterKit) + our pageBreak
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    paragraph: {
      setParagraph: () => ReturnType;
    };
    blockquote: {
      setBlockquote: () => ReturnType;
      toggleBlockquote: () => ReturnType;
      unsetBlockquote: () => ReturnType;
    };
    bulletList: {
      toggleBulletList: () => ReturnType;
    };
    orderedList: {
      toggleOrderedList: () => ReturnType;
    };
    codeBlock: {
      setCodeBlock: (
        attributes?: { language: string } | undefined
      ) => ReturnType;
      toggleCodeBlock: (
        attributes?: { language: string } | undefined
      ) => ReturnType;
    };
    horizontalRule: {
      setHorizontalRule: () => ReturnType;
    };
    pageBreak: {
      setPageBreak: () => ReturnType;
    };
  }
}

/* ------------------ Types ------------------ */
type TermsDoc = {
  id?: string;
  title?: string;
  version?: string;
  effectiveDate?: string;
  content: string;
  createdAt?: number;
  lastModified?: number;
};

type HistoryItem = {
  id: string;
  action: "Added" | "Edited" | "Deleted" | "Restored" | "Archived";
  by: string;
  at: number;
  humanDate: string;
  snapshot: TermsDoc;
};

const NODE_CURRENT = "Terms & Conditions";
const NODE_HISTORY = "History/Terms & Conditions";

const human = (ms: number) => format(new Date(ms), "MMM d, yyyy h:mm a");

const TermsConditions: React.FC = () => {
  const [termsList, setTermsList] = useState<TermsDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("Terms & Conditions");
  const [version, setVersion] = useState("v1.0");
  const [effectiveDate, setEffectiveDate] = useState<string>("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const editorRef = useRef<HTMLDivElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit as AnyExtension,
      HeadingExt.configure({ levels: [1, 2, 3] }) as AnyExtension,
      Link.configure({ openOnClick: false }) as AnyExtension,
      Highlight as AnyExtension,
      PageBreak as AnyExtension,
    ],
    content: "",
  });

  const [historyMode, setHistoryMode] = useState(false);
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const termsRef = ref(db, NODE_CURRENT);
    return onValue(termsRef, (snap) => {
      const raw = snap.val() || {};
      const arr: TermsDoc[] = Object.entries(raw).map(([id, v]: any) => ({
        id,
        content: v.content || "",
        title: v.title,
        version: v.version,
        effectiveDate: v.effectiveDate,
        createdAt: v.createdAt,
        lastModified: v.lastModified,
      }));
      arr.sort((a, b) => {
        const ak = (a.lastModified ?? a.createdAt ?? 0) as number;
        const bk = (b.lastModified ?? b.createdAt ?? 0) as number;
        return bk - ak;
      });
      setTermsList(arr);
      setLoading(false);
    });
  }, []);

  const current = useMemo(() => termsList[0], [termsList]);

  useEffect(() => {
    if (showEditor && editorRef.current) {
      editorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (editor && showEditor && mode === "edit") editor.commands.focus("end");
  }, [showEditor, editor, mode]);

  const nowMs = () => Date.now();

  const logHistory = async (
    action: HistoryItem["action"],
    snapshot: TermsDoc
  ) => {
    await push(ref(db, NODE_HISTORY), {
      action,
      by: "Admin",
      at: nowMs(),
      humanDate: human(nowMs()),
      snapshot,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle("Terms & Conditions");
    setVersion("v1.0");
    setEffectiveDate("");
    editor?.commands.clearContent();
    setMode("edit");
    setShowEditor(false);
    setIsFullscreen(false);
  };

  const startAdd = () => {
    setHistoryMode(false);
    setEditingId(null);
    const last = current?.version?.match(/\d+(\.\d+)?/);
    const candidate =
      last && current?.version?.startsWith("v")
        ? "v" + (parseFloat(last[0]) + 1).toString().replace(/\.0$/, "")
        : "v1.0";
    setVersion(candidate);
    setTitle("Terms & Conditions");
    setEffectiveDate("");
    editor?.commands.setContent("");
    setMode("edit");
    setShowEditor(true);
  };

  const startEdit = (doc: TermsDoc) => {
    setHistoryMode(false);
    setEditingId(doc.id || null);
    setTitle(doc.title || "Terms & Conditions");
    setVersion(doc.version || "v1.0");
    setEffectiveDate(doc.effectiveDate || "");
    editor?.commands.setContent(doc.content || "");
    setMode("edit");
    setShowEditor(true);
  };

  const save = async () => {
    const html = (editor?.getHTML() || "").trim();
    if (!title.trim()) return alert("Title is required.");
    if (!html) return alert("Content cannot be empty.");

    const stamp = nowMs();
    const payload: TermsDoc = {
      title: title.trim(),
      version: version.trim() || "v1.0",
      effectiveDate: effectiveDate.trim(),
      content: html,
      createdAt: editingId ? current?.createdAt ?? stamp : stamp,
      lastModified: stamp,
    };

    const nodeRef = ref(db, NODE_CURRENT);

    if (editingId) {
      await set(ref(db, `${NODE_CURRENT}/${editingId}`), payload);
      await logHistory("Edited", { ...(payload as TermsDoc), id: editingId });
    } else {
      if (current) await logHistory("Archived", current);
      const snap = await get(nodeRef);
      if (snap.exists()) {
        const keys = Object.keys(snap.val() || {});
        await Promise.all(
          keys.map((k) => remove(ref(db, `${NODE_CURRENT}/${k}`)))
        );
      }
      const newRef = push(nodeRef);
      await set(newRef, payload);
      await logHistory("Added", {
        ...(payload as TermsDoc),
        id: newRef.key || undefined,
      });
    }

    resetForm();
  };

  const deleteDoc = async (doc: TermsDoc) => {
    if (!doc.id) return;
    if (!window.confirm("Delete this Terms & Conditions entry?")) return;
    await remove(ref(db, `${NODE_CURRENT}/${doc.id}`));
    await logHistory("Deleted", doc);
  };

  const loadHistory = () => {
    onValue(ref(db, NODE_HISTORY), (snap) => {
      const raw = snap.val() || {};
      const arr: HistoryItem[] = Object.entries(raw).map(([id, v]: any) => ({
        id,
        action: v.action,
        by: v.by,
        at: v.at,
        humanDate: v.humanDate,
        snapshot: v.snapshot,
      }));
      arr.sort((a, b) => b.at - a.at);
      setHistoryList(arr);
      setHistoryMode(true);
      setShowEditor(false);
    });
  };

  const restore = async (item: HistoryItem) => {
    if (
      !window.confirm("Restore this version as the current Terms & Conditions?")
    )
      return;

    const nodeRef = ref(db, NODE_CURRENT);
    const snap = await get(nodeRef);
    if (snap.exists()) {
      const keys = Object.keys(snap.val() || {});
      await Promise.all(
        keys.map((k) => remove(ref(db, `${NODE_CURRENT}/${k}`)))
      );
    }
    const newRef = push(nodeRef);
    const stamp = nowMs();
    const restored = { ...item.snapshot, lastModified: stamp } as TermsDoc;
    await set(newRef, restored);
    await logHistory("Restored", {
      ...(restored as TermsDoc),
      id: newRef.key || undefined,
    });
    alert("Version restored.");
    setHistoryMode(false);
  };

  // live metrics
  const contentHtml = editor?.getHTML() || "";
  const contentText = contentHtml
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = contentText ? contentText.split(" ").length : 0;
  const charCount = contentText.length;

  /* -------- ELEMENTS: insert/toggle helpers -------- */
  const insertHeading = (level: 1 | 2 | 3) =>
    editor?.chain().focus().toggleHeading({ level }).run();

  const insertParagraph = () => editor?.chain().focus().setParagraph().run();

  const insertBullet = () => editor?.chain().focus().toggleBulletList().run();

  const insertNumbered = () =>
    editor?.chain().focus().toggleOrderedList().run();

  const insertQuote = () => editor?.chain().focus().toggleBlockquote().run();

  const insertCodeBlock = () => editor?.chain().focus().toggleCodeBlock().run();

  const insertDivider = () => editor?.chain().focus().setHorizontalRule().run();

  const insertPageBreak = () =>
    editor?.chain().focus().setPageBreak().insertContent("<p></p>").run();

  /* -------- OPTIONAL: quick templates -------- */
  const insertTitleBlock = () =>
    editor
      ?.chain()
      .focus()
      .insertContent([
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Section Title" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Describe this section here…" }],
        },
      ])
      .run();

  const insertClause = () =>
    editor
      ?.chain()
      .focus()
      .insertContent([
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Clause" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "First bullet" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Second bullet" }],
                },
              ],
            },
          ],
        },
      ])
      .run();

  /* ------------------ UI (Modernized from Code 2, functionality from Code 1) ------------------ */
  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 ${
        isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
    >
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-800 to-red-900 flex items-center justify-center">
                <FaFileAlt className="text-white text-lg" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Terms & Conditions
                </h1>
                {current && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <FaCheckCircle className="mr-1" /> Current
                    </span>
                    <span className="text-gray-600">
                      {current.version || "—"} • Updated{" "}
                      {current?.lastModified
                        ? human(current.lastModified)
                        : current?.createdAt
                        ? human(current.createdAt)
                        : "—"}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadHistory}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-800 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-800"
              >
                <FaHistory className="mr-2" /> History
              </button>
              <button
                onClick={startAdd}
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-gradient-to-r from-red-800 to-red-900 hover:from-red-900 hover:to-red-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-800"
              >
                <FaPlus className="mr-2" /> New Version
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* EDITOR MODE */}
        {showEditor && editor && (
          <div
            className={`bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden ${
              isFullscreen ? "h-screen" : ""
            }`}
          >
            {/* Editor Header */}
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 text-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingId ? "Edit Version" : "Create New Version"}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {mode === "edit" ? "Editing mode" : "Preview mode"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        mode === "edit"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {mode === "edit" ? "Draft" : "Preview"}
                    </span>
                    <span className="text-xs text-gray-600">
                      {wordCount} words • {charCount} characters
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                    title={
                      isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                    }
                  >
                    {isFullscreen ? <FaCompress /> : <FaExpand />}
                  </button>
                  <button
                    onClick={resetForm}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                    title="Close editor"
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>

              {/* Meta inputs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <TextInput
                    value={title}
                    onChange={(e) => setTitle(e.currentTarget.value)}
                    placeholder="Terms & Conditions"
                    classNames={{
                      input:
                        "border-gray-300 focus:border-red-800 focus:ring-red-800 text-gray-900",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Version
                  </label>
                  <TextInput
                    value={version}
                    onChange={(e) => setVersion(e.currentTarget.value)}
                    placeholder="e.g., v2.0"
                    classNames={{
                      input:
                        "border-gray-300 focus:border-red-800 focus:ring-red-800 text-gray-900",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Effective Date
                  </label>
                  <TextInput
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.currentTarget.value)}
                    placeholder="YYYY-MM-DD"
                    classNames={{
                      input:
                        "border-gray-300 focus:border-red-800 focus:ring-red-800 text-gray-900",
                    }}
                  />
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="inline-flex rounded-md overflow-hidden border border-gray-300 bg-white min-w-[220px]">
                <button
                  type="button"
                  onClick={() => setMode("edit")}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors
      ${
        mode === "edit"
          ? "bg-red-800 text-white"
          : "text-gray-800 hover:bg-gray-50"
      }`}
                  aria-pressed={mode === "edit"}
                >
                  <FaPen /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => setMode("preview")}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors border-l border-gray-300
      ${
        mode === "preview"
          ? "bg-red-800 text-white"
          : "text-gray-800 hover:bg-gray-50"
      }`}
                  aria-pressed={mode === "preview"}
                >
                  <FaEye /> Preview
                </button>
              </div>
            </div>

            {/* Element Toolbar */}

            {/* Editor / Preview Pane */}
            <div className="px-6 pb-6" ref={editorRef}>
              {mode === "edit" ? (
                <RichTextEditor editor={editor}>
                  <RichTextEditor.Toolbar
                    sticky
                    stickyOffset={60}
                    className="z-10"
                  >
                    <RichTextEditor.ControlsGroup>
                      <RichTextEditor.Bold />
                      <RichTextEditor.Italic />
                      <RichTextEditor.Underline />
                      <RichTextEditor.Strikethrough />
                      <RichTextEditor.ClearFormatting />
                    </RichTextEditor.ControlsGroup>
                    <RichTextEditor.ControlsGroup>
                      <RichTextEditor.H1 />
                      <RichTextEditor.H2 />
                      <RichTextEditor.H3 />
                    </RichTextEditor.ControlsGroup>
                    <RichTextEditor.ControlsGroup>
                      <RichTextEditor.BulletList />
                      <RichTextEditor.OrderedList />
                      <RichTextEditor.Blockquote />
                    </RichTextEditor.ControlsGroup>
                    <RichTextEditor.ControlsGroup>
                      <RichTextEditor.Link />
                      <RichTextEditor.Code />
                      <RichTextEditor.Highlight />
                    </RichTextEditor.ControlsGroup>
                  </RichTextEditor.Toolbar>

                  <RichTextEditor.Content className="min-h-[360px] max-h-[60vh] overflow-auto rounded-lg border border-gray-300 p-4 text-gray-900 bg-white" />
                </RichTextEditor>
              ) : (
                <div className="prose max-w-none border border-gray-300 rounded-lg p-4 bg-white min-h-[360px] max-h-[60vh] overflow-auto text-gray-900">
                  <div
                    className="text-gray-900"
                    dangerouslySetInnerHTML={{
                      __html: contentHtml || "<p><i>No content</i></p>",
                    }}
                  />
                </div>
              )}
            </div>

            <Divider className="mt-0 border-gray-200" />

            {/* Sticky Action Bar */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <Group gap="xs">
                <Tooltip label="Clear editor" withArrow>
                  <Button
                    variant="subtle"
                    className="text-gray-800 hover:bg-gray-100"
                    leftSection={<FaBroom />}
                    onClick={() => editor?.commands.clearContent()}
                  >
                    Clear
                  </Button>
                </Tooltip>
              </Group>
              <Group gap="sm">
                <Button
                  variant="default"
                  className="border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                  onClick={resetForm}
                >
                  Cancel
                </Button>
                <Button
                  variant="filled"
                  className="bg-red-800 text-white border border-red-900 hover:bg-red-900"
                  leftSection={<FaSave />}
                  onClick={save}
                >
                  {editingId ? "Update Version" : "Publish Version"}
                </Button>
              </Group>
            </div>
          </div>
        )}

        {/* HISTORY MODE */}
        {historyMode && !showEditor && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Version History
                  </h3>
                  <p className="text-sm text-gray-600">
                    View and restore previous versions
                  </p>
                </div>
                <button
                  onClick={() => setHistoryMode(false)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-800 bg-white hover:bg-gray-50"
                >
                  <FaTimes className="mr-2" /> Close
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {historyList.length === 0 ? (
                <div className="text-center py-8">
                  <FaHistory className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No history yet
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Version history will appear here as you make changes.
                  </p>
                </div>
              ) : (
                historyList.map((item) => (
                  <div
                    key={item.id}
                    className="bg-gray-50 rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              item.action === "Added"
                                ? "bg-green-100 text-green-800"
                                : item.action === "Edited"
                                ? "bg-gray-200 text-gray-800"
                                : item.action === "Deleted"
                                ? "bg-red-100 text-red-800"
                                : item.action === "Restored"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {item.action}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {item.snapshot.title || "Terms & Conditions"}
                          </span>
                          <span className="text-sm text-gray-600">
                            {item.snapshot.version || "—"}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                          {item.humanDate} by {item.by}
                          {item.snapshot.effectiveDate && (
                            <span>
                              {" "}
                              • Effective {item.snapshot.effectiveDate}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 prose prose-sm max-w-none text-gray-700">
                          <div
                            dangerouslySetInnerHTML={{
                              __html:
                                (item.snapshot.content || "").substring(
                                  0,
                                  200
                                ) +
                                ((item.snapshot.content || "").length > 200
                                  ? "..."
                                  : ""),
                            }}
                          />
                        </div>
                      </div>
                      <div className="ml-4">
                        <button
                          onClick={() => restore(item)}
                          className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-white bg-gradient-to-r from-red-800 to-red-900 hover:from-red-900 hover:to-red-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-800"
                        >
                          <FaUndo className="mr-2" /> Restore
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* CURRENT LIST */}
        {!showEditor && !historyMode && (
          <div className="space-y-4">
            {loading && <p className="text-gray-700">Loading…</p>}
            {!loading && termsList.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <FaFileAlt className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Terms & Conditions Found
                </h3>
                <p className="text-gray-600 mb-6">
                  Get started by creating your first version of terms and
                  conditions.
                </p>
                <button
                  onClick={startAdd}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-gradient-to-r from-red-800 to-red-900 hover:from-red-900 hover:to-red-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-800"
                >
                  <FaPlus className="mr-2" /> Create First Version
                </button>
              </div>
            )}

            {termsList.map((doc, idx) => (
              <div
                key={doc.id || idx}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {doc.title || "Terms & Conditions"}
                        </h3>
                        {idx === 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <FaCheckCircle className="mr-1" /> Current
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                        {doc.version && (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Version:</span>
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                              {doc.version}
                            </span>
                          </div>
                        )}
                        {doc.effectiveDate && (
                          <div className="flex items-center gap-1">
                            <FaClock className="h-3 w-3" />
                            <span>Effective: {doc.effectiveDate}</span>
                          </div>
                        )}
                        {(doc.lastModified || doc.createdAt) && (
                          <div className="flex items-center gap-1">
                            <span>
                              Updated:{" "}
                              {human(doc.lastModified || doc.createdAt!)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div
                        className="prose prose-sm max-w-none text-gray-800"
                        dangerouslySetInnerHTML={{ __html: doc.content }}
                      />
                    </div>

                    <div className="flex items-center gap-2 ml-6">
                      <button
                        onClick={() => startEdit(doc)}
                        className="inline-flex items-center p-2 border border-gray-300 text-sm font-medium rounded-md text-gray-800 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-800"
                        title="Edit version"
                      >
                        <FaEdit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteDoc(doc)}
                        className="inline-flex items-center p-2 border border-red-300 text-sm font-medium rounded-md text-red-800 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-800"
                        title="Delete version"
                      >
                        <FaTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TermsConditions;
