import { motion } from "motion/react";
import {
  CalendarClock,
  Newspaper,
  MessageSquare,
  Trophy,
  FolderOpen,
  LayoutDashboard,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card.tsx";

const FEATURES = [
  {
    icon: CalendarClock,
    title: "Next Shift",
    description:
      "Always know when your next shift starts. View your upcoming schedule at a glance with countdown timers and shift details.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Newspaper,
    title: "Newsfeed",
    description:
      "Stay in the loop with company-wide announcements, updates, and stories. Pin important posts so nothing gets missed.",
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description:
      "Your personalized command center. See shifts, unread messages, reward points, and recent news all in one view.",
    color: "text-chart-3",
    bg: "bg-chart-3/10",
  },
  {
    icon: MessageSquare,
    title: "Internal Messaging",
    description:
      "Direct and group messaging built for your team. Share updates, ask questions, and keep conversations organized.",
    color: "text-chart-4",
    bg: "bg-chart-4/10",
  },
  {
    icon: Trophy,
    title: "Staff Rewards",
    description:
      "Recognize great work with points and rewards. Build a culture of appreciation that motivates your entire team.",
    color: "text-chart-5",
    bg: "bg-chart-5/10",
  },
  {
    icon: FolderOpen,
    title: "Document Hub",
    description:
      "One secure place for policies, handbooks, training materials, and forms. Upload, organize, and find files instantly.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto"
        >
          <span className="text-sm font-semibold tracking-wide uppercase text-primary">
            Everything your team needs
          </span>
          <h2 className="mt-3 font-heading text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Six powerful tools, one platform
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Replace scattered spreadsheets, group chats, and pinned notes with a
            single hub designed for staff.
          </p>
        </motion.div>

        {/* Feature cards */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <Card className="h-full hover:shadow-md transition-shadow duration-300 group">
                <CardContent className="pt-6">
                  <div
                    className={`size-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <feature.icon className={`size-6 ${feature.color}`} />
                  </div>
                  <h3 className="font-heading font-semibold text-lg text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
