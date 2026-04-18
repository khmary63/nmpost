import { Mail, Code2 } from "lucide-react";

interface DeveloperPromoProps {
  variant?: "default" | "compact";
}

export function DeveloperPromo({ variant = "default" }: DeveloperPromoProps) {
  if (variant === "compact") {
    return (
      <div className="border-t border-border bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground">
        Хотите такое же или другое веб-приложение?{" "}
        <a
          href="mailto:Neuromarket@yandex.ru"
          className="font-medium text-primary hover:underline"
        >
          Neuromarket@yandex.ru
        </a>
      </div>
    );
  }

  return (
    <section className="mx-auto my-8 max-w-3xl rounded-lg border border-primary/20 bg-primary/5 p-5 text-center">
      <div className="mb-2 flex items-center justify-center gap-2 text-primary">
        <Code2 className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-wide">Разработка веб-приложений</span>
      </div>
      <p className="mb-3 text-sm text-foreground">
        Если вы хотите разработать аналогичное или любое другое веб-приложение —
        обратитесь к разработчику.
      </p>
      <a
        href="mailto:Neuromarket@yandex.ru"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Mail className="h-4 w-4" />
        Neuromarket@yandex.ru
      </a>
    </section>
  );
}
