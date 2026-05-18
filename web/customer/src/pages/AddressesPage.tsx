import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Plus, Trash2, Home, Briefcase, ChevronLeft, Navigation,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserService } from '@/services/api/userService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';
import type { Address } from '@/types';

const ADDRESS_ICONS: Record<string, typeof Home> = {
  Home,
  Work: Briefcase,
  Other: MapPin,
};

const LABEL_OPTIONS = ['Home', 'Work', 'Other'];

export default function AddressesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ label: 'Home', address: '', latitude: '', longitude: '' });

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: UserService.getAddresses,
  });

  const addMutation = useMutation({
    mutationFn: UserService.addAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast.success('Address added!');
      setAddOpen(false);
      setForm({ label: 'Home', address: '', latitude: '', longitude: '' });
    },
    onError: () => toast.error('Failed to add address'),
  });

  const deleteMutation = useMutation({
    mutationFn: UserService.deleteAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast.success('Address removed');
    },
    onError: () => toast.error('Failed to remove address'),
  });

  const handleAdd = () => {
    if (!form.address.trim()) {
      toast.error('Please enter an address');
      return;
    }
    addMutation.mutate({
      label: form.label,
      address: form.address.trim(),
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
    });
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-soft text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-black text-text-primary tracking-tight">Addresses</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="ml-auto flex items-center gap-1.5 text-sm font-bold text-primary-darker bg-primary-xlight px-3 py-2 rounded-xl hover:bg-primary-light transition-colors"
        >
          <Plus size={16} />
          Add New
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : addresses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-primary-xlight rounded-full flex items-center justify-center mb-4">
            <MapPin size={36} className="text-primary" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-2">No addresses yet</h3>
          <p className="text-sm text-text-muted mb-6">
            Add a delivery address to checkout faster
          </p>
          <Button onClick={() => setAddOpen(true)} icon={<Plus size={16} />}>
            Add Address
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {addresses.map((address: Address) => {
              const Icon = ADDRESS_ICONS[address.label] || MapPin;
              return (
                <motion.div
                  key={address.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white rounded-2xl shadow-card p-4 flex items-start gap-3"
                >
                  <div className="w-10 h-10 bg-primary-xlight rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-text-primary">{address.label}</span>
                      {address.isDefault && (
                        <span className="text-[10px] font-bold text-primary-darker bg-primary-xlight px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed">{address.address}</p>
                    {address.latitude && address.longitude && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-text-muted">
                        <Navigation size={10} />
                        {address.latitude.toFixed(4)}, {address.longitude.toFixed(4)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(address.id)}
                    disabled={deleteMutation.isPending}
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-text-muted hover:bg-error-light hover:text-error transition-colors flex-shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add New Address">
        <div className="space-y-4">
          {/* Label */}
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide block mb-2">
              Label
            </label>
            <div className="flex gap-2">
              {LABEL_OPTIONS.map((opt) => {
                const Icon = ADDRESS_ICONS[opt] || MapPin;
                return (
                  <button
                    key={opt}
                    onClick={() => setForm((f) => ({ ...f, label: opt }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                      form.label === opt
                        ? 'border-primary bg-primary-xlight text-primary-darker'
                        : 'border-border text-text-muted hover:border-gray-300'
                    }`}
                  >
                    <Icon size={15} />
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            label="Street Address"
            placeholder="123 Main Street, City, Country"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            icon={<MapPin size={18} />}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Latitude (optional)"
              type="number"
              placeholder="25.2048"
              value={form.latitude}
              onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
            />
            <Input
              label="Longitude (optional)"
              type="number"
              placeholder="55.2708"
              value={form.longitude}
              onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button fullWidth loading={addMutation.isPending} onClick={handleAdd}>
              Add Address
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
