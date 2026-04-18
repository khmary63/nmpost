import { Mail, Code2, Globe, Send } from "lucide-react";

interface DeveloperPromoProps {
  variant?: "default" | "compact";
}

export function DeveloperPromo({ variant = "default" }: DeveloperPromoProps) {
  if (variant === "compact") {
    return (
      <div className="border-t border-border bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground">
        <span className="block sm:inline">
          Закажите разработку своего веб-приложения у{" "}
          <a
            href="https://neyromarket.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            НейроМаркет | ИИ для бизнеса
          </a>
        </span>
        <span className="hidden sm:inline"> · </span>
        <a href="mailto:Neuromarket@yandex.ru" className="text-primary hover:underline">
          Neuromarket@yandex.ru
        </a>
        {" · "}
        <a
          href="https://t.me/m_khabarova"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          @m_khabarova
        </a>
      </div>
    );
  }

  return (
    <section className="mx-auto my-8 max-w-3xl rounded-lg border border-primary/20 bg-primary/5 p-5 text-center">
      <div className="mb-2 flex items-center justify-center gap-2 text-primary">
        <Code2 className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase tracking-wide">Заказная разработка веб-приложений</span>
      </div>
      <p className="mb-2 text-base font-semibold text-foreground">
        Закажите разработку аналогичного или любого другого веб-приложения под ваш бизнес.
      </p>
      <p className="mb-1 text-sm text-foreground">
        Создаём SaaS-сервисы, личные кабинеты, AI-интеграции, CRM и автоматизации «под ключ».
      </p>
      <p className="mb-4 text-sm text-foreground">
        Разработчик —{" "}
        <a
          href="https://neyromarket.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary hover:underline"
        >
          «НейроМаркет | ИИ для бизнеса»
        </a>
        .
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        По вопросам приобретения услуг и сотрудничества обращаться:
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <a
          href="https://neyromarket.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/10"
        >
          <Globe className="h-4 w-4 text-primary" />
          neyromarket.com
        </a>
        <a
          href="mailto:Neuromarket@yandex.ru"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Mail className="h-4 w-4" />
          Neuromarket@yandex.ru
        </a>
        <a
          href="https://t.me/m_khabarova"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/10"
        >
          <Send className="h-4 w-4 text-primary" />
          @m_khabarova
        </a>
      </div>
    </section>
  );
}
