import type { ReactNode } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useState, useEffect } from "react";

interface StaticPageLayoutProps {
  title: string;
  children: ReactNode;
}

export default function StaticPageLayout({ title, children }: StaticPageLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.title = `${title} | Requisor AI`;
  }, [title]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="py-5 px-6 md:px-8 flex items-center justify-between bg-white sticky top-0 z-50 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2">
          <img src="/assets/requisor-logo.png" alt="Requisor Logo" className="h-10 w-10" />
          <div className="flex items-baseline">
            <h1 className="text-xl font-bold text-gray-900">Requisor</h1>
            <span className="text-xs font-medium text-teal-500 ml-1">AI</span>
          </div>
        </Link>

        <nav className="hidden md:flex gap-8 text-sm font-medium">
          <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">Home</Link>
          <Link href="/privacy-policy" className="text-gray-600 hover:text-gray-900 transition-colors">Privacy</Link>
          <Link href="/terms" className="text-gray-600 hover:text-gray-900 transition-colors">Terms</Link>
          <Link href="/support" className="text-gray-600 hover:text-gray-900 transition-colors">Support</Link>
          <Link href="/zoom-integration" className="text-gray-600 hover:text-gray-900 transition-colors">Zoom</Link>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {isLoading ? (
            <Button disabled variant="outline" size="sm" className="rounded-full">Loading...</Button>
          ) : isAuthenticated ? (
            <Button asChild size="sm" className="rounded-full bg-teal-500 hover:bg-teal-600 text-white">
              <Link href="/">Open Requisor AI</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><a href="/auth">Log in</a></Button>
              <Button asChild size="sm" className="rounded-full bg-gray-900 hover:bg-gray-800 text-white">
                <a href="/auth">Sign Up Free</a>
              </Button>
            </>
          )}
        </div>

        <div className="block md:hidden">
          <Button
            variant="ghost"
            size="sm"
            className="p-1"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="bg-white py-4 px-6 border-b border-gray-100 md:hidden">
          <nav className="flex flex-col space-y-3 text-sm font-medium">
            <Link href="/" className="text-gray-600 hover:text-gray-900 py-1">Home</Link>
            <Link href="/privacy-policy" className="text-gray-600 hover:text-gray-900 py-1">Privacy Policy</Link>
            <Link href="/terms" className="text-gray-600 hover:text-gray-900 py-1">Terms of Use</Link>
            <Link href="/support" className="text-gray-600 hover:text-gray-900 py-1">Support</Link>
            <Link href="/zoom-integration" className="text-gray-600 hover:text-gray-900 py-1">Zoom Integration</Link>
            {!isAuthenticated && !isLoading && (
              <div className="flex flex-col gap-2 pt-2">
                <Button asChild variant="outline" size="sm"><a href="/auth">Log in</a></Button>
                <Button asChild size="sm" className="rounded-full bg-gray-900 hover:bg-gray-800 text-white"><a href="/auth">Sign Up Free</a></Button>
              </div>
            )}
            {isAuthenticated && (
              <Button asChild size="sm" className="rounded-full bg-teal-500 hover:bg-teal-600 text-white mt-2">
                <Link href="/">Go to Dashboard</Link>
              </Button>
            )}
          </nav>
        </div>
      )}

      <main className="flex-1 py-16 px-6 md:px-8">
        <div className="max-w-3xl mx-auto">
          {children}
        </div>
      </main>

      <footer className="bg-gray-50 border-t border-gray-200 py-10 px-6 md:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/assets/requisor-logo.png" alt="Requisor Logo" className="h-6 w-6" />
              <span className="text-sm font-semibold text-gray-700">Requisor AI</span>
            </div>
            <nav className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
              <Link href="/privacy-policy" className="hover:text-gray-900 transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-gray-900 transition-colors">Terms</Link>
              <Link href="/support" className="hover:text-gray-900 transition-colors">Support</Link>
              <Link href="/zoom-integration" className="hover:text-gray-900 transition-colors">Zoom Integration</Link>
            </nav>
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">&copy; {new Date().getFullYear()} Requisor AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
