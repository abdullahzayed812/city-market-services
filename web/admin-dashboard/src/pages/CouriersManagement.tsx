import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bike, Phone, User, Plus, PowerOff, CheckCircle2, Ban, FileText, Eye, XCircle } from "lucide-react";
import { EventType } from "@city-market/shared";
import { useSocket } from "@/contexts/SocketContext";
import { CourierDetailsDialog } from "@/features/couriers/components/CourierDetailsDialog";
import { ListToolbar, FilterSelect } from "@/components/ListToolbar";
import { Pagination } from "@/components/ui/pagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const PAGE_SIZE = 20;
import { useToast } from "@/hooks/use-toast";
import CreateCourierDialog from "@/features/couriers/components/CreateCourierDialog";

type CourierFilter = "ALL" | "OFFICE" | "FREELANCE" | "PENDING_REVIEW";

const FILTER_PARAMS: Record<CourierFilter, { courierType?: "OFFICE" | "FREELANCE"; approvalStatus?: string }> = {
  ALL: {},
  OFFICE: { courierType: "OFFICE" },
  FREELANCE: { courierType: "FREELANCE" },
  // Freelance signups and office couriers requested by managers
  PENDING_REVIEW: { approvalStatus: "PENDING_REVIEW" },
};

const APPROVAL_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  APPROVED: "default",
  PENDING_REVIEW: "outline",
  SUSPENDED: "destructive",
  REJECTED: "destructive",
};

