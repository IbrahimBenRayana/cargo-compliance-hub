import type { Topic, TopicKey } from "./types";

/** copy/resources.md S3. Topic pages (/resources/topics/{key}) ship once a topic has 3+ articles. */
export const TOPICS: Record<TopicKey, Topic> = {
  isf: { key: "isf", accent: "isf", label: "ISF", description: "Deadlines, penalties, house bills and who files the 10+2" },
  entry: {
    key: "entry", accent: "entry",
    label: "Entry and liquidation",
    description: "7501, 3461, rejections, post-summary corrections, liquidation",
  },
  tariffs: {
    key: "tariffs", accent: "compliance",
    label: "Tariffs and rule changes",
    description: "Section 301, ADD/CVD, enforcement numbers, what changed this year",
  },
  cost: { key: "cost", accent: "checks", label: "Cost", description: "What filing actually costs, and how vendors and brokers charge" },
  api: { key: "api", accent: "api", label: "API and integration", description: "Filing from your TMS, webhooks, data formats" },
};

export const TOPIC_ORDER: TopicKey[] = ["isf", "entry", "tariffs", "cost", "api"];
