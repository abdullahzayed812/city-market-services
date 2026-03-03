import { randomUUID } from "crypto";
import { ICustomerRepository } from "../../core/interfaces/customer.repository";
import { IAddressRepository } from "../../core/interfaces/address.repository";
import { Customer } from "../../core/entities/customer.entity";
import { Address } from "../../core/entities/address.entity";
import { CreateCustomerDto, UpdateCustomerDto, CreateAddressDto } from "../../core/dto/customer.dto";
import { ValidationError, NotFoundError } from "@city-market/shared";

export class UserService {
  constructor(private customerRepo: ICustomerRepository, private addressRepo: IAddressRepository) { }

  async createCustomer(dto: CreateCustomerDto): Promise<Customer> {
    const existing = await this.customerRepo.findByUserId(dto.userId);
    if (existing) {
      throw new ValidationError("customer_already_exists");
    }

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
    if (!customer) {
      throw new NotFoundError("customer_not_found");
    }
    return customer;
  }

  async getCustomerByUserId(userId: string): Promise<Customer> {
    const customer = await this.customerRepo.findByUserId(userId);
    if (!customer) {
      throw new NotFoundError("customer_not_found");
    }
    return customer;
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto): Promise<void> {
    await this.getCustomerById(id);
    await this.customerRepo.update(id, dto);
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
    if (!address) {
      throw new NotFoundError("address_not_found");
    }
    await this.addressRepo.delete(addressId);
  }
}
