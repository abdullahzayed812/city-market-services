import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Loader2, Lock, Mail, Store } from "lucide-react";
import { useAuth } from "../components/AuthProvider";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

// Step 1 of merchant signup: the account. The store application (details, location,
// documents) comes next: VendorGate shows it to a merchant without a store.
const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError(t("onboarding.errors.invalid_email"));
    if (password.length < MIN_PASSWORD) return setError(t("onboarding.errors.password_too_short", { min: MIN_PASSWORD }));
    if (password !== confirm) return setError(t("onboarding.errors.passwords_dont_match"));
    setIsLoading(true);
    try {
      await register({ email: email.trim().toLowerCase(), password });
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || t("onboarding.errors.signup_failed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50 px-4 py-8">
      <Card className="w-full max-w-md border-none shadow-xl">
        <CardHeader className="space-y-1 flex flex-col items-center text-center">
          <div className="p-3 bg-orange-100 rounded-2xl mb-3">
            <Store className="h-9 w-9 text-orange-600" />
          </div>
          <CardTitle className="text-2xl font-bold">{t("onboarding.signup_title")}</CardTitle>
          <CardDescription>{t("onboarding.signup_subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <div className="relative">
                <Mail className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
                <Input id="email" type="email" dir="ltr" className="ps-9" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <div className="relative">
                <Lock className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="ps-9 pe-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button type="button" className="absolute end-3 top-3 text-slate-400" onClick={() => setShowPassword((v) => !v)} aria-label={t("onboarding.toggle_password")}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{t("onboarding.password_hint", { min: MIN_PASSWORD })}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">{t("onboarding.confirm_password")}</Label>
              <Input id="confirm" type={showPassword ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </div>
            <Button className="w-full h-11 bg-orange-600 hover:bg-orange-700" type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : t("onboarding.create_account")}
            </Button>
            <p className="text-xs text-center text-muted-foreground">{t("onboarding.signup_next_steps")}</p>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <Link to="/login" className="text-sm text-orange-600 font-semibold hover:underline">
            {t("onboarding.have_account")}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
};

export default RegisterPage;
