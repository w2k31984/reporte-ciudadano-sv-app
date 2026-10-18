import { LoginForm } from "./login-form";

export default function AdminLoginPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        Entrada de administración
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-muted">
        Entrá con el correo del equipo que da seguimiento a los reportes.
      </p>
      <LoginForm />
    </main>
  );
}
