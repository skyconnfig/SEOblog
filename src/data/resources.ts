export interface Resource {
  category: string;
  cover: string;
  typeTag: { label: string; color: string };
  priceTag: { label: string; color: string };
  title: string;
  description: string;
  fileType: string;
  fileSize: string;
  url: string;
  slug: string;
  downloadPath: string;
}

export const resources: Resource[] = [
  {
    category: "ai-dev",
    cover: "/assets/resource-previews/agents-companion-v2/page-1.jpg",
    typeTag: { label: "AI & Dev", color: "purple" },
    priceTag: { label: "Pay What You Want", color: "amber" },
    title: "AI Agents Companion V2",
    description: "A comprehensive reference handbook on AI Agents, covering definitions, classifications, use cases, and future trends in the Agent ecosystem.",
    fileType: "PDF",
    fileSize: "11MB",
    url: "/resources/en-agents-companion-v2",
    slug: "en-agents-companion-v2",
    downloadPath: "/downloads/en-agents-companion-v2.pdf",
  },
  {
    category: "ai-dev",
    cover: "/assets/resource-previews/ai-in-the-enterprise/page-1.jpg",
    typeTag: { label: "AI & Dev", color: "purple" },
    priceTag: { label: "Pay What You Want", color: "amber" },
    title: "AI in the Enterprise: A Practical Guide",
    description: "Explore how AI lands in enterprise environments, from strategic planning to implementation, helping organizations drive AI transformation effectively.",
    fileType: "PDF",
    fileSize: "9.5MB",
    url: "/resources/en-ai-in-the-enterprise",
    slug: "en-ai-in-the-enterprise",
    downloadPath: "/downloads/en-ai-in-the-enterprise.pdf",
  },
  {
    category: "ai-dev",
    cover: "/assets/resource-previews/gemini-for-google-workspace-prompting-guide-101/page-1.jpg",
    typeTag: { label: "AI & Dev", color: "purple" },
    priceTag: { label: "Free", color: "green" },
    title: "Gemini for Google Workspace Prompting Guide 101",
    description: "Google's official prompting guide for Gemini in Workspace, teaching you how to effectively use AI across Gmail, Docs, Sheets, and Slides.",
    fileType: "PDF",
    fileSize: "5.0MB",
    url: "/resources/en-gemini-prompting-guide",
    slug: "en-gemini-prompting-guide",
    downloadPath: "/downloads/en-gemini-prompting-guide.pdf",
  },
  {
    category: "ai-dev",
    cover: "/assets/resource-previews/identifying-and-scaling-ai-use-cases/page-1.jpg",
    typeTag: { label: "AI & Dev", color: "purple" },
    priceTag: { label: "Pay What You Want", color: "amber" },
    title: "Identifying and Scaling AI Use Cases",
    description: "A systematic methodology for identifying high-value AI use cases and planning the path from pilot to full-scale deployment.",
    fileType: "PDF",
    fileSize: "5.9MB",
    url: "/resources/en-identifying-scaling-ai-use-cases",
    slug: "en-identifying-scaling-ai-use-cases",
    downloadPath: "/downloads/en-identifying-scaling-ai-use-cases.pdf",
  },
  {
    category: "ai-dev",
    cover: "/assets/resource-previews/a-practical-guide-to-building-agents/page-1.jpg",
    typeTag: { label: "AI & Dev", color: "purple" },
    priceTag: { label: "Pay What You Want", color: "amber" },
    title: "A Practical Guide to Building AI Agents",
    description: "A systematic guide to building AI Agents from scratch, covering architecture design, engineering implementation, and best practices.",
    fileType: "PDF",
    fileSize: "7.0MB",
    url: "/resources/en-practical-guide-building-agents",
    slug: "en-practical-guide-building-agents",
    downloadPath: "/downloads/en-practical-guide-building-agents.pdf",
  },
  {
    category: "ai-dev",
    cover: "/assets/resource-previews/slides-skill/page-1.jpg",
    typeTag: { label: "AI & Dev", color: "purple" },
    priceTag: { label: "Pay What You Want", color: "amber" },
    title: "AI PPTX Generator Skill | Slides Skill Download",
    description: "A PptxGenJS-based AI Skill toolkit that enables AI to generate editable PPTX files directly, not HTML web presentations. Includes layout helpers, rendering validation tools, and complete workflows.",
    fileType: "ZIP",
    fileSize: "65KB",
    url: "/resources/en-slides-skill",
    slug: "en-slides-skill",
    downloadPath: "/downloads/en-slides-skill.zip",
  },
  {
    category: "ai-dev",
    cover: "/assets/resource-previews/111/cover-1779109039571.png",
    typeTag: { label: "AI & Dev", color: "purple" },
    priceTag: { label: "Pay What You Want", color: "amber" },
    title: "111",
    description: "111",
    fileType: "ZIP",
    fileSize: "10",
    url: "/resources/en-111",
    slug: "en-111",
    downloadPath: "/downloads/111.pdf",
  },
];

export function getResourceBySlug(slug: string): Resource | undefined {
  return resources.find((r) => r.slug === slug);
}

export const colorMap: Record<string, string> = {
  purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  amber: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  green: "bg-green-500/20 text-green-400 border-green-500/30",
};

export const categories = [
  { id: "all", label: "All" },
  { id: "advertising", label: "Advertising" },
  { id: "market-insights", label: "Market Insights" },
  { id: "seo", label: "SEO" },
  { id: "ai-dev", label: "AI & Dev" },
];