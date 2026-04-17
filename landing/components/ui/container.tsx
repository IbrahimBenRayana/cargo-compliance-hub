import * as React from "react";
import { cn } from "@/lib/utils";

type ContainerProps = React.HTMLAttributes<HTMLDivElement>;

export function Container({ className, children, ...props }: ContainerProps) {
  return (
    <div
      className={cn("max-w-[1280px] mx-auto px-6 lg:px-8", className)}
      {...props}
    >
      {children}
    </div>
  );
}
