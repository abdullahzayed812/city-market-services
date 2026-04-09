import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, AlertCircle } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface CommissionTier {
    id: string;
    minAmount: number;
    maxAmount: number | null;
    percentage: number;
}

const CommissionTiers: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTier, setEditingTier] = useState<CommissionTier | null>(null);
    const [formData, setFormData] = useState({
        minAmount: "",
        maxAmount: "",
        percentage: "",
    });
    const [error, setError] = useState<string | null>(null);

    const { data: tiersResponse, isLoading } = useQuery({
        queryKey: ["commissionTiers"],
        queryFn: () => adminApi.getAllCommissionTiers(),
    });

    const tiers: CommissionTier[] = tiersResponse?.data?.data || [];

    const createMutation = useMutation({
        mutationFn: adminApi.createCommissionTier,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["commissionTiers"] });
            setIsDialogOpen(false);
            resetForm();
        },
        onError: (err: any) => {
            setError(err.response?.data?.message || t("common.error"));
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateCommissionTier(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["commissionTiers"] });
            setIsDialogOpen(false);
            resetForm();
        },
        onError: (err: any) => {
            setError(err.response?.data?.message || t("common.error"));
        },
    });

    const deleteMutation = useMutation({
        mutationFn: adminApi.deleteCommissionTier,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["commissionTiers"] });
        },
    });

    const resetForm = () => {
        setFormData({ minAmount: "", maxAmount: "", percentage: "" });
        setEditingTier(null);
        setError(null);
    };

    const handleEdit = (tier: CommissionTier) => {
        setEditingTier(tier);
        setFormData({
            minAmount: tier.minAmount.toString(),
            maxAmount: tier.maxAmount?.toString() || "",
            percentage: tier.percentage.toString(),
        });
        setError(null);
        setIsDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = {
            minAmount: parseFloat(formData.minAmount),
            maxAmount: formData.maxAmount === "" ? null : parseFloat(formData.maxAmount),
            percentage: parseFloat(formData.percentage),
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
                    <h2 className="text-2xl font-bold text-gray-800">{t("financial.commission_tiers")}</h2>
                    <p className="text-gray-500 text-sm">{t("financial.manage_tiers_description")}</p>
                </div>
                <Button
                    onClick={() => {
                        resetForm();
                        setIsDialogOpen(true);
                    }}
                >
                    <Plus className="me-2 h-4 w-4" />
                    {t("financial.add_tier")}
                </Button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t("financial.min_amount")} ({t("common.currency")})</TableHead>
                            <TableHead>{t("financial.max_amount")} ({t("common.currency")})</TableHead>
                            <TableHead>{t("financial.percentage")} (%)</TableHead>
                            <TableHead className="text-end">{t("common.actions")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tiers.map((tier) => (
                            <TableRow key={tier.id}>
                                <TableCell className="font-medium">{tier.minAmount}</TableCell>
                                <TableCell>{tier.maxAmount === null ? "∞" : tier.maxAmount}</TableCell>
                                <TableCell>{tier.percentage}%</TableCell>
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
                                <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                    {t("financial.no_tiers_found")}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingTier ? t("financial.edit_tier") : t("financial.add_new_tier")}</DialogTitle>
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
                                value={formData.minAmount}
                                onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="maxAmount">{t("financial.max_amount")} ({t("financial.leave_empty_for_infinity")})</Label>
                            <Input
                                id="maxAmount"
                                type="number"
                                step="0.01"
                                value={formData.maxAmount}
                                onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="percentage">{t("financial.percentage")}</Label>
                            <Input
                                id="percentage"
                                type="number"
                                step="0.01"
                                max="100"
                                value={formData.percentage}
                                onChange={(e) => setFormData({ ...formData, percentage: e.target.value })}
                                required
                            />
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

export default CommissionTiers;
