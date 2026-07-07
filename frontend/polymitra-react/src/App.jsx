import { Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Colleges from "./pages/Colleges";
import Predictor from "./pages/Predictor";
import About from "./pages/About";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/"          element={<Home />} />
      <Route path="/colleges"  element={<Colleges />} />
      {/* /cutoffs redirects to the combined explorer */}
      <Route path="/cutoffs"   element={<Navigate to="/colleges" replace />} />
      <Route path="/predictor" element={<Predictor />} />
      <Route path="/about"     element={<About />} />
      <Route path="*"          element={<NotFound />} />
    </Routes>
  );
}
