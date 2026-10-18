import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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
