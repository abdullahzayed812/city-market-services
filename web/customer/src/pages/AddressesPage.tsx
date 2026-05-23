import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Plus, Trash2, Home, Briefcase, ChevronLeft, Navigation } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserService } from "@/services/api/userService";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/useLanguage";
import toast from "react-hot-toast";
import type { Address } from "@/types";

const ADDRESS_ICONS: Record<string, typeof Home> = {
  Home,
  Work: Briefcase,
  Other: MapPin,
};

const LABEL_KEYS = [
  { key: "Home", tKey: "addresses.label_home" },
  { key: "Work", tKey: "addresses.label_work" },
  { key: "Other", tKey: "addresses.label_other" },
];

export default function AddressesPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ label: "Home", address: "", latitude: "", longitude: "" });
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["addresses"],
    queryFn: UserService.getAddresses,
    enabled: isAuthenticated,
  });

  const addMutation = useMutation({
    mutationFn: UserService.addAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success(t('addresses.address_added'));
      setAddOpen(false);
      setForm({ label: "Home", address: "", latitude: "", longitude: "" });
    },
    onError: () => toast.error(t('addresses.failed_to_add')),
  });

  const deleteMutation = useMutation({
    mutationFn: UserService.deleteAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success(t('addresses.address_deleted'));
    },
    onError: () => toast.error(t('addresses.failed_to_remove')),
  });

  const handleAdd = () => {
    if (!form.address.trim()) {
      toast.error(t('addresses.please_enter'));
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
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-soft text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronLeft size={20} className={isRTL ? "rotate-180" : ""} />
        </button>
        <h1 className="text-2xl font-black text-text-primary tracking-tight">{t('profile.addresses')}</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="ml-auto flex items-center gap-1.5 text-sm font-bold text-primary-darker bg-primary-xlight px-3 py-2 rounded-xl hover:bg-primary-light transition-colors"
        >
          <Plus size={16} />
          {t('addresses.add_new')}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-primary-xlight rounded-full flex items-center justify-center mb-4">
            <MapPin size={36} className="text-primary" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-2">{t('addresses.no_addresses')}</h3>
          <p className="text-sm text-text-muted mb-6">{t('addresses.add_hint')}</p>
          <Button onClick={() => setAddOpen(true)} icon={<Plus size={16} />}>
            {t('addresses.add_new')}
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
                        <span className="text-[10px] font-bold text-primary-darker bg-primary-xlight px-2 py-0.5 rounded-full">{t('common.default')}</span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed">{address.address}</p>
                    {address.latitude && address.longitude && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-text-muted">
                        <Navigation size={10} />
                        {Number(address.latitude).toFixed(4)}, {Number(address.longitude).toFixed(4)}
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
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('addresses.add_new')}>
        <div className="space-y-4">
          {/* Label */}
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide block mb-2">{t('common.label')}</label>
            <div className="flex gap-2">
              {LABEL_KEYS.map(({ key, tKey }) => {
                const Icon = ADDRESS_ICONS[key] || MapPin;
                return (
                  <button
                    key={key}
                    onClick={() => setForm((f) => ({ ...f, label: key }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                      form.label === key ? "border-primary bg-primary-xlight text-primary-darker" : "border-border text-text-muted hover:border-gray-300"
                    }`}
                  >
                    <Icon size={15} />
                    {t(tKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            label={t('common.address_details')}
            placeholder={t('addresses.placeholder_address')}
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            icon={<MapPin size={18} />}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('addresses.latitude')}
              type="number"
              placeholder="25.2048"
              value={form.latitude}
              onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
            />
            <Input
              label={t('addresses.longitude')}
              type="number"
              placeholder="55.2708"
              value={form.longitude}
              onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setAddOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button fullWidth loading={addMutation.isPending} onClick={handleAdd}>
              {t('addresses.add_new')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
