export interface CreateRatingDTO {
    orderId: string;
    vendorId: string;
    stars: number;
    comment?: string;
}
