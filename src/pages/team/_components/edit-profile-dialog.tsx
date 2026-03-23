import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
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
import { Spinner } from "@/components/ui/spinner.tsx";
import { X } from "lucide-react";

type ProfileData = {
  phone?: string;
  bio?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  skills?: string[];
  certifications?: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProfile: ProfileData;
};

export default function EditProfileDialog({ open, onOpenChange, currentProfile }: Props) {
  const [phone, setPhone] = useState(currentProfile.phone ?? "");
  const [bio, setBio] = useState(currentProfile.bio ?? "");
  const [address, setAddress] = useState(currentProfile.address ?? "");
  const [emergencyName, setEmergencyName] = useState(currentProfile.emergencyContactName ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(currentProfile.emergencyContactPhone ?? "");
  const [skills, setSkills] = useState<string[]>(currentProfile.skills ?? []);
  const [certifications, setCertifications] = useState<string[]>(currentProfile.certifications ?? []);
  const [newSkill, setNewSkill] = useState("");
  const [newCert, setNewCert] = useState("");
  const [loading, setLoading] = useState(false);

  const updateProfile = useMutation(api.profiles.updateMyProfile);

  const addSkill = () => {
    const s = newSkill.trim();
    if (s && !skills.includes(s)) {
      setSkills([...skills, s]);
      setNewSkill("");
    }
  };

  const addCert = () => {
    const c = newCert.trim();
    if (c && !certifications.includes(c)) {
      setCertifications([...certifications, c]);
      setNewCert("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile({
        phone: phone || undefined,
        bio: bio || undefined,
        address: address || undefined,
        emergencyContactName: emergencyName || undefined,
        emergencyContactPhone: emergencyPhone || undefined,
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
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Contact */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Contact</h3>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="+1 (555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" placeholder="123 Main St, City, State" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" placeholder="Tell your team a bit about yourself..." value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
          </div>

          {/* Emergency Contact */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Emergency Contact</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ec-name">Name</Label>
                <Input id="ec-name" placeholder="Jane Smith" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ec-phone">Phone</Label>
                <Input id="ec-phone" placeholder="+1 (555) 987-6543" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="space-y-2">
            <Label>Skills</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {skills.map((s) => (
                <span key={s} className="flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs">
                  {s}
                  <button type="button" onClick={() => setSkills(skills.filter((x) => x !== s))}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add a skill"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
              />
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
                  <button type="button" onClick={() => setCertifications(certifications.filter((x) => x !== c))}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add a certification"
                value={newCert}
                onChange={(e) => setNewCert(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCert(); } }}
              />
              <Button type="button" variant="secondary" size="sm" onClick={addCert}>Add</Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Spinner className="mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
