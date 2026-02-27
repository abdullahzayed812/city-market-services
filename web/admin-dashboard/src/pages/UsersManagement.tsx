import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type UserStatus } from "@city-market/shared";
import { UserStatus as UserStatusEnum } from "@city-market/shared";
import { MoreHorizontal, UserCheck, UserX } from "lucide-react";

const UsersManagement: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users", roleFilter],
    queryFn: async () => {
      try {
        const response = await adminApi.getUsers(roleFilter);
        return response?.data?.data?.data;
      } catch (error) {
        // Mock data
        return [
          {
            id: "1",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            role: "customer",
            status: UserStatusEnum.ACTIVE,
          },
          {
            id: "2",
            firstName: "Jane",
            lastName: "Smith",
            email: "jane@vendor.com",
            role: "vendor",
            status: UserStatusEnum.ACTIVE,
          },
          {
            id: "3",
            firstName: "Bob",
            lastName: "Wilson",
            email: "bob@courier.com",
            role: "courier",
            status: UserStatusEnum.INACTIVE,
          },
        ];
      }
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) => adminApi.updateUserStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  if (isLoading) return <div>{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">{t("common.users")}</h2>
        <div className="w-[200px]">
          <Select value={roleFilter || "all"} onValueChange={(val) => setRoleFilter(val === "all" ? undefined : val)}>
            <SelectTrigger>
              <SelectValue placeholder={t("common.filter_by_role", "Filter by Role")} />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] overflow-y-auto">
              <SelectItem value="all">{t("common.all_roles", "All Roles")}</SelectItem>
              <SelectItem value="customer">{t("common.customers")}</SelectItem>
              <SelectItem value="vendor">{t("common.vendors")}</SelectItem>
              <SelectItem value="courier">{t("common.couriers")}</SelectItem>
              <SelectItem value="admin">{t("common.admins", "Admins")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.email")}</TableHead>
              <TableHead>{t("common.role")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user: any) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? "default" : "destructive"}>
                    {user.isActive ? t("common.active") : t("common.inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => updateStatusMutation.mutate({ id: user.id, status: UserStatusEnum.ACTIVE })}
                        disabled={user.status === UserStatusEnum.ACTIVE}
                      >
                        <UserCheck className="me-2 h-4 w-4" />
                        {t("common.activate")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateStatusMutation.mutate({ id: user.id, status: UserStatusEnum.INACTIVE })}
                        disabled={user.status === UserStatusEnum.INACTIVE}
                        className="text-destructive"
                      >
                        <UserX className="me-2 h-4 w-4" />
                        {t("common.deactivate")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UsersManagement;
