import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/use-toast";

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("admin@citymarket.com");
  const [password, setPassword] = useState("password123");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login({ email, password });
      navigate("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.response?.data?.message || "Invalid credentials",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">CityMarket</h1>
        <h2 className="text-xl font-semibold text-slate-600">{t("common.admin_title")}</h2>
      </div>

      <Card className="w-full max-w-md shadow-lg border-slate-200 animate-in fade-in zoom-in duration-500">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">{t("auth.sign_in")}</CardTitle>
          <CardDescription className="text-center">{t("auth.credentials_hint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@citymarket.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-slate-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-slate-300"
              />
            </div>
            <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800" disabled={isLoading}>
              {isLoading ? t("common.loading") : t("auth.login_button")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8 text-sm text-center text-slate-500">{t("auth.protected_by")}</div>
    </div>
  );
};

export default LoginPage;
