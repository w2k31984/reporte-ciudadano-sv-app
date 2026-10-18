import Link from "next/link";

const links = [
  { href: "/reportar", label: "Reportar" },
  { href: "/seguimiento", label: "Seguimiento" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-header text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/admin/login"
          className="inline-flex min-h-11 items-center text-lg font-semibold tracking-tight"
        >
          Reporte Ciudadano
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold hover:bg-white/10"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
