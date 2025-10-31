import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="relative hover:bg-primary/10 transition-all duration-300"
      data-testid="button-theme-toggle"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <Sun 
        className={`h-5 w-5 transition-all duration-300 ${
          theme === 'dark' 
            ? 'rotate-0 scale-100' 
            : 'rotate-90 scale-0'
        }`}
        style={{
          position: 'absolute',
          color: theme === 'dark' ? 'hsl(var(--foreground))' : 'transparent',
        }}
      />
      <Moon 
        className={`h-5 w-5 transition-all duration-300 ${
          theme === 'light' 
            ? 'rotate-0 scale-100' 
            : '-rotate-90 scale-0'
        }`}
        style={{
          position: 'absolute',
          color: theme === 'light' ? 'hsl(var(--foreground))' : 'transparent',
        }}
      />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
