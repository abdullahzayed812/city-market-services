import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import type { VendorOrderWithItemsDto } from "@city-market/shared";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

interface WeightAdjustmentModalProps {
  order: VendorOrderWithItemsDto;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (itemWeights: { itemId: string; actualWeightGrams: number }[]) => void;
}

export const WeightAdjustmentModal = ({ order, isOpen, onClose, onSubmit }: WeightAdjustmentModalProps) => {
  const { t } = useTranslation();
  const weightItems = order.items.filter(item => item.requestedWeightGrams !== undefined);

  const { register, handleSubmit } = useForm({
    defaultValues: {
      weights: weightItems.reduce((acc, item) => {
        acc[item.id] = item.actualWeightGrams || item.requestedWeightGrams || 0;
        return acc;
      }, {} as Record<string, number>)
    }
  });

  const onFormSubmit = (data: any) => {
    const itemWeights = Object.entries(data.weights).map(([itemId, weightGrams]) => ({
      itemId,
      actualWeightGrams: Number(weightGrams)
    }));
    onSubmit(itemWeights);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t("orders.weightAdjustment")} #{order.id.slice(0, 8)}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Requested Weight (kg)</TableHead>
                <TableHead>Actual Weight (kg)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weightItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell>≈ {(item.requestedWeightGrams! / 1000).toFixed(2)} kg</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="w-32"
                            {...register(`weights.${item.id}` as any, { 
                                required: true,
                                setValueAs: (v) => Math.round(parseFloat(v) * 1000)
                            })}
                        />
                        <span>kg</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t("common.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit">{t("orders.sendWeightProposal")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
