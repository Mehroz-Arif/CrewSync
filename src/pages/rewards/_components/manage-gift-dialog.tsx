import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Plus } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const CATEGORY_OPTIONS = [
  { value: "voucher", label: "Gift Card / Voucher" },
  { value: "time_off", label: "Time Off" },
  { value: "merchandise", label: "Merchandise" },
  { value: "experience", label: "Experience" },
] as const;

type GiftCategory = (typeof CATEGORY_OPTIONS)[number]["value"];

export default function ManageGiftDialog({
  open,
  onOpenChange,
  editGift,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editGift?: {
    _id: Id<"rewardGifts">;
    name: string;
    description?: string;
    pointsCost: number;
    category: GiftCategory;
    stock?: number;
    active: boolean;
  } | null;
}) {
  const createGift = useMutation(api.giftShop.createGift);
  const updateGift = useMutation(api.giftShop.updateGift);

  const isEditing = !!editGift;

  const [name, setName] = useState(editGift?.name ?? "");
  const [description, setDescription] = useState(editGift?.description ?? "");
  const [pointsCost, setPointsCost] = useState(String(editGift?.pointsCost ?? ""));
  const [category, setCategory] = useState<string>(editGift?.category ?? "");
  const [stock, setStock] = useState(editGift?.stock !== undefined ? String(editGift.stock) : "");
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setName("");
    setDescription("");
    setPointsCost("");
    setCategory("");
    setStock("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !pointsCost || !category) return;

    setIsLoading(true);
    try {
      const parsedPoints = parseInt(pointsCost, 10);
      if (isNaN(parsedPoints) || parsedPoints < 1) {
        toast.error("Points cost must be at least 1");
        return;
      }
      const parsedStock = stock.trim() ? parseInt(stock, 10) : undefined;

      if (isEditing && editGift) {
        await updateGift({
          giftId: editGift._id,
          name: name.trim(),
          description: description.trim() || undefined,
          pointsCost: parsedPoints,
          category: category as GiftCategory,
          stock: parsedStock,
        });
        toast.success("Gift updated!");
      } else {
        await createGift({
          name: name.trim(),
          description: description.trim() || undefined,
          pointsCost: parsedPoints,
          category: category as GiftCategory,
          stock: parsedStock,
        });
        toast.success("Gift added to the shop!");
      }
      resetForm();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to save gift");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = name.trim() && pointsCost && category;

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) resetForm();
        onOpenChange(val);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-5 text-primary" />
            {isEditing ? "Edit Gift" : "Add Gift to Shop"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this gift's details"
              : "Create a new gift that staff can redeem with their points"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              placeholder="e.g. Amazon Gift Card"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              placeholder="Describe the gift..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Points Cost</Label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 100"
                value={pointsCost}
                onChange={(e) => setPointsCost(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Stock <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                type="number"
                min={0}
                placeholder="Unlimited"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isLoading}>
              {isLoading ? "Saving..." : isEditing ? "Save Changes" : "Add Gift"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
