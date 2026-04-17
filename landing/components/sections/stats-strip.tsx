import { Container } from "@/components/ui/container";

const stats = [
  { value: "99.8%", label: "CBP acceptance" },
  { value: "< 90 sec", label: "Average filing time" },
  { value: "100%", label: "Audit-ready compliance" },
];

export function StatsStrip() {
  return (
    <div className="border-y border-border/60 py-12 md:py-16">
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/60">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center text-center py-6 md:py-0 px-8">
              <span className="text-3xl md:text-4xl font-semibold text-gradient-gold mb-2">
                {stat.value}
              </span>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
