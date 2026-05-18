import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '@/types';
import { MeasurementType } from '@/types';

interface CartState {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateWeight: (id: string, weightGrams: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addToCart: (item) => {
        if (item.isAvailable === false) return;
        set((state) => {
          const existing = state.items.find((i) => i.id === item.id);
          if (existing) {
            if (item.measurementType === MeasurementType.UNIT) {
              return {
                items: state.items.map((i) =>
                  i.id === item.id
                    ? { ...i, quantity: (i.quantity || 0) + (item.quantity || 1) }
                    : i,
                ),
              };
            } else {
              return {
                items: state.items.map((i) =>
                  i.id === item.id
                    ? {
                        ...i,
                        weightGrams: (i.weightGrams || 0) + (item.weightGrams || 500),
                        weight: ((i.weightGrams || 0) + (item.weightGrams || 500)) / 1000,
                      }
                    : i,
                ),
              };
            }
          }
          return { items: [...state.items, item] };
        });
      },

      removeFromCart: (id) => {
        set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(id);
          return;
        }
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
        }));
      },

      updateWeight: (id, weightGrams) => {
        if (weightGrams <= 0) {
          get().removeFromCart(id);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, weightGrams, weight: weightGrams / 1000 } : i,
          ),
        }));
      },

      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'citymarket-cart',
    },
  ),
);

// Selectors for derived state
export const selectCartTotal = (state: CartState) => {
  return state.items.reduce((sum, item) => {
    if (item.measurementType === MeasurementType.UNIT) {
      return sum + item.price * (item.quantity || 0);
    }
    return sum + (item.price * (item.weightGrams || 0)) / 1000;
  }, 0);
};

export const selectCartItemCount = (state: CartState) => {
  return state.items.reduce((sum, item) => {
    if (item.measurementType === MeasurementType.UNIT) {
      return sum + (item.quantity || 1);
    }
    return sum + 1;
  }, 0);
};

