const FOOTER_LINKS = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How It Works", href: "#how-it-works" },
      { label: "Pricing", href: "#cta" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
];

export default function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-secondary/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <a href="/" className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-heading font-black text-sm">
                  CS
                </span>
              </div>
              <span className="font-heading font-bold text-lg tracking-tight text-foreground">
                CrewSync
              </span>
            </a>
            <p className="mt-3 text-sm text-muted-foreground max-w-xs">
              The all-in-one staff management platform. Shifts, messaging,
              rewards, news, and documents — simplified.
            </p>
          </div>

          {/* Links */}
          {FOOTER_LINKS.map((group) => (
            <div key={group.heading}>
              <h4 className="text-sm font-semibold text-foreground">
                {group.heading}
              </h4>
              <ul className="mt-3 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {year} CrewSync. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Built for teams that care.
          </p>
        </div>
      </div>
    </footer>
  );
}
