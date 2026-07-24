import { Navbar } from "@/components/layout/Navbar";
import { Hero } from "@/components/sections/Hero";
import { ProductDemo } from "@/components/sections/ProductDemo";
import { Comparison } from "@/components/sections/Comparison";
import { ToolsReplacement } from "@/components/sections/ToolsReplacement";
import { FeatureGrid } from "@/components/sections/FeatureGrid";
import { AgentSquad } from "@/components/sections/AgentSquad";
import { AIAgentsSection } from "@/components/sections/AIAgentsSection";
import { Testimonials } from "@/components/sections/Testimonials";
import { CTA } from "@/components/sections/CTA";
import { Footer } from "@/components/sections/Footer";
import { Fig } from "@/components/sections/phone";


export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      
      <Navbar />
      <main>
        <Hero />
        <Comparison />
        <ToolsReplacement />
        {/* <AIAgentsSection /> */}
        <FeatureGrid />
        {/* <AgentSquad /> */}
        <CTA />
        <Testimonials />
      </main>
      <Footer />
    </div>
  );
}
