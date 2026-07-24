import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import Dashboard from "./pages/Dashboard";
import Deliveries from "./pages/Deliveries";
import Couriers from "./pages/Couriers";
import Settlements from "./pages/Settlements";
import Settings from "./pages/Settings";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProtectedRoute from "./components/ProtectedRoute";
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
            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/deliveries" element={<Deliveries />} />
              <Route path="/couriers" element={<Couriers />} />
              <Route path="/settlements" element={<Settlements />} />
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
