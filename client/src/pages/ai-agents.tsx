import { useState } from "react";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calculator,
  UserPlus,
  Search,
  MessageCircle,
  BarChart3,
  PenTool,
  Zap,
  Star,
  ArrowRight,
  Sparkles,
  Brain,
  Target,
  Lightbulb,
  ChevronRight,
  Play,
  Rocket,
  Settings,
  TrendingUp,
  Award,
  Clock,
  ChefHat,
  FileText,
} from "lucide-react";

// Import dinosaur avatar images
import budgetDino from "@assets/image_1752964073019.png";
import onboardingDino from "@assets/image_1752964111218.png";
import socialMediaDino from "@assets/image_1752964131330.png";
import schedulingDino from "@assets/image_1752964152326.png";
import analyticsDino from "@assets/image_1752964173930.png";
import contentDino from "@assets/image_1752964192200.png";
import foodisaurDino from "@assets/image_1752806541220.png";
import rgaDino from "@assets/image_1752963244999.png";

interface AIAgent {
  id: string;
  name: string;
  dinoName: string;
  dinoSpecies: string;
  description: string;
  longDescription: string;
  icon: React.ComponentType<any>;
  avatar: string;
  dinoImage?: string;
  color: string;
  gradient: string;
  route: string;
  demoRoute?: string;
  features: string[];
  status: "active" | "coming-soon" | "beta";
  popular?: boolean;
  new?: boolean;
}

const categories = [
  { id: "all", name: "All Agents", icon: Sparkles },
  { id: "active", name: "Active", icon: Zap },
  { id: "beta", name: "Beta", icon: Star },
  { id: "coming-soon", name: "Coming Soon", icon: Clock },
];

