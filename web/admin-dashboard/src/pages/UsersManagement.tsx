import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Shield, UserCheck, UserMinus, Plus, Eye } from "lucide-react";
import { UserDetailsDialog } from "@/features/users/components/UserDetailsDialog";
import { UserRole, UserStatus, type User as SharedUser } from "@city-market/shared";
import { ListToolbar, FilterSelect } from "@/components/ListToolbar";
import { Pagination } from "@/components/ui/pagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const PAGE_SIZE = 20;
import { useToast } from "@/hooks/use-toast";
import CreateUserDialog from "@/features/users/components/CreateUserDialog";

const UsersManagement: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [viewUser, setViewUser] = useState<SharedUser | null>(null);

  // Server-side filters + paging
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const params = {
    search: debouncedSearch || undefined,
    role: role === "all" ? undefined : role,
    status: status === "all" ? undefined : status,
  };
  React.useEffect(() => setPage(1), [debouncedSearch, role, status]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["adminUsers", params, page],
    queryFn: async () => (await adminApi.getUsers({ ...params, page, limit: PAGE_SIZE })).data.data,
    placeholderData: (previous) => previous,
  });
  const users = data?.data;
  const total = data?.total ?? 0;

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) => adminApi.updateUserStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      toast({ description: t("users.status_updated") });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (data: any) => adminApi.registerUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      setIsCreateDialogOpen(false);
      toast({ description: t("users.created_success") });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: error.response?.data?.message || t("common.error"),
      });
    },
  });



  return (
    <div className="">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">{t("common.users")}</h2>
        <Button className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus size={16} />
          {t("users.create_new")}
        </Button>
        <CreateUserDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSubmit={(data) => createUserMutation.mutate(data)}
          isPending={createUserMutation.isPending}
        />
      </div>

      <ListToolbar search={search} onSearchChange={setSearch} searchPlaceholder={t("list.search_users")} total={total}>
        <FilterSelect
          value={role}
          onChange={setRole}
          allLabel={t("list.all_roles")}
          options={Object.values(UserRole).map((r) => ({ value: r, label: r }))}
        />
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

      <div className={`bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden ${isFetching ? "opacity-60" : ""}`}>
        {isLoading && <div className="p-8 text-center">{t("common.loading")}</div>}
        {!isLoading && users?.length === 0 && <div className="p-8 text-center text-slate-500">{t("list.no_results")}</div>}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.email")}</TableHead>
              <TableHead>{t("common.role")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user: SharedUser) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center me-3 text-slate-500">
                      <User size={16} />
                    </div>
                    <span className="font-medium">{user.name || `${user.firstName || ""} ${user.lastName || ""}`}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center text-gray-600 text-sm">
                    <Mail size={14} className="me-2 text-slate-400" />
                    {user.email}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <Shield size={14} className="me-2 text-slate-400" />
                    <span className="text-sm">{user.role}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? "default" : "secondary"}>
                    {user.isActive ? t("common.active") : t("common.inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-end whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => setViewUser(user)}>
                    <Eye className="h-4 w-4 me-2" />
                    {t("user_details.view")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={
                      user.isActive
                        ? "text-destructive hover:text-destructive"
                        : "text-emerald-600 hover:text-emerald-600"
                    }
                    onClick={() =>
                      updateStatusMutation.mutate({
                        id: user.id,
                        status: user.isActive ? UserStatus.INACTIVE : UserStatus.ACTIVE,
                      })
                    }
                  >
                    {user.isActive ? (
                      <>
                        <UserMinus className="h-4 w-4 me-2" />
                        {t("common.deactivate")}
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4 me-2" />
                        {t("common.activate")}
                      </>
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination currentPage={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} onPageChange={setPage} className="py-4" />
        <UserDetailsDialog user={viewUser} onClose={() => setViewUser(null)} />
      </div>
    </div>
  );
};

export default UsersManagement;
