import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, ok, readJson, requireFields } from "@/lib/api";
import { sendNewUserCredentials } from "@/lib/notify";
import { generateTempPassword } from "@/lib/passwords";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

export async function GET(req: NextRequest) {
  return handle(async () => {
    // Admin manages users; secretary needs the staff list for meeting attendees.
    const session = await requireUser(["admin", "secretary"]);
    const url = new URL(req.url);
    const full = url.searchParams.get("full") === "1" && session.role === "admin";

    let users;
    try {
      users = await cx().query(api.users.listUsers, {
        secret: secret(),
        orgId: session.orgId as never,
        full,
      });
    } catch (e) {
      return mapConvexError(e);
    }
    return ok({ users });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireUser(["admin"]);
    const body = await readJson<{ name: string; email: string; phone?: string; role: string }>(req);
    requireFields(body, ["name", "email", "role"]);

    const email = String(body.email).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Invalid email address");

    const tempPassword = generateTempPassword();

    let id: string;
    try {
      id = await cx().mutation(api.users.createUser, {
        secret: secret(),
        orgId: session.orgId as never,
        name: String(body.name).trim(),
        email,
        phone: body.phone?.trim() || undefined,
        role: body.role as "admin" | "secretary" | "manager" | "employee",
        passwordHash: bcrypt.hashSync(tempPassword, 10),
      });
    } catch (e) {
      return mapConvexError(e);
    }

    const user = await cx().query(api.auth.getUserById, {
      secret: secret(),
      id: id as never,
      orgId: session.orgId as never,
    });

    await sendNewUserCredentials(
      { id: user!._id, name: user!.name, email: user!.email, phone: user!.phone ?? null },
      tempPassword
    );

    return ok({
      user: {
        id: user!._id,
        name: user!.name,
        email: user!.email,
        phone: user!.phone ?? null,
        role: user!.role,
        leave_balance: user!.leaveBalance,
        must_change_password: user!.mustChangePassword ? 1 : 0,
        active: user!.active ? 1 : 0,
        created_at: new Date(user!.createdAt).toISOString().replace("T", " ").slice(0, 19),
      },
      tempPassword,
      note: "Credentials have been sent to the user via email and SMS.",
    });
  });
}
