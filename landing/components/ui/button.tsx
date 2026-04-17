"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90 hover:scale-[1.01] hover:shadow-[0_4px_6px_-1px_hsl(var(--foreground)/0.06),_0_12px_20px_-4px_hsl(var(--foreground)/0.08),_0_0_0_1px_hsl(var(--border))] focus-visible:ring-ring dark:bg-gold dark:text-yellow-950 dark:hover:bg-gold-dark",
        gold:
          "bg-gold text-yellow-950 font-semibold shadow-gold hover:scale-[1.01] hover:bg-gold-light hover:shadow-[0_0_0_1px_hsl(43_96%_56%_/_0.25),_0_0_24px_hsl(43_96%_56%_/_0.35),_0_0_48px_hsl(43_96%_56%_/_0.12)]",
        outline:
          "border border-border bg-transparent text-foreground shadow-sm hover:bg-secondary hover:text-secondary-foreground hover:scale-[1.01] focus-visible:ring-ring",
        ghost:
          "text-foreground hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-ring",
        link:
          "text-primary underline-offset-4 hover:underline focus-visible:ring-ring",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-md px-4 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
