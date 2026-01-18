import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import LandingPage from "./components/LandingPage";

/* Student */
import StudentLogin from "./components/student/StudentLogin";
import StudentDashboard from "./components/student/StudentDashboard";
import InstructionScreen from "./components/student/InstructionScreen";
import LearningInterface from "./components/student/LearningInterface";

/* Teacher */
import TeacherLogin from "./components/teacher/TeacherLogin";
import TeacherSignup from "./components/teacher/TeacherSignup";
import TeacherDashboard from "./components/teacher/TeacherDashboard";

/* Parent */
import ParentLogin from "./components/parent/ParentLogin";
import ParentSignup from "./components/parent/ParentSignup";
import ParentDashboard from "./components/parent/ParentDashborad";

import "./App.css";

function App() {

  /* ======================================
     Restore accessibility mode on refresh
     ====================================== */
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

        {/* Landing */}
        <Route path="/" element={<LandingPage />} />

        {/* =====================
           Student Routes
           ===================== */}
        <Route path="/student-login" element={<StudentLogin />} />
        <Route path="/student-dashboard" element={<StudentDashboard />} />
        <Route
          path="/instruction"
          element={<InstructionScreen onComplete={() => window.location.replace("/learning")} />}
        />
        <Route path="/learning" element={<LearningInterface />} />

        {/* =====================
           Teacher Routes
           ===================== */}
        <Route path="/teacher-login" element={<TeacherLogin />} />
        <Route path="/teacher-signup" element={<TeacherSignup />} />
        <Route path="/teacher-dashboard" element={<TeacherDashboard />} />

        {/* =====================
           Parent Routes
           ===================== */}
        <Route path="/parent-login" element={<ParentLogin />} />
        <Route path="/parent-signup" element={<ParentSignup />} />
        <Route path="/parent-dashboard" element={<ParentDashboard />} />

      </Routes>
    </Router>
  );
}

export default App;
