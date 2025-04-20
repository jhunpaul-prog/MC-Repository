import Navbar from "../../components/Navbar";
import SearchBar from "../../components/SearchBar";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="text-center mt-45">
        <h1 className="text-5xl font-bold text-gray-900">Cobra Archives</h1>
        <p className="text-gray-600 mt-2 text-lg">Stop at nothing until you become the best that you can be.</p>
      </div>
      <SearchBar />
      
    </div>
    
  );
};

export default LandingPage;
