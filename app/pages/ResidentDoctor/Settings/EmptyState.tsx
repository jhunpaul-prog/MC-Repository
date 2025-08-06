// src/components/EmptyState.tsx
import React from "react";

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="text-center text-gray-600 p-10">
    <p>{message}</p>
  </div>
);

export default EmptyState;
