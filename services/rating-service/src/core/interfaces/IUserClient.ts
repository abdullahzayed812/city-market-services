export interface UserInfo {
  id: string;
  userId: string;
  fullName: string;
}

export interface IUserClient {
  getCustomerByUserId(userId: string): Promise<UserInfo | null>;
  getCustomersByIds(ids: string[], currentUserId?: string): Promise<UserInfo[]>;
}
