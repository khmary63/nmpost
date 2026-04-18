import { Link } from "react-router-dom";
import { ArrowLeft, Zap, Mail, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DeveloperPromo } from "@/components/DeveloperPromo";

export default function Delivery() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" /> На главную
          </Button>
        </Link>

        <h1 className="font-display text-3xl font-bold text-foreground mb-2">
          Способы получения услуг
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Сервис «КроссПост» — это онлайн-платформа. Все услуги предоставляются
          в электронном виде без физической доставки.
        </p>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 flex gap-4 items-start">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-foreground mb-1">
                  Мгновенная активация
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Доступ к платным функциям открывается автоматически сразу после
                  успешной оплаты через платёжный сервис Т-Банк. Дополнительные
                  действия от Пользователя не требуются.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex gap-4 items-start">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-foreground mb-1">
                  Подтверждение по email
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  После оплаты Пользователь получает на указанный электронный адрес
                  фискальный чек от Т-Банка и уведомление об активации тарифа.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex gap-4 items-start">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-foreground mb-1">
                  Срок предоставления услуги
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Услуга предоставляется в течение всего оплаченного периода (как правило,
                  1 месяц с момента оплаты). По окончании периода подписку можно продлить
                  оплатой следующего периода.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="font-display font-semibold text-foreground mb-2">
                Регион оказания услуг
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Сервис доступен на территории Российской Федерации и стран СНГ.
                Все услуги предоставляются дистанционно через личный кабинет на сайте,
                физическая доставка не требуется.
              </p>
            </CardContent>
          </Card>

          <DeveloperPromo />
        </div>
      </div>
    </div>
  );
}
