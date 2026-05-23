import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, AlertCircle, Check, X, Scale, Info, Package, Store, Tag, Clock, Layers } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { OrderService } from "@/services/api/orderService";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { formatPrice, formatDateTime } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/useLanguage";
import toast from "react-hot-toast";
import type { OrderItemProposal } from "@/types";

enum ProposalType {
  QUANTITY_REDUCTION = "QUANTITY_REDUCTION",
  WEIGHT_ADJUSTMENT = "WEIGHT_ADJUSTMENT",
  UNAVAILABLE = "UNAVAILABLE",
}

export default function ReviewProposalsPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [acceptModal, setAcceptModal] = useState<{ id: string } | null>(null);
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    [ProposalType.QUANTITY_REDUCTION]: { label: t('proposals.type_quantity_reduction'), color: "#FF9500" },
    [ProposalType.WEIGHT_ADJUSTMENT]: { label: t('proposals.type_weight_adjustment'), color: "#FF9500" },
    [ProposalType.UNAVAILABLE]: { label: t('proposals.type_unavailable'), color: "#EF4444" },
  };

  const { data: proposals = [], isLoading } = useQuery<OrderItemProposal[]>({
    queryKey: ["order-proposals", orderId],
    queryFn: () => OrderService.getOrderProposals(orderId!),
    enabled: !!orderId,
  });

  const acceptMutation = useMutation({
    mutationFn: OrderService.acceptProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-proposals", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      toast.success(t('common.accept'));
      setAcceptModal(null);
    },
    onError: () => toast.error(t('proposals.failed_to_accept')),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, cancel }: { id: string; cancel: boolean }) => OrderService.rejectProposal(id, cancel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-proposals", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      toast.success(t('common.reject'));
      setRejectModal(null);
      // If no more proposals, go back
      if (proposals.length <= 1) {
        navigate(`/orders/${orderId}`);
      }
    },
    onError: () => toast.error(t('proposals.failed_to_reject')),
  });

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-soft text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronLeft size={20} className={isRTL ? "rotate-180" : ""} />
        </button>
        <h1 className="text-xl font-black text-text-primary">{t('proposals.title')}</h1>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
        <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700 leading-relaxed">
          {t('proposals.info_text')}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center bg-white rounded-3xl shadow-card p-8">
          <div className="w-20 h-20 bg-success-light rounded-full flex items-center justify-center mb-4">
            <Check size={40} className="text-success" />
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-2">{t('proposals.no_proposals')}</h3>
          <p className="text-sm text-text-muted mb-6">{t('proposals.all_processed')}</p>
          <Button onClick={() => navigate(-1)}>{t('common.go_back')}</Button>
        </div>
      ) : (
        <div className="space-y-5">
          {proposals.map((proposal: OrderItemProposal) => {
            const typeCfg = TYPE_CONFIG[proposal.type] || { label: proposal.type, color: "#6B7280" };
            return (
              <div key={proposal.id} className="bg-white rounded-3xl shadow-card overflow-hidden">
                {/* Card Header */}
                <div className="p-5 border-b border-border-light bg-gray-50/50">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Store size={14} className="text-primary" />
                        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">{proposal.vendorName || t('common.vendor')}</span>
                      </div>
                      <h3 className="font-black text-text-primary text-lg leading-tight">{proposal.productName}</h3>
                    </div>
                    <div
                      className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap"
                      style={{ backgroundColor: typeCfg.color }}
                    >
                      {typeCfg.label}
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                    {/* Original */}
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                      <p className="text-[10px] text-text-muted uppercase font-black tracking-widest mb-2 flex items-center gap-1.5">
                        <Tag size={10} />
                        {t('proposals.original_order')}
                      </p>
                      <div className="flex items-baseline gap-1.5">
                        {proposal.originalQuantity ? (
                          <span className="text-lg font-black text-text-primary">{proposal.originalQuantity}</span>
                        ) : (
                          <span className="text-lg font-black text-text-primary">{((proposal.requestedWeightGrams || 0) / 1000).toFixed(2)}</span>
                        )}

                        <span className="text-xs font-bold text-text-muted">{proposal.originalQuantity ? t('proposals.units') : t('common.kg')}</span>
                      </div>
                    </div>

                    {/* Proposed */}
                    <div className="bg-primary-xlight rounded-2xl p-4 border border-primary/10">
                      <p className="text-[10px] text-primary uppercase font-black tracking-widest mb-2 flex items-center gap-1.5">
                        <RefreshCw size={10} />
                        {t('proposals.review_button')}
                      </p>
                      <div className="flex items-baseline gap-1.5">
                        {proposal.proposedQuantity ? (
                          <span className="text-lg font-black text-primary">{proposal.proposedQuantity}</span>
                        ) : proposal.proposedWeightGrams ? (
                          <span className="text-lg font-black text-primary">{((proposal.proposedWeightGrams || 0) / 1000).toFixed(2)}</span>
                        ) : (
                          <span className="text-lg font-black text-error">0</span>
                        )}

                        <span className="text-xs font-bold text-primary/60">
                          {proposal.proposedQuantity ? t('proposals.units') : proposal.proposedWeightGrams ? t('common.kg') : t('proposals.type_unavailable')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Details List */}
                  <div className="space-y-3 mb-6">
                    {proposal.priceDifference !== undefined && proposal.priceDifference !== 0 && (
                      <div className="flex items-center justify-between text-sm py-2 px-1 border-b border-gray-50">
                        <div className="flex items-center gap-2 text-text-muted font-medium">
                          <Info size={14} />
                          {t('proposals.price_difference')}
                        </div>
                        <span className={`font-black ${proposal.priceDifference > 0 ? "text-error" : "text-success"}`}>
                          {proposal.priceDifference > 0 ? "+" : ""}
                          {formatPrice(proposal.priceDifference)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm py-2 px-1 border-b border-gray-50">
                      <div className="flex items-center gap-2 text-text-muted font-medium">
                        <Clock size={14} />
                        {t('common.date')}
                      </div>
                      <span className="font-bold text-text-primary">{formatDateTime(proposal.createdAt)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      fullWidth
                      size="lg"
                      icon={<X size={18} />}
                      onClick={() => setRejectModal({ id: proposal.id })}
                      className="rounded-2xl border-2"
                    >
                      {t('common.reject')}
                    </Button>
                    <Button
                      fullWidth
                      size="lg"
                      icon={<Check size={18} />}
                      onClick={() => setAcceptModal({ id: proposal.id })}
                      className="rounded-2xl shadow-primary-glow"
                    >
                      {t('common.accept')}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accept confirmation modal */}
      <Modal open={!!acceptModal} onClose={() => setAcceptModal(null)} title={t('proposals.confirm_accept_title')}>
        <p className="text-sm text-text-muted mb-6 leading-relaxed">
          {t('proposals.confirm_accept_message')}
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" fullWidth onClick={() => setAcceptModal(null)}>
            {t('common.cancel')}
          </Button>
          <Button fullWidth loading={acceptMutation.isPending} onClick={() => acceptModal && acceptMutation.mutate(acceptModal.id)}>
            {t('common.confirm')}
          </Button>
        </div>
      </Modal>

      {/* Reject confirmation modal */}
      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)} title={t('proposals.reject_proposal_title')}>
        <p className="text-sm text-text-muted mb-6 leading-relaxed">
          {t('proposals.reject_proposal_message')}
        </p>
        <div className="space-y-3">
          <Button
            variant="outline"
            fullWidth
            className="h-12 border-2"
            loading={rejectMutation.isPending}
            onClick={() => rejectModal && rejectMutation.mutate({ id: rejectModal.id, cancel: false })}
          >
            {t('proposals.cancel_shop_label')}
          </Button>
          <Button
            variant="danger"
            fullWidth
            className="h-12"
            loading={rejectMutation.isPending}
            onClick={() => rejectModal && rejectMutation.mutate({ id: rejectModal.id, cancel: true })}
          >
            {t('proposals.cancel_entire_order_label')}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setRejectModal(null)}>
            {t('common.cancel')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// Helper icons
function RefreshCw({ size, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size || 24}
      height={size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
