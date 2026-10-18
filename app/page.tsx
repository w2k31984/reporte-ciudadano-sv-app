import Link from "next/link";
import { CodigoForm } from "@/components/codigo-form";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-8">
      <h1 className="text-3xl font-semibold leading-tight tracking-tight">
        ¿Viste un problema en la calle?
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-muted">
        Baches, luminarias apagadas, basura, fugas de agua o un árbol caído.
        Reportalo y te damos un código para seguirlo.
      </p>
      <Link
        href="/reportar"
        className="mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-accent px-6 text-lg font-semibold text-white hover:bg-accent-hover"
      >
        Reportar un problema
      </Link>
      <CodigoForm />
    </main>
  );
}
