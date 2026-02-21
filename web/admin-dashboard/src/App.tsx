import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import UsersManagement from "./pages/UsersManagement.tsx";
import OrdersManagement from "./pages/OrdersManagement.tsx";
import CouriersManagement from "./pages/CouriersManagement.tsx";
import FinancialOverview from "./pages/FinancialOverview.tsx";
import CategoriesManagement from "./pages/CategoriesManagement.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import ProtectedRoute from "./components/ProtectedRoute.tsx";
import { AuthProvider } from "./components/AuthProvider.tsx";
import { SocketProvider } from "./contexts/SocketContext.tsx";

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="users" element={<UsersManagement />} />
              <Route path="orders" element={<OrdersManagement />} />
              <Route path="couriers" element={<CouriersManagement />} />
              <Route path="revenue" element={<FinancialOverview />} />
              <Route path="categories" element={<CategoriesManagement />} />
              <Route path="settings" element={<div>Settings Page (Coming Soon)</div>} />
            </Route>
          </Routes>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
