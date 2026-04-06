import React from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Users, ShoppingBag, Truck, BarChart3, Settings, Building, Box } from "lucide-react";
import { cn } from "@/lib/utils";

const Sidebar: React.FC = () => {
  const { t } = useTranslation();

  const navItems = [
    { name: t("common.dashboard"), href: "/", icon: LayoutDashboard },
    { name: t("common.orders"), href: "/orders", icon: ShoppingBag },
    { name: t("common.users"), href: "/users", icon: Users },
    { name: t("common.vendors"), href: "/vendors", icon: Building },
    { name: t("common.couriers"), href: "/couriers", icon: Truck },
    { name: t("common.products"), href: "/products", icon: Box },
    { name: t("common.categories"), href: "/categories", icon: LayoutDashboard },
    { name: t("common.revenue"), href: "/revenue", icon: BarChart3 },
    { name: t("financial.analytics", "Vendor Analytics"), href: "/financial-analytics", icon: BarChart3 },
    { name: t("common.settings"), href: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white border-e border-gray-200 flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <span className="text-xl font-bold text-primary">{t("common.admin_title")}</span>
      </div>
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }: { isActive: boolean }) =>
              cn(
                "flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors",
                isActive ? "bg-primary text-primary-foreground" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
              )
            }
          >
            <item.icon className={cn("me-3 h-5 w-5")} />
            {item.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
