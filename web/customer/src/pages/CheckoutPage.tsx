import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin, Plus, Check, CreditCard, Ban, ArrowRight,
  AlertCircle, ChevronLeft,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { UserService } from '@/services/api/userService';
import { OrderService } from '@/services/api/orderService';
import { useCartStore, selectCartTotal } from '@/store/cartStore';
import { MeasurementType } from '@/types';
import { formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import type { Address } from '@/types';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const total = useCartStore(selectCartTotal);
  const clearCart = useCartStore((s) => s.clearCart);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: UserService.getProfile,
  });

  const { data: addressesData, isLoading: addressesLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: UserService.getAddresses,
  });

  const addresses: Address[] = addressesData ?? [];

  // Auto-select first/default address when addresses load
  if (addresses.length > 0 && !selectedAddressId) {
    const def = addresses.find((a) => a.isDefault) || addresses[0];
    if (def) setSelectedAddressId(def.id);
  }

  const selectedAddress = addresses.find((a: Address) => a.id === selectedAddressId);

  const { data: deliveryFee = 0, isLoading: deliveryFeeLoading } = useQuery({
    queryKey: ['delivery-fee', selectedAddressId, items.map((i) => i.id).join(',')],
    queryFn: () =>
      OrderService.getDeliveryFee(
        selectedAddress!.latitude!,
        selectedAddress!.longitude!,
        Array.from(new Set(items.map((i) => i.vendorId))),
      ),
    enabled: !!selectedAddress?.latitude && !!selectedAddress?.longitude && items.length > 0,
    placeholderData: 15,
  });

  const grandTotal = total + (deliveryFee || 0);
  const hasPenalty = profile?.hasPenalty === true;

  const orderMutation = useMutation({
    mutationFn: OrderService.createOrder,
    onSuccess: () => {
      clearCart();
      toast.success('Order placed successfully!');
      navigate('/orders');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to place order. Please try again.');
    },
  });

  const handleConfirmOrder = () => {
    if (!selectedAddressId || !selectedAddress) {
      toast.error('Please select a delivery address');
      return;
    }

    orderMutation.mutate({
      items: items.map((item) => ({
        vendorProductId: item.id,
        quantity: item.measurementType === MeasurementType.UNIT ? item.quantity : undefined,
        weightGrams: item.measurementType === MeasurementType.WEIGHT ? item.weightGrams : undefined,
      })),
      deliveryAddress: selectedAddress.address,
      deliveryLatitude: selectedAddress.latitude,
      deliveryLongitude: selectedAddress.longitude,
    });
  };

  const isDisabled = orderMutation.isPending || hasPenalty || !selectedAddressId;

  if (addressesLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-soft text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-black text-text-primary tracking-tight">Checkout</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Address + Payment */}
        <div className="lg:col-span-2 space-y-5">

          {/* Delivery Address */}
          <section className="bg-white rounded-2xl shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-text-primary">Delivery Address</h2>
              <Link
                to="/addresses"
                className="flex items-center gap-1.5 text-sm font-semibold text-primary-darker bg-primary-xlight px-3 py-1.5 rounded-full hover:bg-primary-light transition-colors"
              >
                <Plus size={14} />
                Add New
              </Link>
            </div>

            {addresses.length === 0 ? (
              <Link to="/addresses">
                <div className="border-2 border-dashed border-border rounded-2xl p-8 flex flex-col items-center text-center hover:border-primary transition-colors">
                  <div className="w-12 h-12 bg-primary-xlight rounded-full flex items-center justify-center mb-3">
                    <MapPin size={22} className="text-primary-darker" />
                  </div>
                  <p className="font-bold text-primary-darker mb-1">Add a delivery address</p>
                  <p className="text-xs text-text-muted">Tap to add your delivery location</p>
                </div>
              </Link>
            ) : (
              <div className="space-y-3">
                {addresses.map((address: Address) => {
                  const isSelected = selectedAddressId === address.id;
                  return (
                    <motion.button
                      key={address.id}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelectedAddressId(address.id)}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? 'border-primary bg-primary-xlight'
                          : 'border-border bg-white hover:border-gray-300'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-primary' : 'bg-gray-100'
                        }`}
                      >
                        <MapPin
                          size={18}
                          className={isSelected ? 'text-white' : 'text-text-muted'}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-bold mb-0.5 ${
                            isSelected ? 'text-primary' : 'text-text-primary'
                          }`}
                        >
                          {address.label}
                        </p>
                        <p className="text-xs text-text-muted leading-relaxed line-clamp-2">
                          {address.address}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <Check size={13} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Payment Method */}
          <section className="bg-white rounded-2xl shadow-card p-5">
            <h2 className="font-bold text-text-primary mb-4">Payment Method</h2>

            {hasPenalty ? (
              <div className="flex items-start gap-3 bg-error-light border border-red-200 rounded-xl p-4">
                <Ban size={20} className="text-error flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-error mb-1">COD Blocked</p>
                  <p className="text-xs text-red-700">
                    Cash on delivery is unavailable due to a previous order issue. Please
                    contact support.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-primary bg-primary-xlight">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <CreditCard size={18} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-text-primary">Cash on Delivery</p>
                  <p className="text-xs text-text-muted">Pay when your order arrives</p>
                </div>
                <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right: Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-card p-5 sticky top-24">
            <h2 className="font-bold text-text-primary mb-4">Order Summary</h2>

            {/* Items */}
            <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
              {items.map((item) => {
                const isWeight = item.measurementType === MeasurementType.WEIGHT;
                const lineTotal = isWeight
                  ? (item.price * (item.weightGrams || 0)) / 1000
                  : item.price * (item.quantity || 0);
                return (
                  <div key={item.id} className="flex justify-between text-xs">
                    <span className="text-text-muted truncate flex-1 pr-2">{item.name}</span>
                    <span className="font-semibold text-text-primary flex-shrink-0">
                      {formatPrice(lineTotal)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="h-px bg-border mb-3" />

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Subtotal</span>
                <span className="font-semibold">{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Delivery fee</span>
                <span className="font-semibold">
                  {deliveryFeeLoading ? (
                    <span className="text-text-muted">Calculating...</span>
                  ) : (
                    formatPrice(deliveryFee || 0)
                  )}
                </span>
              </div>
            </div>

            <div className="h-px bg-border mb-4" />

            <div className="flex justify-between items-center mb-5">
              <span className="font-bold text-text-primary">Total</span>
              <span className="text-2xl font-black text-primary">{formatPrice(grandTotal)}</span>
            </div>

            <Button
              fullWidth
              size="lg"
              onClick={handleConfirmOrder}
              disabled={isDisabled}
              loading={orderMutation.isPending}
              iconRight={<ArrowRight size={18} />}
            >
              Confirm Order
            </Button>

            {hasPenalty && (
              <div className="flex items-center gap-2 mt-3 text-xs text-error">
                <AlertCircle size={13} />
                COD unavailable. Contact support.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
