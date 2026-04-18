import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" /> На главную
          </Button>
        </Link>

        <h1 className="font-display text-3xl font-bold text-foreground mb-2">
          Политика конфиденциальности
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Условия обработки и защиты персональных данных пользователей сервиса «КроссПост»
        </p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="font-display text-xl font-semibold mb-2">1. Оператор персональных данных</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Оператором персональных данных является ИП Хабарова Мария Павловна
              (ИНН 631212609521, ОГРНИП 326632700064940, г. Самара, ул. Ташкентская, 173),
              далее — «Оператор».
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-2">2. Какие данные мы собираем</h2>
            <ul className="text-sm leading-relaxed text-muted-foreground list-disc pl-5 space-y-1">
              <li>Имя, фамилия, адрес электронной почты, номер телефона</li>
              <li>Идентификаторы аккаунтов в социальных сетях, токены доступа к API (Telegram, ВКонтакте, MAX)</li>
              <li>Содержимое создаваемых публикаций и загружаемых изображений</li>
              <li>Технические данные: IP-адрес, тип устройства, cookies, журнал действий в сервисе</li>
              <li>Платёжные данные обрабатываются исключительно платёжным сервисом Т-Банк, на стороне сайта данные банковских карт не сохраняются</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-2">3. Цели обработки</h2>
            <ul className="text-sm leading-relaxed text-muted-foreground list-disc pl-5 space-y-1">
              <li>Регистрация и предоставление доступа к сервису</li>
              <li>Публикация контента в подключённые социальные сети по поручению Пользователя</li>
              <li>Обработка платежей и выставление чеков (54-ФЗ)</li>
              <li>Связь с Пользователем по вопросам поддержки и сервиса</li>
              <li>Улучшение качества работы сервиса и безопасность</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-2">4. Правовые основания</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Обработка осуществляется на основании согласия субъекта персональных данных,
              предоставленного при регистрации, и в рамках исполнения договора-оферты.
              Обработка ведётся в соответствии с Федеральным законом № 152-ФЗ
              «О персональных данных».
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-2">5. Передача третьим лицам</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Оператор не передаёт персональные данные третьим лицам, за исключением:
              платёжного сервиса Т-Банк (для проведения оплаты), API социальных сетей
              (Telegram, ВКонтакте, MAX) — для публикации контента по поручению Пользователя,
              а также случаев, прямо предусмотренных законодательством РФ.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-2">6. Безопасность платежей</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Оплата на сайте производится через защищённую страницу платёжного сервиса
              Т-Банк, соответствующего стандарту PCI DSS. Реквизиты банковской карты
              вводятся на стороне Т-Банка и Оператору не передаются и не хранятся.
              Соединение защищено TLS-шифрованием.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-2">7. Срок хранения и удаление</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Персональные данные хранятся в течение срока действия учётной записи и
              3 лет после её удаления (для целей бухгалтерского и налогового учёта).
              Пользователь вправе в любой момент запросить удаление своих данных,
              отправив запрос на адрес поддержки.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-2">8. Права пользователя</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Пользователь вправе получать информацию об обработке своих персональных данных,
              требовать их уточнения, блокирования или удаления, а также отзывать согласие
              на обработку. Для этого направьте обращение на email поддержки.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-2">9. Cookies</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Сайт использует cookies для авторизации, сохранения настроек и аналитики.
              Продолжая пользоваться сайтом, вы соглашаетесь с использованием cookies.
              Их можно отключить в настройках браузера.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-2">10. Контакты</h2>
            <div className="rounded-lg border border-border bg-card p-4 text-sm space-y-1 text-foreground">
              <p><span className="text-muted-foreground">ИП:</span> Хабарова Мария Павловна</p>
              <p><span className="text-muted-foreground">ИНН:</span> 631212609521</p>
              <p><span className="text-muted-foreground">ОГРНИП:</span> 326632700064940</p>
              <p><span className="text-muted-foreground">Адрес:</span> г. Самара, ул. Ташкентская, 173</p>
              <p><span className="text-muted-foreground">Email:</span> neyromarket@yandex.ru</p>
              <p><span className="text-muted-foreground">Телефон:</span> +7 917 111-40-30</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
