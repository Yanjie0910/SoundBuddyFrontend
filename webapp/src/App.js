import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import LandingPage from "./components/landing/LandingPage";

import StudentLogin from "./components/student/auth/StudentLogin";
import StudentDashboard from "./components/student/dashboard/StudentDashboard";
import InstructionScreen from "./components/student/learning/core/InstructionScreen";
import LearningInterface from "./components/student/learning/core/LearningInterface";
import MiniGameInterface from "./components/student/games/MiniGameInterface";
import LearningResults from './components/student/learning/core/LearningResults';
import CertificatePage from './components/student/learning/core/CertificatePage';

import TeacherLogin from "./components/teacher/auth/TeacherLogin";
import TeacherSignup from "./components/teacher/auth/TeacherSignup";
import TeacherDashboard from "./components/teacher/dashboard/TeacherDashboard";

import ParentLogin from "./components/parent/auth/ParentLogin";
import ParentSignup from "./components/parent/auth/ParentSignup";
import ParentDashboard from "./components/parent/dashboard/ParentDashboard";

import "./App.css";

function App() {
  useEffect(() => {
    const role = localStorage.getItem("userRole");

    if (role === "student") {
      document.body.classList.add("student-mode");
    } else {
      document.body.classList.remove("student-mode");
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/student-login" element={<StudentLogin />} />
        <Route path="/student-dashboard" element={<StudentDashboard />} />
        <Route path="/instruction/:moduleId" element={<InstructionScreen />} />
        <Route path="/learning/:moduleId" element={<LearningInterface />} />
<Route path="/minigame/:moduleId" element={<MiniGameInterface />} />
<Route path="/learning-results/:moduleId" element={<LearningResults />} />
<Route path="/certificate" element={<CertificatePage />} />        
<Route path="/teacher-login" element={<TeacherLogin />} />
        <Route path="/teacher-signup" element={<TeacherSignup />} />
        <Route path="/teacher-dashboard" element={<TeacherDashboard />} />

        <Route path="/parent-login" element={<ParentLogin />} />
        <Route path="/parent-signup" element={<ParentSignup />} />
        <Route path="/parent-dashboard" element={<ParentDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;