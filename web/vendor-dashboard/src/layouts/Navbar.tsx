import { useTranslation } from "react-i18next";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Languages, Bell, User, LogOut } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const Navbar = () => {
  const { t } = useTranslation();
  const { setLanguage } = useLanguage();
  const { vendor, logout, logoutAllDevices } = useAuth();

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold hidden md:block">{t("common.dashboard")}</h2>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Languages className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLanguage("ar")}>{t("common.arabic")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage("en")}>{t("common.english")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon">
          <Bell className="w-5 h-5" />
        </Button>

        <div className="h-8 w-px bg-border mx-2" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <span className="font-medium hidden sm:inline-block">{vendor?.shopName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => logout()}>
              <LogOut className="me-2 h-4 w-4" />
              {t("common.logout")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => logoutAllDevices()}>
              <LogOut className="me-2 h-4 w-4" />
              {t("common.logout_all_devices")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Navbar;
