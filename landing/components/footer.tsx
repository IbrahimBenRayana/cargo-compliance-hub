import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { Container } from "@/components/ui/container";

// Inline brand SVGs — lucide-react v1 removed all brand icons
const GithubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const socialLinks = [
  { label: "GitHub", href: "https://github.com", Icon: GithubIcon },
  { label: "Twitter / X", href: "https://twitter.com", Icon: XIcon },
  { label: "LinkedIn", href: "https://linkedin.com", Icon: LinkedInIcon },
];

const productLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Roadmap", href: "#" },
  { label: "Changelog", href: "#" },
];

const companyLinks = [
  { label: "About", href: "#" },
  { label: "Contact", href: "/contact" },
  { label: "Blog", href: "#" },
];

const legalLinks = [
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Security", href: "#" },
];

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        {title}
      </h3>
      <ul className="space-y-3">
        {links.map((link, i) => (
          <li key={`${link.label}-${i}`}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-secondary/20">
      <Container>
        <div className="py-12 lg:py-16">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* Column 1: Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <Link href="/" className="inline-block hover:opacity-90 transition-opacity mb-4">
                <Wordmark />
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                The complete CBP compliance platform for modern importers.
              </p>
              <div className="flex items-center gap-3 mt-5">
                {socialLinks.map(({ label, href, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Icon />
                  </a>
                ))}
              </div>
            </div>

            {/* Column 2: Product */}
            <FooterColumn title="Product" links={productLinks} />

            {/* Column 3: Company */}
            <FooterColumn title="Company" links={companyLinks} />

            {/* Column 4: Legal */}
            <FooterColumn title="Legal" links={legalLinks} />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border/60 py-6">
          <p className="text-xs text-muted-foreground text-center">
            &copy; 2026 MyCargoLens. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