const CouriersManagement: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [filter, setFilter] = useState<CourierFilter>("ALL");
  const [viewCourierId, setViewCourierId] = useState<string | null>(null);

  // A manager just requested a new office courier: refresh so it shows under "Pending review"
  const { socket } = useSocket();
  React.useEffect(() => {
    if (!socket) return;
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["adminCouriers"] });
    socket.on(EventType.COURIER_REVIEW_REQUESTED, refresh);
    return () => {
      socket.off(EventType.COURIER_REVIEW_REQUESTED, refresh);
    };
  }, [socket, queryClient]);

  // Server-side filters + paging (list and count use the same filters)
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const params = {
    ...FILTER_PARAMS[filter],
    search: debouncedSearch || undefined,
    status: status === "all" ? undefined : status,
  };
  React.useEffect(() => setPage(1), [filter, debouncedSearch, status]);

  const { data: couriers, isLoading, isFetching } = useQuery({
    queryKey: ["adminCouriers", params, page],
    queryFn: async () => (await adminApi.getCouriers({ ...params, page, limit: PAGE_SIZE })).data.data,
    placeholderData: (previous) => previous,
  });
  const { data: total = 0 } = useQuery({
    queryKey: ["adminCouriers", "count", params],
    queryFn: async () => (await adminApi.getCouriersCount(params)).data.data?.total ?? 0,
  });

  const onError = (error: any) => {
    toast({
      variant: "destructive",
      description: error.response?.data?.message || t("common.error"),
    });
  };

  const createCourierMutation = useMutation({
    mutationFn: (data: any) => adminApi.registerCourier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCouriers"] });
      setIsCreateDialogOpen(false);
      toast({ description: t("couriers.created_success") });
    },
    onError,
  });

  const deactivateCourierMutation = useMutation({
    mutationFn: (id: string) => adminApi.deactivateCourier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCouriers"] });
      toast({ description: t("couriers.status_updated") });
    },
    onError,
  });

  const approvalMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "APPROVED" | "SUSPENDED" | "REJECTED" }) => adminApi.setCourierApproval(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCouriers"] });
      toast({ description: t("couriers.status_updated") });
    },
    onError,
  });

  return (
    <div className="">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">{t("common.couriers")}</h2>
        <div className="flex gap-4 items-center">
          <Button className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus size={16} />
            {t("couriers.add_new")}
          </Button>

          <CreateCourierDialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
            onSubmit={(data) => createCourierMutation.mutate(data)}
            isPending={createCourierMutation.isPending}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {(Object.keys(FILTER_PARAMS) as CourierFilter[]).map((key) => (
          <Button key={key} size="sm" variant={filter === key ? "default" : "outline"} onClick={() => setFilter(key)}>
            {t(`couriers.filter_${key.toLowerCase()}`)}
          </Button>
        ))}
      </div>

      <ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder={t("list.search_couriers")} total={total}>
        <FilterSelect
          value={status}
          onChange={setStatus}
          allLabel={t("list.all_statuses")}
          options={[
            { value: "active", label: t("list.active") },
            { value: "inactive", label: t("list.inactive") },
          ]}
        />
      </ListToolbar>

      {isLoading ? (
        <div className="p-8 text-center">{t("common.loading")}</div>
      ) : (
        <div className={`bg-white rounded-lg shadow-sm border border-gray-100 overflow-x-auto ${isFetching ? "opacity-60" : ""}`}>
          {couriers?.length === 0 && <div className="p-8 text-center text-slate-500">{t("list.no_results")}</div>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("couriers.courier_type")}</TableHead>
                <TableHead>{t("couriers.vehicle")}</TableHead>
                <TableHead>{t("couriers.phone")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {couriers?.map((courier) => {
                const isFreelance = courier.courierType === "FREELANCE";
                return (
                  <TableRow key={courier.id}>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center me-3 text-slate-500">
                          <User size={16} />
                        </div>
                        <span className="font-medium">{courier.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant="secondary">{isFreelance ? t("couriers.type_freelance") : t("couriers.type_office")}</Badge>
                        {courier.approvalStatus && (
                          <Badge variant={APPROVAL_BADGE[courier.approvalStatus] ?? "outline"}>
                            {t(`couriers.approval_${courier.approvalStatus.toLowerCase()}`)}
                          </Badge>
                        )}
                        {/* Signup documents to review before approving */}
                        {(courier.nationalIdUrl || courier.licenseUrl) && (
                          <div className="flex gap-2 text-xs">
                            {courier.nationalIdUrl && (
                              <a href={courier.nationalIdUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                                <FileText size={12} />
                                {t("couriers.national_id")}
                              </a>
                            )}
                            {courier.licenseUrl && (
                              <a href={courier.licenseUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                                <FileText size={12} />
                                {t("couriers.license")}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-gray-600">
                        <Bike size={14} className="me-2" />
                        {courier.vehicleType || "Motorcycle"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-gray-600">
                        <Phone size={14} className="me-2" />
                        {courier.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={courier.isActive ? "default" : "secondary"}>
                        {courier.isActive ? t("common.active") : t("common.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => setViewCourierId(courier.id)}>
                        <Eye size={14} className="me-2" />
                        {t("user_details.view")}
                      </Button>
                      {courier.approvalStatus !== "APPROVED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={approvalMutation.isPending}
                          onClick={() => approvalMutation.mutate({ id: courier.id, status: "APPROVED" })}
                        >
                          <CheckCircle2 size={14} className="me-2 text-emerald-600" />
                          {t("couriers.approve")}
                        </Button>
                      )}
                      {courier.approvalStatus === "PENDING_REVIEW" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={approvalMutation.isPending}
                          onClick={() => approvalMutation.mutate({ id: courier.id, status: "REJECTED" })}
                        >
                          <XCircle size={14} className="me-2 text-destructive" />
                          {t("couriers.reject")}
                        </Button>
                      )}
                      {courier.approvalStatus === "APPROVED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={approvalMutation.isPending}
                          onClick={() => approvalMutation.mutate({ id: courier.id, status: "SUSPENDED" })}
                        >
                          <Ban size={14} className="me-2 text-amber-600" />
                          {t("couriers.suspend")}
                        </Button>
                      )}
                      {/* Deactivation is one-way: couriers are kept for settlement history, not reactivated */}
                      {courier.isActive && (
                        <Button variant="ghost" size="sm" onClick={() => deactivateCourierMutation.mutate(courier.id)}>
                          <PowerOff size={14} className="me-2 text-destructive" />
                          {t("common.deactivate")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination currentPage={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} onPageChange={setPage} className="py-4" />
        </div>
      )}
      <CourierDetailsDialog courierId={viewCourierId} onClose={() => setViewCourierId(null)} />
    </div>
  );
};

export default CouriersManagement;
