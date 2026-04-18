import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Send, LayoutDashboard, Settings, LogOut, User, Menu, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription, PLAN_LABELS } from "@/hooks/useSubscription";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Дашборд" },
  { to: "/profile", icon: User, label: "Кабинет" },
  { to: "/pricing", icon: Sparkles, label: "Тарифы" },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { plan } = useSubscription();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex h-14 items-center px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="md:hidden h-10 w-10" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Send className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold font-display text-foreground hidden sm:block">КроссПост</span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1 flex-1 justify-end mr-3">
            {navItems.map((item) => {
              const isActive = pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <Link key={item.to} to={item.to}>
                  <Button variant={isActive ? "secondary" : "ghost"} size="sm" className={cn("gap-2", isActive && "bg-accent text-accent-foreground")}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 ml-auto md:ml-0">
            <Link to="/pricing" className="hidden sm:inline-flex">
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-foreground hover:bg-primary/10 transition-colors">
                <Sparkles className="h-3 w-3 text-primary" />
                {PLAN_LABELS[plan]}
              </span>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{user?.email}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/pricing")}>
                  <Sparkles className="mr-2 h-4 w-4" /> Тариф: {PLAN_LABELS[plan]}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Send className="h-4 w-4 text-primary-foreground" />
              </div>
              КроссПост
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-4">
            {navItems.map((item) => {
              const isActive = pathname === item.to;
              return (
                <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)}>
                  <Button variant={isActive ? "secondary" : "ghost"} className={cn("w-full justify-start gap-3 h-12", isActive && "bg-accent text-accent-foreground")}>
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6">{children}</main>
    </div>
  );
}
