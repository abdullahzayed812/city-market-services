import { CustomerPenalty } from "../entities/customer-penalty.entity";

export interface ICustomerPenaltyRepository {
  create(penalty: CustomerPenalty): Promise<void>;
  hasActivePenalty(customerId: string): Promise<boolean>;
}
