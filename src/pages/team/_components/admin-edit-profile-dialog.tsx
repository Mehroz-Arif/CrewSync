import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Spinner } from "@/components/ui/spinner.tsx";
import { X } from "lucide-react";

type ProfileData = {
  _id: string;
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  phone?: string;
  bio?: string;
  employmentType?: "employee" | "subcontractor";
  jobTitle?: string;
  startDate?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  skills?: string[];
  certifications?: string[];
  hourlyRate?: number;
  notes?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileData;
};

export default function AdminEditProfileDialog({ open, onOpenChange, profile }: Props) {
  const [form, setForm] = useState({
    name: profile.name ?? "",
    email: profile.email ?? "",
    role: profile.role ?? "staff",
    department: profile.department ?? "",
    phone: profile.phone ?? "",
    bio: profile.bio ?? "",
    employmentType: (profile.employmentType ?? "employee") as "employee" | "subcontractor",
    jobTitle: profile.jobTitle ?? "",
    startDate: profile.startDate ?? "",
    address: profile.address ?? "",
    emergencyContactName: profile.emergencyContactName ?? "",
    emergencyContactPhone: profile.emergencyContactPhone ?? "",
    hourlyRate: profile.hourlyRate?.toString() ?? "",
    notes: profile.notes ?? "",
  });
  const [skills, setSkills] = useState<string[]>(profile.skills ?? []);
  const [certifications, setCertifications] = useState<string[]>(profile.certifications ?? []);
  const [newSkill, setNewSkill] = useState("");
  const [newCert, setNewCert] = useState("");
  const [loading, setLoading] = useState(false);

  const updateProfile = useMutation(api.profiles.updateProfileAsAdmin);

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const addSkill = () => {
    const s = newSkill.trim();
    if (s && !skills.includes(s)) { setSkills([...skills, s]); setNewSkill(""); }
  };
  const addCert = () => {
    const c = newCert.trim();
    if (c && !certifications.includes(c)) { setCertifications([...certifications, c]); setNewCert(""); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile({
        userId: profile._id as Id<"users">,
        name: form.name || undefined,
        email: form.email || undefined,
        role: form.role || undefined,
        department: form.department || undefined,
        phone: form.phone || undefined,
        bio: form.bio || undefined,
        employmentType: form.employmentType,
        jobTitle: form.jobTitle || undefined,
        startDate: form.startDate || undefined,
        address: form.address || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContactPhone: form.emergencyContactPhone || undefined,
        hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : undefined,
        notes: form.notes || undefined,
        skills: skills.length > 0 ? skills : undefined,
        certifications: certifications.length > 0 ? certifications : undefined,
      });
      toast.success("Profile updated");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {profile.name ?? "Member"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic info */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Basic Info</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Job Title</Label>
                <Input placeholder="e.g. Paramedic, Driver" value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input placeholder="e.g. Operations" value={form.department} onChange={(e) => set("department", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Employment */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Employment</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.employmentType} onValueChange={(v) => set("employmentType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="subcontractor">Subcontractor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => set("role", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Hourly Rate</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={form.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Contact</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Emergency */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Emergency Contact</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={2} />
          </div>

          {/* Skills */}
          <div className="space-y-2">
            <Label>Skills</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {skills.map((s) => (
                <span key={s} className="flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs">
                  {s}
                  <button type="button" onClick={() => setSkills(skills.filter((x) => x !== s))}><X className="size-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Add a skill" value={newSkill} onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} />
              <Button type="button" variant="secondary" size="sm" onClick={addSkill}>Add</Button>
            </div>
          </div>

          {/* Certifications */}
          <div className="space-y-2">
            <Label>Certifications</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {certifications.map((c) => (
                <span key={c} className="flex items-center gap-1 rounded-full bg-accent/10 text-accent-foreground px-2.5 py-1 text-xs">
                  {c}
                  <button type="button" onClick={() => setCertifications(certifications.filter((x) => x !== c))}><X className="size-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Add a certification" value={newCert} onChange={(e) => setNewCert(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCert(); } }} />
              <Button type="button" variant="secondary" size="sm" onClick={addCert}>Add</Button>
            </div>
          </div>

          {/* Admin notes */}
          <div className="space-y-2">
            <Label>Admin Notes (private)</Label>
            <Textarea placeholder="Internal notes about this team member..." value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Spinner className="mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


