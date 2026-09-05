import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthForm } from "@/components/site/auth/AuthForm";

// Ruta directa mantenida para links compartidos / SEO (ej. un email con
// "inicia sesión aquí") — dentro de la app, el flujo por defecto es el modal
// (AuthModal.tsx). Misma lógica de auth, un solo componente (AuthForm).
export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md rounded-[2rem] border border-border bg-white p-8 md:p-10 shadow-sm">
        <AuthForm onAuthenticated={() => navigate({ to: "/" })} />
      </div>
    </div>
  );
}
