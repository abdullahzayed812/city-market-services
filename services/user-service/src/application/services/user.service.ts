import { randomUUID } from "crypto";
import { ICustomerRepository } from "../../core/interfaces/customer.repository";
import { IAddressRepository } from "../../core/interfaces/address.repository";
import { ICustomerPenaltyRepository } from "../../core/interfaces/customer-penalty.repository";
import { Customer } from "../../core/entities/customer.entity";
import { CustomerPenalty } from "../../core/entities/customer-penalty.entity";
import { Address } from "../../core/entities/address.entity";
import { CreateCustomerDto, UpdateCustomerDto, CreateAddressDto } from "../../core/dto/customer.dto";
import { RegisterDeviceDto } from "@city-market/shared";
import { ValidationError, NotFoundError } from "@city-market/shared";

export class UserService {
  constructor(
    private customerRepo: ICustomerRepository,
    private addressRepo: IAddressRepository,
    private penaltyRepo: ICustomerPenaltyRepository,
  ) {}

  async createCustomer(dto: CreateCustomerDto): Promise<Customer> {
    const existing = await this.customerRepo.findByUserId(dto.userId);
    if (existing) throw new ValidationError("customer_already_exists");

    const customer: Customer = {
      id: randomUUID(),
      userId: dto.userId,
      fullName: dto.fullName,
      phone: dto.phone,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.customerRepo.create(customer);
  }

  async getCustomerById(id: string): Promise<Customer> {
    const customer = await this.customerRepo.findById(id);
    if (!customer) throw new NotFoundError("customer_not_found");
    return customer;
  }

  async getCustomerByUserId(userId: string): Promise<Customer> {
    const customer = await this.customerRepo.findByUserId(userId);
    if (!customer) throw new NotFoundError("customer_not_found");
    return customer;
  }

  async getCustomersByIds(ids: string[]): Promise<Customer[]> {
    return this.customerRepo.findByIds(ids);
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto): Promise<void> {
    await this.getCustomerById(id);
    await this.customerRepo.update(id, dto);
  }

  async registerDeviceInfo(userId: string, dto: RegisterDeviceDto, ip?: string): Promise<void> {
    const customer = await this.customerRepo.findByUserId(userId);
    if (!customer) throw new NotFoundError("customer_not_found");
    await this.customerRepo.updateDeviceInfo(customer.id, {
      deviceId: dto.deviceId,
      devicePlatform: dto.platform,
      deviceModel: dto.model,
      deviceAppVersion: dto.appVersion,
      deviceIp: ip,
    });
  }

  async registerPenalty(payload: {
    customerId: string;
    customerOrderId: string;
    deliveryId: string;
    reason: string;
  }): Promise<void> {
    const customer = await this.customerRepo.findByUserId(payload.customerId);
    if (!customer) return;

    const penalty: CustomerPenalty = {
      id: randomUUID(),
      customerId: customer.id,
      customerOrderId: payload.customerOrderId,
      deliveryId: payload.deliveryId,
      reason: payload.reason,
      deviceId: customer.deviceId,
      devicePlatform: customer.devicePlatform,
      deviceModel: customer.deviceModel,
      deviceAppVersion: customer.deviceAppVersion,
      deviceIp: customer.deviceIp,
      isActive: true,
      createdAt: new Date(),
    };
    await this.penaltyRepo.create(penalty);
  }

  async addAddress(customerId: string, dto: CreateAddressDto): Promise<Address> {
    await this.getCustomerById(customerId);
    if (dto.isDefault) {
      await this.addressRepo.clearDefaultForCustomer(customerId);
    }
    const address: Address = {
      id: randomUUID(),
      customerId,
      label: dto.label,
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
      isDefault: dto.isDefault || false,
      createdAt: new Date(),
    };
    return this.addressRepo.create(address);
  }

  async getCustomerAddresses(customerId: string): Promise<Address[]> {
    return this.addressRepo.findByCustomer(customerId);
  }

  async deleteAddress(addressId: string): Promise<void> {
    const address = await this.addressRepo.findById(addressId);
    if (!address) throw new NotFoundError("address_not_found");
    await this.addressRepo.delete(addressId);
  }
}
