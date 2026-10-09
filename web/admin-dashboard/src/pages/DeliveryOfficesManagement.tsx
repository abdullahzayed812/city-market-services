import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Eye, Phone, Star, Plus } from "lucide-react";
import { CreateOfficeDialog, type CreateOfficeData } from "@/features/offices/components/CreateOfficeDialog";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OfficeReviewPanel } from "@/features/offices/components/OfficeReviewPanel";
import { ListToolbar } from "@/components/ListToolbar";
import { Pagination } from "@/components/ui/pagination";
import { useClientPagination } from "@/hooks/useClientPagination";

const PAGE_SIZE = 20;

type Filter = "ALL" | "PENDING_REVIEW" | "APPROVED" | "SUSPENDED";

const APPROVAL_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  APPROVED: "default",
  PENDING_REVIEW: "outline",
  SUSPENDED: "destructive",
};

// Delivery offices, incl. self-registered ones waiting for review
const DeliveryOfficesManagement: React.FC = () => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [viewId, setViewId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createOffice = useMutation({
    mutationFn: (data: CreateOfficeData) => adminApi.createDeliveryOffice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryOffices"] });
      setCreateOpen(false);
      toast({ description: t("offices.created_success") });
    },
    onError: (error: any) => toast({ variant: "destructive", description: error.response?.data?.message || t("common.error") }),
  });

  const { data: offices = [], isLoading } = useQuery({
    queryKey: ["deliveryOffices", filter],
    queryFn: async () => (await adminApi.getDeliveryOffices(filter === "ALL" ? undefined : filter)).data.data ?? [],
  });

  // Approval is filtered by the server; search and paging happen here (few offices)
  const [search, setSearch] = useState("");
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? offices.filter((o: any) => [o.name, o.phone].some((f: string | undefined) => f?.toLowerCase().includes(q))) : offices;
  }, [offices, search]);
  const { page, setPage, totalPages, pageItems } = useClientPagination(filtered, PAGE_SIZE, `${search}|${filter}`);

  const { data: details, isLoading: detailsLoading, refetch } = useQuery({
    queryKey: ["officeDetails", viewId],
    queryFn: async () => (await adminApi.getOfficeDetails(viewId!)).data.data,
    enabled: !!viewId,
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">{t("offices.title")}</h2>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          {t("offices.add_new")}
        </Button>
      </div>
      <CreateOfficeDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={(data) => createOffice.mutate(data)} isPending={createOffice.isPending} />

      <div className="flex flex-wrap gap-2 mt-4">
        {(["ALL", "PENDING_REVIEW", "APPROVED", "SUSPENDED"] as Filter[]).map((key) => (
          <Button key={key} size="sm" variant={filter === key ? "default" : "outline"} onClick={() => setFilter(key)}>
            {key === "ALL" ? t("couriers.filter_all") : t(`couriers.approval_${key.toLowerCase()}`)}
          </Button>
        ))}
      </div>

      <ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder={t("list.search_offices")} total={filtered.length} />

      {isLoading ? (
        <div className="p-8 text-center">{t("common.loading")}</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("couriers.phone")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("ratings.rating")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      <Building2 size={16} className="text-slate-400" />
                      {o.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone size={14} />
                      {o.phone || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={APPROVAL_BADGE[o.approvalStatus] ?? "outline"}>{t(`couriers.approval_${String(o.approvalStatus).toLowerCase()}`)}</Badge>
                  </TableCell>
                  <TableCell>
                    {o.ratingCount ? (
                      <span className="inline-flex items-center gap-1">
                        <Star size={14} className="fill-amber-400 text-amber-400" />
                        {Number(o.rating).toFixed(1)} <span className="text-xs text-slate-400">({o.ratingCount})</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <Button variant="ghost" size="sm" onClick={() => setViewId(o.id)}>
                      <Eye size={14} className="me-2" />
                      {t("user_details.view")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && <div className="p-8 text-center text-slate-500">{t("list.no_results")}</div>}
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} className="py-4" />
        </div>
      )}

      <Dialog open={!!viewId} onOpenChange={(open) => !open && setViewId(null)}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("offices.review_title")}</DialogTitle>
          </DialogHeader>
          {detailsLoading || !details ? (
            <div className="p-6 text-center">{t("common.loading")}</div>
          ) : (
            <OfficeReviewPanel details={details} onChanged={() => refetch()} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeliveryOfficesManagement;
