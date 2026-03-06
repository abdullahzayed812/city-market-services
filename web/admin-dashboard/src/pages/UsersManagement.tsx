import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Shield, UserCheck, UserMinus } from "lucide-react";
import { UserStatus } from "@city-market/shared";

const UsersManagement: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["adminUsers"],
    queryFn: async () => {
      const response = await adminApi.getUsers();
      return response.data.data?.data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) => adminApi.updateUserStatus(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["adminUsers"] }),
  });

  if (isLoading) return <div className="p-8 text-center">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">{t("common.users")}</h2>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
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
            {users?.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center me-3 text-slate-500">
                      <User size={16} />
                    </div>
                    <span className="font-medium">{user.name}</span>
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
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={
                      user.status === UserStatus.ACTIVE
                        ? "text-destructive hover:text-destructive"
                        : "text-emerald-600 hover:text-emerald-600"
                    }
                    onClick={() =>
                      updateStatusMutation.mutate({
                        id: user.id,
                        status: user.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE,
                      })
                    }
                  >
                    {user.status === UserStatus.ACTIVE ? (
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
      </div>
    </div>
  );
};

export default UsersManagement;
