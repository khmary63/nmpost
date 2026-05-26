import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeveloperPromo } from "@/components/DeveloperPromo";
import { SEO } from "@/components/SEO";

export default function Offer() {
  return (
    <div className="min-h-screen bg-background py-12">
      <SEO title="Публичная оферта — КроссПост" description="Договор-оферта на оказание услуг сервиса КроссПост." path="/offer" />
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
              Индивидуальным предпринимателем Хабаровой Марией Павловной
              (ИНН 631212609521, ОГРНИП 326632700064940), далее — «Исполнитель»,
              и любым физическим или юридическим лицом, принявшим условия
              настоящей Оферты, далее — «Пользователь».
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
              платёжный сервис АО «Т-Банк» (tbank.ru). Доступны тарифы:
            </p>
            <ul className="mt-2 text-sm leading-relaxed text-muted-foreground list-disc pl-5 space-y-1">
              <li><span className="text-foreground font-medium">Бесплатный</span> — 0 ₽, оплата не взимается. Доступен бессрочно с базовым набором функций и лимитами, указанными на странице тарифов.</li>
              <li><span className="text-foreground font-medium">Базовый</span> — 990 ₽/мес.</li>
              <li><span className="text-foreground font-medium">Про</span> — 1 990 ₽/мес.</li>
            </ul>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Подписка на платных тарифах списывается ежемесячно с момента активации.
              Услуги оказываются на территории Российской Федерации и стран СНГ.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-2">4. Возврат средств</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Возврат денежных средств возможен в течение 7 календарных дней с момента
              оплаты при условии, что Пользователь не использовал платные функции сервиса.
              Для оформления возврата направьте заявление на email службы поддержки
              (neyromarket@yandex.ru) с указанием ФИО, даты платежа и причины возврата.
              Возврат осуществляется на ту же банковскую карту, с которой производилась
              оплата, в срок до 10 рабочих дней с момента подтверждения заявки
              (срок зачисления зависит от банка-эмитента карты).
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
              <p><span className="text-muted-foreground">Наименование:</span> ИП Хабарова Мария Павловна</p>
              <p><span className="text-muted-foreground">ИНН:</span> 631212609521</p>
              <p><span className="text-muted-foreground">ОГРНИП:</span> 326632700064940</p>
              <p><span className="text-muted-foreground">Адрес:</span> г. Самара, ул. Ташкентская, 173</p>
              <p><span className="text-muted-foreground">Email:</span> neyromarket@yandex.ru</p>
              <p><span className="text-muted-foreground">Телефон:</span> +7 917 111-40-30</p>
            </div>
          </section>

          <DeveloperPromo />
        </div>
      </div>
    </div>
  );
}
