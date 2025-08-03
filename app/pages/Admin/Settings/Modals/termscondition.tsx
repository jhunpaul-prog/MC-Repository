import React, { useEffect, useState } from "react";
import { ref, onValue, push, remove, set } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { format } from "date-fns";
import { FaEdit, FaTrash, FaTimes, FaUndo } from "react-icons/fa";
import { RichTextEditor } from "@mantine/tiptap";
import { useEditor } from "@tiptap/react";
import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import Code from "@tiptap/extension-code";
import { Button } from "@mantine/core";

interface Terms {
  id: string;
  content: string;
}

const TermsConditions: React.FC = () => {
  const [terms, setTerms] = useState<Terms[]>([]);
  const [editing, setEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [historyMode, setHistoryMode] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<any | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({}) as unknown as AnyExtension,
      LinkExtension.configure({ openOnClick: false }) as unknown as AnyExtension,
      Highlight as unknown as AnyExtension,
      Code as unknown as AnyExtension,
    ],
    content: "",
  });

  useEffect(() => {
    const termsRef = ref(db, "Terms & Conditions");
    return onValue(termsRef, (snapshot) => {
      const data = snapshot.val() || {};
      setTerms(
        Object.entries(data).map(([id, val]: any) => ({
          id,
          content: val.content,
        }))
      );
    });
  }, []);

  const logHistory = async (
    type: "Added" | "Edited" | "Deleted",
    contentText: string
  ) => {
    const timestamp = format(new Date(), "MMMM d, yyyy h:mm a");
    await push(ref(db, `History/Terms & Conditions/${type}`), {
      By: "Admin",
      Date: timestamp,
      Content: contentText,
    });
  };

  const handleSave = async () => {
    const html = editor?.getHTML().trim() || "";
    if (!html) return alert("Content cannot be empty");

    if (editing && currentId) {
      await set(ref(db, `Terms & Conditions/${currentId}`), { content: html });
      await logHistory("Edited", html);
    } else {
      await Promise.all(
        terms.map((t) => remove(ref(db, `Terms & Conditions/${t.id}`)))
      );
      const newRef = push(ref(db, "Terms & Conditions"));
      await set(newRef, { content: html });
      await logHistory("Added", html);
    }

    editor?.commands.clearContent();
    setEditing(false);
    setCurrentId(null);
    setShowEditor(false);
  };

  const handleDelete = async (id: string, contentText: string) => {
    if (!window.confirm("Are you sure you want to delete this term?")) return;
    await remove(ref(db, `Terms & Conditions/${id}`));
    await logHistory("Deleted", contentText);
  };

  const loadHistory = () => {
    const historyRef = ref(db, "History/Terms & Conditions");
    onValue(historyRef, (snapshot) => {
      const data = snapshot.val() || {};
      const flat: any[] = [];
      Object.entries(data).forEach(([type, recs]: any) => {
        Object.entries(recs).forEach(([key, entry]: any) => {
          flat.push({ id: key, type, ...entry });
        });
      });
      setHistoryList(flat);
      setHistoryMode(true);
    });
  };

  const handleRestore = async (content: string) => {
    if (!window.confirm("Restore this version as the current Terms & Conditions?")) return;
    await Promise.all(
      terms.map((t) => remove(ref(db, `Terms & Conditions/${t.id}`)))
    );
    const newRef = push(ref(db, "Terms & Conditions"));
    await set(newRef, { content });
    await logHistory("Added", content);
    alert("Version restored.");
    setHistoryMode(false);
  };

  return (
    <div className="p-6 text-black max-w-[1000px] mx-auto overflow-y-auto h-[90vh]">
      <h1 className="text-2xl font-bold text-[#8B0000] mb-6">Terms & Conditions</h1>

      <div className="max-w-3xl mx-auto mb-6">
        <div className="flex justify-end gap-4 mb-4">
          <Button color="gray" onClick={loadHistory}>
            View History
          </Button>
          <Button color="red" onClick={() => setShowEditor(true)}>
            Add New Terms
          </Button>
        </div>

        {showEditor && (
          <div className="relative border p-4 rounded shadow bg-gray-50 max-h-[500px] overflow-y-auto">
            <button
              onClick={() => {
                setShowEditor(false);
                editor?.commands.clearContent();
                setEditing(false);
              }}
              className="absolute top-2 right-2 text-gray-500 hover:text-red-700"
            >
              <FaTimes />
            </button>

            <RichTextEditor editor={editor}>
              <RichTextEditor.Toolbar sticky stickyOffset={60}>
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
              <RichTextEditor.Content className="min-h-[200px] text-black" />
            </RichTextEditor>

            <div className="flex justify-end text-black mt-4">
              <Button onClick={handleSave} color="red">
                {editing ? "Update" : "Add"} Terms
              </Button>
            </div>
          </div>
        )}
      </div>

      {!showEditor && !historyMode && (
        <div className="space-y-4 max-w-3xl mx-auto">
          {terms.map(({ id, content }) => (
            <div
              key={id}
              className="bg-gray-50 border border-gray-300 p-4 rounded shadow-sm"
            >
              <div
                className="text-black mb-4"
                dangerouslySetInnerHTML={{ __html: content }}
              />
              <div className="flex gap-4 justify-end">
                <button
                  onClick={() => {
                    setEditing(true);
                    setCurrentId(id);
                    editor?.commands.setContent(content);
                    setShowEditor(true);
                  }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => handleDelete(id, content)}
                  className="text-red-600 hover:text-red-800"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {historyMode && (
        <div className="max-w-3xl mx-auto space-y-3">
          <h2 className="text-xl font-semibold text-black">Terms History</h2>
          <Button variant="outline" onClick={() => setHistoryMode(false)}>
            Back to Current Terms
          </Button>
          {historyList.map((item) => (
            <div
              key={item.id}
              className="border p-4 bg-white rounded shadow-sm"
            >
              <p className="text-sm text-gray-600">
                {item.Date} — {item.By} ({item.type})
              </p>
              <div
                className="text-black mt-2"
                dangerouslySetInnerHTML={{ __html: item.Content }}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => handleRestore(item.Content)}
                  className="text-green-600 hover:text-green-800 text-sm flex items-center gap-1"
                >
                  <FaUndo /> Restore
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TermsConditions;
