import { motion } from "motion/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { ArrowRight } from "lucide-react";

export default function CtaSection() {
  return (
    <section id="cta" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 sm:px-16 sm:py-24 text-center"
        >
          {/* Background decoration */}
          <div className="absolute inset-0 -z-0">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />
          </div>

          <div className="relative z-10">
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-primary-foreground text-balance">
              Ready to sync your crew?
            </h2>
            <p className="mt-4 text-lg text-primary-foreground/80 max-w-xl mx-auto text-balance">
              Join teams who have ditched the chaos for a simpler, smarter way
              to manage staff. Free to get started.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <SignInButton
                signInText="Start Free Today"
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto text-base px-8 font-semibold"
              />
              <a
                href="#features"
                className="inline-flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground text-sm font-medium transition-colors group"
              >
                Learn more
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
