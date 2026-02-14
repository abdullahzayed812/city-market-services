export interface Customer {
  id: string;
  userId: string;
  fullName: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  id: string;
  customerId: string;
  label?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  createdAt: Date;
}

export interface CreateCustomerDto {
  userId: string;
  fullName: string;
  phone?: string;
}

export interface UpdateCustomerDto {
  fullName?: string;
  phone?: string;
}

export interface CreateAddressDto {
  label?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}