const aiAgents: AIAgent[] = [
  {
    id: "agile-planning",
    name: "Agile Planning Agent",
    dinoName: "Rextask",
    dinoSpecies: "tyrannosaurus",
    description:
      "Chat-driven planning that breaks down ideas into initiatives, epics, and user stories",
    longDescription:
      "Turn your project ideas into structured agile plans. AI breaks down your prompts into initiatives, epics, and properly formatted user stories with acceptance criteria. Save to Requisor projects or export to Jira with one click.",
    icon: Rocket,
    avatar: "🚀",
    color: "violet",
    gradient: "from-violet-500 to-purple-600",
    route: "/agile-planning",
    features: [
      "Initiative Breakdown",
      "Epic Creation",
      "Story Generation",
      "Jira Export",
    ],
    status: "active",
    new: true,
    popular: true,
  },
  {
    id: "budgeting",
    name: "Budget & Quote Agent",
    dinoName: "Triceraprice",
    dinoSpecies: "triceratops",
    description:
      "AI-powered project estimation and professional quote generation",
    longDescription:
      "Generate accurate project budgets using AI analysis, create professional quotes, and export client-ready proposals with detailed SOW breakdowns.",
    icon: Calculator,
    avatar: "💰",
    dinoImage: budgetDino,
    color: "green",
    gradient: "from-green-500 to-emerald-600",
    route: "/ai-budget-agent",
    features: [
      "Project Scoping",
      "Budget Estimation",
      "Quote Generation",
      "PDF/Excel Export",
    ],
    status: "active",
    popular: true,
  },
  {
    id: "onboarding",
    name: "Client Onboarding Agent",
    dinoName: "Stegoboard",
    dinoSpecies: "stegosaurus",
    description:
      "Streamline client onboarding with intelligent workflow automation",
    longDescription:
      "Automate client intake processes, generate custom onboarding checklists, and ensure smooth project kickoffs with personalized welcome sequences.",
    icon: UserPlus,
    avatar: "👋",
    dinoImage: onboardingDino,
    color: "blue",
    gradient: "from-blue-500 to-cyan-600",
    route: "/ai-onboarding-agent",
    features: [
      "Intake Forms",
      "Welcome Sequences",
      "Document Collection",
      "Project Setup",
    ],
    status: "coming-soon",
  },
  {
    id: "research",
    name: "Research & Analysis Agent",
    dinoName: "Raptelligence",
    dinoSpecies: "velociraptor",
    description:
      "Comprehensive market research and competitive analysis powered by AI",
    longDescription:
      "Conduct in-depth market research, analyze competitors, and generate actionable insights to inform your strategic decisions.",
    icon: Search,
    avatar: "🔍",
    dinoImage: schedulingDino,
    color: "purple",
    gradient: "from-purple-500 to-violet-600",
    route: "/ai-research-agent",
    features: [
      "Market Analysis",
      "Competitor Research",
      "Trend Identification",
      "Report Generation",
    ],
    status: "coming-soon",
  },
  {
    id: "prioritisor",
    name: "Prioritisor Agent",
    dinoName: "Taskosaurus",
    dinoSpecies: "velocipriority",
    description:
      "AI-powered task prioritization based on ROI, effort, urgency, and strategic fit",
    longDescription:
      "Leverage advanced AI to intelligently prioritize your tasks using multi-factor analysis. The agent evaluates ROI potential, effort required, urgency based on deadlines, and strategic alignment to provide data-driven priority scores and actionable recommendations.",
    icon: Target,
    avatar: "🎯",
    color: "indigo",
    gradient: "from-indigo-500 to-purple-600",
    route: "/prioritisor-agent",
    demoRoute: "/prioritisor-demo",
    features: [
      "Multi-Factor Analysis",
      "Custom Weighting",
      "AI Recommendations",
      "Priority Scoring",
    ],
    status: "active",
    new: true,
    popular: false,
  },
  {
    id: "social-media",
    name: "Social Media Agent",
    dinoName: "Pteropost",
    dinoSpecies: "pterodactyl",
    description: "AI-driven content creation and social media management",
    longDescription:
      "Create engaging social media content, schedule posts across platforms, and analyze performance metrics to optimize your social presence.",
    icon: MessageCircle,
    avatar: "📣",
    dinoImage: socialMediaDino,
    color: "pink",
    gradient: "from-pink-500 to-rose-600",
    route: "/social-media-agent",
    features: [
      "Content Creation",
      "Post Scheduling",
      "Analytics",
      "Hashtag Research",
    ],
    status: "active",
    new: true,
    popular: false,
  },
  {
    id: "analytics",
    name: "Performance Analytics Agent",
    dinoName: "Chartkylo",
    dinoSpecies: "ankylosaurus",
    description: "Deep business insights and performance optimization",
    longDescription:
      "Analyze project performance, identify bottlenecks, and get AI-powered recommendations to improve efficiency and profitability.",
    icon: BarChart3,
    avatar: "📊",
    dinoImage: analyticsDino,
    color: "orange",
    gradient: "from-orange-500 to-amber-600",
    route: "/ai-analytics-agent",
    features: [
      "Performance Tracking",
      "ROI Analysis",
      "Bottleneck Detection",
      "Growth Insights",
    ],
    status: "coming-soon",
  },
  {
    id: "content",
    name: "Content Creation Agent",
    dinoName: "Writosaurus",
    dinoSpecies: "brachiosaurus",
    description: "Professional content generation for all your marketing needs",
    longDescription:
      "Generate blog posts, marketing copy, email campaigns, and website content tailored to your brand voice and target audience.",
    icon: PenTool,
    avatar: "✍️",
    dinoImage: contentDino,
    color: "indigo",
    gradient: "from-indigo-500 to-blue-600",
    route: "/ai-content-agent",
    features: [
      "Blog Writing",
      "Marketing Copy",
      "Email Campaigns",
      "SEO Optimization",
    ],
    status: "coming-soon",
  },
  {
    id: "foodisaur",
    name: "Foodisaur Agent",
    dinoName: "Foodisaur",
    dinoSpecies: "tyrannosaurus",
    description:
      "Transform recipe ideas into complete recipes with AI-generated videos",
    longDescription:
      "Create structured recipes from ingredients or ideas, generate visual step-by-step cards, add AI voiceovers, and produce short-form cooking videos automatically.",
    icon: ChefHat,
    avatar: "🍳",
    dinoImage: foodisaurDino,
    color: "red",
    gradient: "from-red-500 to-orange-600",
    route: "/foodisaur-agent",
    features: [
      "Recipe Generation",
      "Visual Cards",
      "AI Voiceover",
      "Video Creation",
    ],
    status: "active",
    new: true,
    popular: false,
  },
  {
    id: "rga",
    name: "RGA Assistant",
    dinoName: "Revenuraptor",
    dinoSpecies: "velociraptor",
    description: "Optimize Revenue-Generating Activities for startup growth",
    longDescription:
      "Track and categorize your tasks as RGA (customer-facing) vs non-RGA (internal) to ensure you're spending optimal time on revenue-generating activities. Get AI insights for maintaining the right balance.",
    icon: TrendingUp,
    avatar: "💰",
    dinoImage: rgaDino,
    color: "emerald",
    gradient: "from-emerald-500 to-green-600",
    route: "/rga-assistant",
    demoRoute: "/rga-demo",
    features: [
      "Task Categorization",
      "RGA Analytics",
      "AI Recommendations",
      "Weekly Planning",
    ],
    status: "coming-soon",
    new: true,
  },
  {
    id: "jira",
    name: "Agile Story Generator",
    dinoName: "Agileraptor",
    dinoSpecies: "velociraptor",
    description:
      "Generate user stories, estimate points, and create backlogs - no login required",
    longDescription:
      "Transform ideas into well-structured user stories, get AI-driven story point estimates based on complexity analysis, and generate complete backlogs. Export to JIRA or save as Requisor projects.",
    icon: FileText,
    avatar: "📝",
    color: "blue",
    gradient: "from-blue-500 to-indigo-600",
    route: "/jira-agent",
    features: [
      "Story Writing",
      "Point Estimation",
      "Backlog Generation",
      "Export to JIRA",
    ],
    status: "coming-soon",
    new: true,
    popular: true,
  },
];

