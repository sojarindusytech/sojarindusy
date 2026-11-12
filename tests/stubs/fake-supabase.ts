/**
 * A small in-memory stand-in for Supabase Auth + the `profiles` table, used to run the real auth
 * server actions end to end without a network. It mimics the provider behaviours the app depends on:
 *   - signUp on an existing address returns a user with an EMPTY identities list (no error);
 *   - signInWithPassword checks the password first, then "Email not confirmed";
 *   - signOut defaults to the global scope.
 */
type Row = Record<string, unknown>;

export interface FakeUser {
  id: string;
  email: string;
  password: string;
  confirmed: boolean;
  metadata: Record<string, unknown>;
}

export class FakeWorld {
  users = new Map<string, FakeUser>(); // by email
  profiles = new Map<string, Row>(); // by id
  /** Signed-in user id for the "browser" making the request. */
  session: string | null = null;
  ip = "10.0.0.1";
  cookies = new Map<string, string>();
  codes = new Map<string, string>(); // one-time auth code -> user id
  notifications: Row[] = [];
  calls = {
    signUp: [] as Row[],
    signOut: [] as unknown[],
    deleteUser: [] as string[],
    signInWithOtp: [] as Row[],
    resetPasswordForEmail: [] as Row[],
    resend: [] as Row[],
    updateUser: [] as Row[],
    profileUpserts: [] as Row[],
  };
  failures: Partial<Record<"profileUpsert" | "profileUpdate" | "signUp" | "resetPasswordForEmail" | "resend" | "updateUser" | "signInWithOtp", string>> = {};
  private seq = 1;

  addUser(o: {
    email: string;
    password?: string;
    confirmed?: boolean;
    role?: string;
    approval?: string;
    metadata?: Record<string, unknown>;
    profile?: boolean;
  }): FakeUser {
    const id = `00000000-0000-4000-8000-${String(this.seq++).padStart(12, "0")}`;
    const user: FakeUser = {
      id,
      email: o.email.toLowerCase(),
      password: o.password ?? "Str0ng!pass",
      confirmed: o.confirmed ?? true,
      metadata: o.metadata ?? {},
    };
    this.users.set(user.email, user);
    if (o.profile !== false) {
      this.profiles.set(id, {
        id,
        email: user.email,
        role: o.role ?? "customer",
        approval_status: o.approval ?? "approved",
        company_name: "Original Co",
        first_name: "Orig",
        last_name: "Name",
      });
    }
    return user;
  }

  signInAs(user: FakeUser) {
    this.session = user.id;
  }

  private userById(id: string | null): FakeUser | undefined {
    return id ? [...this.users.values()].find((u) => u.id === id) : undefined;
  }

  private authUser(u: FakeUser) {
    return { id: u.id, email: u.email, user_metadata: u.metadata, created_at: "2026-01-01T00:00:00Z", identities: [{ id: u.id }] };
  }

  /** The cookie-bound client the app creates per request (anon key). */
  userClient() {
    const w = this;
    return {
      auth: {
        async getUser() {
          const u = w.userById(w.session);
          return { data: { user: u ? w.authUser(u) : null }, error: null };
        },
        async getSession() {
          return { data: { session: w.session ? { user: { id: w.session } } : null }, error: null };
        },
        async signUp(args: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
          w.calls.signUp.push(args as unknown as Row);
          if (w.failures.signUp) return { data: { user: null }, error: { message: w.failures.signUp } };
          const email = args.email.toLowerCase();
          const existing = w.users.get(email);
          if (existing) {
            // Confirmed account: obfuscated user, empty identities. Unconfirmed: provider re-sends the mail
            // and returns the same user with identities.
            return {
              data: { user: { ...w.authUser(existing), identities: existing.confirmed ? [] : [{ id: existing.id }] } },
              error: null,
            };
          }
          const user = w.addUser({ email, password: args.password, confirmed: false, metadata: args.options?.data, profile: false });
          return { data: { user: w.authUser(user) }, error: null };
        },
        async signInWithPassword(args: { email: string; password: string }) {
          const u = w.users.get(args.email.toLowerCase());
          if (!u || u.password !== args.password) return { data: { user: null }, error: { message: "Invalid login credentials" } };
          if (!u.confirmed) return { data: { user: null }, error: { message: "Email not confirmed" } };
          w.session = u.id;
          return { data: { user: w.authUser(u) }, error: null };
        },
        async signOut(opts?: unknown) {
          w.calls.signOut.push(opts ?? { scope: "global" });
          w.session = null;
          return { error: null };
        },
        async resetPasswordForEmail(email: string, opts: unknown) {
          w.calls.resetPasswordForEmail.push({ email, opts } as Row);
          return w.failures.resetPasswordForEmail ? { error: { message: w.failures.resetPasswordForEmail } } : { error: null };
        },
        async resend(args: Row) {
          w.calls.resend.push(args);
          return w.failures.resend ? { error: { message: w.failures.resend } } : { error: null };
        },
        async updateUser(args: { password?: string }) {
          w.calls.updateUser.push(args as Row);
          if (w.failures.updateUser) return { error: { message: w.failures.updateUser } };
          const u = w.userById(w.session);
          if (!u) return { error: { message: "Auth session missing!" } };
          if (args.password) u.password = args.password;
          return { error: null };
        },
        async exchangeCodeForSession(code: string) {
          const id = w.codes.get(code);
          if (!id) return { error: { message: "invalid flow state" } };
          w.codes.delete(code); // single use
          w.session = id;
          return { error: null };
        },
        async verifyOtp(args: { token_hash: string }) {
          const id = w.codes.get(args.token_hash);
          if (!id) return { error: { message: "Token has expired or is invalid" } };
          w.codes.delete(args.token_hash);
          w.session = id;
          return { error: null };
        },
      },
    };
  }

