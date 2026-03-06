export interface GlobalProduct {
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    globalCategoryId: string;
    createdAt: Date;
    updatedAt: Date;
}
