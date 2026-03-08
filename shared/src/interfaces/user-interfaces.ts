import { UserRole } from "../enums/roles.js";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  firstName?: string;
  lastName?: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

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

export interface RegisterDto {
  email: string;
  password: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}
