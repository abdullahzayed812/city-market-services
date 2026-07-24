import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout.tsx";
import NotFoundPage from "./pages/NotFoundPage.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import UsersManagement from "./pages/UsersManagement.tsx";
import OrdersManagement from "./pages/OrdersManagement.tsx";
import CouriersManagement from "./pages/CouriersManagement.tsx";
import CategoriesManagement from "./pages/CategoriesManagement.tsx";
import VendorsManagement from "./pages/VendorsManagement.tsx";
import ProductsManagement from "./pages/ProductsManagement.tsx";
import FinancialAnalytics from "./pages/FinancialAnalytics.tsx";
import CommissionTiers from "./pages/CommissionTiers.tsx";
import DeliveryFeeTiers from "./pages/DeliveryFeeTiers.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import ProtectedRoute from "./components/ProtectedRoute.tsx";
import { AuthProvider } from "./components/AuthProvider.tsx";
import { SocketProvider } from "./contexts/SocketContext.tsx";
import { Toaster } from "@/components/ui/toaster"; // Import Toaster

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
              <Route path="vendors" element={<VendorsManagement />} />
              <Route path="products" element={<ProductsManagement />} />
              <Route path="orders" element={<OrdersManagement />} />
              <Route path="couriers" element={<CouriersManagement />} />
              <Route path="financial-analytics" element={<FinancialAnalytics />} />
              <Route path="commission-tiers" element={<CommissionTiers />} />
              <Route path="delivery-fee-tiers" element={<DeliveryFeeTiers />} />
              <Route path="categories" element={<CategoriesManagement />} />
              <Route path="settings" element={<div>Settings Page (Coming Soon)</div>} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Router>
      </SocketProvider>
      <Toaster /> {/* Render Toaster here */}
    </AuthProvider>
  );
}

export default App;
