import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { VendorOrderWithItemsDto, ProposeChangesDto } from "@city-market/shared";
import { useForm, useFieldArray } from "react-hook-form";
import { useTranslation } from "react-i18next";

interface ProposalDialogProps {
  order: VendorOrderWithItemsDto;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (proposals: ProposeChangesDto[]) => void;
}

export const ProposalDialog = ({ order, isOpen, onClose, onSubmit }: ProposalDialogProps) => {
  const { t } = useTranslation();
  const { control, handleSubmit, watch } = useForm({
    defaultValues: {
      items: order.items.map((item) => ({
        ...item,
        isUnavailable: false,
        newQuantity: item.quantity,
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
          type: "UNAVAILABLE",
        });
      } else if (item.newQuantity < originalItem.quantity) {
        proposals.push({
          itemId: originalItem.id,
          type: "QUANTITY_REDUCTION",
          proposedQuantity: item.newQuantity,
        });
      }
    });
    onSubmit(proposals);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {t("orders.proposeChangesForOrder")} #{order.id.slice(0, 8)}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Original Qty</TableHead>
                <TableHead>New Qty</TableHead>
                <TableHead>Unavailable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => {
                const isUnavailable = watchedItems[index].isUnavailable;
                return (
                  <TableRow key={field.id}>
                    <TableCell>{(field as any).productName}</TableCell>
                    <TableCell>{(field as any).quantity}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        max={(field as any).quantity}
                        disabled={isUnavailable}
                        {...control.register(`items.${index}.newQuantity`)}
                      />
                    </TableCell>
                    <TableCell>
                      <Checkbox {...control.register(`items.${index}.isUnavailable`)} />
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
            <Button type="submit">{t("orders.sendProposal")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
