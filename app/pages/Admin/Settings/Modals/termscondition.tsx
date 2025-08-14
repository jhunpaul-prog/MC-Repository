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
import Heading from "@tiptap/extension-heading";
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

const TermsConditions: React.FC = () => {
  const [termsList, setTermsList] = useState<TermsDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("Terms & Conditions");
  const [version, setVersion] = useState("v1.0");
  const [effectiveDate, setEffectiveDate] = useState<string>("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  const editorRef = useRef<HTMLDivElement | null>(null);

  const editor = useEditor({
    extensions: [
      // ✅ StarterKit already includes paragraph, lists, blockquote, codeBlock, horizontalRule, etc.
      StarterKit as AnyExtension,
      Heading.configure({ levels: [1, 2, 3] }) as AnyExtension,
      Link.configure({ openOnClick: false }) as AnyExtension,
      Highlight as AnyExtension,
      PageBreak as AnyExtension, // our printable <hr class="page-break" />
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
  const human = (ms: number) => format(new Date(ms), "MMM d, yyyy h:mm a");

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
  };

  const startAdd = () => {
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
    const restored = { ...item.snapshot, lastModified: stamp };
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

  /* ------------------ UI ------------------ */
  return (
    <div className="p-6 text-black max-w-[1200px] mx-auto overflow-y-auto h-[90vh]">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-[#8B0000]">
          Terms & Conditions
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" color="gray" onClick={loadHistory}>
            View History
          </Button>
          <Button color="red" onClick={startAdd}>
            Add New Version
          </Button>
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-4 flex items-center gap-2">
        <FaClock className="opacity-70" />
        {current?.lastModified
          ? `Updated ${human(current.lastModified)}`
          : "No version found"}
        {current?.version ? ` • ${current?.version}` : ""}
        {current?.effectiveDate ? ` • Effective ${current.effectiveDate}` : ""}
      </p>

      {/* Editor Card */}
      {showEditor && editor && (
        <Paper
          ref={editorRef}
          withBorder
          shadow="sm"
          className="bg-white rounded-2xl border-gray-200 overflow-hidden"
        >
          {/* Top Info Bar */}
          <div className="px-5 pt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {editingId
                  ? "Editing existing version"
                  : "Creating new version"}
              </div>
              <Badge
                color={mode === "edit" ? "yellow" : "green"}
                variant="filled"
              >
                {mode === "edit" ? "Draft" : "Preview"}
              </Badge>
            </div>

            {/* Meta inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              <TextInput
                label="Title"
                value={title}
                required
                placeholder="Terms & Conditions"
                onChange={(e) => setTitle(e.currentTarget.value)}
              />
              <TextInput
                label="Version"
                value={version}
                placeholder="e.g., v2.0"
                onChange={(e) => setVersion(e.currentTarget.value)}
              />
              <TextInput
                label="Effective Date"
                value={effectiveDate}
                placeholder="YYYY-MM-DD"
                onChange={(e) => setEffectiveDate(e.currentTarget.value)}
              />
            </div>

            {/* Mode + counters */}
            <div className="flex items-center justify-between mt-3">
              <SegmentedControl
                value={mode}
                onChange={(v) => setMode(v as "edit" | "preview")}
                data={[
                  {
                    label: (
                      <div className="flex items-center gap-2">
                        <FaPen /> Edit
                      </div>
                    ),
                    value: "edit",
                  },
                  {
                    label: (
                      <div className="flex items-center gap-2">
                        <FaEye /> Preview
                      </div>
                    ),
                    value: "preview",
                  },
                ]}
              />
              <div className="text-xs text-gray-500">
                {wordCount} words • {charCount} characters
              </div>
            </div>

            {/* ELEMENTS BAR */}
            <div className="mt-4 border border-gray-200 rounded-lg p-2 bg-gray-50">
              <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-2">
                <FaFileAlt /> Elements
              </div>
              <div className="flex flex-wrap gap-2">
                <Tooltip label="Heading 1" withArrow>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => insertHeading(1)}
                    disabled={
                      !editor ||
                      !editor
                        .can()
                        .chain()
                        .focus()
                        .toggleHeading({ level: 1 })
                        .run()
                    }
                  >
                    <FaHeading className="mr-1" /> H1
                  </Button>
                </Tooltip>
                <Tooltip label="Heading 2" withArrow>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => insertHeading(2)}
                    disabled={
                      !editor ||
                      !editor
                        .can()
                        .chain()
                        .focus()
                        .toggleHeading({ level: 2 })
                        .run()
                    }
                  >
                    <FaHeading className="mr-1" /> H2
                  </Button>
                </Tooltip>
                <Tooltip label="Heading 3" withArrow>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => insertHeading(3)}
                    disabled={
                      !editor ||
                      !editor
                        .can()
                        .chain()
                        .focus()
                        .toggleHeading({ level: 3 })
                        .run()
                    }
                  >
                    <FaHeading className="mr-1" /> H3
                  </Button>
                </Tooltip>
                <Tooltip label="Paragraph" withArrow>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={insertParagraph}
                    disabled={
                      !editor ||
                      !editor.can().chain().focus().setParagraph().run()
                    }
                  >
                    <FaParagraph className="mr-1" /> Paragraph
                  </Button>
                </Tooltip>
                <Tooltip label="Bulleted list" withArrow>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={insertBullet}
                    disabled={
                      !editor ||
                      !editor.can().chain().focus().toggleBulletList().run()
                    }
                  >
                    <FaListUl className="mr-1" /> Bulleted
                  </Button>
                </Tooltip>
                <Tooltip label="Numbered list" withArrow>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={insertNumbered}
                    disabled={
                      !editor ||
                      !editor.can().chain().focus().toggleOrderedList().run()
                    }
                  >
                    <FaListOl className="mr-1" /> Numbered
                  </Button>
                </Tooltip>
                <Tooltip label="Blockquote" withArrow>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={insertQuote}
                    disabled={
                      !editor ||
                      !editor.can().chain().focus().toggleBlockquote().run()
                    }
                  >
                    <FaQuoteRight className="mr-1" /> Quote
                  </Button>
                </Tooltip>
                <Tooltip label="Code block" withArrow>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={insertCodeBlock}
                    disabled={
                      !editor ||
                      !editor.can().chain().focus().toggleCodeBlock().run()
                    }
                  >
                    <FaCode className="mr-1" /> Code
                  </Button>
                </Tooltip>
                <Tooltip label="Divider" withArrow>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={insertDivider}
                    disabled={
                      !editor ||
                      !editor.can().chain().focus().setHorizontalRule().run()
                    }
                  >
                    <FaMinus className="mr-1" /> Divider
                  </Button>
                </Tooltip>
                <Tooltip label="Insert Page Break" withArrow>
                  <Button
                    size="xs"
                    variant="filled"
                    color="red"
                    onClick={insertPageBreak}
                  >
                    <FaPlusSquare className="mr-1" /> Add Page
                  </Button>
                </Tooltip>

                {/* Optional quick templates */}
                <Tooltip label="Insert H2 + paragraph" withArrow>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={insertTitleBlock}
                  >
                    Title block
                  </Button>
                </Tooltip>
                <Tooltip label="Insert clause (H3 + bullets)" withArrow>
                  <Button size="xs" variant="outline" onClick={insertClause}>
                    Clause
                  </Button>
                </Tooltip>
              </div>
            </div>
          </div>

          <Divider className="my-4" />

          {/* Editor / Preview Pane */}
          <div className="px-5 pb-5">
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

                <RichTextEditor.Content className="min-h-[360px] max-h-[60vh] overflow-auto rounded-lg border border-gray-200 p-4 text-black bg-white" />
              </RichTextEditor>
            ) : (
              <div className="prose max-w-none border border-gray-200 rounded-lg p-4 bg-gray-50 min-h-[360px] max-h-[60vh] overflow-auto">
                <div
                  className="text-gray-800"
                  dangerouslySetInnerHTML={{
                    __html: contentHtml || "<p><i>No content</i></p>",
                  }}
                />
              </div>
            )}
          </div>

          <Divider className="mt-0" />

          {/* Sticky Action Bar */}
          <div className="sticky bottom-0 bg-white/90 backdrop-blur px-5 py-3 border-t border-gray-200 flex items-center justify-between">
            <Group gap="xs">
              <Tooltip label="Clear editor" withArrow>
                <Button
                  variant="subtle"
                  color="gray"
                  leftSection={<FaBroom />}
                  onClick={() => editor?.commands.clearContent()}
                >
                  Clear
                </Button>
              </Tooltip>
            </Group>
            <Group gap="sm">
              <Button variant="default" onClick={resetForm}>
                Cancel
              </Button>
              <Button color="red" onClick={save}>
                {editingId ? "Update Version" : "Publish Version"}
              </Button>
            </Group>
          </div>
        </Paper>
      )}

      {/* Current list */}
      {!showEditor && !historyMode && (
        <div className="space-y-4 max-w-3xl mx-auto mt-4">
          {loading && <p className="text-gray-500">Loading…</p>}
          {!loading && termsList.length === 0 && (
            <p className="text-gray-500">No Terms & Conditions found.</p>
          )}

          {termsList.map((doc, idx) => (
            <Paper key={doc.id || idx} withBorder shadow="xs" className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="font-semibold">
                    {doc.title || "Terms & Conditions"}
                  </div>
                  <div className="text-gray-500 text-sm">
                    {doc.version ? `Version: ${doc.version}` : "—"}
                    {doc.version && (doc.effectiveDate || doc.lastModified)
                      ? " • "
                      : ""}
                    {doc.effectiveDate ? `Effective: ${doc.effectiveDate}` : ""}
                    {!doc.effectiveDate && doc.lastModified
                      ? `Updated: ${human(doc.lastModified)}`
                      : ""}
                  </div>
                </div>
                {idx === 0 && <Badge color="green">Current</Badge>}
              </div>

              <div
                className="text-black mb-4 prose max-w-none"
                dangerouslySetInnerHTML={{ __html: doc.content }}
              />

              <div className="flex gap-3 justify-end">
                <Tooltip label="Edit this version" withArrow>
                  <button
                    onClick={() => startEdit(doc)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <FaEdit />
                  </button>
                </Tooltip>
                <Tooltip label="Delete this version" withArrow>
                  <button
                    onClick={() => deleteDoc(doc)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <FaTrash />
                  </button>
                </Tooltip>
              </div>
            </Paper>
          ))}
        </div>
      )}

      {/* History */}
      {historyMode && (
        <div className="max-w-3xl mx-auto space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-black">
              Terms & Conditions — History
            </h2>
            <Button variant="outline" onClick={() => setHistoryMode(false)}>
              Back to Current
            </Button>
          </div>

          {historyList.length === 0 && (
            <p className="text-gray-500 mt-2">No history yet.</p>
          )}

          {historyList.map((item) => (
            <Paper key={item.id} withBorder shadow="xs" className="p-4">
              <p className="text-sm text-gray-600">
                {item.humanDate} — {item.by} ({item.action})
              </p>
              <div className="text-gray-700 text-sm mb-2">
                <span className="font-medium">
                  {item.snapshot.title || "Terms & Conditions"}
                </span>
                {" • "}
                {item.snapshot.version || "—"}
                {item.snapshot.effectiveDate
                  ? ` • Effective ${item.snapshot.effectiveDate}`
                  : ""}
              </div>
              <div
                className="text-black mt-2 prose max-w-none"
                dangerouslySetInnerHTML={{
                  __html: item.snapshot.content || "",
                }}
              />
              <div className="flex justify-end mt-2">
                <Button
                  color="green"
                  variant="light"
                  leftSection={<FaUndo />}
                  onClick={() => restore(item)}
                >
                  Restore as Current
                </Button>
              </div>
            </Paper>
          ))}
        </div>
      )}
    </div>
  );
};

export default TermsConditions;
