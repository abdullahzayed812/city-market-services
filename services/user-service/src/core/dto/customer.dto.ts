export interface CreateCustomerDto {
  userId: string;
  fullName: string;
  phone: string;
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
