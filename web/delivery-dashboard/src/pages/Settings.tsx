import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Shield, Globe, Moon } from "lucide-react";

const Settings = () => {
  const { t } = useTranslation();

  return (
    <div className="">
      <h1 className="text-3xl font-bold">{t("common.settings")}</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" /> {t("common.notifications")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t("common.new_order_alerts")}</Label>
                <p className="text-sm text-muted-foreground">{t("common.new_order_alerts_desc")}</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <div className="space-y-0.5">
                <Label>{t("common.earnings_reports")}</Label>
                <p className="text-sm text-muted-foreground">{t("common.earnings_reports_desc")}</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" /> {t("common.privacy_security")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t("common.share_location")}</Label>
                <p className="text-sm text-muted-foreground">{t("common.share_location_desc")}</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" /> {t("common.appearance")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Moon className="h-4 w-4" /> {t("common.dark_mode")}
                </Label>
                <p className="text-sm text-muted-foreground">{t("common.dark_mode_desc")}</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
