import React from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-red-900 mb-6">
            SWU Medical Repository
          </h1>
          <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
            A comprehensive platform for managing and accessing medical research papers, 
            case studies, and academic resources for healthcare professionals.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/login"
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Login
            </Link>
            <Link
              to="/create"
              className="bg-white hover:bg-gray-50 text-red-600 border-2 border-red-600 px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Create Account
            </Link>
          </div>

          <div className="mt-16 grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold text-red-800 mb-3">Research Papers</h3>
              <p className="text-gray-600">
                Access a vast collection of peer-reviewed medical research papers and publications.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold text-red-800 mb-3">Case Studies</h3>
              <p className="text-gray-600">
                Learn from real-world medical cases and clinical experiences.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold text-red-800 mb-3">Collaboration</h3>
              <p className="text-gray-600">
                Connect with medical professionals and share knowledge across departments.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
