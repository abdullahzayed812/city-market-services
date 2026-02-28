import { CategoryType } from "@city-market/shared";

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  vendorId?: string | null;
  description?: string;
  iconUrl?: string;
  color?: string;
  createdAt: Date;
}
