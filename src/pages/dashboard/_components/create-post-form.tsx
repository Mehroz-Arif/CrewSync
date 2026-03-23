import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Plus, ImagePlus, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type Category = "announcement" | "update" | "shoutout" | "general";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "general", label: "General" },
  { value: "announcement", label: "Announcement" },
  { value: "update", label: "Update" },
  { value: "shoutout", label: "Shoutout" },
];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

export default function CreatePostForm() {
  const createPost = useMutation(api.posts.create);
  const generateUploadUrl = useMutation(api.posts.generateUploadUrl);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Image must be under 5 MB");
      return;
    }

    setSelectedImage(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  }

  function removeImage() {
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function resetForm() {
    setTitle("");
    setBody("");
    setCategory("general");
    removeImage();
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      let imageStorageId: Id<"_storage"> | undefined;

      // Upload image if selected
      if (selectedImage) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": selectedImage.type },
          body: selectedImage,
        });
        if (!result.ok) {
          throw new Error("Image upload failed");
        }
        const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };
        imageStorageId = storageId;
      }

      await createPost({
        title: title.trim(),
        body: body.trim(),
        category,
        imageStorageId,
      });
      toast.success("Post published!");
      resetForm();
      setOpen(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to create post");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="size-4" />
          New Post
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Create a Post</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="post-title">
              Title
            </label>
            <Input
              id="post-title"
              placeholder="What's happening?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="post-body">
              Content
            </label>
            <Textarea
              id="post-body"
              placeholder="Share news, updates, or give a shoutout..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
            />
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Photo (optional)</label>
            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden border">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full max-h-48 object-cover"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 size-7 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed py-6 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              >
                <ImagePlus className="size-5" />
                <span>Add a photo</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as Category)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Spinner />
                  <span className="ml-1.5">Publishing...</span>
                </>
              ) : (
                "Publish"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
