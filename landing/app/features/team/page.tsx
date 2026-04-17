import type { Metadata } from "next";
import { TeamClient } from "./team-client";

export const metadata: Metadata = {
  title: "Team Management",
  description:
    "Multi-user workspaces, role-based access, shared audit trails. MyCargoLens is built for compliance teams, not solo operators.",
};

export default function TeamPage() {
  return <TeamClient />;
}
