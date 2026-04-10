/**
 * Utility to calculate delivery fee based on distance between customer and vendors.
 */
export class DeliveryFeeCalculator {
    private static readonly BASE_FEE = 5.0;
    private static readonly PER_KM_RATE = 2.0;
    private static readonly MAX_FEE = 45.0;
    private static readonly DEFAULT_FALLBACK_FEE = 15.0;

    /**
     * Calculates the delivery fee based on the farthest vendor.
     */
    static calculate(
        customerLat?: number,
        customerLng?: number,
        vendorLocations: { latitude?: number; longitude?: number }[] = []
    ): number {
        // Fallback if no coordinates provided
        if (customerLat === undefined || customerLng === undefined || vendorLocations.length === 0) {
            return this.DEFAULT_FALLBACK_FEE;
        }

        let maxDistance = 0;

        for (const vendor of vendorLocations) {
            if (vendor.latitude !== undefined && vendor.longitude !== undefined) {
                const distance = this.haversineDistanceKm(
                    customerLat,
                    customerLng,
                    vendor.latitude,
                    vendor.longitude
                );
                if (distance > maxDistance) {
                    maxDistance = distance;
                }
            }
        }

        // If no vendors had valid coordinates, fallback
        if (maxDistance === 0 && vendorLocations.every(v => v.latitude === undefined)) {
            return this.DEFAULT_FALLBACK_FEE;
        }

        const calculatedFee = this.BASE_FEE + (maxDistance * this.PER_KM_RATE);

        // Clamp between BASE_FEE and MAX_FEE
        return Math.min(Math.max(calculatedFee, this.BASE_FEE), this.MAX_FEE);
    }

    /**
     * Haversine formula to calculate distance between two points in km.
     */
    private static haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Earth's radius in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private static deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
    }
}
