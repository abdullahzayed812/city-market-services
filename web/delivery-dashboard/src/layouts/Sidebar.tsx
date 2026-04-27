import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    LayoutDashboard,
    Truck,
    Users,
    Wallet,
    Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

const Sidebar = () => {
    const { t } = useTranslation();

    const navItems = [
        { icon: LayoutDashboard, label: t("common.dashboard"), path: "/" },
        { icon: Truck, label: t("common.deliveries"), path: "/deliveries" },
        { icon: Users, label: t("common.couriers"), path: "/couriers" },
        { icon: Wallet, label: t("financial.settlements", "Settlements"), path: "/settlements" },
        { icon: Settings, label: t("common.settings"), path: "/settings" },
    ];

    return (
        <div className="flex flex-col h-full w-64 bg-card border-e">
            <div className="p-6 border-b">
                <h1 className="text-2xl font-bold text-primary">{t("common.citymarket")}</h1>
                <p className="text-xs text-muted-foreground mt-1 text-blue-600 font-semibold">{t("common.delivery_office")}</p>
            </div>
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                                isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
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
