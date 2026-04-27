export interface CustomerPenalty {
  id: string;
  customerId: string;
  customerOrderId: string;
  deliveryId?: string;
  reason: string;
  deviceId?: string;
  devicePlatform?: string;
  deviceModel?: string;
  deviceAppVersion?: string;
  deviceIp?: string;
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
}
