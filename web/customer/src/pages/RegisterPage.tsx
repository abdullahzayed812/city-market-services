import { useState } from 'react';
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
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

const schema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    phone: z.string().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

const PERKS = [
  { icon: Zap, text: 'Lightning-fast checkout' },
  { icon: Leaf, text: 'Farm-fresh produce' },
  { icon: HeartHandshake, text: 'Trusted local stores' },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useAuthStore((s) => s.signIn);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // Determine where to redirect after registration
  const queryParams = new URLSearchParams(location.search);
  const redirectPath = queryParams.get("redirect");
  const from = (location.state as any)?.from?.pathname || redirectPath || "/";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const result = await AuthService.register({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        phone: data.phone,
      });
      if (result?.user && result?.accessToken) {
        signIn(result.user, result.accessToken, result.refreshToken);
        try {
          await UserService.createCustomer({ fullName: data.fullName, phone: data.phone });
        } catch {}
        toast.success('Account created successfully!');
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Registration failed. Please try again.');
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
            Join thousands<br />
            <span className="text-white/75">of happy shoppers</span>
          </h2>
          <p className="text-white/65 text-base leading-relaxed mb-10 max-w-xs">
            Create your free account and start ordering from the best local stores in minutes.
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
          © {new Date().getFullYear()} CityMarket. All rights reserved.
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
            Create account
          </h1>
          <p className="text-text-muted text-sm mb-8">
            Free to join — start shopping in minutes
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Full Name"
              placeholder="John Smith"
              icon={<User size={18} />}
              error={errors.fullName?.message}
              {...register('fullName')}
            />
            <Input
              label="Email Address"
              type="email"
              placeholder="name@example.com"
              icon={<Mail size={18} />}
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Phone (optional)"
              type="tel"
              placeholder="+1 234 567 8900"
              icon={<Phone size={18} />}
              error={errors.phone?.message}
              {...register('phone')}
            />

            <div>
              <Input
                label="Password"
                type={showPass ? 'text' : 'password'}
                placeholder="Minimum 8 characters"
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
                {...register('password')}
              />
            </div>

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Repeat your password"
              icon={<Lock size={18} />}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              iconRight={<ArrowRight size={18} />}
            >
              Create Account
            </Button>
          </form>

          <p className="mt-7 text-center text-sm text-text-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-primary hover:text-primary-dark transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
