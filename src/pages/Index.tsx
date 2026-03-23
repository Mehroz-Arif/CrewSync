import LandingNavbar from "./_components/landing-navbar.tsx";
import HeroSection from "./_components/hero-section.tsx";
import FeaturesSection from "./_components/features-section.tsx";
import HowItWorksSection from "./_components/how-it-works-section.tsx";
import CtaSection from "./_components/cta-section.tsx";
import LandingFooter from "./_components/landing-footer.tsx";

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <CtaSection />
      <LandingFooter />
    </div>
  );
}
