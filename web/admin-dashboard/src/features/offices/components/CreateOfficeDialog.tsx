import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export interface CreateOfficeData {
  managerName: string;
  email: string;
  password: string;
  name: string;
  phone: string;
  address: string;
}

const EMPTY: CreateOfficeData = { managerName: "", email: "", password: "", name: "", phone: "", address: "" };

// Admin adds an office: the manager's login + the office itself (approved right away)
export const CreateOfficeDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateOfficeData) => void;
  isPending: boolean;
}> = ({ open, onOpenChange, onSubmit, isPending }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<CreateOfficeData>(EMPTY);
  const set = (key: keyof CreateOfficeData) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  const complete = Object.values(form).every((v) => v.trim()) && form.password.length >= 8;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (complete) onSubmit({ ...form, email: form.email.trim().toLowerCase() });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setForm(EMPTY);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t("offices.add_new_title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 py-2">
          <p className="text-sm font-semibold text-slate-700">{t("offices.office_section")}</p>
          <div className="space-y-2">
            <Label htmlFor="office-name">{t("offices.office_name")}</Label>
            <Input id="office-name" value={form.name} onChange={set("name")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="office-phone">{t("common.phone")}</Label>
              <Input id="office-phone" type="tel" value={form.phone} onChange={set("phone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="office-address">{t("user_details.address")}</Label>
              <Input id="office-address" value={form.address} onChange={set("address")} />
            </div>
          </div>

          <p className="text-sm font-semibold text-slate-700 pt-2">{t("offices.manager_section")}</p>
          <div className="space-y-2">
            <Label htmlFor="manager-name">{t("offices.manager_name")}</Label>
            <Input id="manager-name" value={form.managerName} onChange={set("managerName")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manager-email">{t("common.email")}</Label>
              <Input id="manager-email" type="email" value={form.email} onChange={set("email")} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manager-password">{t("auth.password")}</Label>
              <PasswordInput id="manager-password" value={form.password} onChange={set("password")} autoComplete="new-password" />
            </div>
          </div>
          <p className="text-xs text-slate-500">{t("offices.approved_hint")}</p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending || !complete}>
              {isPending ? t("common.loading") : t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
