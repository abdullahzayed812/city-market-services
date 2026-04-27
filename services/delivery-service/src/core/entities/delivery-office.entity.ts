export interface DeliveryOffice {
  id: string;
  userId: string;
  name: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
