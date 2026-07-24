import { Navbar } from "@/components/layout/Navbar";
import { Hero } from "@/components/sections/Hero";
import { Comparison } from "@/components/sections/Comparison";
import { ToolsReplacement } from "@/components/sections/ToolsReplacement";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { Testimonials } from "@/components/sections/Testimonials";
import { CTA } from "@/components/sections/CTA";
import { Footer } from "@/components/sections/Footer";
import "../landing-theme.css";

export default function AgentsHubPage() {
  return (
    <div className="landing-root dark min-h-screen overflow-x-hidden">
      <Navbar />
      <main className="bg-background text-foreground">
        <Hero />
        <Comparison />
        <ToolsReplacement />
        <FeatureGrid />
        <CTA />
        <Testimonials />
      </main>
      <Footer />
    </div>
  );
}
