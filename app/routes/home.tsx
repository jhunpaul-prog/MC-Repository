import type { Route } from "./+types/home";
import LandingPage from "../pages/ResidentDoctor/RDDashboard";
import Login from "../pages/Login";
import { useEffect } from "react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "COBRA REPOSITORY" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  useEffect(() => {
    document.title = "COBRA REPOSITORY";
  }, []);

  return <Login />;
}
