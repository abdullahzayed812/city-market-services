import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, SearchX } from "lucide-react";

const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-slate-200 text-center">
        <CardHeader className="space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <SearchX className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-5xl font-extrabold text-slate-900 tracking-tight">404</CardTitle>
          <CardDescription className="text-base font-medium text-slate-700">
            {t("common.not_found_title", "Page Not Found")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-slate-500">
            {t("common.not_found_message", "The page you're looking for doesn't exist or may have been moved.")}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button variant="outline" className="gap-2" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
              {t("common.go_back", "Go Back")}
            </Button>
            <Button className="gap-2" onClick={() => navigate("/")}>
              <Home className="h-4 w-4" />
              {t("common.go_home", "Go to Home")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFoundPage;
