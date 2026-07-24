import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth.tsx";
import {
  ChevronRight,
  ArrowRight,
  Check,
  PanelRight,
  BarChart3,
  Calendar,
  PlusCircle,
  Zap,
  Shield,
  Menu,
  TrendingUp,
  Users,
  Calculator,
  Target,
  Send,
  Paperclip,
  Sparkles,
  Rocket,
  FileText,
  DollarSign,
  Clock,
  Bot,
  ChefHat,
  Upload,
  Workflow,
  Brain,
} from "lucide-react";
import { TypeAnimation } from "react-type-animation";

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [chatInput, setChatInput] = React.useState("");

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      window.location.href = `/auth`;
    }
  };

  const handlePillClick = () => {
    window.location.href = `/auth`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFCF8]">
      {/* Announcement Banner */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 py-2 px-4 text-center text-sm text-amber-900">
        <span className="font-semibold">New:</span> Smart task prioritization
        with AI ·{" "}
        <a
          href="#features"
          className="text-amber-700 hover:text-amber-800 font-medium underline underline-offset-2"
        >
          See what's new
        </a>
      </div>

      {/* Header */}
      <header className="py-5 px-6 md:px-8 flex items-center justify-between bg-[#FFFCF8] sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <img
            src="/assets/requisor-logo.png"
            alt="Requisor Logo"
            className="h-10 w-10"
          />
          <div className="flex items-baseline">
            <h1 className="text-xl font-bold text-gray-900">Requisor</h1>
            <span className="text-xs font-medium text-teal-500 ml-1">AI</span>
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
              Private Beta
            </span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex gap-8 text-sm font-medium">
          <a
            href="#features"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            How it works
          </a>
          <a
            href="#pricing"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            Pricing
          </a>
          <a
            href="#testimonials"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            Testimonials
          </a>
          <Link
            href="/privacy-policy"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            Privacy Policy
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <div className="block md:hidden">
          <Button
            variant="ghost"
            size="sm"
            className="p-1"
            onClick={toggleMobileMenu}
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>

        {/* Auth Buttons */}
        <div className="hidden md:flex items-center gap-3">
          {isLoading ? (
            <Button
              disabled
              variant="outline"
              size="sm"
              className="rounded-full"
            >
              Loading...
            </Button>
          ) : isAuthenticated ? (
            <Button
              asChild
              size="sm"
              className="rounded-full bg-teal-500 hover:bg-teal-600 text-white"
            >
              <Link href="/">Open Requisor AI</Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden md:flex"
              >
                <a href="/auth">Log in</a>
              </Button>
              <Button
                asChild
                size="sm"
                className="rounded-full bg-emerald-900 hover:bg-emerald-800 text-white"
              >
                <a href="/auth">Sign Up Free</a>
              </Button>

              {/* <Button
                variant="ghost"
                className="text-slate-700 hover:text-slate-900 font-medium"
              >
                <a href="/auth"> Login</a>
              </Button> */}
            </>
          )}
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      <div
        className={`bg-white py-4 px-6 shadow-md md:hidden ${mobileMenuOpen ? "block" : "hidden"}`}
      >
        <nav className="flex flex-col space-y-4 text-sm font-medium">
          <a
            href="#features"
            className="text-gray-600 hover:text-gray-900 py-2 transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-gray-600 hover:text-gray-900 py-2 transition-colors"
          >
            How it works
          </a>
          <a
            href="#pricing"
            className="text-gray-600 hover:text-gray-900 py-2 transition-colors"
          >
            Pricing
          </a>
          <a
            href="#testimonials"
            className="text-gray-600 hover:text-gray-900 py-2 transition-colors"
          >
            Testimonials
          </a>
          {!isAuthenticated && (
            <div className="flex flex-col gap-3 pt-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="justify-center"
              >
                <a href="/auth">Log in</a>
              </Button>
              <Button
                asChild
                size="sm"
                className="rounded-full bg-teal-900 hover:bg-teal-800 text-white justify-center"
              >
                <a href="/auth">Sign Up Free</a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="justify-center text-xs"
              >
                <a href="/api/logout">Clear Session (if login issues)</a>
              </Button>
            </div>
          )}
          {isAuthenticated && (
            <Button
              asChild
              size="sm"
              className="rounded-full bg-teal-500 hover:bg-teal-600 text-white justify-center mt-2"
            >
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          )}
        </nav>
      </div>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="pt-12 pb-20 md:pt-20 px-6 md:px-8 bg-[#FFFCF8]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-block px-3 py-1 mb-6 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
                <span className="flex items-center gap-1">
                  <Zap size={14} />
                  <span>Get 1 month free with yearly plan</span>
                </span>
              </div>

              {/* Large text above chat */}
              <h1 className="text-5xl md:text-7xl font-bold mb-8 text-gray-900 tracking-tight">
                Ideas to execution in{" "}
                <span className="text-teal-600">seconds</span>
              </h1>

              {/* Sleek Chat Interface - Integrated with Hero */}
              <div className="mb-8 max-w-3xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="p-8">
                    {/* Chat Input with Action Pills */}
                    <form onSubmit={handleChatSubmit} className="relative">
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Create something beautiful..."
                        className="w-full px-4 py-3 pr-12 text-gray-700 placeholder-gray-400 bg-transparent border-0 resize-none focus:outline-none text-base"
                        rows={1}
                        style={{ minHeight: "48px" }}
                        onInput={(e) => {
                          e.currentTarget.style.height = "auto";
                          e.currentTarget.style.height =
                            e.currentTarget.scrollHeight + "px";
                        }}
                      />

                      {/* Action Pills */}
                      <div className="flex items-center gap-2 mt-4 pb-2">
                        <button
                          type="button"
                          onClick={handlePillClick}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          <Sparkles className="h-4 w-4" />
                          <span>Prompt Builder</span>
                        </button>
                        <button
                          type="button"
                          onClick={handlePillClick}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          <FileText className="h-4 w-4" />
                          <span>Create project plan</span>
                        </button>
                        <button
                          type="button"
                          onClick={handlePillClick}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          <Paperclip className="h-4 w-4" />
                          <span>Attach</span>
                        </button>
                        <button
                          type="button"
                          onClick={handlePillClick}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          <Rocket className="h-4 w-4" />
                          <span>Launch agent</span>
                        </button>

                        {/* Send button */}
                        <button
                          type="submit"
                          className="ml-auto h-8 w-8 bg-gray-900 hover:bg-gray-800 rounded-full flex items-center justify-center transition-colors"
                        >
                          <ArrowRight className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>

              {/* Hero Text - Moved below chat interface */}
              <h2 className="text-2xl md:text-3xl font-bold mb-4 text-gray-900 tracking-tight">
                Your smart project manager
                <div className="text-teal-500 mt-1">
                  <span>and AI assistant for </span>
                  <TypeAnimation
                    sequence={[
                      "solopreneurs",
                      2000,
                      "freelancers",
                      2000,
                      "small teams",
                      2000,
                      "consultants",
                      2000,
                    ]}
                    wrapper="span"
                    speed={50}
                    repeat={Infinity}
                  />
                </div>
              </h2>
              <p className="text-base md:text-lg text-gray-600 mb-8 max-w-3xl mx-auto">
                AI is moving fast. You're building a business. Requisor bridges
                the gap. We turn messy ideas into structured plans and help you
                find the right AI tools to automate, execute, and grow - without
                the overwhelm.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center mb-16">
                {isAuthenticated ? (
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full bg-teal-500 hover:bg-teal-600 text-white px-8"
                  >
                    <Link href="/dashboard">Go to Dashboard</Link>
                  </Button>
                ) : (
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full bg-gray-900 hover:bg-gray-800 text-white px-8"
                  >
                    <a href="/auth">Start for free</a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full px-8 group"
                  asChild
                >
                  <a href="#features" className="flex items-center gap-2">
                    See how it works
                    <ChevronRight
                      size={16}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </a>
                </Button>
              </div>
            </div>

            {/* Hero Video/Demo Section */}
            <div className="relative mx-auto max-w-5xl rounded-xl overflow-hidden shadow-2xl border border-gray-200 mt-12">
              <div className="relative pb-[56.25%] h-0">
                <iframe
                  className="absolute top-0 left-0 w-full h-full"
                  src="https://www.youtube.com/embed/I_bunEH35LE?si=S1PtxRTWgeFDCZ7J"
                  title="Requisor Dashboard Demo"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
              <div className="absolute bottom-6 right-6 bg-gradient-to-r from-teal-500 to-teal-600 text-white py-3 px-6 rounded-lg shadow-lg flex items-center gap-2">
                <Zap size={18} />
                <span className="font-medium">AI-powered insights</span>
              </div>
            </div>

            {/* Stats Section */}
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
                <p className="text-3xl font-bold text-gray-900 mb-2">94%</p>
                <p className="text-gray-600">
                  reduction in manual task management for solopreneurs
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
                <p className="text-3xl font-bold text-gray-900 mb-2">2.5x</p>
                <p className="text-gray-600">
                  faster project completion for freelancers and small teams
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
                <p className="text-3xl font-bold text-gray-900 mb-2">3,500+</p>
                <p className="text-gray-600">
                  Project requests from solopreneurs
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 px-6 md:px-8 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-block px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-sm font-medium mb-6">
                Smart features
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
                🚀 Requisor – 6 Core AI-Powered Features
              </h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
                <div className="h-12 w-12 rounded-lg bg-teal-500 text-white flex items-center justify-center mb-4">
                  <span className="text-xl">🦾</span>
                </div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">
                  Your Personal AI Project Manager
                </h3>
                <p className="text-gray-600">
                  Meet the Ultimate Planning Agent, Requisor's core AI that
                  reads your ideas, specs, or messy documents and turns them
                  into crystal-clear project plans. It asks smart questions,
                  adds deadlines, generates subtasks, and keeps everything
                  moving. No chaos. No guesswork. Just pure execution.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
                <div className="h-12 w-12 rounded-lg bg-teal-500 text-white flex items-center justify-center mb-4">
                  <span className="text-xl">🧠</span>
                </div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">
                  Modular AI Agent Hub
                </h3>
                <p className="text-gray-600">
                  From budgeting to onboarding to roadmap planning, plug in the
                  right AI agent to automate parts of your workflow. Built for
                  scale, tailored to your needs.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
                <div className="h-12 w-12 rounded-lg bg-teal-500 text-white flex items-center justify-center mb-4">
                  <span className="text-xl">📋</span>
                </div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">
                  World-Class Project Board
                </h3>
                <p className="text-gray-600">
                  Kanban-style task board enhanced with AI-generated subtasks,
                  effort estimation, deadlines, and intelligent priority
                  tagging.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
                <div className="h-12 w-12 rounded-lg bg-teal-500 text-white flex items-center justify-center mb-4">
                  <span className="text-xl">📊</span>
                </div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">
                  Smart Bandwidth & Resource Planning
                </h3>
                <p className="text-gray-600">
                  Visualize workload across the team. Requisor automatically
                  assigns tasks based on skill, availability, and priority to
                  avoid burnout and optimize output.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
                <div className="h-12 w-12 rounded-lg bg-teal-500 text-white flex items-center justify-center mb-4">
                  <span className="text-xl">🛠️</span>
                </div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">
                  No-Code Workflow Builder
                </h3>
                <p className="text-gray-600">
                  Describe what you want in plain English. Requisor builds the
                  tools, process maps, and integrations for you, even suggests
                  better alternatives.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
                <div className="h-12 w-12 rounded-lg bg-teal-500 text-white flex items-center justify-center mb-4">
                  <span className="text-xl">💰</span>
                </div>
                <h3 className="text-xl font-bold mb-2 text-gray-900">
                  ROI-Driven Execution Engine
                </h3>
                <p className="text-gray-600">
                  Every task is scored on ROI. Requisor helps you prioritize
                  high-impact work to maximize value and minimize wasted effort.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section
          id="how-it-works"
          className="py-20 px-6 md:px-8 bg-gradient-to-b from-gray-50 to-white"
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-medium mb-6">
                Easy to get started
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
                How Requisor AI works
              </h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Get your project management system up and running in minutes
                with our intuitive platform.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 md:gap-12">
              <div className="relative">
                <div className="h-12 w-12 rounded-full bg-teal-500 text-white flex items-center justify-center mb-4 font-bold text-xl">
                  1
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">
                  Describe your project
                </h3>
                <p className="text-gray-600 mb-4">
                  Tell our AI about your project goals, timelines, and
                  requirements in simple language.
                </p>
                <div className="absolute right-0 top-8 hidden md:block">
                  <ArrowRight size={30} className="text-gray-300" />
                </div>
              </div>

              <div className="relative">
                <div className="h-12 w-12 rounded-full bg-teal-500 text-white flex items-center justify-center mb-4 font-bold text-xl">
                  2
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">
                  AI generates your plan
                </h3>
                <p className="text-gray-600 mb-4">
                  Our AI creates a comprehensive project plan with tasks,
                  dependencies, and resource allocation.
                </p>
                <div className="absolute right-0 top-8 hidden md:block">
                  <ArrowRight size={30} className="text-gray-300" />
                </div>
              </div>

              <div>
                <div className="h-12 w-12 rounded-full bg-teal-500 text-white flex items-center justify-center mb-4 font-bold text-xl">
                  3
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">
                  Execute with confidence
                </h3>
                <p className="text-gray-600 mb-4">
                  Collaborate with your team using AI-powered insights to keep
                  the project on track and adapt to changes.
                </p>
              </div>
            </div>

            <div className="mt-16 text-center">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-gray-900 hover:bg-gray-800 text-white px-8"
              >
                <a href="/auth">Get started now</a>
              </Button>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-20 px-6 md:px-8 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-block px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-medium mb-6">
                Customer stories
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
                💡 Designed for Builders, Not Big Tech
              </h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                See how solopreneurs, freelancers, and small teams use Requisor
                to work smarter and stay competitive in the AI age.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
                <div className="flex items-center mb-4">
                  {/* <div className="h-10 w-10 rounded-full bg-gray-300 mr-3"></div> */}
                  <div>
                    <h4 className="font-bold">Erin Magennis</h4>
                    <p className="text-sm text-gray-500">
                      Emerging Science Tech Startup Strategist
                    </p>
                  </div>
                </div>
                <p className="text-gray-600 italic">
                  "Requisor has been such a lifesaver for consulting projects!
                  Specifically, Requisor has been so helpful in requirements
                  gathering to have it all in one place. When working in other
                  projects it can be so time consuming and hard to keep track of
                  all the information across different platforms. It's been so
                  much easier now with Requisor!"
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
                <div className="flex items-center mb-4">
                  {/* <div className="h-10 w-10 rounded-full bg-gray-300 mr-3"></div> */}
                  <div>
                    <h4 className="font-bold">Lisa Thompson</h4>
                    <p className="text-sm text-gray-500">
                      Small Business Owner
                    </p>
                  </div>
                </div>
                <p className="text-gray-600 italic">
                  "Running a small agency, I always felt like we were at a
                  disadvantage against bigger firms. Requisor changed that. It
                  gives us the structure, the planning, and even the confidence
                  to pitch and deliver like we’re a much larger team. For the
                  first time, I feel like we’re truly competing on equal
                  ground."
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
                <div className="flex items-center mb-4">
                  {/* <div className="h-10 w-10 rounded-full bg-gray-300 mr-3"></div> */}
                  <div>
                    <h4 className="font-bold">James Anderson</h4>
                    <p className="text-sm text-gray-500">Tech Freelancer</p>
                  </div>
                </div>
                <p className="text-gray-600 italic">
                  "Honestly, Requisor feels like the teammate I never had. I
                  used to spend late nights trying to piece together project
                  plans, but now I just write my messy ideas and it gives me
                  clarity in minutes. It’s taken a huge weight off my shoulders
                  and let me fall back in love with the creative side of my
                  business."
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 px-6 md:px-8 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-block px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-sm font-medium mb-6">
                Simple pricing
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
                Simple pricing that grows with you
              </h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Perfect for solopreneurs and small teams. Start free, add
                features as your business grows.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Free Plan */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 flex flex-col">
                <div className="w-8 h-8 rounded-full bg-green-500 mb-4"></div>
                <h3 className="text-xl font-bold mb-1 text-gray-900">Free</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">$0</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                  For solopreneurs just getting started
                  <br />
                  Plan faster with AI. No cost, no catch.
                </p>
                <ul className="space-y-3 mb-8 flex-grow text-sm">
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-green-500 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">
                      Basic AI Planning Agent
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-green-500 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">
                      Unlimited project creation
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-green-500 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">
                      Manual tasks & milestones
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-green-500 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">
                      Export as PDF/Markdown
                    </span>
                  </li>
                </ul>
                <p className="text-xs text-gray-500 mb-4">
                  Great for testing ideas and organizing solo work.
                </p>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full rounded-lg"
                >
                  <a href="/auth">Start for free</a>
                </Button>
              </div>

              {/* Builder Plan */}
              <div className="bg-white p-6 rounded-xl border-2 border-blue-500 flex flex-col relative">
                <div className="w-8 h-8 rounded-full bg-blue-500 mb-4"></div>
                <h3 className="text-xl font-bold mb-1 text-gray-900">Builder</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">$29</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                  For solo founders, freelancers, and consultants
                  <br />
                  Automate your planning with smarter AI tools.
                </p>
                <ul className="space-y-3 mb-8 flex-grow text-sm">
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-blue-500 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">Everything in Explorer</span>
                  </li>
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-blue-500 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">
                      Advanced AI Agents (Ideator, Strategist, Executor)
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-blue-500 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">
                      Smart task suggestions + prioritization
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-blue-500 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">
                      Built-in project templates
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-blue-500 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">
                      Collaborate with up to 3 teammates
                    </span>
                  </li>
                </ul>
                <p className="text-xs text-gray-500 mb-4">
                  Speed up execution. Stay ahead of the curve.
                </p>
                <Button
                  asChild
                  size="lg"
                  className="w-full rounded-lg bg-blue-500 hover:bg-blue-600"
                >
                  <a href="/auth">Get started</a>
                </Button>
              </div>

              {/* Pro Plan */}
              <div className="bg-white p-6 rounded-xl border-2 border-orange-500 flex flex-col relative">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                  Most popular
                </div>
                <div className="w-8 h-8 rounded-full bg-orange-500 mb-4"></div>
                <h3 className="text-xl font-bold mb-1 text-gray-900">
                  Pro
                </h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">$99</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                  For agencies, startups, and small teams
                  <br />
                  Leverage powerful AI agents built for execution.
                </p>
                <ul className="space-y-3 mb-8 flex-grow text-sm">
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-orange-500 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">Everything in Builder</span>
                  </li>
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-orange-500 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">
                      Custom AI Agents (Budgeting, Marketing, Quote Generator,
                      Social Media)
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-orange-500 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">
                      Smart Bandwidth & Capacity Planner
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-orange-500 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">
                      Auto task sequencing & dependencies
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-orange-500 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">
                      Full integrations (Jira, Asana, Trello, ClickUp)
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-orange-500 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">
                      API Access for automation
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-orange-500 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">Up to 10 users</span>
                  </li>
                </ul>
                <p className="text-xs text-gray-500 mb-4">
                  Your AI-powered ops team, working 24/7 for you.
                </p>
                <Button
                  asChild
                  size="lg"
                  className="w-full rounded-lg bg-orange-500 hover:bg-orange-600"
                >
                  <a href="/auth">Get started</a>
                </Button>
              </div>

              {/* Enterprise Plan */}
              <div className="bg-white p-6 rounded-xl border border-gray-800 flex flex-col">
                <div className="w-8 h-8 rounded-full bg-gray-800 mb-4"></div>
                <h3 className="text-xl font-bold mb-1 text-gray-900">
                  Enterprise
                </h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">
                    Custom
                  </span>
                  <span className="text-gray-500"> pricing</span>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                  For agencies, enterprises & innovation hubs
                  <br />
                  Custom AI infrastructure built around your workflow.
                </p>
                <ul className="space-y-3 mb-8 flex-grow text-sm">
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-gray-600 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">
                      Everything in Pro
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-gray-600 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">
                      Fully tailored AI workflows
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-gray-600 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">
                      Enterprise security (SSO, SOC2, RBAC)
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-gray-600 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">
                      Onboarding, training, and priority support
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-gray-600 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">
                      Usage analytics & quarterly reviews
                    </span>
                  </li>
                  <li className="flex items-start">
                    <Check
                      size={16}
                      className="text-gray-600 mr-2 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-gray-600">Unlimited users</span>
                  </li>
                </ul>
                <p className="text-xs text-gray-500 mb-4">
                  We build your competitive edge, powered by AI.
                </p>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full rounded-lg"
                >
                  <a href="mailto:support@requisor.io">Contact sales</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 px-6 md:px-8 bg-gradient-to-r from-teal-500 to-teal-600">
          <div className="max-w-4xl mx-auto text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to transform your business with AI?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Join thousands of solopreneurs and small teams who are scaling
              smarter with Requisor.
            </p>
            <Button
              asChild
              size="lg"
              className="bg-white text-teal-600 hover:bg-gray-100 rounded-full px-8"
            >
              <a href="/auth">Start your free trial</a>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 md:px-8 bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img
              src="/assets/requisor-logo.png"
              alt="Requisor Logo"
              className="h-8 w-8"
            />
            <span className="text-sm">
              © 2025 Requisor. All rights reserved.
            </span>
          </div>
          <div className="text-sm text-gray-400">
            Built with AI for solopreneurs and small teams
          </div>
        </div>
      </footer>
    </div>
  );
}
