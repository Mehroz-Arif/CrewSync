import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  ShieldCheck,
  Send,
  Lightbulb,
  CalendarClock,
  Building2,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const CATEGORIES = [
  { value: "general", label: "General Feedback", icon: MessageSquare },
  { value: "scheduling", label: "Scheduling", icon: CalendarClock },
  { value: "workplace", label: "Workplace", icon: Building2 },
  { value: "suggestion", label: "Suggestion", icon: Lightbulb },
  { value: "concern", label: "Concern", icon: AlertCircle },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

export default function FeedbackForm() {
  const submitFeedback = useMutation(api.feedback.submit);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (message.trim().length < 5) {
      toast.error("Please write at least 5 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitFeedback({ message: message.trim(), category });
      setSubmitted(true);
      setMessage("");
      setCategory("general");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to submit feedback");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="py-10 flex flex-col items-center text-center gap-4">
          <div className="size-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 className="size-7 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-lg">
              Thank you for your feedback
            </h3>
            <p className="text-muted-foreground text-sm mt-1.5 max-w-sm">
              Your response has been submitted anonymously. Your identity is not stored or tracked.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setSubmitted(false)}
            className="mt-2"
          >
            Submit Another
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Privacy notice */}
      <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
        <div className="size-9 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck className="size-4 text-emerald-500" />
        </div>
        <div>
          <p className="text-sm font-semibold">Your feedback is 100% anonymous</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your name, email, and identity are never stored with your submission.
            Management cannot trace feedback back to you.
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">Share Your Thoughts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <cat.icon className="size-3.5" />
                      <span>{cat.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Your Feedback</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What's on your mind? Share ideas, concerns, or suggestions..."
              rows={5}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length}/2000
            </p>
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isSubmitting || message.trim().length < 5}
          >
            {isSubmitting ? (
              <Spinner />
            ) : (
              <>
                <Send className="size-4 mr-1.5" />
                Submit Anonymously
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
