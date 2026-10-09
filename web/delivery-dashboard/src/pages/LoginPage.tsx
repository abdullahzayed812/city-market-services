import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Truck } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { DEMO_MODE, DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/config/demo";

const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  // Demo account prefilled while DEMO_MODE is on (see src/config/demo.ts)
  const [email, setEmail] = useState(DEMO_MODE ? DEMO_ACCOUNTS[0].email : "");
  const [password, setPassword] = useState(DEMO_MODE ? DEMO_PASSWORD : "");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginWith(email, password);
  };

  const loginWith = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      await login({ email, password });
      toast({ title: t("common.success"), description: t("auth.login_success") });
      navigate("/");
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.response?.data?.message || t("auth.login_failed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="p-3 bg-primary rounded-full mb-4">
            <Truck className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">{t("common.citymarket")}</CardTitle>
          <CardDescription>{t("common.delivery_office")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@citymarket.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("common.password")}</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? t("common.loading") : t("common.login")}
            </Button>
          </form>
          {/* One-tap demo accounts while DEMO_MODE is on (src/config/demo.ts) */}
          {DEMO_MODE && (
            <div className="mt-6 border-t pt-4">
              <p className="text-xs font-semibold text-slate-500 mb-2 text-center">{t("auth.demo_accounts")}</p>
              <div className="grid gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <Button
                    key={account.email}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-between h-auto py-2"
                    disabled={isLoading}
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(DEMO_PASSWORD);
                      loginWith(account.email, DEMO_PASSWORD);
                    }}
                  >
                    <span className="font-semibold">{account.label}</span>
                    <span className="text-xs text-slate-400">{account.email}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col">
          <Link to="/register" className="text-sm text-primary hover:underline">
            {t("office_signup.register_office")}
          </Link>
          <p className="text-xs text-center text-muted-foreground mt-4">
            &copy; {new Date().getFullYear()} {t("common.citymarket")}. {t("common.admin")}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginPage;
