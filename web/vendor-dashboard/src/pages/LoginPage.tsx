import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../components/AuthProvider";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Lock, Mail, Loader2, Store } from "lucide-react";
import { useTranslation } from "react-i18next";

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("supermarket1@citymarket.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin(email, password);
  };

  const handleLogin = async (loginEmail: string, loginPass: string) => {
    setError(null);
    setIsLoading(true);

    try {
      await login({ email: loginEmail, password: loginPass });
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || t("auth.error_login_failed"));
    } finally {
      setIsLoading(false);
    }
  };

  const quickVendors = [
    { name: t("vendors.madinaty_supermarket"), email: "supermarket1@citymarket.com" },
    { name: t("vendors.al_jazira_supermarket"), email: "supermarket2@citymarket.com" },
    { name: t("vendors.moataz_pharmacy"), email: "pharmacy@citymarket.com" },
    { name: t("vendors.el_madina_bakery"), email: "bakery@citymarket.com" },
    { name: t("vendors.al_radwa_butcher"), email: "butcher@citymarket.com" },
    { name: t("vendors.al_hakeem_poultry"), email: "poultry@citymarket.com" },
    { name: t("vendors.al_hakeem_fish"), email: "fish@citymarket.com" },
    { name: t("vendors.sanaqreh"), email: "sanaqreh@citymarket.com" },
    { name: t("vendors.ahmed_yehia"), email: "ahmed_yehia@citymarket.com" },
    { name: t("vendors.sabawi"), email: "sabawi@citymarket.com" },
    { name: t("vendors.abdullah_butcher"), email: "abdullah_butcher@citymarket.com" },
    { name: t("vendors.beheiry_poultry"), email: "beheiry_poultry@citymarket.com" },
    { name: t("vendors.ghanem_fish"), email: "ghanem_fish@citymarket.com" },
    { name: t("vendors.mutawakkil_fish"), email: "mutawakkil_fish@citymarket.com" },
    { name: t("vendors.abu_youssef_fish"), email: "abu_youssef_fish@citymarket.com" },
    { name: t("vendors.bondoqa"), email: "bondoqa@citymarket.com" },
    { name: t("vendors.ashri"), email: "ashri@citymarket.com" },
    { name: t("vendors.lozina"), email: "lozina@citymarket.com" },
    { name: t("vendors.al_baraka_bakery"), email: "al_baraka_bakery@citymarket.com" },
    { name: t("vendors.abu_omar"), email: "abu_omar@citymarket.com" },
    { name: t("vendors.rawan"), email: "rawan@citymarket.com" },
    { name: t("vendors.shady_library"), email: "shady_library@citymarket.com" },
    { name: t("vendors.awlad_ragab"), email: "awlad_ragab@citymarket.com" },
    { name: t("vendors.mazaare_al_kheir"), email: "mazaare_al_kheir@citymarket.com" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-7xl w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-orange-100 rounded-2xl shadow-sm">
              <Store className="h-10 w-10 text-orange-600" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-2">CityMarket</h1>
          <h2 className="text-xl font-semibold text-slate-600">{t("auth.login_title")}</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Quick Login Card */}
          <Card className="border-none shadow-xl bg-white/60 backdrop-blur-md overflow-hidden flex flex-col">
            <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-800">{t("auth.quick_login_title")}</CardTitle>
                  <CardDescription className="text-slate-500 text-sm">{t("auth.quick_login_desc")}</CardDescription>
                </div>
                <div className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold rounded uppercase tracking-wider">Debug</div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 flex-grow">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {quickVendors.map((v) => (
                  <Button
                    key={v.email}
                    variant="outline"
                    size="sm"
                    className="justify-start font-medium text-xs h-10 border-slate-200 hover:bg-orange-600 hover:text-white hover:border-orange-600 transition-all group shrink-0"
                    onClick={() => {
                      setEmail(v.email);
                      handleLogin(v.email, "password123");
                    }}
                  >
                    <Store className="mr-2 h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
                    <span className="truncate">{v.name}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Standard Login Card */}
          <Card className="border-none shadow-2xl bg-white overflow-hidden flex flex-col">
            <div className="h-2 bg-orange-600 w-full" />
            <CardHeader className="space-y-1 pt-8">
              <CardTitle className="text-2xl font-bold text-center text-slate-900">{t("auth.signin")}</CardTitle>
              <CardDescription className="text-center text-slate-500">{t("auth.login_subtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 flex-grow">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm font-medium animate-in fade-in slide-in-from-top-1">
                    {error}
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-slate-700 font-semibold ml-1">{t("auth.email")}</Label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400 group-focus-within:text-orange-600 transition-colors" />
                    <Input
                      id="email"
                      type="email"
                      placeholder={t("auth.email_placeholder")}
                      className="pl-11 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-orange-600 focus:ring-orange-600/20 rounded-xl transition-all"
                      value={email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between ml-1">
                    <Label htmlFor="password" title="Password" className="text-slate-700 font-semibold">{t("auth.password")}</Label>
                    <a href="#" className="text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors">{t("auth.forgot_password")}</a>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400 group-focus-within:text-orange-600 transition-colors" />
                    <Input
                      id="password"
                      type="password"
                      placeholder={t("auth.password_placeholder")}
                      className="pl-11 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-orange-600 focus:ring-orange-600/20 rounded-xl transition-all"
                      value={password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 text-base font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/20 transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] rounded-xl mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {t("auth.authenticating")}
                    </>
                  ) : (
                    t("auth.signin")
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-6 pb-8 pt-2 mt-auto">
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-100" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-400 font-medium">{t("auth.dont_have_account")}</span>
                </div>
              </div>
              <div className="text-sm text-center text-slate-600 font-medium">
                <a href="/register" className="text-orange-600 font-bold hover:underline underline-offset-4">
                  {t("auth.register_store")}
                </a>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;

