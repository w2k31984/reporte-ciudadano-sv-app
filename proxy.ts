import { NextResponse, type NextRequest } from "next/server";
import { publicSupabaseEnv } from "@/lib/supabase/public-env";

export function proxy(request: NextRequest) {
  const { url, key } = publicSupabaseEnv();

  if (!url || !key) {
    return new NextResponse("Falta la configuración del servidor.", { status: 503 });
  }

  const signedIn = request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes("-auth-token") && cookie.value.length > 0);
  const isLogin = request.nextUrl.pathname === "/admin/login";
  const demo = request.nextUrl.searchParams.get("demo") === "1";

  if (!signedIn && !isLogin) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/admin/login";
    redirectUrl.search = demo ? "demo=1" : "";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
