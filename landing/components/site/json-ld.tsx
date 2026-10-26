import * as React from "react";
import type { JsonLdDoc, JsonLdNode } from "@/lib/schema";

/**
 * Renders a schema.org JSON-LD script. `<` is escaped so data can never
 * close the script tag. Accepts a full doc (`graph(...)`) or a single node.
 */
export function JsonLd({ data }: { data: JsonLdDoc | JsonLdNode }) {
  const doc = "@context" in data ? data : { "@context": "https://schema.org", ...data };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(doc).replace(/</g, "\\u003c") }}
    />
  );
}
