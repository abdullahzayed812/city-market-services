import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Shield } from 'lucide-react';

export default function TermsPage() {
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-soft text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-black text-text-primary">Terms & Conditions</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-6 prose prose-sm max-w-none">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary-xlight rounded-2xl flex items-center justify-center">
            <Shield size={24} className="text-primary" />
          </div>
          <div>
            <p className="font-bold text-text-primary">CityMarket</p>
            <p className="text-xs text-text-muted">Terms of Service & Privacy Policy</p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-text-secondary leading-relaxed">
          <p>
            Welcome to CityMarket. By using our platform, you agree to these terms and conditions.
          </p>
          <h3 className="font-bold text-text-primary">1. Service Description</h3>
          <p>
            CityMarket is a grocery delivery platform connecting customers with local stores and
            vendors. We facilitate the ordering and delivery of products.
          </p>
          <h3 className="font-bold text-text-primary">2. User Accounts</h3>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials.
            You must be at least 18 years old to use our services.
          </p>
          <h3 className="font-bold text-text-primary">3. Orders & Payments</h3>
          <p>
            Orders are subject to product availability. Prices may vary. We currently offer
            cash on delivery as our payment method. Delivery fees are calculated based on distance.
          </p>
          <h3 className="font-bold text-text-primary">4. Privacy Policy</h3>
          <p>
            We collect and process your personal data to provide our services. Your data is used
            for order processing, delivery coordination, and customer support.
          </p>
          <h3 className="font-bold text-text-primary">5. Contact Us</h3>
          <p>
            For support or inquiries, please contact our customer service team through the app.
          </p>
        </div>
      </div>
    </div>
  );
}
