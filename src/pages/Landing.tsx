import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Landing() {
  const { user, loading, organization } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 animate-fade-in">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <FileText className="h-8 w-8 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
            {organization?.name ?? "QuoteKit"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Proposal Management System — Sign in to continue
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" className="h-12 px-8" onClick={() => navigate("/login")}>
            Sign in
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-8" onClick={() => navigate("/signup")}>
            Join your team
          </Button>
        </div>
      </div>
      <footer className="absolute bottom-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          QuoteKit © {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
