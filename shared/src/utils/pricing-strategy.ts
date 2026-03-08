import { MeasurementType } from "../enums/measurement-type.enum.js";

export interface PricingStrategy {
  calculateTotal(price: number, amount: number): number;
}

export class UnitPricingStrategy implements PricingStrategy {
  calculateTotal(price: number, quantity: number): number {
    return price * quantity;
  }
}

export class WeightPricingStrategy implements PricingStrategy {
  calculateTotal(price: number, weightGrams: number): number {
    return (price * weightGrams) / 1000;
  }
}

export class PricingStrategyFactory {
  static getStrategy(type: MeasurementType): PricingStrategy {
    switch (type) {
      case MeasurementType.UNIT:
        return new UnitPricingStrategy();
      case MeasurementType.WEIGHT:
        return new WeightPricingStrategy();
      default:
        return new UnitPricingStrategy();
    }
  }
}
