import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sparkles,
  Send,
  Calendar,
  Image,
  BarChart3,
  Zap,
  ArrowRight,
  CheckCircle2,
  Star,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VisaLogo, MastercardLogo, MirLogo, TBankLogo, SbpLogo } from "@/components/PaymentLogos";

const features = [
  {
    icon: Sparkles,
    title: "AI-генерация постов",
    description: "Создавайте тексты постов за секунды — AI напишет за вас профессиональный контент на любую тему.",
  },
  {
    icon: Send,
    title: "Кросспостинг в 1 клик",
    description: "Публикуйте одновременно в Telegram, ВКонтакте и Макс одной кнопкой.",
  },
  {
    icon: Calendar,
    title: "Отложенный постинг",
    description: "Планируйте публикации на любую дату и время. Посты выйдут автоматически.",
  },
  {
    icon: Image,
    title: "Генерация изображений",
    description: "AI создаёт уникальные картинки по вашему описанию — идеально для оформления постов.",
  },
  {
    icon: BarChart3,
    title: "Контент-план",
    description: "AI предложит план публикаций на неделю или месяц с учётом вашей тематики.",
  },
  {
    icon: Zap,
    title: "Шаблоны оформления",
    description: "Выбирайте из готовых визуальных стилей: деловой, креативный, минимализм и другие.",
  },
];

const steps = [
  { num: "01", title: "Создайте", description: "Напишите пост вручную или сгенерируйте с помощью AI. Добавьте изображение и выберите стиль." },
  { num: "02", title: "Настройте", description: "Выберите соцсети для публикации, задайте дату и время или опубликуйте сразу." },
  { num: "03", title: "Публикуйте", description: "Один клик — и ваш пост появится во всех выбранных каналах одновременно." },
];

const plans = [
  {
    name: "Бесплатный",
    price: "0",
    period: "навсегда",
    features: [
      "5 постов в месяц",
      "Базовые шаблоны стиля",
      "Кросспостинг (чаты, каналы, сообщества): Tg, VK, Max",
    ],
    popular: false,
  },
  {
    name: "Базовый",
    price: "990",
    period: "/ мес",
    features: [
      "10 постов в месяц",
      "AI-генерация текста — 10 запросов",
      "Генерация изображений — 10 запросов",
      "Базовые шаблоны стиля",
      "Отложенный постинг",
    ],
    popular: true,
  },
  {
    name: "Про",
    price: "1 990",
    period: "/ мес",
    features: [
      "Постов в месяц — без ограничений",
      "AI-генерация текста — 30 запросов",
      "Генерация изображений — 30 запросов",
      "Базовые шаблоны стиля",
      "Отложенный постинг",
      "AI-генерация контент-плана — 3 запроса",
      "Приоритетная поддержка",
    ],
    popular: false,
  },
];

