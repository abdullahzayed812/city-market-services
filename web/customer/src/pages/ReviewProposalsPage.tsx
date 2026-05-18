import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft, AlertCircle, Check, X, Scale,
  Info, Package,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { OrderService } from '@/services/api/orderService';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import toast from 'react-hot-toast';

export default function ReviewProposalsPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['order-proposals', orderId],
    queryFn: () => OrderService.getOrderProposals(orderId!),
    enabled: !!orderId,
  });

  const acceptMutation = useMutation({
    mutationFn: OrderService.acceptProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-proposals', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      toast.success('Proposal accepted');
    },
    onError: () => toast.error('Failed to accept proposal'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, cancel }: { id: string; cancel: boolean }) =>
      OrderService.rejectProposal(id, cancel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-proposals', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      toast.success('Proposal rejected');
      setRejectModal(null);
      navigate(`/orders/${orderId}`);
    },
    onError: () => toast.error('Failed to reject proposal'),
  });

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-soft text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-black text-text-primary">Review Proposals</h1>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
        <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700">
          The vendor has proposed changes to some items. Review and accept or reject them.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      ) : proposals.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Package size={48} className="text-primary/30 mb-3" />
          <p className="font-bold text-text-primary">No proposals to review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal: any) => (
            <div key={proposal.id} className="bg-white rounded-2xl shadow-card p-5">
              <h3 className="font-bold text-text-primary text-sm mb-3">
                {proposal.productName || 'Product'}
              </h3>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-text-muted uppercase font-semibold tracking-wide mb-1">
                    You Ordered
                  </p>
                  {proposal.originalQuantity ? (
                    <p className="text-sm font-bold text-text-primary">
                      {proposal.originalQuantity} units
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-text-primary flex items-center gap-1">
                      <Scale size={12} />
                      {(proposal.requestedWeightGrams / 1000).toFixed(2)} kg
                    </p>
                  )}
                </div>
                <div className="bg-primary-xlight rounded-xl p-3">
                  <p className="text-[10px] text-primary uppercase font-semibold tracking-wide mb-1">
                    Vendor Proposes
                  </p>
                  {proposal.proposedQuantity ? (
                    <p className="text-sm font-bold text-primary">
                      {proposal.proposedQuantity} units
                    </p>
                  ) : proposal.proposedWeightGrams ? (
                    <p className="text-sm font-bold text-primary flex items-center gap-1">
                      <Scale size={12} />
                      {(proposal.proposedWeightGrams / 1000).toFixed(2)} kg
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-error">Unavailable</p>
                  )}
                </div>
              </div>

              {proposal.priceDifference !== 0 && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 mb-4">
                  <Info size={14} className="text-text-muted" />
                  <p className="text-xs text-text-muted">
                    Price difference:{' '}
                    <span
                      className={`font-bold ${
                        proposal.priceDifference > 0 ? 'text-error' : 'text-success'
                      }`}
                    >
                      {proposal.priceDifference > 0 ? '+' : ''}
                      {formatPrice(proposal.priceDifference)}
                    </span>
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  fullWidth
                  size="sm"
                  icon={<X size={14} />}
                  onClick={() => setRejectModal({ id: proposal.id })}
                >
                  Reject
                </Button>
                <Button
                  fullWidth
                  size="sm"
                  icon={<Check size={14} />}
                  loading={acceptMutation.isPending}
                  onClick={() => acceptMutation.mutate(proposal.id)}
                >
                  Accept
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject confirmation modal */}
      <Modal
        open={!!rejectModal}
        onClose={() => setRejectModal(null)}
        title="Reject Proposal"
      >
        <p className="text-sm text-text-muted mb-5">
          Do you want to reject just this item or cancel the entire order?
        </p>
        <div className="space-y-3">
          <Button
            variant="outline"
            fullWidth
            loading={rejectMutation.isPending}
            onClick={() => rejectModal && rejectMutation.mutate({ id: rejectModal.id, cancel: false })}
          >
            Reject This Item Only
          </Button>
          <Button
            variant="danger"
            fullWidth
            loading={rejectMutation.isPending}
            onClick={() => rejectModal && rejectMutation.mutate({ id: rejectModal.id, cancel: true })}
          >
            Cancel Entire Order
          </Button>
        </div>
      </Modal>
    </div>
  );
}
