import React, { useEffect, useState } from "react";
import { ref, onValue, set, push, remove } from "firebase/database";
import { db } from "../../../Backend/firebase";
import { getAuth } from "firebase/auth";
import { format } from "date-fns";
import { FaPlus, FaEdit, FaTrash, FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "../components/AdminNavbar"; // ✅ Navbar path
import AdminSidebar from "../components/AdminSidebar"; // ✅ Sidebar path

interface DepartmentItem {
  id: string;
  name: string;
  imageUrl: string;
  description: string;
}

const Department = () => {
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [newDepartment, setNewDepartment] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editModeId, setEditModeId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImage, setEditImage] = useState<File | null>(null);
  const [showAddForm, setShowAddForm] = useState(false); // State for toggling form visibility
  const [showDeleteModal, setShowDeleteModal] = useState(false); // State for delete modal
  const [deleteId, setDeleteId] = useState<string | null>(null); // Store department id to delete
  const auth = getAuth();
  const user = auth.currentUser;
  const navigate = useNavigate();

  useEffect(() => {
    const departmentRef = ref(db, "Department");
    onValue(departmentRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const deptArray = Object.entries(data).map(([key, value]) => ({
          id: key,
          name: (value as any).name,
          description: (value as any).description || "",
          imageUrl: (value as any).imageUrl || "",
        }));
        setDepartments(deptArray);
      } else {
        setDepartments([]);
      }
    });
  }, []);

  const logHistory = async (
    type: "New Department" | "Edited" | "Deleted",
    name: string
  ) => {
    const timestamp = format(new Date(), "MMMM d, yyyy h:mm a");
    const editor = user?.email || "Unknown";
    await push(ref(db, `History/Department/${type}`), {
      By: editor,
      Date: timestamp,
      "Name of Department": name,
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewImage(file);
    setPreviewImage(URL.createObjectURL(file));
  };

  const handleAdd = async () => {
    const trimmed = newDepartment.trim();
    const trimmedDescription = newDescription.trim();
    if (!trimmed || !newImage || !trimmedDescription)
      return alert("Please fill in all fields.");

    const reader = new FileReader();
    reader.onloadend = async () => {
      const newRef = push(ref(db, "Department"));
      await set(newRef, {
        name: trimmed,
        description: trimmedDescription,
        imageUrl: reader.result,
      });
      await logHistory("New Department", trimmed);
      setNewDepartment("");
      setNewDescription("");
      setNewImage(null);
      setPreviewImage(null);
      setShowAddForm(false); // Close the form after adding
    };
    reader.readAsDataURL(newImage);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm("Are you sure you want to delete this department?"))
      return;
    await remove(ref(db, `Department/${id}`));
    await logHistory("Deleted", name);
    setShowDeleteModal(false); // Close the modal after deletion
  };

  const handleConfirmDelete = (id: string) => {
    setDeleteId(id); // Store the department id to delete
    setShowDeleteModal(true); // Show the delete confirmation modal
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false); // Close the modal without deleting
    setDeleteId(null); // Clear the department id
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return alert("Updated name cannot be empty.");
    const updatedData: any = { name: editName.trim(), description: editDescription.trim() };

    if (editImage) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        updatedData.imageUrl = reader.result;
        await set(ref(db, `Department/${id}`), updatedData);
        await logHistory("Edited", editName.trim());
        setEditModeId(null);
        setEditName("");
        setEditDescription("");
        setEditImage(null);
      };
      reader.readAsDataURL(editImage);
    } else {
      await set(ref(db, `Department/${id}`), updatedData);
      await logHistory("Edited", editName.trim());
      setEditModeId(null);
      setEditName("");
      setEditDescription("");
    }
  };

  const handleCancel = () => {
    // Reset all form values and hide the form
    setNewDepartment("");
    setNewDescription("");
    setNewImage(null);
    setPreviewImage(null);
    setShowAddForm(false); // Hide form
  };

  return (
    <div className="flex min-h-screen bg-[#fafafa] relative">
      {/* Sidebar */}
      <AdminSidebar isOpen={true} toggleSidebar={() => {}} />

      {/* Main Content */}
      <div className="flex-1 transition-all duration-300 ml-64">
        <AdminNavbar toggleSidebar={() => {}} isSidebarOpen={true} />

        {/* Centered Department Content */}
        <main className="p-5 max-w-[1400px] mx-auto">
          <div className="flex justify-between items-center mb-6">
            <FaArrowLeft className="text-[#8B0000] text-lg" onClick={() => navigate(-1)} />
            <h1 className="text-2xl font-bold ml-25 text-[#8B0000]">Listed Department</h1>
            <button
              onClick={() => setShowAddForm(true)} // Show form when clicked
              className="text-white bg-[#a50000] py-2 px-4 rounded hover:bg-[#8b0000]"
            >
              <FaPlus className="mr-2" /> Add New Department
            </button>
          </div>

          {/* Add New Department Form */}
          {showAddForm && (
            <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
              <h2 className="text-xl font-semibold mb-4">Add New Department</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  placeholder="Department Name"
                  className="w-full p-3 border rounded-md"
                />
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Department Description"
                  className="w-full p-3 border rounded-md"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full"
                />
                {previewImage && (
                  <img
                    src={previewImage}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded mt-2"
                  />
                )}
                <div className="flex gap-4">
                  <button
                    onClick={handleAdd}
                    className="bg-[#a50000] text-white py-2 px-4 rounded hover:bg-[#8B0000]"
                  >
                    Save Department
                  </button>
                  <button
                    onClick={handleCancel} // Cancel and clear the form
                    className="bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Department List */}
          {!showAddForm && (
            <div className="space-y-6">
              {departments.map(({ id, name, imageUrl, description }) => (
                <div
                  key={id}
                  className="flex justify-between items-center border border-gray-400 px-6 py-4 rounded-lg shadow-sm max-w-2xl mx-auto flex-wrap md:flex-nowrap"
                >
                  <div className="flex items-center gap-4 w-full md:w-2/3">
                    <img
                      src={imageUrl}
                      alt="Avatar"
                      className="w-12 h-12 rounded border border-[#8B0000] object-cover"
                    />
                    {editModeId === id ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 border rounded text-gray-600"
                      />
                    ) : (
                      <div className="text-lg font-semibold text-gray-800">{name}</div>
                    )}
                  </div>

                  {/* Description */}
                  <div className="w-full md:w-1/3 flex flex-col justify-start">
                    {editModeId === id ? (
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full px-3 py-2 border rounded text-gray-600"
                      />
                    ) : (
                      <div className="text-sm text-gray-600">{description}</div>
                    )}
                  </div>

                  <div className="flex gap-3 items-center w-full md:w-auto mt-4 md:mt-0 justify-end">
                    {editModeId === id ? (
                      <>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setEditImage(file);
                          }}
                        />
                        <button
                          onClick={() => handleEdit(id)}
                          className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                        >
                          Save
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setEditModeId(id);
                          setEditName(name);
                          setEditDescription(description);
                          setEditImage(null);
                        }}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        <FaEdit />
                      </button>
                    )}
                    <button
                      onClick={() => handleConfirmDelete(id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteModal && (
            <div className="fixed inset-0 flex justify-center items-center z-50 bg-black/30 backdrop-blur-sm">
              <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full opacity-100">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">
                  Are you sure you want to delete this department?
                </h2>
                <div className="flex gap-4 justify-end">
                  <button
                    onClick={() => handleDelete(deleteId!, "Department Name")}
                    className="bg-[#8B0000] text-white px-6 py-3 rounded-md hover:bg-red-800"
                  >
                    Yes
                  </button>
                  <button
                    onClick={handleCancelDelete}
                    className="bg-gray-300 text-black px-6 py-3 rounded-md hover:bg-gray-400"
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Department;
