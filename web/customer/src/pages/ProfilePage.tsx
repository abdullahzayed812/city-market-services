import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, MapPin, Bell, Globe, LogOut, ChevronRight,
  Phone, Shield, HelpCircle, Edit2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { UserService } from '@/services/api/userService';
import { AuthService } from '@/services/api/authService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';

const menuItems = [
  { icon: MapPin, label: 'Addresses', to: '/addresses', color: '#10B981' },
  { icon: Bell, label: 'Notifications', to: '/notifications', color: '#3B82F6' },
  { icon: Globe, label: 'Language', to: '/settings/language', color: '#8B5CF6' },
  { icon: Shield, label: 'Terms & Conditions', to: '/terms', color: '#6B7280' },
  { icon: HelpCircle, label: 'Help & Support', to: '/support', color: '#F59E0B' },
];

function MenuItem({ icon: Icon, label, to, color }: typeof menuItems[0]) {
  return (
    <Link to={to}>
      <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        <span className="flex-1 text-sm font-semibold text-text-primary">{label}</span>
        <ChevronRight size={16} className="text-text-muted" />
      </div>
    </Link>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut, refreshToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: UserService.getProfile,
    enabled: true,
  });

  const updateMutation = useMutation({
    mutationFn: UserService.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile updated!');
      setEditOpen(false);
    },
    onError: () => toast.error('Failed to update profile'),
  });

  const handleSignOut = async () => {
    try {
      if (refreshToken) await AuthService.logout(refreshToken);
    } catch {}
    signOut();
    toast.success('Signed out');
    navigate('/');
  };

  const openEdit = () => {
    setEditName(profile?.fullName || user?.name || '');
    setEditPhone(profile?.phone || '');
    setEditOpen(true);
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6">
      {/* Avatar + Info */}
      <div className="bg-white rounded-3xl shadow-card p-6 mb-4">
        {isLoading ? (
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-black text-white">
                {(profile?.fullName || user?.name || 'U')[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-black text-text-primary">
                {profile?.fullName || user?.name || 'User'}
              </h2>
              <p className="text-sm text-text-muted truncate">{user?.email}</p>
              {profile?.phone && (
                <div className="flex items-center gap-1 mt-1">
                  <Phone size={12} className="text-text-muted" />
                  <p className="text-xs text-text-muted">{profile.phone}</p>
                </div>
              )}
            </div>
            <button
              onClick={openEdit}
              className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-text-muted hover:bg-primary-xlight hover:text-primary transition-colors flex-shrink-0"
            >
              <Edit2 size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Menu */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden mb-4">
        {menuItems.map((item, i) => (
          <div key={item.to}>
            <MenuItem {...item} />
            {i < menuItems.length - 1 && (
              <div className="h-px bg-border-light mx-4" />
            )}
          </div>
        ))}
      </div>

      {/* Sign out */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-error-light transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-error-light flex items-center justify-center">
            <LogOut size={18} className="text-error" />
          </div>
          <span className="flex-1 text-sm font-semibold text-error text-left">Sign Out</span>
        </button>
      </div>

      {/* Edit modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Profile">
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            icon={<User size={18} />}
          />
          <Input
            label="Phone"
            type="tel"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            icon={<Phone size={18} />}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              fullWidth
              loading={updateMutation.isPending}
              onClick={() =>
                updateMutation.mutate({ fullName: editName, phone: editPhone || undefined })
              }
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
