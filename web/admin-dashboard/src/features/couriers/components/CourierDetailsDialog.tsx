import React from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/api/admin-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CourierReviewPanel } from "./CourierReviewPanel";

// Opened from the couriers list: review one courier (documents, record, actions)
export const CourierDetailsDialog: React.FC<{ courierId: string | null; onClose: () => void }> = ({ courierId, onClose }) => {
  const { t } = useTranslation();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["adminCourierDetails", courierId],
    queryFn: async () => (await adminApi.getCourierDetails(courierId!)).data.data,
    enabled: !!courierId,
  });

  return (
    <Dialog open={!!courierId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("courier_review.title")}</DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <div className="p-6 text-center">{t("common.loading")}</div>
        ) : (
          <CourierReviewPanel details={data} onChanged={() => refetch()} />
        )}
      </DialogContent>
    </Dialog>
  );
};
