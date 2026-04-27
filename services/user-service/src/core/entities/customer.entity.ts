export interface Customer {
  id: string;
  userId: string;
  fullName: string;
  phone?: string;
  hasPenalty?: boolean;
  deviceId?: string;
  devicePlatform?: string;
  deviceModel?: string;
  deviceAppVersion?: string;
  deviceIp?: string;
  deviceUpdatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
