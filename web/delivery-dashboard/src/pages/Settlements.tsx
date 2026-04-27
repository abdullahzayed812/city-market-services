import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deliveryService } from "@/services/api/delivery.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Truck, PlusCircle, Clock, Info } from "lucide-react";

// ─── Shared ───────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => (
  <Badge
    variant={status === "PAID" ? "default" : "secondary"}
    className={status === "PAID" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-orange-100 text-orange-800"}
  >
    {status}
  </Badge>
);

interface CreateSettlementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  pendingData: any;
  onConfirm: (periodStart: string, periodEnd: string, notes: string) => void;
  isPending: boolean;
}

const CreateSettlementDialog: React.FC<CreateSettlementDialogProps> = ({ isOpen, onClose, title, description, pendingData, onConfirm, isPending }) => {
  const { t } = useTranslation();
  const [periodStart, setPeriodStart] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    const start = new Date(periodStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(periodEnd);
    end.setHours(23, 59, 59, 999);
    onConfirm(start.toISOString(), end.toISOString(), notes);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("financial.period_start", "Period Start")}</Label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("financial.period_end", "Period End")}</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg flex gap-3 items-start border border-blue-100">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800 grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="font-semibold col-span-2 mb-1">{t("financial.unsettled_summary", "Unsettled summary")}</span>
              <span>{t("financial.deliveries", "Deliveries")}:</span>
              <span className="font-mono font-bold">{pendingData?.unsettledDeliveries || 0}</span>
              <span>{t("financial.delivery_fees", "Fees")}:</span>
              <span className="font-mono font-bold">EGP {(pendingData?.totalDeliveryFees || 0).toLocaleString()}</span>
              <span>{t("financial.net_payout", "Net payout")}:</span>
              <span className="font-mono font-bold text-emerald-700">EGP {(pendingData?.netPayout || 0).toLocaleString()}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("financial.internal_notes", "Notes (optional)")}</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("financial.notes_placeholder", "Internal notes...")}
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || !pendingData?.unsettledDeliveries} className="bg-indigo-600 hover:bg-indigo-700">
            {isPending ? t("financial.creating", "Creating...") : t("financial.confirm_settlement", "Confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Courier Settlements ──────────────────────────────────────────────────────

const CourierSettlementsTab: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: allPendingData } = useQuery({
    queryKey: ["allCouriersPendingEarnings"],
    queryFn: deliveryService.getAllCouriersPendingEarnings,
  });

  const { data: selectedPendingData } = useQuery({
    queryKey: ["courierPendingEarnings", selectedCourierId],
    queryFn: () => deliveryService.getCourierPendingEarnings(selectedCourierId!),
    enabled: !!selectedCourierId,
  });

  const { data: settlementsData, isLoading } = useQuery({
    queryKey: ["courierSettlements", selectedCourierId],
    queryFn: () => deliveryService.getCourierSettlements(selectedCourierId ?? undefined),
  });

  const createMutation = useMutation({
    mutationFn: (data: { courierId: string; periodStart: string; periodEnd: string; notes: string }) =>
      deliveryService.createCourierSettlement(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courierSettlements"] });
      queryClient.invalidateQueries({ queryKey: ["allCouriersPendingEarnings"] });
      queryClient.invalidateQueries({ queryKey: ["courierPendingEarnings"] });
      toast({ title: t("common.success", "Success"), description: t("financial.settlement_created_success", "Settlement created") });
      setIsDialogOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: t("common.error", "Error"),
        description: err.response?.data?.message || t("financial.failed_create_settlement", "Failed"),
        variant: "destructive",
      });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => deliveryService.markCourierSettlementPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courierSettlements"] });
      toast({ title: t("common.success", "Success"), description: t("financial.settlement_marked_paid", "Marked as paid") });
    },
    onError: (err: any) => {
      toast({
        title: t("common.error", "Error"),
        description: err.response?.data?.message || t("financial.failed_mark_paid", "Failed"),
        variant: "destructive",
      });
    },
  });

  const selectedCourierName = allPendingData?.find((c: any) => c.courierId === selectedCourierId)?.courierName || "";

  return (
    <div className="space-y-6">
      {/* Couriers with pending earnings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("financial.couriers_pending_earnings", "Couriers with Pending Earnings")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.courier", "Courier")}</TableHead>
                <TableHead>{t("financial.unsettled_deliveries", "Unsettled")}</TableHead>
                <TableHead>{t("financial.delivery_fees", "Fees")}</TableHead>
                <TableHead>{t("financial.net_payout", "Net Payout")}</TableHead>
                <TableHead>{t("financial.actions", "Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allPendingData?.map((c: any) => (
                <TableRow
                  key={c.courierId}
                  className={`cursor-pointer hover:bg-gray-50 ${selectedCourierId === c.courierId ? "bg-indigo-50" : ""}`}
                  onClick={() => setSelectedCourierId(c.courierId === selectedCourierId ? null : c.courierId)}
                >
                  <TableCell className="font-medium">{c.courierName}</TableCell>
                  <TableCell>{c.unsettledDeliveries}</TableCell>
                  <TableCell>EGP {c.totalDeliveryFees?.toLocaleString()}</TableCell>
                  <TableCell className="font-bold text-emerald-700">EGP {c.netPayout?.toLocaleString()}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCourierId(c.courierId);
                        setIsDialogOpen(true);
                      }}
                    >
                      <PlusCircle className="h-3 w-3 mr-1" />
                      {t("financial.settle", "Settle")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!allPendingData || allPendingData.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-gray-400">
                    {t("financial.no_pending_earnings", "No pending earnings")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Settlement history */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {selectedCourierId
              ? t("financial.settlement_history_for", "Settlement history for {{name}}", { name: selectedCourierName })
              : t("financial.all_courier_settlements", "All Courier Settlements")}
          </CardTitle>
          {selectedCourierId && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedCourierId(null)}>
              {t("financial.show_all", "Show all")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>{t("financial.period", "Period")}</TableHead>
                  <TableHead>{t("financial.delivery_fees", "Fees")}</TableHead>
                  <TableHead>{t("financial.net_payout", "Net Payout")}</TableHead>
                  <TableHead>{t("financial.deliveries", "Deliveries")}</TableHead>
                  <TableHead>{t("common.status", "Status")}</TableHead>
                  <TableHead>{t("financial.actions", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlementsData?.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.id.split("-")[0]}…</TableCell>
                    <TableCell className="text-sm">
                      {new Date(s.periodStart).toLocaleDateString()} – {new Date(s.periodEnd).toLocaleDateString()}
                    </TableCell>
                    <TableCell>EGP {s.totalDeliveryFees?.toLocaleString()}</TableCell>
                    <TableCell className="font-bold">EGP {s.netPayout?.toLocaleString()}</TableCell>
                    <TableCell>{s.deliveryCount}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                    <TableCell>
                      {s.status === "PENDING" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          onClick={() => markPaidMutation.mutate(s.id)}
                          disabled={markPaidMutation.isPending}
                        >
                          {t("financial.mark_paid", "Mark Paid")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(!settlementsData || settlementsData.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-gray-400">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      {t("financial.no_settlement_history", "No settlements yet")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedCourierId && (
        <CreateSettlementDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          title={t("financial.create_settlement", "Create Settlement")}
          description={t("financial.create_settlement_description", { name: selectedCourierName })}
          pendingData={selectedPendingData}
          onConfirm={(ps, pe, notes) => createMutation.mutate({ courierId: selectedCourierId, periodStart: ps, periodEnd: pe, notes })}
          isPending={createMutation.isPending}
        />
      )}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const Settlements: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center gap-2">
        <Truck className="h-7 w-7 text-indigo-600" />
        {t("financial.courier_settlements", "Courier Settlements")}
      </h2>
      <CourierSettlementsTab />
    </div>
  );
};

export default Settlements;
