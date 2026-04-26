import { CustomerPenalty } from "../entities/customer-penalty.entity";

export interface ICustomerPenaltyRepository {
  create(penalty: CustomerPenalty, connection?: any): Promise<void>;
  hasActivePenalty(customerId: string, connection?: any): Promise<boolean>;
}
