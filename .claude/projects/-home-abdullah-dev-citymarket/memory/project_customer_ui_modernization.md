---
name: customer-ui-modernization
description: Customer app UI/UX modernization — all screens and components upgraded with animations, skeleton loaders, and consistent design system
metadata:
  type: project
---

Major UI/UX modernization of the Customer mobile app (React Native + TypeScript) completed in May 2026.

**Why:** User requested premium, modern UI/UX similar to Talabat/HungerStation/Uber Eats.

**How to apply:** No new dependencies were added — all animations use React Native's built-in `Animated` API.

## New files created
- `src/hooks/useAnimatedPress.ts` — spring-based press scale animation hook
- `src/hooks/useShimmer.ts` — opacity shimmer loop for skeleton loading
- `src/components/common/SkeletonLoader.tsx` — HomeScreenSkeleton + ProductCardSkeleton
- `src/components/common/FloatingCartBar.tsx` — reusable animated floating cart bar (used by StoreDetailsScreen and CategoryProductsScreen)

## Theme additions
- `colors.ts` — added `primaryXLight`, `accentLight`, `errorLight`, `borderLight`, `overlay`, `overlayLight`
- `spacing.ts` — added `xxs: 2` and `xxxl: 56`

## Key improvements per component
- **Tab Navigator** — full custom animated tab bar with pill highlight on active tab, cart badge, scale animation
- **HomeScreen** — skeleton loading, promo banner with pulse animation, animated cart button
- **CategoryItem** — press scale animation
- **VendorItem** — taller images (130px), rating overlay on image, press animation, Clock meta
- **ProductCard** — bounce animation on add-to-cart button, cleaner price layout
- **QuantitySelector** — new green pill container, animated press buttons
- **CartItem** — fade+slide-in animation, ImageWithPlaceholder instead of Image
- **CartEmptyState** — bounce icon animation, animated CTA button
- **CartScreen** — bottom-sheet auth modal with slide animation
- **CheckoutScreen** — improved address selection, pill Add button, disabled state improvements
- **SearchScreen** — fixed autoFocus, filter chip with X, better product row layout
- **OrdersScreen** — status dot pills, animated order cards
- **ProfileScreen** — dashed avatar ring, stats card with overlap effect
- **OrderDetailsScreen** — fixed back button (was on wrong side/right)
- **StoreHeader** — back button moved to correct left position
- **StoreDetailsScreen & CategoryProductsScreen** — use new FloatingCartBar
- **ProductDetailsScreen** — ImageWithPlaceholder, add-to-cart animation, rounded sheet layout
- **OrderStatusStepper** — active node pulse animation
- **ImageWithPlaceholder** — shimmer loading state before image loads
- **SplashScreen** — fade-in animation
- **LanguageSettingsScreen, AddressesScreen, AllStoresScreen** — consistent header style fixes
