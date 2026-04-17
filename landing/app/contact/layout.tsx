import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — MyCargoLens",
  description:
    "Get in touch with the MyCargoLens team for support, enterprise inquiries, or general questions.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
