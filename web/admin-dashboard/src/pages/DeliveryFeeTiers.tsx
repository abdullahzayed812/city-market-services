import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, AlertCircle, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DeliveryFeeTier {
  id: string;
  minAmount: number;
  maxAmount: number | null;
  courierPercentage: number;
}

const DeliveryFeeTiers: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<DeliveryFeeTier | null>(null);
  const [formData, setFormData] = useState({ minAmount: "", maxAmount: "", courierPercentage: "" });
  const [error, setError] = useState<string | null>(null);

  const { data: tiersResponse, isLoading } = useQuery({
    queryKey: ["deliveryFeeTiers"],
    queryFn: () => adminApi.getAllDeliveryFeeTiers(),
  });

  const tiers: DeliveryFeeTier[] = tiersResponse?.data?.data || [];

  const createMutation = useMutation({
    mutationFn: adminApi.createDeliveryFeeTier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryFeeTiers"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => setError(err.response?.data?.message || t("common.error")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateDeliveryFeeTier(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryFeeTiers"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => setError(err.response?.data?.message || t("common.error")),
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteDeliveryFeeTier,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deliveryFeeTiers"] }),
  });

  const resetForm = () => {
    setFormData({ minAmount: "", maxAmount: "", courierPercentage: "" });
    setEditingTier(null);
    setError(null);
  };

  const handleEdit = (tier: DeliveryFeeTier) => {
    setEditingTier(tier);
    setFormData({
      minAmount: tier.minAmount.toString(),
      maxAmount: tier.maxAmount?.toString() || "",
      courierPercentage: tier.courierPercentage.toString(),
    });
    setError(null);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      minAmount: parseFloat(formData.minAmount),
      maxAmount: formData.maxAmount === "" ? null : parseFloat(formData.maxAmount),
      courierPercentage: parseFloat(formData.courierPercentage),
    };
    if (editingTier) {
      updateMutation.mutate({ id: editingTier.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) return <div className="p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6 p-6 animate-in fade-in zoom-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t("delivery_tiers.title")}</h2>
          <p className="text-gray-500 text-sm">{t("delivery_tiers.description")}</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
        >
          <Plus className="me-2 h-4 w-4" />
          {t("delivery_tiers.add_tier")}
        </Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>{t("delivery_tiers.how_it_works")}</AlertTitle>
        <AlertDescription>{t("delivery_tiers.how_it_works_desc")}</AlertDescription>
      </Alert>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("financial.min_amount")} ({t("common.currency")})</TableHead>
              <TableHead>{t("financial.max_amount")} ({t("common.currency")})</TableHead>
              <TableHead>{t("delivery_tiers.courier_percentage")} (%)</TableHead>
              <TableHead>{t("delivery_tiers.office_percentage")} (%)</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiers.map((tier) => (
              <TableRow key={tier.id}>
                <TableCell className="font-medium">{tier.minAmount}</TableCell>
                <TableCell>{tier.maxAmount === null ? "∞" : tier.maxAmount}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {tier.courierPercentage}%
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {(100 - tier.courierPercentage).toFixed(2)}%
                  </span>
                </TableCell>
                <TableCell className="text-end space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(tier)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm(t("common.confirm_delete"))) {
                        deleteMutation.mutate(tier.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {tiers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  {t("delivery_tiers.no_tiers_found")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTier ? t("delivery_tiers.edit_tier") : t("delivery_tiers.add_new_tier")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t("common.error")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="minAmount">{t("financial.min_amount")}</Label>
              <Input
                id="minAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.minAmount}
                onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxAmount">
                {t("financial.max_amount")} ({t("financial.leave_empty_for_infinity")})
              </Label>
              <Input
                id="maxAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.maxAmount}
                onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="courierPercentage">{t("delivery_tiers.courier_percentage")}</Label>
              <Input
                id="courierPercentage"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.courierPercentage}
                onChange={(e) => setFormData({ ...formData, courierPercentage: e.target.value })}
                required
              />
              {formData.courierPercentage !== "" && (
                <p className="text-xs text-gray-500">
                  {t("delivery_tiers.office_gets")} {(100 - parseFloat(formData.courierPercentage || "0")).toFixed(2)}%
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingTier ? t("common.update") : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeliveryFeeTiers;
