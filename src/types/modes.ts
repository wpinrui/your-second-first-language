export type LearningMode = "think-out-loud" | "chat" | "story" | "review";

export interface ModeInfo {
  id: LearningMode;
  name: string;
  description: string;
  icon: string;
  disabled?: boolean;
}

export const LEARNING_MODES: ModeInfo[] = [
  {
    id: "think-out-loud",
    name: "Think Out Loud",
    description: "Narrate your thoughts. Tutor echoes corrections.",
    icon: "💭",
  },
  {
    id: "chat",
    name: "Chat",
    description: "Natural conversation practice.",
    icon: "💬",
  },
  {
    id: "story",
    name: "Story",
    description: "Build stories together.",
    icon: "📖",
  },
  {
    id: "review",
    name: "Review",
    description: "Coming soon...",
    icon: "📝",
    disabled: true,
  },
];