const reviews = [
  { name: "Анна К.", role: "SMM-менеджер", text: "Наконец-то не нужно копировать посты вручную! Экономлю по 2 часа каждый день.", rating: 5 },
  { name: "Дмитрий П.", role: "Предприниматель", text: "AI пишет посты лучше, чем я сам. А кросспостинг — это просто магия.", rating: 5 },
  { name: "Мария С.", role: "Контент-маркетолог", text: "Контент-план на месяц за 5 минут. Отложенный постинг работает идеально.", rating: 5 },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Send className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">
              КроссПост
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Возможности</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Тарифы</a>
            <a href="#reviews" className="hover:text-foreground transition-colors">Отзывы</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
              Войти
            </Button>
            <Button size="sm" onClick={() => navigate("/signup")}>
              Начать бесплатно
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/50 to-background" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pb-20 pt-20 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              AI-генерация контента и изображений
            </div>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Публикуйте везде{" "}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                одним кликом
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Создавайте посты с помощью AI, оформляйте в стильных шаблонах и публикуйте
              сразу в Telegram, ВКонтакте и Макс. Планируйте контент на недели вперёд.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" className="h-12 px-8 text-base w-full sm:w-auto" onClick={() => navigate("/signup")}>
                Начать бесплатно
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base w-full sm:w-auto" onClick={() => navigate("/login")}>
                Войти в аккаунт
              </Button>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative mx-auto mt-16 max-w-4xl">
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl shadow-primary/10">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-accent/50 p-4 text-center">
                  <Send className="mx-auto h-8 w-8 text-primary mb-2" />
                  <p className="text-sm font-medium text-foreground">Telegram</p>
                  <p className="text-xs text-muted-foreground">Подключён</p>
                </div>
                <div className="rounded-xl bg-accent/50 p-4 text-center">
                  <MessageSquare className="mx-auto h-8 w-8 text-primary mb-2" />
                  <p className="text-sm font-medium text-foreground">ВКонтакте</p>
                  <p className="text-xs text-muted-foreground">Подключён</p>
                </div>
                <div className="rounded-xl bg-accent/50 p-4 text-center">
                  <Zap className="mx-auto h-8 w-8 text-primary mb-2" />
                  <p className="text-sm font-medium text-foreground">Макс</p>
                  <p className="text-xs text-muted-foreground">Подключён</p>
                </div>
              </div>
              <div className="mt-6 rounded-xl border border-border bg-background p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">AI сгенерировал пост</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  🚀 Автоматизируйте свой контент-маркетинг! Наш сервис поможет вам публиковать посты
                  во всех соцсетях одновременно. Экономьте время, увеличивайте охват...
                </p>
              </div>
            </div>
            <div className="absolute -inset-4 -z-10 rounded-2xl bg-gradient-to-r from-primary/20 via-transparent to-primary/10 blur-3xl" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
              Всё для эффективного постинга
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Создавайте, оформляйте и публикуйте контент быстрее, чем когда-либо.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
              Три простых шага
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              От идеи до публикации — за считанные минуты.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.num} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground font-display text-xl font-bold">
                  {s.num}
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
              Тарифные планы
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Выберите план, который подходит именно вам.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative overflow-hidden transition-all hover:shadow-lg ${
                  plan.popular ? "border-primary shadow-lg shadow-primary/10 scale-105" : "border-border"
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 rounded-bl-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    Популярный
                  </div>
                )}
                <CardContent className="p-6">
                  <h3 className="font-display text-xl font-bold text-foreground">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-extrabold text-foreground">{plan.price} ₽</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="text-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-6 w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => navigate(plan.price === "0" ? "/signup" : "/pricing")}
                  >
                    {plan.price === "0" ? "Начать бесплатно" : "Выбрать план"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Годовая подписка — скидка 10%.
          </p>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="bg-muted/50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
              Отзывы пользователей
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Нам доверяют SMM-менеджеры и предприниматели.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {reviews.map((r) => (
              <Card key={r.name} className="border-border">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-3">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">«{r.text}»</p>
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="text-sm font-medium text-foreground">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent to-primary/5" />
        <div className="relative mx-auto max-w-6xl px-6 text-center">
          <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">
            Готовы автоматизировать постинг?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Присоединяйтесь к сотням пользователей, которые уже экономят время с КроссПост.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="h-12 px-8 text-base w-full sm:w-auto" onClick={() => navigate("/signup")}>
              Начать бесплатно
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Legal & company info */}
      <section className="border-t border-border bg-muted/30 py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="font-display text-base font-semibold text-foreground mb-3">
              Документы
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/offer" className="text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">
                  Публичная оферта
                </a>
              </li>
              <li>
                <a href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">
                  Политика конфиденциальности
                </a>
              </li>
              <li>
                <a href="/delivery" className="text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">
                  Способы получения услуг
                </a>
              </li>
            </ul>
            <h3 className="font-display text-base font-semibold text-foreground mt-6 mb-3">
              Поддержка
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="mailto:neyromarket@yandex.ru" className="text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">
                  neyromarket@yandex.ru
                </a>
              </li>
              <li>
                <a href="tel:+79171114030" className="text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">
                  +7 917 111-40-30
                </a>
              </li>
              <li className="text-muted-foreground">
                Регион оказания услуг: Россия и страны СНГ
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-base font-semibold text-foreground mb-3">
              Контакты и реквизиты
            </h3>
            <div className="text-xs text-muted-foreground space-y-1 leading-relaxed">
              <p className="text-foreground font-medium">ИП Хабарова Мария Павловна</p>
              <p>ИНН: 631212609521</p>
              <p>ОГРНИП: 326632700064940</p>
              <p>Адрес: г. Самара, ул. Ташкентская, 173</p>
              <p>Email: neyromarket@yandex.ru</p>
              <p>Телефон: +7 917 111-40-30</p>
            </div>
          </div>

          <div>
            <h3 className="font-display text-base font-semibold text-foreground mb-3">
              Безопасные платежи
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Оплата принимается через платёжный сервис АО «Т-Банк» с поддержкой
              стандарта PCI DSS. Данные карты вводятся на стороне банка и на сайте
              не хранятся.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-2">
                <VisaLogo className="h-4 w-auto" />
              </span>
              <span className="inline-flex h-9 w-12 items-center justify-center rounded-md border border-border bg-background px-2">
                <MastercardLogo className="h-6 w-auto" />
              </span>
              <span className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background overflow-hidden">
                <MirLogo className="h-9 w-auto" />
              </span>
              <a
                href="https://www.tbank.ru/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Т-Банк"
                className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background overflow-hidden hover:opacity-90 transition-opacity"
              >
                <TBankLogo className="h-9 w-auto" />
              </a>
              <a
                href="https://sbp.nspk.ru/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="СБП"
                className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background overflow-hidden hover:opacity-90 transition-opacity"
              >
                <SbpLogo className="h-9 w-auto" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
              <Send className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="font-display text-sm font-semibold text-foreground">КроссПост</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ИП Хабарова М.П. Все права защищены.
          </p>
        </div>
      </footer>
    </div>
  );
}
