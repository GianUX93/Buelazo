import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <img src="/logo-buelazo-dark.png" alt="Buelazo" className="h-6 w-auto" />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            El marketplace peruano para transferir pasajes aéreos entre personas, con pago retenido
            hasta confirmar el endoso.
          </p>
        </div>
        <FooterCol title="Producto">
          <Link to="/explore" className="hover:text-foreground">
            Explorar
          </Link>
          <Link to="/publish" className="hover:text-foreground">
            Publicar pasaje
          </Link>
          <Link to="/dashboard" className="hover:text-foreground">
            Mis operaciones
          </Link>
        </FooterCol>
        <FooterCol title="Confianza">
          <Link to="/trust" className="hover:text-foreground">
            Cómo funciona
          </Link>
          <a href="#" className="hover:text-foreground">
            Respaldo legal (Indecopi)
          </a>
          <a href="#" className="hover:text-foreground">
            Política de reembolso
          </a>
        </FooterCol>
        <FooterCol title="Empresa">
          <a href="#" className="hover:text-foreground">
            Nosotros
          </a>
          <a href="#" className="hover:text-foreground">
            Soporte
          </a>
          <a href="#" className="hover:text-foreground">
            Términos
          </a>
        </FooterCol>
      </div>
      <div className="border-t border-hairline">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <span>© {new Date().getFullYear()} Buelazo PE · Todos los derechos reservados</span>
          <span>Hecho en Lima 🇵🇪 · Prototipo con datos simulados</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
      <div className="text-xs uppercase tracking-widest text-foreground/70">{title}</div>
      {children}
    </div>
  );
}
