export interface Rating {
    id: string;
    orderId: string;
    vendorId: string;
    customerUserId: string;
    customerName?: string;
    stars: number;
    comment?: string;
    createdAt: Date;
}

export interface VendorRatingSummary {
    vendorId: string;
    totalRatings: number;
    totalStars: number;
    averageRating: number;
}
