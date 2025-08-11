import React, { useEffect, useState } from "react";
import { ref, onValue, push, remove, set } from "firebase/database";
import { db } from "../../../../Backend/firebase";
import { format } from "date-fns";
import {
  FaArrowLeft,
  FaEdit,
  FaTrash,
  FaTimes,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { RichTextEditor } from "@mantine/tiptap";
import { useEditor } from "@tiptap/react";
import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import { Button } from "@mantine/core";
import AdminNavbar from "../../components/AdminNavbar";
import AdminSidebar from "../../components/AdminSidebar";

interface Policy {
  id: string;
  content: string;
}

const PoliciesGuidelines: React.FC = () => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [editing, setEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [historyMode, setHistoryMode] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const navigate = useNavigate();

  const editor = useEditor({
    extensions: [
      (StarterKit.configure({}) as unknown) as AnyExtension,
      (LinkExtension.configure({ openOnClick: false }) as unknown) as AnyExtension,
    ],
    content: "",
  });

  useEffect(() => {
    const policiesRef = ref(db, "Policies & Guidelines");
    return onValue(policiesRef, (snapshot) => {
      const data = snapshot.val() || {};
      setPolicies(
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
    await push(ref(db, `History/Policies & Guidelines/${type}`), {
      By: "Admin",
      Date: timestamp,
      Content: contentText,
    });
  };

  const handleSave = async () => {
    const html = editor?.getHTML().trim() || "";
    if (!html) return alert("Content cannot be empty");

    if (editing && currentId) {
      await set(ref(db, `Policies & Guidelines/${currentId}`), { content: html });
      await logHistory("Edited", html);
    } else {
      await Promise.all(
        policies.map((p) => remove(ref(db, `Policies & Guidelines/${p.id}`)))
      );
      const newRef = push(ref(db, "Policies & Guidelines"));
      await set(newRef, { content: html });
      await logHistory("Added", html);
    }

    editor?.commands.clearContent();
    setEditing(false);
    setCurrentId(null);
    setShowEditor(false);
  };

  const handleDelete = async (id: string, contentText: string) => {
    if (!window.confirm("Are you sure you want to delete this policy?")) return;
    await remove(ref(db, `Policies & Guidelines/${id}`));
    await logHistory("Deleted", contentText);
  };

  const loadHistory = () => {
    const historyRef = ref(db, "History/Policies & Guidelines");
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

  return (
    <div className="flex min-h-screen bg-[#fafafa]">
     
      <div className="flex-1 ml-64 transition-all">
       
        <main className="p-6 text-black max-w-[1400px] mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <FaArrowLeft
              onClick={() => navigate(-1)}
              className="text-[#8B0000] cursor-pointer"
            />
            <h1 className="text-2xl font-bold text-[#8B0000]">
              Privacy Policy & Guidelines
            </h1>
          </div>

          <div className="max-w-3xl mx-auto mb-6">
            <div className="flex justify-end gap-4 mb-4">
              <Button color="gray" onClick={loadHistory}>
                View History
              </Button>
              <Button color="red" onClick={() => setShowEditor(true)}>
                Add New Policy
              </Button>
            </div>

            {showEditor && (
              <div className="relative border p-4 rounded shadow bg-gray-50">
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
                    </RichTextEditor.ControlsGroup>
                  </RichTextEditor.Toolbar>
                  
                  {/* Editor content now black */}
                  <RichTextEditor.Content className="min-h-[150px] text-black" />
                </RichTextEditor>

                <div className="flex justify-end  text-black mt-4">
                  <Button onClick={handleSave} color="red">
                    {editing ? "Update" : "Add"} Policy
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Current policies */}
          {!showEditor && !historyMode && (
            <div className="space-y-4 max-w-3xl mx-auto">
              {policies.map(({ id, content }) => (
                <div
                  key={id}
                  className="bg-gray-50 border border-gray-300 p-4 rounded shadow-sm"
                >
                  {/* Policy text now black */}
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

          {/* History mode */}
          {historyMode && (
            <div className="max-w-3xl mx-auto space-y-3">
              <h2 className="text-xl font-semibold text-black">Policy History</h2>
              <Button variant="outline" onClick={() => setHistoryMode(false)}>
                Back to Current Policies
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
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default PoliciesGuidelines;
