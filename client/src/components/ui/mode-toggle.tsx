import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";

export function ModeToggle() {
  const [isLandingPage, setIsLandingPage] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const landing = document.querySelector(".landing-root");
    if (!landing) return;

    setIsLandingPage(true);
    setIsDark(landing.classList.contains("dark"));
  }, []);

  if (!isLandingPage) return null;

  const setLandingTheme = (theme: "light" | "dark") => {
    const landing = document.querySelector(".landing-root");
    if (!landing) return;

    if (theme === "dark") {
      landing.classList.add("dark");
      setIsDark(true);
    } else {
      landing.classList.remove("dark");
      setIsDark(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          {!isDark && <Sun className="h-[1.2rem] w-[1.2rem] transition-all" />}
          {isDark && <Moon className="h-[1.2rem] w-[1.2rem] transition-all" />}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLandingTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLandingTheme("dark")}>
          Dark
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
