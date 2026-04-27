import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Info } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  type: "courier" | "office";
  targetId?: string;
  targetName: string;
  pendingData: any;
  queryKeyToInvalidate: unknown[];
}

export const CreateDeliverySettlementDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  type,
  targetId,
  targetName,
  pendingData,
  queryKeyToInvalidate,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [periodStart, setPeriodStart] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  );
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      type === "courier" ? adminApi.createCourierSettlement(data) : adminApi.createOfficeSettlement(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeyToInvalidate });
      toast({ title: t("common.success"), description: t("financial.settlement_created_success") });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.response?.data?.message || t("financial.failed_create_settlement"),
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!periodStart || !periodEnd) return;

    const start = new Date(periodStart);
    start.setHours(0, 0, 0, 0);

    const end = new Date(periodEnd);
    end.setHours(23, 59, 59, 999);

    const payload: any = {
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      notes,
    };

    if (type === "courier" && targetId) payload.courierId = targetId;
    if (type === "office" && targetId) payload.deliveryOfficeId = targetId;

    createMutation.mutate(payload);
  };

  const unsettledCount = pendingData?.unsettledDeliveries || 0;
  const label = type === "courier"
    ? t("financial.create_settlement_description", { name: targetName })
    : t("financial.create_office_settlement_description", { name: targetName });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("financial.create_settlement")}</DialogTitle>
          <DialogDescription>{label}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="periodStart">{t("financial.period_start")}</Label>
              <Input id="periodStart" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodEnd">{t("financial.period_end")}</Label>
              <Input id="periodEnd" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg flex gap-3 items-start border border-blue-100">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">{t("financial.unsettled_summary")}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span>{t("financial.deliveries", "Deliveries")}:</span>
                <span className="font-mono font-bold">{unsettledCount}</span>
                <span>{t("financial.delivery_fees", "Delivery Fees")}:</span>
                <span className="font-mono font-bold">EGP {pendingData?.totalDeliveryFees?.toLocaleString() || 0}</span>
                <span>{t("financial.net_payout")}:</span>
                <span className="font-mono font-bold text-emerald-700">EGP {pendingData?.netPayout?.toLocaleString() || 0}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">{t("financial.internal_notes")}</Label>
            <textarea
              id="notes"
              placeholder={t("financial.notes_placeholder")}
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending || !unsettledCount}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {createMutation.isPending ? t("financial.creating") : t("financial.confirm_settlement")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
