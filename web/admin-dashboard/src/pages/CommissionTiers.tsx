import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, AlertCircle, Store, Tags, Globe } from "lucide-react";
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
    vendorId?: string | null;
    vendorType?: string | null;
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
        tierType: "global" as "global" | "vendorType" | "vendorId",
        vendorType: "",
        vendorId: "",
        minAmount: "",
        maxAmount: "",
        percentage: "",
    });
    const [error, setError] = useState<string | null>(null);

    const { data: tiersResponse, isLoading } = useQuery({
        queryKey: ["commissionTiers"],
        queryFn: () => adminApi.getAllCommissionTiers(),
    });

    const { data: vendorsResponse } = useQuery({
        queryKey: ["vendors"],
        queryFn: () => adminApi.getVendors(),
    });

    const tiers: CommissionTier[] = tiersResponse?.data?.data || [];
    const vendors = vendorsResponse?.data?.data || [];
    const uniqueVendorTypes = Array.from(new Set(vendors.map((v: any) => v.type).filter(Boolean)));

    const sortedTiers = [...tiers].sort((a, b) => {
        const getPriority = (tier: CommissionTier) => {
            if (!tier.vendorId && !tier.vendorType) return 1; // Global
            if (tier.vendorType) return 2; // Type
            return 3; // Specific vendor
        };
        const pA = getPriority(a);
        const pB = getPriority(b);
        if (pA !== pB) return pA - pB;
        if (a.vendorType && b.vendorType && a.vendorType !== b.vendorType) return a.vendorType.localeCompare(b.vendorType);
        if (a.vendorId && b.vendorId && a.vendorId !== b.vendorId) return a.vendorId.localeCompare(b.vendorId);
        return a.minAmount - b.minAmount;
    });

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
        setFormData({ tierType: "global", vendorType: "", vendorId: "", minAmount: "", maxAmount: "", percentage: "" });
        setEditingTier(null);
        setError(null);
    };

    const handleEdit = (tier: CommissionTier) => {
        setEditingTier(tier);
        let tierType: "global" | "vendorType" | "vendorId" = "global";
        if (tier.vendorId) tierType = "vendorId";
        else if (tier.vendorType) tierType = "vendorType";

        setFormData({
            tierType,
            vendorType: tier.vendorType || "",
            vendorId: tier.vendorId || "",
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
            vendorId: formData.tierType === "vendorId" && formData.vendorId.trim() !== "" ? formData.vendorId.trim() : null,
            vendorType: formData.tierType === "vendorType" && formData.vendorType.trim() !== "" ? formData.vendorType.trim() : null,
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
                            <TableHead>{t("financial.scope")}</TableHead>
                            <TableHead>{t("financial.min_amount")} ({t("common.currency")})</TableHead>
                            <TableHead>{t("financial.max_amount")} ({t("common.currency")})</TableHead>
                            <TableHead>{t("financial.percentage")} (%)</TableHead>
                            <TableHead className="text-end">{t("common.actions")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedTiers.map((tier) => (
                            <TableRow key={tier.id}>
                                <TableCell>
                                    {tier.vendorId ? (
                                        <div className="flex items-center space-x-2">
                                            <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs font-semibold">
                                                <Store className="h-3 w-3 me-1" />
                                                {vendors.find((v: any) => v.id === tier.vendorId)?.shopName || tier.vendorId}
                                            </span>
                                            {vendors.find((v: any) => v.id === tier.vendorId)?.type && (
                                                <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-[10px] font-medium border border-blue-100">
                                                    {t(`vendors.types.${(vendors.find((v: any) => v.id === tier.vendorId)?.type as string).toLowerCase()}`) || vendors.find((v: any) => v.id === tier.vendorId)?.type}
                                                </span>
                                            )}
                                        </div>
                                    ) : tier.vendorType ? (
                                        <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-semibold">
                                            <Tags className="h-3 w-3 me-1" />
                                            {t("common.type")}: {t(`vendors.types.${tier.vendorType!.toLowerCase()}`) || tier.vendorType}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-semibold">
                                            <Globe className="h-3 w-3 me-1" />
                                            {t("financial.global_default")}
                                        </span>
                                    )}
                                </TableCell>
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
                            <Label htmlFor="tierType">{t("financial.tier_scope")}</Label>
                            <select
                                id="tierType"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.tierType}
                                onChange={(e) => setFormData({ ...formData, tierType: e.target.value as any })}
                            >
                                <option value="global">{t("financial.scope_global")}</option>
                                <option value="vendorType">{t("financial.scope_vendor_type")}</option>
                                <option value="vendorId">{t("financial.scope_specific_vendor")}</option>
                            </select>
                        </div>
                        {formData.tierType === "vendorType" && (
                            <div className="space-y-2">
                                <Label htmlFor="vendorType">{t("financial.scope_vendor_type")}</Label>
                                <select
                                    id="vendorType"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={formData.vendorType}
                                    onChange={(e) => setFormData({ ...formData, vendorType: e.target.value })}
                                    required
                                >
                                    <option value="" disabled>{t("common.select_type") || "Select Type"}</option>
                                    {uniqueVendorTypes.map((type: any) => (
                                        <option key={type} value={type}>{t(`vendors.types.${type.toLowerCase()}`) || type}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {formData.tierType === "vendorId" && (
                            <div className="space-y-2">
                                <Label htmlFor="vendorId">{t("financial.scope_specific_vendor")}</Label>
                                <select
                                    id="vendorId"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={formData.vendorId}
                                    onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                                    required
                                >
                                    <option value="" disabled>{t("common.select_vendor")}</option>
                                    {vendors.map((v: any) => (
                                        <option key={v.id} value={v.id}>{v.shopName} {v.type ? `(${t(`vendors.types.${v.type.toLowerCase()}`)})` : ""}</option>
                                    ))}
                                </select>
                            </div>
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
