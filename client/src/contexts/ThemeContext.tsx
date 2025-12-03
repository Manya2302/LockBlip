import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequest } from '@/lib/queryClient';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [isInitialized, setIsInitialized] = useState(false);

  const loadThemeFromLocalStorage = () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        const userTheme = user.themePreference || 'dark';
        setThemeState(userTheme);
        document.documentElement.classList.toggle('dark', userTheme === 'dark');
        console.log(`🎨 Loaded theme preference: ${userTheme} for user ${user.username}`);
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  };

  useEffect(() => {
    loadThemeFromLocalStorage();
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user' || e.key === null) {
        console.log('🔄 User data changed in localStorage, reloading theme...');
        loadThemeFromLocalStorage();
      }
    };

    const handleUserChange = () => {
      loadThemeFromLocalStorage();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('user-logged-in', handleUserChange);

    const interval = setInterval(() => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          const userTheme = user.themePreference || 'dark';
          if (userTheme !== theme) {
            console.log('🔄 Theme preference mismatch detected, syncing...');
            loadThemeFromLocalStorage();
          }
        } catch (error) {
          // Ignore parsing errors
        }
      }
    }, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('user-logged-in', handleUserChange);
      clearInterval(interval);
    };
  }, [theme]);

  useEffect(() => {
    if (!isInitialized) return;

    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    
    root.style.transition = 'background-color 0.3s ease, color 0.3s ease';
  }, [theme, isInitialized]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        user.themePreference = newTheme;
        localStorage.setItem('user', JSON.stringify(user));

        await apiRequest('PUT', '/api/users/theme', { theme: newTheme });
        console.log(`✅ Theme updated to ${newTheme} for user and saved to backend`);
      } catch (error) {
        console.error('Failed to save theme preference:', error);
      }
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
