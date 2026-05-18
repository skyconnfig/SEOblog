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
    cover: "/assets/resource-previews/geo-citation-lab-remotion-source/cover.png",
    typeTag: { label: "AI & Dev", color: "purple" },
    priceTag: { label: "Pay What You Want", color: "amber" },
    title: "GEO Citation Lab Remotion Source Code Download",
    description:
      "Download the Remotion source package for LXSBest's AI search citation analysis video, including animated data visualization components, caption timelines, narration audio, cover images, and setup notes.",
    fileType: "ZIP",
    fileSize: "46MB",
    url: "/resources/en-geo-citation-lab-remotion-source",
    slug: "en-geo-citation-lab-remotion-source",
    downloadPath: "/downloads/en-geo-citation-lab-remotion-source.zip",
  },
  {
    category: "ai-dev",
    cover: "/assets/resource-previews/guoshu-featured-10-efficiency-skills/cover.png",
    typeTag: { label: "AI & Dev", color: "purple" },
    priceTag: { label: "Pay What You Want", color: "amber" },
    title: "LXSBest's 10 Productivity Skills Pack",
    description:
      "Download the same 10 office efficiency AI Skills featured in the video, covering weekly reports, meeting notes, SOP writing, PPT storytelling, Excel formulas, contract review checklists, competitor analysis, customer replies, interview questions, and risk ledgers.",
    fileType: "ZIP",
    fileSize: "36MB",
    url: "/resources/en-guoshu-featured-10-efficiency-skills",
    slug: "en-guoshu-featured-10-efficiency-skills",
    downloadPath: "/downloads/en-guoshu-featured-10-efficiency-skills.zip",
  },
  {
    category: "ai-dev",
    cover: "/assets/resource-previews/markdown-to-docx-skill/cover.svg",
    typeTag: { label: "AI & Dev", color: "purple" },
    priceTag: { label: "Pay What You Want", color: "amber" },
    title: "Markdown to DOCX Skill | Template-Driven Word Export Download",
    description:
      "An open-source Markdown-to-DOCX Skill built around Pandoc, Obsidian image embeds, Mermaid rendering, caption repair, and DOCX/DOTX template styling for polished Word output.",
    fileType: "ZIP",
    fileSize: "24KB",
    url: "/resources/en-markdown-to-docx-skill",
    slug: "en-markdown-to-docx-skill",
    downloadPath: "/downloads/en-markdown-to-docx-skill.zip",
  },
  {
    category: "ai-dev",
    cover: "/assets/resource-previews/agent-system-engineering/page-1.jpg",
    typeTag: { label: "AI & Dev", color: "purple" },
    priceTag: { label: "Pay What You Want", color: "amber" },
    title: "Agent System Engineering: From Design to Deployment",
    description:
      "A deep dive into AI Agent system engineering, covering architecture, reliability, monitoring, evaluation, and key engineering practices.",
    fileType: "PDF",
    fileSize: "17MB",
    url: "/resources/en-agent-system-engineering",
    slug: "en-agent-system-engineering",
    downloadPath: "/downloads/en-agent-system-engineering.pdf",
  },
  {
    category: "ai-dev",
    cover: "/assets/resource-previews/agents-companion-v2/page-1.jpg",
    typeTag: { label: "AI & Dev", color: "purple" },
    priceTag: { label: "Pay What You Want", color: "amber" },
    title: "AI Agents Companion V2",
    description:
      "A comprehensive reference handbook on AI Agents, covering definitions, classifications, use cases, and future trends in the Agent ecosystem.",
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
    description:
      "Explore how AI lands in enterprise environments, from strategic planning to implementation, helping organizations drive AI transformation effectively.",
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
    description:
      "Google's official prompting guide for Gemini in Workspace, teaching you how to effectively use AI across Gmail, Docs, Sheets, and Slides.",
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
    description:
      "A systematic methodology for identifying high-value AI use cases and planning the path from pilot to full-scale deployment.",
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
    description:
      "A systematic guide to building AI Agents from scratch, covering architecture design, engineering implementation, and best practices.",
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
    description:
      "A PptxGenJS-based AI Skill toolkit that enables AI to generate editable PPTX files directly, not HTML web presentations. Includes layout helpers, rendering validation tools, and complete workflows.",
    fileType: "ZIP",
    fileSize: "65KB",
    url: "/resources/en-slides-skill",
    slug: "en-slides-skill",
    downloadPath: "/downloads/en-slides-skill.zip",
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
