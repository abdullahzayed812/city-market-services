import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { MobileBottomNav } from './MobileBottomNav';
import { NotificationPermissionBanner } from '@/components/notifications/NotificationPermissionBanner';
import { TermsModal } from '@/components/shared/TermsModal';

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TermsModal />
      <Navbar />
      <NotificationPermissionBanner />
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileBottomNav />
    </div>
  );
}