export default function AIAgentsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Sort agents: active first, then coming-soon
  const sortedAgents = [...aiAgents].sort((a, b) => {
    const statusOrder = { active: 0, beta: 1, "coming-soon": 2 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  const filteredAgents = sortedAgents.filter((agent) => {
    const matchesCategory =
      selectedCategory === "all" || agent.status === selectedCategory;

    const query = searchQuery.toLowerCase();

    const matchesSearch =
      agent.name.toLowerCase().includes(query) ||
      agent.description.toLowerCase().includes(query) ||
      agent.longDescription.toLowerCase().includes(query) ||
      agent.dinoName.toLowerCase().includes(query) ||
      agent.features.some((feature) => feature.toLowerCase().includes(query));

    return matchesCategory && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            Active
          </Badge>
        );
      case "beta":
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
            Beta
          </Badge>
        );
      case "coming-soon":
        return (
          <Badge className="bg-gray-100 text-gray-700 border-gray-200">
            Coming Soon
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Premium Hero Section */}
        <div className="relative text-center mb-12 overflow-hidden">
          {/* Advanced Background Effects */}
          <div className="absolute inset-0 -z-10">
            {/* Animated gradient mesh */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 opacity-60"></div>

            {/* Floating orbs */}
            <div className="absolute top-10 left-10 w-24 h-24 bg-gradient-to-r from-blue-400 to-purple-600 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
            <div
              className="absolute top-20 right-10 w-20 h-20 bg-gradient-to-r from-purple-400 to-pink-600 rounded-full mix-blend-multiply filter blur-xl opacity-40 animate-pulse"
              style={{ animationDelay: "1s" }}
            ></div>

            {/* Grid pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] opacity-30"></div>
          </div>

          {/* Premium Badge */}
          {/* <div className="inline-flex items-center space-x-3 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white px-6 py-3 rounded-full text-sm font-bold mb-6 shadow-2xl hover:shadow-3xl transition-all duration-500 border border-white/20 backdrop-blur-sm"> */}
          <div className="relative">
            {/* <Sparkles
                className="h-4 w-4 animate-spin"
                style={{ animationDuration: "3s" }}
              />
              <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-75"></div>
            </div> */}
            {/* <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-100">
              Enterprise AI Automation Platform
            </span>
            <div className="w-2 h-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full animate-pulse shadow-lg"></div> */}
          </div>

          {/* Main Headline */}
          <div className="relative mb-6">
            {/* Animated underline */}
            {/* <div className="flex justify-center mt-4">
              {/* <div className="h-1 w-24 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full shadow-lg animate-pulse"></div> 
            </div> */}
          </div>

          {/* Dinosaur Animation */}
          {/* <div className="flex justify-center space-x-3 mb-6">
            <div className="relative">
              <span
                className="text-3xl animate-bounce filter drop-shadow-lg"
                style={{ animationDelay: "0ms" }}
              >
                🦕
              </span>
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full opacity-60"></div>
            </div>
            <div className="relative">
              <span
                className="text-4xl animate-bounce filter drop-shadow-lg"
                style={{ animationDelay: "150ms" }}
              >
                🦖
              </span>
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-red-400 to-orange-500 rounded-full opacity-60"></div>
            </div>
            <div className="relative">
              <span
                className="text-3xl animate-bounce filter drop-shadow-lg"
                style={{ animationDelay: "300ms" }}
              >
                🦕
              </span>
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full opacity-60"></div>
            </div>
          </div>

          {/* Enhanced Description */}
          {/* <p className="text-lg sm:text-xl lg:text-2xl text-gray-700 max-w-4xl mx-auto leading-relaxed mb-8 font-medium px-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600 font-bold">
              Automate everything.
            </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 font-bold">
              {" "}
              Scale infinitely.
            </span>
            <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 font-bold">
              Transform your business
            </span>
            <span className="text-gray-600">
              {" "}
              with enterprise-grade AI agents.
            </span>
          </p>  */}

          {/* Premium Stats Grid */}
          {/* <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto mb-8">
            <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl p-4 shadow-lg border border-blue-100 hover:shadow-xl transition-all duration-300">
              <div className="text-center">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg mx-auto mb-2 flex items-center justify-center shadow-md">
                  <Award className="h-5 w-5 text-white" />
                </div>
                <div className="text-2xl font-black text-gray-900 mb-1">
                  {aiAgents.length}
                </div>
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Elite AI Agents
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-purple-50 rounded-xl p-4 shadow-lg border border-purple-100 hover:shadow-xl transition-all duration-300">
              <div className="text-center">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg mx-auto mb-2 flex items-center justify-center shadow-md">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div className="text-2xl font-black text-gray-900 mb-1">
                  50x
                </div>
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Productivity Multiplier
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-white to-green-50 rounded-xl p-4 shadow-lg border border-green-100 hover:shadow-xl transition-all duration-300">
              <div className="text-center">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg mx-auto mb-2 flex items-center justify-center shadow-md">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div className="text-2xl font-black text-gray-900 mb-1">
                  24/7
                </div>
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Autonomous Operation
                </div>
              </div>
            </div>
          </div> */}

          {/* Premium Value Proposition */}
          {/* <div className="bg-gradient-to-r from-gray-900 via-purple-900 to-violet-900 rounded-2xl p-6 mx-auto max-w-3xl shadow-xl border border-purple-500/20">
            <div className="text-center text-white">
              <h3 className="text-lg font-bold mb-2">
                Enterprise-Grade AI Automation
              </h3>
              <p className="text-sm text-gray-300 mb-3">
                Replace entire teams with intelligent agents that work 24/7,
                scale infinitely, and deliver consistent results.
              </p>
              <div className="flex flex-wrap justify-center gap-3 text-xs">
                <span className="bg-white/10 px-3 py-1 rounded-full">
                  Zero Downtime
                </span>
                <span className="bg-white/10 px-3 py-1 rounded-full">
                  Infinite Scale
                </span>
                <span className="bg-white/10 px-3 py-1 rounded-full">
                  Sub-Second Response
                </span>
                <span className="bg-white/10 px-3 py-1 rounded-full">
                  99.9% Accuracy
                </span>
              </div>
            </div>
          </div>*/}
        </div>
        {/* Search Bar */}
        <div className="max-w-xl mx-auto mb-10">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search AI agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-base shadow-lg transition-all"
            />
          </div>
        </div>

        {/* Premium Category Filter */}
        <div className="flex flex-wrap justify-center gap-4 mb-10">
          {categories.map((category) => {
            const Icon = category.icon;
            const isSelected = selectedCategory === category.id;
            return (
              <Button
                key={category.id}
                variant={isSelected ? "default" : "outline"}
                onClick={() => setSelectedCategory(category.id)}
                className={`group relative overflow-hidden flex items-center space-x-3 px-6 py-3 rounded-xl font-bold text-base transition-all duration-500 transform hover:scale-105 ${
                  isSelected
                    ? "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-700 hover:via-purple-700 hover:to-indigo-700 text-white shadow-2xl scale-110 border-2 border-purple-300"
                    : "hover:bg-gradient-to-r hover:from-white hover:to-gray-50 hover:shadow-xl border-2 border-gray-200 hover:border-purple-300 bg-white/80 backdrop-blur-md text-gray-700 hover:text-gray-900 shadow-lg"
                }`}
              >
                {/* Background glow effect */}
                {isSelected && (
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-400 to-purple-400 opacity-20 animate-pulse rounded-2xl blur-sm"></div>
                )}

                {/* Icon with enhanced styling */}
                <div
                  className={`relative z-10 ${isSelected ? "text-white" : "text-gray-600 group-hover:text-purple-600"}`}
                >
                  <Icon
                    className={`h-6 w-6 transition-all duration-300 ${isSelected ? "animate-pulse drop-shadow-lg" : "group-hover:scale-110"}`}
                  />
                </div>

                {/* Text */}
                <span
                  className={`relative z-10 font-bold transition-all duration-300 ${isSelected ? "text-white drop-shadow-sm" : "text-gray-700 group-hover:text-gray-900"}`}
                >
                  {category.name}
                </span>

                {/* Particle effect for selected */}
                {isSelected && (
                  <>
                    <div className="absolute top-1 right-2 w-1 h-1 bg-yellow-300 rounded-full animate-ping"></div>
                    <div
                      className="absolute bottom-1 left-2 w-1 h-1 bg-blue-300 rounded-full animate-ping"
                      style={{ animationDelay: "0.5s" }}
                    ></div>
                  </>
                )}
              </Button>
            );
          })}
        </div>

        {/* Dinosaur footprints divider */}
        <div className="flex justify-center items-center space-x-4 my-8">
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-gray-300 rounded-full opacity-20"></div>
            <div className="w-3 h-3 bg-gray-300 rounded-full opacity-30"></div>
            <div className="w-3 h-3 bg-gray-300 rounded-full opacity-40"></div>
          </div>
          <span className="text-2xl">🦖</span>
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-gray-300 rounded-full opacity-40"></div>
            <div className="w-3 h-3 bg-gray-300 rounded-full opacity-30"></div>
            <div className="w-3 h-3 bg-gray-300 rounded-full opacity-20"></div>
          </div>
        </div>

        {/* Enhanced Agents Grid */}
        {filteredAgents.length === 0 ? (
          <div className="text-center text-gray-600 text-lg mt-12">
            No agents found matching your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredAgents.map((agent, index) => {
              const Icon = agent.icon;
              const isActive = agent.status === "active";

              return (
                <Card
                  key={agent.id}
                  className={`group relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:scale-105 hover:-translate-y-2 flex flex-col h-full ${
                    isActive
                      ? "border-2 border-blue-200 bg-white shadow-lg"
                      : "border border-gray-200 bg-white/70 backdrop-blur-sm"
                  } ${!isActive ? "opacity-90" : ""}`}
                  style={{
                    animationDelay: `${index * 100}ms`,
                  }}
                >
                  {/* Popular Badge */}
                  {agent.popular && (
                    <div className="absolute top-6 right-6 z-20">
                      <div className="flex items-center space-x-2 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white px-3 py-2 rounded-full text-sm font-bold shadow-lg animate-pulse">
                        <Star className="h-4 w-4 fill-current" />
                        <span>Popular</span>
                      </div>
                    </div>
                  )}

                  {/* Enhanced Gradient Header */}
                  <div
                    className={`h-40 bg-gradient-to-br ${agent.gradient} relative overflow-hidden`}
                  >
                    {/* Animated Background Pattern */}
                    <div className="absolute inset-0 opacity-20">
                      <div
                        className="absolute top-4 left-4 w-16 h-16 border-2 border-white rounded-full animate-spin"
                        style={{ animationDuration: "8s" }}
                      ></div>
                      <div className="absolute bottom-4 right-4 w-8 h-8 border border-white rounded-full animate-ping"></div>
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-white rounded-full animate-pulse"></div>
                    </div>

                    <div className="absolute inset-0 bg-black bg-opacity-10 group-hover:bg-opacity-5 transition-all duration-300" />

                    {/* Dinosaur Avatar - Properly Centered */}
                    <div className="absolute inset-0 flex items-center justify-center pt-4">
                      {agent.dinoImage ? (
                        <div className="relative flex flex-col items-center transform group-hover:scale-105 transition-transform duration-300">
                          <div className="relative w-24 h-24 bg-white bg-opacity-20 rounded-2xl backdrop-blur-sm p-3 shadow-lg flex items-center justify-center">
                            <img
                              src={agent.dinoImage}
                              alt={agent.dinoName}
                              className="max-w-full max-h-full object-contain filter drop-shadow-md"
                              style={{
                                background: "transparent",
                              }}
                            />
                          </div>
                          <h3 className="mt-2 text-sm font-bold text-white text-center drop-shadow-lg">
                            {agent.dinoName}
                          </h3>
                        </div>
                      ) : (
                        <div className="relative flex flex-col items-center">
                          <div className="w-24 h-24 flex items-center justify-center bg-white bg-opacity-20 rounded-2xl shadow-lg">
                            <span className="text-5xl">{agent.avatar}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Icon Badge */}
                    <div className="absolute bottom-6 left-6 flex items-center space-x-3">
                      <div className="bg-white bg-opacity-30 backdrop-blur-md rounded-xl p-3 group-hover:bg-opacity-40 transition-all duration-300 shadow-lg">
                        <Icon className="h-6 w-6 text-white drop-shadow-sm" />
                      </div>
                    </div>

                    {/* Status Indicator */}
                    <div className="absolute top-6 left-6">
                      {getStatusBadge(agent.status)}
                    </div>
                  </div>

                  <CardHeader className="pb-4 pt-6">
                    <CardTitle className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-blue-700 transition-colors duration-300">
                      {agent.name}
                    </CardTitle>
                    <CardDescription className="text-gray-600 leading-relaxed text-base">
                      {agent.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-0 pb-6 flex flex-col h-full">
                    <p className="text-sm text-gray-700 mb-6 leading-relaxed flex-grow-0">
                      {agent.longDescription}
                    </p>

                    {/* Enhanced Features */}
                    <div className="mb-6 flex-grow">
                      <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
                        Key Features
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {agent.features.map((feature, index) => (
                          <div
                            key={index}
                            className="flex items-center space-x-2 text-sm text-gray-700"
                          >
                            <ChevronRight className="h-3 w-3 text-blue-500" />
                            <span className="font-medium">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Enhanced Action Button - Fixed at bottom */}
                    <div className="mt-auto">
                      {isActive ? (
                        <div className="space-y-3">
                          <Link to={agent.route}>
                            <Button
                              className={`w-full h-14 bg-gradient-to-r ${agent.gradient} hover:opacity-90 transition-all duration-300 group/btn shadow-lg hover:shadow-xl text-base font-semibold`}
                            >
                              <Play className="mr-2 h-5 w-5 group-hover/btn:animate-pulse" />
                              <span>Launch Agent</span>
                              <ArrowRight className="ml-2 h-5 w-5 group-hover/btn:translate-x-1 transition-transform duration-300" />
                            </Button>
                          </Link>
                          {agent.demoRoute && (
                            <Link to={agent.demoRoute}>
                              <Button
                                variant="outline"
                                className="w-full h-10 border-2 hover:bg-gray-50 transition-all duration-300"
                              >
                                <Sparkles className="mr-2 h-4 w-4" />
                                <span>View Demo</span>
                              </Button>
                            </Link>
                          )}
                        </div>
                      ) : (
                        <Button
                          disabled
                          className="w-full h-14 bg-gray-100 text-gray-500 cursor-not-allowed border-2 border-dashed border-gray-300 text-base font-semibold"
                        >
                          <Settings className="mr-2 h-5 w-5" />
                          {agent.status === "beta"
                            ? "Beta Access"
                            : "Coming Soon"}
                        </Button>
                      )}
                    </div>
                  </CardContent>

                  {/* Hover Effect Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-blue-50 to-transparent opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none"></div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Enhanced Call to Action */}
        <div className="mt-20 text-center">
          <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-3xl p-12 text-white overflow-hidden shadow-2xl">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute inset-0 bg-white opacity-5"></div>
                <div className="absolute top-4 left-4 w-16 h-16 border border-white rounded-full animate-pulse"></div>
                <div
                  className="absolute top-8 right-8 w-12 h-12 border border-white rounded-full animate-pulse"
                  style={{ animationDelay: "1s" }}
                ></div>
                <div
                  className="absolute bottom-8 left-8 w-10 h-10 border border-white rounded-full animate-pulse"
                  style={{ animationDelay: "2s" }}
                ></div>
                <div
                  className="absolute bottom-4 right-4 w-14 h-14 border border-white rounded-full animate-pulse"
                  style={{ animationDelay: "0.5s" }}
                ></div>
              </div>
            </div>

            {/* Floating Elements */}
            <div className="absolute top-8 left-8 w-4 h-4 bg-white rounded-full animate-ping opacity-60"></div>
            <div className="absolute top-16 right-12 w-2 h-2 bg-yellow-300 rounded-full animate-bounce"></div>
            <div className="absolute bottom-8 left-16 w-3 h-3 bg-pink-300 rounded-full animate-pulse"></div>
            <div className="absolute bottom-16 right-8 w-2 h-2 bg-green-300 rounded-full animate-ping"></div>

            <div className="relative z-10">
              <div className="inline-flex items-center space-x-2 bg-white bg-opacity-20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
                <Rocket className="h-4 w-4 animate-pulse" />
                <span className="text-sm font-semibold">
                  Start Your AI Journey
                </span>
              </div>

              <h2 className="text-4xl sm:text-5xl font-bold mb-6 leading-tight">
                Ready to <span className="text-yellow-300">Automate</span> Your
                Workflow?
              </h2>

              <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto leading-relaxed">
                Start with our{" "}
                <span className="font-semibold text-white">
                  Budget & Quote Agent
                </span>{" "}
                to streamline your project estimation process, then explore
                other specialized agents as they become available.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link to="/ai-budget-agent">
                  <Button className="bg-white text-blue-600 hover:bg-blue-50 font-bold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-lg group">
                    <Play className="mr-2 h-5 w-5 group-hover:animate-pulse" />
                    Get Started with Budget Agent
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </Button>
                </Link>

                <div className="flex items-center space-x-4 text-blue-100">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-sm">Active Now</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Star className="h-4 w-4 text-yellow-400 fill-current" />
                    <span className="text-sm">Most Popular</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 text-blue-200 text-sm">
                <p>
                  Join thousands of agencies already automating their workflows
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
