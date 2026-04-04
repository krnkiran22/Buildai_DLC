"use client";

import { useRef, useState } from "react";
import {
  loginUser,
  requestRegistrationOtp,
  verifyRegistrationOtp,
} from "@/lib/backend";
import type { AuthSession } from "@/lib/operations-types";

type Mode = "login" | "register" | "otp";
const MODE_DEPTH: Record<Mode, number> = { login: 0, register: 1, otp: 2 };

type Props = {
  onAuthenticated: (session: AuthSession) => void;
};

export function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [slideDir, setSlideDir] = useState<"right" | "left">("right");
  const [animKey, setAnimKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const prevMode = useRef<Mode>("login");

  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPwd, setShowLoginPwd] = useState(false);

  // Register fields
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regRole, setRegRole] = useState<"factory_operator" | "ingestion">("factory_operator");

  // OTP
  const [otpCode, setOtpCode] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpDebug, setOtpDebug] = useState<string | null>(null);

  function goTo(next: Mode) {
    const isForward = MODE_DEPTH[next] > MODE_DEPTH[prevMode.current];
    setSlideDir(isForward ? "right" : "left");
    prevMode.current = next;
    setAnimKey((k) => k + 1);
    setMode(next);
    setError("");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!loginEmail || !loginPassword) { setError("Please enter your email and password."); return; }
    setLoading(true);
    try {
      const session = await loginUser({ email: loginEmail, password: loginPassword });
      onAuthenticated(session);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      // Map backend messages to human-friendly text
      if (!raw || raw === "SESSION_EXPIRED" || raw === "Request failed with 401") {
        setError("Incorrect email or password. Please try again.");
      } else if (raw.toLowerCase().includes("not found") || raw.toLowerCase().includes("no account")) {
        setError("No account found with that email. Please check or create an account.");
      } else if (raw.toLowerCase().includes("incorrect") || raw.toLowerCase().includes("wrong") || raw.toLowerCase().includes("invalid")) {
        setError("Incorrect password. Please try again.");
      } else if (raw.toLowerCase().includes("inactive") || raw.toLowerCase().includes("disabled")) {
        setError("Your account is inactive. Please contact your admin.");
      } else {
        setError(raw || "Sign in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!regEmail || !regPassword || !regName) { setError("All fields are required."); return; }
    if (regPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      const challenge = await requestRegistrationOtp({
        email: regEmail,
        password: regPassword,
        displayName: regName,
        role: regRole,
      });
      setOtpEmail(regEmail);
      setOtpDebug(challenge.otpDebugCode ?? null);
      goTo("otp");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      if (!raw || raw === "SESSION_EXPIRED") {
        setError("Registration failed. Please try again.");
      } else if (raw.toLowerCase().includes("already") || raw.toLowerCase().includes("exists")) {
        setError("An account with this email already exists. Please sign in instead.");
      } else {
        setError(raw || "Registration failed. Please check your details.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!otpCode || otpCode.length < 4) { setError("Please enter the 6-digit code sent to your email."); return; }
    setLoading(true);
    try {
      const session = await verifyRegistrationOtp({ email: otpEmail, otp: otpCode });
      onAuthenticated(session);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      if (!raw || raw === "SESSION_EXPIRED") {
        setError("Verification failed. Please check the code and try again.");
      } else if (raw.toLowerCase().includes("expired")) {
        setError("The code has expired. Please go back and request a new one.");
      } else if (raw.toLowerCase().includes("invalid") || raw.toLowerCase().includes("incorrect") || raw.toLowerCase().includes("wrong")) {
        setError("Incorrect code. Please check your email and try again.");
      } else {
        setError(raw || "Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const animClass = slideDir === "right" ? "anim-slide-right" : "anim-slide-left";

  return (
    <div className="auth-screen" style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "var(--bg-subtle)",
      padding: "0 0",
    }}>
      <div className="auth-box" style={{
        width: "100%",
        maxWidth: 400,
        background: "#fff",
        border: "1px solid var(--border)",
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
      }}>
        {/* ── Brand header ── */}
        <div style={{
          padding: "28px 28px 20px",
          borderBottom: "1px solid var(--border)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "#111" }}>
            Build AI
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Operations Platform
          </div>
        </div>

        {/* ── Animated form area ── */}
        <div style={{ overflow: "hidden", position: "relative" }}>
          <div key={animKey} className={animClass} style={{ padding: "24px 28px 28px", willChange: "transform" }}>

            {/* Mode title */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                {mode === "login" && "Welcome back"}
                {mode === "register" && "Create your account"}
                {mode === "otp" && "Check your email"}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {mode === "login" && "Sign in to continue"}
                {mode === "register" && "Takes less than a minute"}
                {mode === "otp" && `We sent a code to ${otpEmail}`}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="alert alert-error anim-slide-down" style={{ marginBottom: 16, borderRadius: 10, fontSize: 13 }}>
                {error}
              </div>
            )}

            {/* ── Login ── */}
            {mode === "login" && (
              <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Field label="Email">
                  <input
                    type="email"
                    className="input"
                    placeholder="you@company.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    autoComplete="email"
                    disabled={loading}
                  />
                </Field>
                <Field label="Password">
                  <div style={{ position: "relative" }}>
                    <input
                      type={showLoginPwd ? "text" : "password"}
                      className="input"
                      placeholder="Your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      autoComplete="current-password"
                      disabled={loading}
                      style={{ paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPwd((v) => !v)}
                      style={{
                        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--text-muted)", fontSize: 16, padding: 4,
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >{showLoginPwd ? "🙈" : "👁"}</button>
                  </div>
                </Field>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: "100%", marginTop: 4, height: 48, fontSize: 15, fontWeight: 700, borderRadius: 14 }}
                  disabled={loading}
                >
                  {loading ? <><Spinner /> Signing in…</> : "Sign In"}
                </button>
              </form>
            )}

            {/* ── Register ── */}
            {mode === "register" && (
              <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Field label="Full Name">
                  <input
                    type="text"
                    className="input"
                    placeholder="Your full name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                </Field>
                <Field label="Work Email">
                  <input
                    type="email"
                    className="input"
                    placeholder="you@company.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    disabled={loading}
                  />
                </Field>
                <Field label="Password">
                  <input
                    type="password"
                    className="input"
                    placeholder="Minimum 8 characters"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    disabled={loading}
                  />
                </Field>
                <Field label="Your Role">
                  <select
                    className="input"
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as "factory_operator" | "ingestion")}
                    disabled={loading}
                    style={{ appearance: "auto" }}
                  >
                    <option value="factory_operator">Factory Operator</option>
                    <option value="ingestion">Ingestion Operator</option>
                  </select>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    Admin &amp; Logistics accounts are created by your administrator.
                  </div>
                </Field>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: "100%", marginTop: 4, height: 48, fontSize: 15, fontWeight: 700, borderRadius: 14 }}
                  disabled={loading}
                >
                  {loading ? <><Spinner /> Sending OTP…</> : "Continue →"}
                </button>
              </form>
            )}

            {/* ── OTP ── */}
            {mode === "otp" && (
              <form onSubmit={handleOtp} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {otpDebug && (
                  <div className="alert" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textAlign: "center", borderRadius: 10, fontSize: 13 }}>
                    Dev OTP: <strong>{otpDebug}</strong>
                  </div>
                )}
                {/* 6-digit OTP large input */}
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="input"
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={6}
                    style={{
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.4em",
                      fontSize: 28,
                      textAlign: "center",
                      height: 64,
                      borderRadius: 14,
                      width: "100%",
                      fontWeight: 700,
                    }}
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: "100%", height: 48, fontSize: 15, fontWeight: 700, borderRadius: 14 }}
                  disabled={loading || otpCode.length < 4}
                >
                  {loading ? <><Spinner /> Verifying…</> : "Verify & Sign In"}
                </button>
                <button
                  type="button"
                  onClick={() => goTo("register")}
                  className="btn btn-ghost"
                  style={{ width: "100%", fontSize: 13, borderRadius: 10 }}
                >
                  ← Back
                </button>
              </form>
            )}

            {/* ── Mode switcher footer ── */}
            {mode !== "otp" && (
              <div style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
                {mode === "login" ? (
                  <>New here?{" "}
                    <button
                      type="button"
                      onClick={() => goTo("register")}
                      style={{ color: "var(--text-primary)", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontSize: "inherit", WebkitTapHighlightColor: "transparent" }}
                    >Create account</button>
                  </>
                ) : (
                  <>Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => goTo("login")}
                      style={{ color: "var(--text-primary)", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontSize: "inherit", WebkitTapHighlightColor: "transparent" }}
                    >Sign in</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Mini helpers ───────────────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{label}</label>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 14, height: 14, borderRadius: "50%",
      border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff",
      animation: "spin 0.6s linear infinite", flexShrink: 0,
    }} />
  );
}
