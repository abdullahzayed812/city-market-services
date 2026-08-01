import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Globe, User, LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

interface NavbarProps {
    onMenuClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
    const { t, i18n } = useTranslation();
    const { logout, logoutAllDevices } = useAuth();

    const toggleLanguage = () => {
        const newLang = i18n.language === 'ar' ? 'en' : 'ar';
        i18n.changeLanguage(newLang);
    };

    return (
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
            <div className="flex items-center">
                <Button variant="ghost" size="icon" className="lg:hidden me-2" onClick={onMenuClick}>
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">{t('common.menu', 'Menu')}</span>
                </Button>
                <h1 className="text-lg font-semibold text-gray-800">
                    {/* Page title could go here */}
                </h1>
            </div>
            <div className="flex items-center space-x-4 rtl:space-x-reverse">
                <Button variant="ghost" size="icon" onClick={toggleLanguage}>
                    <Globe className="h-5 w-5" />
                    <span className="sr-only">{t('common.language')}</span>
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <User className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                            <User className="me-2 h-4 w-4" />
                            <span>{t('common.settings')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => logout()}>
                            <LogOut className="me-2 h-4 w-4" />
                            <span>{t('common.logout')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => logoutAllDevices()}>
                            <LogOut className="me-2 h-4 w-4" />
                            <span>{t('common.logout_all_devices')}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
};

export default Navbar;
