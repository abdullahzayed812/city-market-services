import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SearchX, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-primary-xlight flex items-center justify-center mb-6">
        <SearchX className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-5xl font-extrabold text-text-primary mb-2 tracking-tight">404</h1>
      <p className="text-lg font-semibold text-text-primary mb-2">{t('common.not_found_title', 'Page Not Found')}</p>
      <p className="text-sm text-text-secondary max-w-sm mb-8">
        {t('common.not_found_message', "The page you're looking for doesn't exist or may have been moved.")}
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button variant="outline" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate(-1)}>
          {t('common.go_back', 'Go Back')}
        </Button>
        <Button icon={<Home className="w-4 h-4" />} onClick={() => navigate(isAuthenticated ? '/' : '/login')}>
          {t('common.go_home', 'Go to Home')}
        </Button>
      </div>
    </div>
  );
}
