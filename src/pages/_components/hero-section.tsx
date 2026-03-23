import { motion } from "motion/react";
import { Button } from "@/components/ui/button.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { ArrowRight, Clock, MessageCircle, Trophy } from "lucide-react";

const FLOATING_BADGES = [
  { icon: Clock, label: "Next Shift: 2pm", delay: 0.6, position: "top-24 left-[8%]" },
  { icon: MessageCircle, label: "3 new messages", delay: 0.8, position: "top-36 right-[6%]" },
  { icon: Trophy, label: "+50 points earned", delay: 1.0, position: "bottom-32 left-[12%]" },
];

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-accent/8" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary tracking-wide uppercase">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              Built for modern teams
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-6 font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-balance text-foreground"
          >
            Your team, perfectly{" "}
            <span className="text-primary">in sync</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance"
          >
            Shifts, messaging, rewards, news, and documents — all in one
            beautifully simple platform your staff will actually love using.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <SignInButton
              signInText="Get Started Free"
              size="lg"
              className="w-full sm:w-auto text-base px-8"
            />
            <Button
              variant="ghost"
              size="lg"
              className="w-full sm:w-auto text-base group"
              asChild
            >
              <a href="#features">
                See Features
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
          </motion.div>
        </div>

        {/* Floating badges */}
        <div className="relative mt-16 hidden lg:block h-16">
          {FLOATING_BADGES.map((badge) => (
            <motion.div
              key={badge.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: badge.delay }}
              className={`absolute ${badge.position}`}
            >
              <div className="flex items-center gap-2.5 rounded-full bg-card px-4 py-2.5 shadow-lg border">
                <badge.icon className="size-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{badge.label}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Hero image */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-12 lg:mt-4 mx-auto max-w-4xl"
        >
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border">
            <img
              src="https://images.unsplash.com/photo-1758691737124-05c5bffe46f0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NzIwMTN8MHwxfHNlYXJjaHw4fHxtb2Rlcm4lMjB0ZWFtJTIwY29sbGFib3JhdGlvbiUyMG9mZmljZSUyMHdvcmtwbGFjZSUyMGRpdmVyc2UlMjBzdGFmZnxlbnwwfHx8fDE3NzQyNzMwODh8MA&ixlib=rb-4.1.0&q=80&w=1080"
              alt="Team collaborating in a modern office"
              className="w-full h-64 sm:h-80 lg:h-96 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
