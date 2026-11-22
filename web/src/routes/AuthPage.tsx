import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, CarFront, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { api, friendlyError } from "../api";
import { PoolrMark } from "../components/PoolrMark";
import { RouteLine } from "../components/RouteLine";
import { useAuth } from "../features/auth/AuthProvider";

const loginSchema = z.object({ email: z.email("Enter a valid email"), password: z.string().min(1, "Enter your password") });
const registerSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters").max(100),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").refine((value) => new TextEncoder().encode(value).length <= 72, "Password is too long"),
  isDriver: z.boolean(),
});
type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export function AuthPage() {
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode") === "login" ? "login" : "register";
  const { acceptAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const requestedPath = (location.state as { from?: unknown } | null)?.from;
  const loginDestination = typeof requestedPath === "string" && requestedPath.startsWith("/app/") ? requestedPath : "/app/search";

  return (
    <main className="grid min-h-screen bg-canvas lg:grid-cols-[1fr_.9fr]">
      <section className="relative hidden overflow-hidden bg-[#e8d9bd] p-8 lg:block"><RouteLine className="absolute inset-0 h-full w-full" /><div className="relative z-10"><PoolrMark /></div><p className="absolute bottom-10 left-10 z-10 max-w-lg font-display text-5xl font-semibold leading-[.95] tracking-[-.05em]">A familiar route feels lighter with company.</p></section>
      <section className="flex min-h-screen flex-col p-5 sm:p-8 lg:p-12">
        <div className="flex items-center justify-between"><Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-ink"><ArrowLeft className="size-4" />Home</Link><div className="lg:hidden"><PoolrMark /></div></div>
        <div className="mx-auto my-auto w-full max-w-md py-12">
          <div className="grid grid-cols-2 rounded-full bg-ink/5 p-1 text-sm font-bold"><button type="button" className={`rounded-full py-3 ${mode === "register" ? "bg-paper shadow" : "text-muted"}`} onClick={() => setParams({ mode: "register" })}>Create account</button><button type="button" className={`rounded-full py-3 ${mode === "login" ? "bg-paper shadow" : "text-muted"}`} onClick={() => setParams({ mode: "login" })}>Log in</button></div>
          <h1 className="mt-9 font-display text-4xl font-semibold tracking-[-.045em]">{mode === "login" ? "Good to see you." : "Let’s find your route."}</h1>
          <p className="mt-2 text-muted">{mode === "login" ? "Your routes are waiting." : "A real account, ready for the API."}</p>
          {mode === "login" ? <LoginForm show={showPassword} toggle={() => setShowPassword((value) => !value)} submit={async (values) => { const response = await api.login(values); acceptAuth(response); navigate(loginDestination, { replace: true }); }} /> : <RegisterForm defaultDriver={params.get("driver") === "1"} show={showPassword} toggle={() => setShowPassword((value) => !value)} submit={async (values) => { const response = await api.register(values); acceptAuth(response); navigate(values.isDriver ? "/app/driver/new" : "/app/search"); }} />}
        </div>
      </section>
    </main>
  );
}

function LoginForm({ show, toggle, submit }: { show: boolean; toggle(): void; submit(values: LoginValues): Promise<void> }) {
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const mutation = useMutation({ mutationFn: submit });
  return <form className="mt-8 grid gap-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}><Field label="Email" error={form.formState.errors.email?.message}><input {...form.register("email")} type="email" autoComplete="email" placeholder="you@example.com" /></Field><PasswordField register={form.register("password")} error={form.formState.errors.password?.message} show={show} toggle={toggle} autoComplete="current-password" placeholder="Your password" />{mutation.error && <p className="rounded-xl bg-error/10 p-3 text-sm font-semibold text-error" role="alert">{friendlyError(mutation.error)}</p>}<button className="press rounded-full bg-deep px-6 py-3.5 font-bold text-paper" disabled={mutation.isPending}>{mutation.isPending ? "Logging in…" : "Log in"}</button></form>;
}

function RegisterForm({ defaultDriver, show, toggle, submit }: { defaultDriver: boolean; show: boolean; toggle(): void; submit(values: RegisterValues): Promise<void> }) {
  const form = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: { name: "", email: "", password: "", isDriver: defaultDriver } });
  const mutation = useMutation({ mutationFn: submit });
  return <form className="mt-8 grid gap-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}><Field label="Name" error={form.formState.errors.name?.message}><input {...form.register("name")} autoComplete="name" placeholder="What should we call you?" /></Field><Field label="Email" error={form.formState.errors.email?.message}><input {...form.register("email")} type="email" autoComplete="email" placeholder="you@example.com" /></Field><PasswordField register={form.register("password")} error={form.formState.errors.password?.message} show={show} toggle={toggle} autoComplete="new-password" placeholder="At least 8 characters" /><label className="flex cursor-pointer items-center justify-between rounded-2xl border border-ink/15 bg-paper p-4"><span className="flex items-center gap-3"><CarFront className="size-5 text-signature" /><span><strong className="block text-sm">I also offer rides</strong><small className="text-muted">Adds driver capability to your account</small></span></span><input type="checkbox" {...form.register("isDriver")} className="switch" /></label>{mutation.error && <p className="rounded-xl bg-error/10 p-3 text-sm font-semibold text-error" role="alert">{friendlyError(mutation.error)}</p>}<button className="press rounded-full bg-signature px-6 py-3.5 font-bold text-white" disabled={mutation.isPending}>{mutation.isPending ? "Creating account…" : "Create my account"}</button></form>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="form-field"><span>{label}</span>{children}{error && <small role="alert">{error}</small>}</label>; }
function PasswordField({ register, error, show, toggle, autoComplete, placeholder }: { register: ReturnType<ReturnType<typeof useForm<LoginValues>>["register"]> | ReturnType<ReturnType<typeof useForm<RegisterValues>>["register"]>; error?: string; show: boolean; toggle(): void; autoComplete: "current-password" | "new-password"; placeholder: string }) { return <label className="form-field"><span>Password</span><span className="relative"><input {...register} type={show ? "text" : "password"} autoComplete={autoComplete} placeholder={placeholder} /><button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted" aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span>{error && <small role="alert">{error}</small>}</label>; }
