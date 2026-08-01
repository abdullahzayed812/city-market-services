import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, ShoppingBag, Package, Warehouse, Store, Wallet, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { t } = useTranslation();

  const handleNavClick = () => {
    if (window.innerWidth < 1024) onClose();
  };

  const navItems = [
    { icon: LayoutDashboard, label: t("common.dashboard"), path: "/" },
    { icon: ShoppingBag, label: t("common.orders"), path: "/orders" },
    { icon: Package, label: t("common.products"), path: "/products" },
    { icon: Warehouse, label: t("common.inventory"), path: "/inventory" },
    { icon: ShoppingBag, label: t("reviews.title"), path: "/reviews" },
    { icon: Wallet, label: t("common.payouts"), path: "/payouts" },
    { icon: Store, label: t("common.profile"), path: "/profile" },
    { icon: Settings, label: t("common.settings"), path: "/settings" },
  ];

  return (
    <div
      className={cn(
        "fixed inset-y-0 start-0 z-50 flex flex-col h-full w-64 bg-card border-e transform transition-transform duration-200 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
        "lg:static lg:z-auto lg:translate-x-0",
        !isOpen && "lg:hidden",
      )}
    >
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold text-primary">CityMarket</h1>
        <p className="text-xs text-muted-foreground mt-1">Vendor Dashboard</p>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={handleNavClick}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
