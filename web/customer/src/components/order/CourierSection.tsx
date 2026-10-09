import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Bike, Phone, Search, CheckCircle, Star } from "lucide-react";
import {
  DeliveryService,
  type OrderCourier,
} from "@/services/api/deliveryService";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const STATUS_KEY: Record<string, string> = {
  PENDING: "courier.finding",
  ACCEPTED: "courier.finding",
  ASSIGNED: "courier.heading_to_store",
  PICKED_UP: "courier.picked_up",
  ON_THE_WAY: "courier.on_the_way",
  DELIVERED: "courier.delivered",
};

// Who is bringing the order, with a call link. Keyed under ["order", id] so the
// socket hook's per-order invalidation refreshes it too.
export function CourierSection({
  orderId,
  enabled,
}: {
  orderId: string;
  enabled: boolean;
}) {
  const { t } = useTranslation();
  const { data: deliveries = [] } = useQuery({
    queryKey: ["order", orderId, "couriers"],
    queryFn: () => DeliveryService.getOrderCouriers(orderId),
    enabled,
  });

  if (!enabled || deliveries.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl shadow-card p-5 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 bg-primary-xlight rounded-xl flex items-center justify-center">
          <Bike size={16} className="text-primary" />
        </div>
        <h2 className="font-bold text-text-primary text-sm">
          {t(deliveries.length > 1 ? "courier.title_plural" : "courier.title")}
        </h2>
      </div>
      <div className="space-y-3">
        {deliveries.map((d, i) => (
          <CourierRow
            key={d.deliveryId}
            orderId={orderId}
            delivery={d}
            label={
              deliveries.length > 1
                ? t("courier.delivery_n_of_m", {
                    n: i + 1,
                    m: deliveries.length,
                  })
                : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}

function CourierRow({
  orderId,
  delivery,
  label,
}: {
  orderId: string;
  delivery: OrderCourier;
  label?: string;
}) {
  const { t } = useTranslation();
  const [ratingOpen, setRatingOpen] = useState(false);
  const { courier, status, officeName, myRating, canRate } = delivery;
  const statusText = t(STATUS_KEY[status] ?? "courier.finding");
  const vehicle = courier
    ? [
        officeName,
        courier.vehicleType
          ? t(
              `courier.vehicle_${courier.vehicleType.toLowerCase()}`,
              courier.vehicleType,
            )
          : null,
        courier.licensePlate,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-11 h-11 rounded-full bg-primary-xlight flex items-center justify-center shrink-0">
          {courier ? (
            <Bike size={20} className="text-primary" />
          ) : status === "DELIVERED" ? (
            <CheckCircle size={20} className="text-success" />
          ) : (
            <Search size={20} className="text-text-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {label && <p className="text-xs text-text-muted">{label}</p>}
          {courier && (
            <p className="font-bold text-text-primary text-sm truncate">
              {courier.name}
            </p>
          )}
          {vehicle && (
            <p className="text-xs text-text-secondary truncate">{vehicle}</p>
          )}
          <p className="text-xs text-primary mt-0.5">{statusText}</p>
        </div>
        {courier?.phone && (
          <a
            href={`tel:${courier.phone}`}
            className="flex items-center gap-2 bg-success text-white text-sm font-bold px-4 h-10 rounded-full hover:opacity-90 transition-opacity"
            title={courier.phone}
          >
            <Phone size={16} />
            {t("courier.call")}
          </a>
        )}
      </div>

      {/* After delivery: rate once (courier, and their office for office deliveries), then show the stars */}
      {status === "DELIVERED" && myRating && (
        <div className="flex items-center gap-1 mt-3 ps-14 text-xs text-text-secondary">
          <span className="me-1">{t("courier.your_rating")}</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              size={14}
              className={
                n <= myRating.stars
                  ? "fill-accent text-accent"
                  : "text-gray-300"
              }
            />
          ))}
        </div>
      )}
      {canRate && (
        <div className="mt-3 ps-14">
          <Button size="sm" onClick={() => setRatingOpen(true)}>
            <Star size={14} className="me-1" />
            {t("courier.rate_delivery")}
          </Button>
          <DeliveryRatingModal
            open={ratingOpen}
            onClose={() => setRatingOpen(false)}
            orderId={orderId}
            deliveryId={delivery.deliveryId}
            subject={
              courier
                ? officeName
                  ? `${courier.name} · ${officeName}`
                  : courier.name
                : ""
            }
          />
        </div>
      )}
    </div>
  );
}

function DeliveryRatingModal({
  open,
  onClose,
  orderId,
  deliveryId,
  subject,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  deliveryId: string;
  subject: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      DeliveryService.rateDelivery(
        deliveryId,
        stars,
        comment.trim() || undefined,
      ),
    onSuccess: () => {
      toast.success(t("rating.thank_you_generic"));
      queryClient.invalidateQueries({
        queryKey: ["order", orderId, "couriers"],
      });
      onClose();
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || t("rating.submit_failed")),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t("courier.rate_delivery")}: ${subject}`}
    >
      <div className="text-center">
        <div className="flex justify-center gap-2 mb-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStars(n)}
              aria-label={`${n}`}
            >
              <Star
                size={32}
                className={`transition-colors ${n <= stars ? "fill-accent text-accent" : "text-gray-300"}`}
              />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          placeholder={t("rating.comment_placeholder")}
          className="w-full h-24 px-4 py-3 bg-gray-50 border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        <div className="flex gap-3 mt-4">
          <Button variant="ghost" fullWidth onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            fullWidth
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t("orders.submit_review")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
