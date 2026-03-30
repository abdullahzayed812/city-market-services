import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ProposalType, type VendorOrderWithItemsDto, type ProposeChangesDto } from "@city-market/shared";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";

interface OrderPreparationModalProps {
    order: VendorOrderWithItemsDto;
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (proposals: ProposeChangesDto[]) => void;
}

export const OrderPreparationModal = ({ order, isOpen, onClose, onSubmit }: OrderPreparationModalProps) => {
    const { t } = useTranslation();
    const { control, handleSubmit, watch } = useForm({
        defaultValues: {
            items: order.items.map((item) => ({
                id: item.id,
                productName: item.productName,
                quantity: item.quantity,
                requestedWeightGrams: item.requestedWeightGrams,
                isUnavailable: false,
                newQuantity: item.quantity,
                newWeightKg: item.requestedWeightGrams ? item.requestedWeightGrams / 1000 : undefined,
            })),
        },
    });

    const { fields } = useFieldArray({
        control,
        name: "items",
    });

    const watchedItems = watch("items");

    const onFormSubmit = (data: any) => {
        const proposals: ProposeChangesDto[] = [];
        data.items.forEach((item: any, index: number) => {
            const originalItem = order.items[index];

            if (item.isUnavailable) {
                proposals.push({
                    itemId: originalItem.id,
                    type: ProposalType.UNAVAILABLE,
                });
            } else if (originalItem.quantity !== undefined && item.newQuantity !== undefined && item.newQuantity < originalItem.quantity) {
                proposals.push({
                    itemId: originalItem.id,
                    type: ProposalType.QUANTITY_REDUCTION,
                    proposedQuantity: Number(item.newQuantity),
                });
            } else if (originalItem.requestedWeightGrams !== undefined && item.newWeightKg !== undefined) {
                const newWeightGrams = Math.round(Number(item.newWeightKg) * 1000);
                if (newWeightGrams !== originalItem.requestedWeightGrams) {
                    proposals.push({
                        itemId: originalItem.id,
                        type: ProposalType.WEIGHT_ADJUSTMENT,
                        proposedWeightGrams: newWeightGrams,
                        requestedWeightGrams: originalItem.requestedWeightGrams,
                    });
                }
            }
        });
        onSubmit(proposals);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>
                        {t("orders.prepareOrder")} #{order.id.slice(0, 8)}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onFormSubmit)}>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t("orders.product")}</TableHead>
                                <TableHead>{t("orders.requested")}</TableHead>
                                <TableHead>{t("orders.actual")}</TableHead>
                                <TableHead>{t("orders.unavailable")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, index) => {
                                const isUnavailable = watchedItems[index].isUnavailable;
                                const item = watchedItems[index];

                                return (
                                    <TableRow key={field.id}>
                                        <TableCell>{item.productName}</TableCell>
                                        <TableCell>
                                            {item.quantity !== undefined
                                                ? item.quantity
                                                : `≈ ${(item.requestedWeightGrams! / 1000).toFixed(2)} ${t("inventory.units.kg")}`}
                                        </TableCell>
                                        <TableCell>
                                            {item.quantity !== undefined ? (
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    max={item.quantity}
                                                    disabled={isUnavailable}
                                                    {...control.register(`items.${index}.newQuantity` as const)}
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        min="0.01"
                                                        disabled={isUnavailable}
                                                        {...control.register(`items.${index}.newWeightKg` as const)}
                                                    />
                                                    <span>{t("inventory.units.kg")}</span>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Controller
                                                control={control}
                                                name={`items.${index}.isUnavailable` as const}
                                                render={({ field }) => (
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                )}
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    <DialogFooter className="mt-4">
                        <DialogClose asChild>
                            <Button type="button" variant="ghost">
                                {t("common.cancel")}
                            </Button>
                        </DialogClose>
                        <Button type="submit">{t("orders.confirmPreparation")}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