  /** The service-role client. */
  adminClient() {
    const w = this;
    return {
      from(table: string) {
        if (table !== "profiles") throw new Error(`fake supabase: table ${table} not supported`);
        return new Query(w);
      },
      auth: {
        admin: {
          async deleteUser(id: string) {
            w.calls.deleteUser.push(id);
            const u = w.userById(id);
            if (u) w.users.delete(u.email);
            w.profiles.delete(id);
            return { error: null };
          },
          async updateUserById(id: string, attrs: { user_metadata?: Record<string, unknown> }) {
            const u = w.userById(id);
            if (u) u.metadata = { ...u.metadata, ...attrs.user_metadata };
            return { data: {}, error: null };
          },
          async getUserById(id: string) {
            const u = w.userById(id);
            return { data: { user: u ? w.authUser(u) : null }, error: null };
          },
        },
        async signInWithOtp(args: Row) {
          w.calls.signInWithOtp.push(args);
          return w.failures.signInWithOtp ? Promise.reject(new Error(w.failures.signInWithOtp)) : { data: {}, error: null };
        },
      },
    };
  }
}

class Query implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
  private op: "select" | "update" | "upsert" = "select";
  private payload: Row = {};
  private filters: [string, unknown][] = [];
  constructor(private w: FakeWorld) {}

  select() { return this; }
  order() { return this; }
  not() { return this; }
  eq(col: string, val: unknown) { this.filters.push([col, val]); return this; }
  update(p: Row) { this.op = "update"; this.payload = p; return this; }
  upsert(p: Row) { this.op = "upsert"; this.payload = p; return this; }
  single() { return Promise.resolve(this.run(true)); }
  maybeSingle() { return Promise.resolve(this.run(true, true)); }
  then<T1, T2>(ok?: ((v: { data: unknown; error: { message: string } | null }) => T1 | PromiseLike<T1>) | null, bad?: ((e: unknown) => T2 | PromiseLike<T2>) | null) {
    return Promise.resolve(this.run(false)).then(ok, bad);
  }

  private matching(): Row[] {
    return [...this.w.profiles.values()].filter((r) => this.filters.every(([c, v]) => r[c] === v));
  }

  private run(one: boolean, nullable = false): { data: unknown; error: { message: string } | null } {
    if (this.op === "upsert") {
      this.w.calls.profileUpserts.push(this.payload);
      if (this.w.failures.profileUpsert) return { data: null, error: { message: this.w.failures.profileUpsert } };
      const id = this.payload.id as string;
      this.w.profiles.set(id, { ...(this.w.profiles.get(id) ?? {}), ...this.payload });
      return { data: null, error: null };
    }
    if (this.op === "update") {
      if (this.w.failures.profileUpdate) return { data: null, error: { message: this.w.failures.profileUpdate } };
      for (const r of this.matching()) Object.assign(r, this.payload);
      return { data: null, error: null };
    }
    const rows = this.matching();
    if (one) {
      return rows[0] ? { data: rows[0], error: null } : { data: null, error: nullable ? null : { message: "no rows" } };
    }
    return { data: rows, error: null };
  }
}
