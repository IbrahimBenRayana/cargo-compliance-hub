"use client";

import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="bg-mesh min-h-[calc(100vh-4rem)] flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="text-center max-w-md"
      >
        <p
          className="text-gradient-gold text-8xl font-bold leading-none mb-6 select-none"
          aria-hidden="true"
        >
          404
        </p>
        <h1 className="text-2xl font-bold tracking-tight mb-3">Page not found</h1>
        <p className="text-muted-foreground text-base leading-relaxed mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button variant="gold" size="lg" asChild>
            <Link href="/">Back to home</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/pricing">View pricing</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
