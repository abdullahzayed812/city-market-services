import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import Deliveries from "./pages/Deliveries";
import Couriers from "./pages/Couriers";
import Settlements from "./pages/Settlements";
import Ratings from "./pages/Ratings";
import Settings from "./pages/Settings";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProtectedRoute from "./components/ProtectedRoute";
import OfficeGate from "./components/OfficeGate";
import RegisterPage from "./pages/RegisterPage";
import { AuthProvider } from "./components/AuthProvider";
import { SocketProvider } from "./contexts/SocketContext";
import { Toaster } from "./components/ui/toaster";

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <OfficeGate>
                    <MainLayout />
                  </OfficeGate>
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/deliveries" element={<Deliveries />} />
              <Route path="/couriers" element={<Couriers />} />
              <Route path="/settlements" element={<Settlements />} />
              <Route path="/ratings" element={<Ratings />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
