import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuthStore } from '@/store/authStore';
import { silentRefresh } from '@/services/api/apiClient';

// Lazy-loaded pages
const HomePage = lazy(() => import('@/pages/HomePage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const SearchPage = lazy(() => import('@/pages/SearchPage'));
const StoresPage = lazy(() => import('@/pages/StoresPage'));
const StoreDetailsPage = lazy(() => import('@/pages/StoreDetailsPage'));
const ProductDetailsPage = lazy(() => import('@/pages/ProductDetailsPage'));
const CartPage = lazy(() => import('@/pages/CartPage'));
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'));
const OrdersPage = lazy(() => import('@/pages/OrdersPage'));
const OrderDetailsPage = lazy(() => import('@/pages/OrderDetailsPage'));
const ReviewProposalsPage = lazy(() => import('@/pages/ReviewProposalsPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const AddressesPage = lazy(() => import('@/pages/AddressesPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const VendorReviewsPage = lazy(() => import('@/pages/VendorReviewsPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const LanguageSettingsPage = lazy(() => import('@/pages/LanguageSettingsPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Requires authentication — redirects to /login if not signed in
function RequireAuth() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

// Redirects authenticated users away from login/register back to home
function GuestOnly() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />;
}

// Access tokens live only in memory, so a hard page reload loses them —
// silently re-establish one from the httpOnly refresh cookie before rendering
// any auth-gated route.
function useAuthBootstrap() {
  const signIn = useAuthStore((s) => s.signIn);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await silentRefresh();
      if (result?.user && result?.accessToken) {
        signIn(result.user as any, result.accessToken);
      }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}

export function AppRouter() {
  const bootstrapped = useAuthBootstrap();

  if (!bootstrapped) {
    return <PageLoader />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Guest-only: redirect to home when already signed in */}
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Public standalone route */}
        <Route path="/terms" element={<TermsPage />} />

        {/* All app routes require authentication */}
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/stores" element={<StoresPage />} />
            <Route path="/store/:vendorId" element={<StoreDetailsPage />} />
            <Route path="/store/:vendorId/reviews" element={<VendorReviewsPage />} />
            <Route path="/product/:productId" element={<ProductDetailsPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:orderId" element={<OrderDetailsPage />} />
            <Route path="/orders/:orderId/proposals" element={<ReviewProposalsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/addresses" element={<AddressesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings/language" element={<LanguageSettingsPage />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
