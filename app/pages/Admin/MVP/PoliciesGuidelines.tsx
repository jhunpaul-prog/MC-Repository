import React, { useEffect, useState } from "react";
import { ref, onValue, push, remove, set } from "firebase/database";
import { db } from "../../../Backend/firebase";
import { format } from "date-fns";
import { FaArrowLeft, FaEdit, FaTrash, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { RichTextEditor, Link } from "@mantine/tiptap";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@mantine/core";
import AdminNavbar from "../components/AdminNavbar"; // ✅ Navbar path
import AdminSidebar from "../components/AdminSidebar"; // ✅ Sidebar path
import { FaFileExcel } from "react-icons/fa";


const PoliciesGuidelines = () => {
  const [policies, setPolicies] = useState<{ id: string; content: string }[]>([]);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [historyMode, setHistoryMode] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);

  const editor = useEditor({
    extensions: [StarterKit, Link],
    content: "",
  });

  useEffect(() => {
    const refData = ref(db, "Policies & Guidelines");
    onValue(refData, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, value]: any) => ({
          id,
          content: value.content,
        }));
        setPolicies(list);
      }
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
    const content = editor?.getHTML() || "";
    if (!content.trim()) return alert("Content cannot be empty.");

    if (editing && currentId) {
      await set(ref(db, `Policies & Guidelines/${currentId}`), { content });
      await logHistory("Edited", content);
    } else {
      policies.forEach((policy) => remove(ref(db, `Policies & Guidelines/${policy.id}`)));
      const newRef = push(ref(db, "Policies & Guidelines"));
      await set(newRef, { content });
      await logHistory("Added", content);
    }

    editor?.commands.clearContent();
    setEditing(false);
    setCurrentId(null);
    setShowEditor(false);
  };

  const handleDelete = async (id: string, contentText: string) => {
    if (window.confirm("Are you sure you want to delete this policy?")) {
      await remove(ref(db, `Policies & Guidelines/${id}`));
      await logHistory("Deleted", contentText);
    }
  };

  const loadHistory = async () => {
    const refData = ref(db, "History/Policies & Guidelines");
    onValue(refData, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const flatHistory = Object.entries(data).flatMap(([type, records]: any) => {
          return Object.entries(records).map(([key, entry]: any) => ({
            id: key,
            type,
            ...entry,
          }));
        });
        setHistoryList(flatHistory);
        setHistoryMode(true);
      }
    });
  };

  return (
    <div className="flex min-h-screen bg-[#fafafa] relative">
      {/* Sidebar */}
      <AdminSidebar isOpen={true} toggleSidebar={() => {}} />

      {/* Main Content */}
      <div className="flex-1 transition-all duration-300 ml-64">
        <AdminNavbar toggleSidebar={() => {}} isSidebarOpen={true} />

        {/* Centered Content */}
        <main className="p-6 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <FaArrowLeft
              onClick={() => navigate(-1)}
              className="text-[#8B0000] text-lg cursor-pointer"
            />
            <h1 className="text-2xl font-bold text-[#8B0000]">Privacy Policy & Guidelines</h1>
          </div>

          <div className="max-w-3xl mx-auto mb-6">
            <div className="flex justify-end mb-4 gap-4">
              <Button color="gray" onClick={() => loadHistory()}>
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
                  className="absolute top-2 right-5 text-gray-500 hover:text-red-700 text-lg"
                >
                  <FaTimes />
                </button>

                <RichTextEditor editor={editor} className="mt-3">
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
                  </RichTextEditor.Toolbar>
                  <RichTextEditor.Content className="min-h-[150px]" />
                </RichTextEditor>

                <div className="flex justify-end mt-4">
                  <Button onClick={handleSave} color="red">
                    {editing ? "Update" : "Add"} Policy
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Policies List */}
          {!showEditor && !historyMode && (
            <div className="space-y-4 max-w-3xl mx-auto">
              {policies.map(({ id, content }) => (
                <div
                  key={id}
                  className="border border-gray-300 rounded-lg p-4 shadow-sm bg-gray-50"
                >
                  <div
                    className="text-gray-700 mb-4"
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

          {/* Toggleable History */}
          {historyMode && (
            <div className="max-w-3xl mx-auto space-y-3">
              <h2 className="text-xl font-semibold mb-2">Policy History</h2>
              <Button variant="outline" onClick={() => setHistoryMode(false)}>
                Back to Current Policies
              </Button>
              {historyList.map((item, index) => (
                <div key={index} className="border p-4 bg-white shadow-sm rounded">
                  <p className="text-sm text-gray-600">
                    {item.Date} - {item.By} ({item.type})
                  </p>
                  <div
                    className="text-gray-800 mt-2"
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
