import { GlobalProduct } from "../entities/global-product.entity";

export interface IGlobalProductRepository {
    create(product: GlobalProduct): Promise<GlobalProduct>;
    findById(id: string): Promise<GlobalProduct | null>;
    findAll(limit: number, offset: number, search?: string, globalCategoryId?: string): Promise<GlobalProduct[]>;
    findAllByCategory(globalCategoryId: string): Promise<GlobalProduct[]>;
    update(id: string, data: Partial<GlobalProduct>): Promise<void>;
    delete(id: string): Promise<void>;
    count(search?: string, globalCategoryId?: string): Promise<number>;
}
