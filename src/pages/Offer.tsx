import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Offer() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" /> На главную
          </Button>
        </Link>

        <h1 className="font-display text-3xl font-bold text-foreground mb-2">
          Публичная оферта
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Договор-оферта на оказание услуг сервиса «КроссПост»
        </p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="font-display text-xl font-semibold mb-2">1. Общие положения</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Настоящая публичная оферта (далее — «Оферта») регулирует отношения между
              Индивидуальным предпринимателем Хабаровой Марией Павловной (ИНН 7710140679),
              далее — «Исполнитель», и любым физическим или юридическим лицом, принявшим
              условия настоящей Оферты, далее — «Пользователь».
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-2">2. Предмет договора</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Исполнитель предоставляет Пользователю доступ к программному обеспечению
              сервиса «КроссПост» для автоматизированной публикации контента в социальных
              сетях и мессенджерах (Telegram, ВКонтакте, MAX), а также к сопутствующим
              функциям (AI-генерация текста и изображений, отложенный постинг, аналитика).
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-2">3. Стоимость и оплата</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Стоимость услуг указана на странице тарифов. Оплата производится через
              платёжный сервис ЮKassa. Доступны тарифы: Бесплатный, Базовый (490 ₽/мес)
              и Про (1 490 ₽/мес). Подписка списывается ежемесячно с момента активации.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-2">4. Возврат средств</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Возврат денежных средств возможен в течение 7 дней с момента оплаты при условии,
              что Пользователь не использовал платные функции сервиса. Для оформления возврата
              обратитесь по электронной почте в службу поддержки.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-2">5. Права и обязанности сторон</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Пользователь обязуется не использовать сервис для распространения противоправного
              контента, спама, а также материалов, нарушающих законодательство РФ. Исполнитель
              оставляет за собой право заблокировать аккаунт при нарушении этих условий.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-2">6. Конфиденциальность</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Исполнитель обязуется не передавать персональные данные Пользователя третьим
              лицам, за исключением случаев, предусмотренных законодательством РФ.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-2">7. Реквизиты Исполнителя</h2>
            <div className="rounded-lg border border-border bg-card p-4 text-sm space-y-1 text-foreground">
              <p><span className="text-muted-foreground">Наименование:</span> ИП ХАБАРОВА МАРИЯ ПАВЛОВНА</p>
              <p><span className="text-muted-foreground">ИНН:</span> 7710140679</p>
              <p><span className="text-muted-foreground">Расчётный счёт:</span> 40802810900009535828</p>
              <p><span className="text-muted-foreground">Банк:</span> АО «Тинькофф Банк»</p>
              <p><span className="text-muted-foreground">Корр. счёт:</span> 30101810145250000974</p>
              <p><span className="text-muted-foreground">БИК:</span> 044525974</p>
              <p><span className="text-muted-foreground">Юридический адрес:</span> Москва, 127287, ул. Хуторская 2-я, д. 38А, стр. 26</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
