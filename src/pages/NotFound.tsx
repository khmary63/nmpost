import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";

const NotFound = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="font-display text-6xl font-extrabold text-foreground">404</h1>
      <p className="mt-4 text-lg text-muted-foreground">Страница не найдена</p>
      <Button className="mt-8" asChild>
        <Link to="/">На главную</Link>
      </Button>
    </div>
  );
};

export default NotFound;
