const SearchBar = () => {
    return (
      <div className="flex items-center bg-white shadow-lg rounded-full px-4 py-2  max-w-3xl mx-auto mt-10 w-full">
        {/* Search Input */}
        <input 
          type="text" 
          placeholder="Find something..." 
          className="w-full px-4 py-2 text-gray-800 outline-none bg-transparent"
        />
  
        {/* Dropdown */}
        <select className="bg-gray-100 px-4 py-2 rounded-md border border-gray-300 text-black">
          <option>Choose Department</option>
          <option>B-School</option>
          <option>Medicine</option>
          <option>Information and technology</option>
        </select>
  
        {/* Search Button */}
        <button className="bg-red-900 text-white p-3 rounded-full ml-2 hover:bg-red-700 transition">
          🔍
        </button>
      </div>
    );
  };
  
  export default SearchBar;
  