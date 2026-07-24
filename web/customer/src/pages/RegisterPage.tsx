import { useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Mail, Lock, User, Phone, ArrowRight, Eye, EyeOff,
  ShoppingBag, Zap, Leaf, HeartHandshake,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AuthService } from '@/services/api/authService';
import { UserService } from '@/services/api/userService';
import { setAccessToken } from '@/services/api/apiClient';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import type { User as AppUser } from '@/types';

type FormData = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useAuthStore((s) => s.signIn);
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  // Determine where to redirect after registration
  const queryParams = new URLSearchParams(location.search);
  const redirectPath = queryParams.get("redirect");
  const from = (location.state as any)?.from?.pathname || redirectPath || "/";

  const PERKS = [
    { icon: Zap, text: t('auth.perk_fast_checkout') },
    { icon: Leaf, text: t('auth.perk_fresh_produce') },
    { icon: HeartHandshake, text: t('auth.perk_trusted_stores') },
  ];

  const schema = useMemo(
    () =>
      z
        .object({
          fullName: z.string().min(2, t('auth.validation_full_name_min')),
          email: z.string().email(t('auth.validation_email_invalid')),
          phone: z.string().min(1, t('auth.validation_phone_required')),
          password: z.string().min(8, t('auth.validation_password_min')),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t('auth.validation_passwords_mismatch'),
          path: ['confirmPassword'],
        }),
    [t],
  );

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Registration is two calls: create the auth account, then create the customer
  // profile (name/phone). Both need to succeed for the account to be usable, but
  // they can't be one atomic transaction across two services. Two things guard
  // against that gap:
  //
  // 1. Pre-check the phone against user-service *before* creating the auth account
  //    at all — the common case (phone already taken) never creates an account in
  //    the first place, so there's nothing to leave orphaned.
  // 2. For the residual race (two signups with the same phone landing at the same
  //    instant), we still authorize the createCustomer call but deliberately don't
  //    call the store's signIn() — which flips isAuthenticated — until the profile
  //    is actually saved. /register is wrapped in a GuestOnly route guard that
  //    redirects to "/" the moment isAuthenticated becomes true, which would yank
  //    the user off this page mid-flow regardless of local component state. Holding
  //    off on that flip keeps them here, in "finish setting up" mode, until both
  //    steps have actually succeeded.
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [pendingAuth, setPendingAuth] = useState<{ user: AppUser; accessToken: string } | null>(null);

  const saveProfile = async (data: FormData, auth: { user: AppUser; accessToken: string }) => {
    try {
      await UserService.createCustomer({ fullName: data.fullName, phone: data.phone });
      signIn(auth.user, auth.accessToken);
      toast.success(t('auth.register_success'));
      navigate(from, { replace: true });
    } catch (err: any) {
      const code = err?.response?.data?.message;
      if (code === 'phone_already_registered') {
        setError('phone', { type: 'manual', message: t('auth.validation_phone_already_registered') });
      } else {
        toast.error(code || t('auth.profile_setup_failed'));
      }
      setNeedsProfileCompletion(true);
    }
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      if (needsProfileCompletion && pendingAuth) {
        await saveProfile(data, pendingAuth);
        return;
      }

      const phoneAvailable = await UserService.checkPhoneAvailable(data.phone);
      if (!phoneAvailable) {
        setError('phone', { type: 'manual', message: t('auth.validation_phone_already_registered') });
        return;
      }

      const result = await AuthService.register({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        phone: data.phone,
      });
      if (result?.user && result?.accessToken) {
        // Authorize this axios instance for the createCustomer call without marking
        // the app "logged in" yet — see comment above.
        setAccessToken(result.accessToken);
        const auth = { user: result.user, accessToken: result.accessToken };
        setPendingAuth(auth);
        await saveProfile(data, auth);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('auth.register_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel (desktop only) ──────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] bg-hero-gradient relative flex-col justify-between overflow-hidden p-10 xl:p-14">
        {/* Background circles */}
        <div className="absolute w-[500px] h-[500px] rounded-full bg-white/[0.06] -top-32 -right-32" />
        <div className="absolute w-72 h-72 rounded-full bg-black/[0.05] -bottom-16 -left-16" />
        <div className="absolute w-40 h-40 rounded-full bg-white/[0.04] bottom-32 right-0" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center border border-white/25">
            <ShoppingBag size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white font-black text-2xl tracking-tight">CityMarket</span>
        </div>

        {/* Main copy */}
        <div className="relative z-10">
          <h2 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] tracking-tight mb-5">
            {t('auth.register_hero_title_line1')}<br />
            <span className="text-white/75">{t('auth.register_hero_title_line2')}</span>
          </h2>
          <p className="text-white/65 text-base leading-relaxed mb-10 max-w-xs">
            {t('auth.register_hero_subtitle')}
          </p>
          <div className="space-y-3.5">
            {PERKS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Icon size={15} className="text-white" />
                </div>
                <span className="text-white/85 text-sm font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tagline */}
        <p className="relative z-10 text-white/40 text-xs">
          {t('auth.copyright', { year: new Date().getFullYear() })}
        </p>
      </div>

      {/* ── Right form panel ──────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-5 py-10 bg-background overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-[420px]"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 bg-primary-gradient rounded-xl flex items-center justify-center shadow-primary-glow">
              <ShoppingBag size={17} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-black text-xl text-text-primary">
              City<span className="gradient-text">Market</span>
            </span>
          </div>

          <h1 className="text-3xl font-black text-text-primary tracking-tight mb-1.5">
            {t('auth.register_button')}
          </h1>
          <p className="text-text-muted text-sm mb-8">
            {t('auth.register_subtitle')}
          </p>

          {needsProfileCompletion && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t('auth.complete_profile_banner')}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label={t('auth.full_name')}
              placeholder={t('auth.full_name_placeholder')}
              icon={<User size={18} />}
              error={errors.fullName?.message}
              {...register('fullName')}
            />
            <Input
              label={t('auth.email')}
              type="email"
              placeholder={t('auth.email_placeholder')}
              icon={<Mail size={18} />}
              error={errors.email?.message}
              disabled={needsProfileCompletion}
              {...register('email')}
            />
            <Input
              label={t('auth.phone')}
              type="tel"
              placeholder={t('auth.phone_placeholder')}
              icon={<Phone size={18} />}
              error={errors.phone?.message}
              {...register('phone')}
            />

            <div>
              <Input
                label={t('auth.password')}
                type={showPass ? 'text' : 'password'}
                placeholder={t('auth.password_placeholder')}
                icon={<Lock size={18} />}
                iconRight={
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
                error={errors.password?.message}
                disabled={needsProfileCompletion}
                {...register('password')}
              />
            </div>

            <Input
              label={t('auth.confirm_password')}
              type={showConfirmPass ? 'text' : 'password'}
              placeholder={t('auth.confirm_password_placeholder')}
              icon={<Lock size={18} />}
              iconRight={
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="text-text-muted hover:text-text-primary transition-colors"
                >
                  {showConfirmPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
              error={errors.confirmPassword?.message}
              disabled={needsProfileCompletion}
              {...register('confirmPassword')}
            />

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              iconRight={<ArrowRight size={18} />}
            >
              {needsProfileCompletion ? t('auth.complete_profile_button') : t('auth.register_button')}
            </Button>
          </form>

          <p className="mt-7 text-center text-sm text-text-muted">
            {t('auth.no_account')}{' '}
            <Link to="/login" className="font-bold text-primary hover:text-primary-dark transition-colors">
              {t('common.login')}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
