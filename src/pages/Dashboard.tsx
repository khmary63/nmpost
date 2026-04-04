import { DashboardLayout } from "@/components/DashboardLayout";

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="text-center py-20">
        <h1 className="font-display text-3xl font-bold text-foreground">Дашборд</h1>
        <p className="mt-2 text-muted-foreground">Скоро здесь появится ваш рабочий стол.</p>
      </div>
    </DashboardLayout>
  );
}
