import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/hooks/use-toast";

const MIN_PASSWORD = 8;

// Step 1 of office signup: the manager account. The office details and documents come
// next (OfficeGate shows the onboarding form for a manager without an office).
export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      toast({ variant: "destructive", description: t("office_signup.password_too_short", { min: MIN_PASSWORD }) });
      return;
    }
    if (password !== confirm) {
      toast({ variant: "destructive", description: t("office_signup.passwords_dont_match") });
      return;
    }
    setIsLoading(true);
    try {
      await register({ email: email.trim().toLowerCase(), password });
      navigate("/");
    } catch (error: any) {
      toast({ variant: "destructive", description: error.response?.data?.message || t("office_signup.failed") });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="p-3 bg-primary rounded-full mb-4">
            <Truck className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">{t("office_signup.title")}</CardTitle>
          <CardDescription className="text-center">{t("office_signup.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("common.password")}</Label>
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">{t("office_signup.confirm_password")}</Label>
              <PasswordInput id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
            </div>
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? t("common.loading") : t("office_signup.create_account")}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <Link to="/login" className="text-sm text-primary hover:underline">
            {t("office_signup.have_account")}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
