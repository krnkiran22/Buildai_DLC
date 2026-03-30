"use client";

import { startTransition, useState } from "react";
import {
  isApiConfigured,
  loginUser,
  requestRegistrationOtp,
  verifyRegistrationOtp,
} from "@/lib/backend";
import type { AuthSession } from "@/lib/operations-types";

type SelfRegisterRole = "factory_operator" | "ingestion";

export function AuthPortal({
  onAuthenticated,
}: {
  onAuthenticated: (session: AuthSession) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerDisplayName, setRegisterDisplayName] = useState("");
  const [registerRole, setRegisterRole] = useState<SelfRegisterRole>("factory_operator");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpDebugCode, setOtpDebugCode] = useState<string>("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState(false);

  async function handleRequestOtp() {
    setPending(true);
    setFeedback("");

    try {
      const challenge = await requestRegistrationOtp({
        email: registerEmail,
        password: registerPassword,
        displayName: registerDisplayName,
        role: registerRole,
      });
      setOtpEmail(challenge.email);
      setOtpDebugCode(challenge.otpDebugCode ?? "");
      setFeedback(
        challenge.deliveryMode === "development_log"
          ? "OTP generated in development mode. Use the debug code below."
          : "OTP sent to your email. Enter it below to complete registration.",
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to request OTP.");
    } finally {
      setPending(false);
    }
  }

  async function handleVerifyOtp() {
    setPending(true);
    setFeedback("");

    try {
      const session = await verifyRegistrationOtp({
        email: otpEmail,
        otp: otpCode,
      });
      startTransition(() => onAuthenticated(session));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "OTP verification failed.");
    } finally {
      setPending(false);
    }
  }

  async function handleLogin() {
    setPending(true);
    setFeedback("");

    try {
      const session = await loginUser({
        email: loginEmail,
        password: loginPassword,
      });
      startTransition(() => onAuthenticated(session));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid-overlay min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[1240px] items-start px-4 py-6 sm:px-6 sm:py-8 lg:items-center lg:px-10">
        <section className="panel-shell grid w-full overflow-hidden lg:grid-cols-[1.08fr_0.92fr]">
          <div className="border-b border-[color:var(--border)] bg-[color:var(--accent-soft)] px-6 py-8 lg:border-b-0 lg:border-r lg:px-8">
            <span className="border border-[color:var(--border)] bg-white px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
              Moto Ops Control
            </span>
            <h1 className="mt-5 max-w-2xl font-display text-4xl font-semibold tracking-[-0.06em] text-[color:var(--foreground)] sm:text-5xl">
              Registration and login for factory and ingestion teams.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[color:var(--muted-foreground)]">
              Factory operators can raise deployment requests. Ingestion users can
              monitor returned SD card packets and processing progress. Admin and
              logistics accounts are created privately through backend endpoints.
            </p>
            <div className="mt-8 grid gap-3">
              {[
                "Factory operator can self-register with OTP",
                "Ingestion user can self-register with OTP",
                "Admin and logistics accounts stay private",
                "Role-based dashboard actions come from backend permissions",
              ].map((item) => (
                <div
                  key={item}
                  className="border border-[color:var(--border)] bg-white/75 px-4 py-3 text-sm text-[color:var(--foreground)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0 px-6 py-8 lg:px-8">
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "login", label: "Login" },
                { id: "register", label: "Register" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id as "login" | "register")}
                  className={`border px-4 py-2 text-sm font-semibold ${
                    mode === item.id
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--info-foreground)]"
                      : "border-[color:var(--border)] bg-white text-[color:var(--muted-foreground)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {!isApiConfigured() ? (
              <div className="mt-6 border border-[color:var(--border)] bg-[color:var(--muted)] p-4 text-sm text-[color:var(--muted-foreground)]">
                Set `NEXT_PUBLIC_OPERATIONS_API_BASE_URL` first. Auth needs the real backend.
              </div>
            ) : null}

            {mode === "login" ? (
              <div className="mt-6 grid gap-4">
                <label className="grid gap-2 text-sm text-[color:var(--muted-foreground)]">
                  Email
                  <input
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[color:var(--muted-foreground)]">
                  Password
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleLogin()}
                  disabled={pending || !loginEmail || !loginPassword || !isApiConfigured()}
                  className="w-full border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pending ? "Signing in..." : "Login"}
                </button>
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                <label className="grid gap-2 text-sm text-[color:var(--muted-foreground)]">
                  Display name
                  <input
                    value={registerDisplayName}
                    onChange={(event) => setRegisterDisplayName(event.target.value)}
                    className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[color:var(--muted-foreground)]">
                  Email
                  <input
                    value={registerEmail}
                    onChange={(event) => setRegisterEmail(event.target.value)}
                    className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[color:var(--muted-foreground)]">
                  Password
                  <input
                    type="password"
                    value={registerPassword}
                    onChange={(event) => setRegisterPassword(event.target.value)}
                    className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
                <label className="grid gap-2 text-sm text-[color:var(--muted-foreground)]">
                  Role
                  <select
                    value={registerRole}
                    onChange={(event) => setRegisterRole(event.target.value as SelfRegisterRole)}
                    className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                  >
                    <option value="factory_operator">Factory operator</option>
                    <option value="ingestion">Ingestion</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void handleRequestOtp()}
                  disabled={
                    pending ||
                    !registerEmail ||
                    !registerPassword ||
                    !registerDisplayName ||
                    !isApiConfigured()
                  }
                  className="w-full border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pending ? "Generating..." : "Request OTP"}
                </button>

                {otpEmail ? (
                  <div className="grid gap-3 border border-[color:var(--border)] bg-[color:var(--muted)] p-4">
                    <p className="break-all text-sm text-[color:var(--foreground)]">
                      Verify registration for <span className="font-semibold">{otpEmail}</span>
                    </p>
                    {otpDebugCode ? (
                      <p className="break-all font-mono text-sm text-[color:var(--info-foreground)]">
                        Debug OTP: {otpDebugCode}
                      </p>
                    ) : null}
                    <label className="grid gap-2 text-sm text-[color:var(--muted-foreground)]">
                      OTP code
                      <input
                        value={otpCode}
                        onChange={(event) => setOtpCode(event.target.value)}
                        className="border border-[color:var(--border)] bg-white px-3 py-2.5 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleVerifyOtp()}
                      disabled={pending || !otpCode}
                      className="w-full border border-[color:var(--foreground)] bg-[color:var(--foreground)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {pending ? "Verifying..." : "Verify OTP and Login"}
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {feedback ? (
              <p className="mt-5 text-sm text-[color:var(--muted-foreground)]">{feedback}</p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
