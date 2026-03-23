import { motion } from "motion/react";
import { UserPlus, LayoutDashboard, Rocket } from "lucide-react";

const STEPS = [
  {
    icon: UserPlus,
    number: "01",
    title: "Sign up your team",
    description:
      "Create your workspace in seconds. Invite staff with a link — they sign in and they're ready to go.",
  },
  {
    icon: LayoutDashboard,
    number: "02",
    title: "Set up your workspace",
    description:
      "Add shifts, post news, upload documents, and configure rewards. Everything is drag-and-drop simple.",
  },
  {
    icon: Rocket,
    number: "03",
    title: "Run like clockwork",
    description:
      "Your team stays informed, connected, and motivated. Less admin, more time for what matters.",
  },
];

export default function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="py-20 sm:py-28 bg-secondary/50"
    >
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
            Simple to start
          </span>
          <h2 className="mt-3 font-heading text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Up and running in minutes
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            No complicated setup. No training manuals. Just sign up and go.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.15 }}
              className="relative text-center"
            >
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-10 left-[60%] w-[80%] h-px bg-border" />
              )}

              <div className="inline-flex items-center justify-center size-20 rounded-2xl bg-card border shadow-sm mb-6">
                <step.icon className="size-8 text-primary" />
              </div>

              <div className="text-xs font-bold tracking-widest text-primary/60 uppercase mb-2">
                Step {step.number}
              </div>
              <h3 className="font-heading font-semibold text-xl text-foreground">
                {step.title}
              </h3>
              <p className="mt-3 text-muted-foreground max-w-xs mx-auto">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
