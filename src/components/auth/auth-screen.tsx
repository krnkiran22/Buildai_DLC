"use client";

import { useState } from "react";
import {
  loginUser,
  requestRegistrationOtp,
  verifyRegistrationOtp,
} from "@/lib/backend";
import type { AuthSession } from "@/lib/operations-types";

type Mode = "login" | "register" | "otp";

type Props = {
  onAuthenticated: (session: AuthSession) => void;
};

export function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register fields
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regRole, setRegRole] = useState<"factory_operator" | "ingestion">("factory_operator");

  // OTP
  const [otpCode, setOtpCode] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpDebug, setOtpDebug] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!loginEmail || !loginPassword) { setError("Email and password are required."); return; }
    setLoading(true);
    try {
      const session = await loginUser({ email: loginEmail, password: loginPassword });
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
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
      setMode("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!otpCode || otpCode.length < 4) { setError("Enter the OTP sent to your email."); return; }
    setLoading(true);
    try {
      const session = await verifyRegistrationOtp({ email: otpEmail, otp: otpCode });
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-box">
        {/* Header */}
        <div className="auth-header">
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
            Build AI
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Operations Platform
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
            {mode === "login" && "Sign in to your account"}
            {mode === "register" && "Create an account"}
            {mode === "otp" && "Verify your email"}
          </div>
        </div>

        {/* Body */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="auth-body">
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@company.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? <><span className="spinner" style={{ borderTopColor: "white" }} /> Signing in...</> : "Sign In"}
            </button>
          </form>
        )}

        {mode === "register" && (
          <form onSubmit={handleRegister} className="auth-body">
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="input"
                placeholder="Your full name"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Work Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@company.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="Minimum 8 characters"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                className="select"
                value={regRole}
                onChange={(e) => setRegRole(e.target.value as "factory_operator" | "ingestion")}
                disabled={loading}
              >
                <option value="factory_operator">Factory Operator</option>
                <option value="ingestion">Ingestion Operator</option>
              </select>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                Admin and Logistics accounts are created by your administrator.
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? <><span className="spinner" style={{ borderTopColor: "white" }} /> Sending OTP...</> : "Continue with OTP"}
            </button>
          </form>
        )}

        {mode === "otp" && (
          <form onSubmit={handleOtp} className="auth-body">
            {error && <div className="alert alert-error">{error}</div>}
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              An OTP was sent to <strong>{otpEmail}</strong>. Enter it below to complete registration.
            </div>
            {otpDebug && (
              <div className="alert" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
                Dev OTP: <strong>{otpDebug}</strong>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">One-Time Code</label>
              <input
                type="text"
                className="input"
                placeholder="Enter 6-digit OTP"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoComplete="one-time-code"
                style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.2em", fontSize: 20, textAlign: "center" }}
                disabled={loading}
                maxLength={6}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? <><span className="spinner" style={{ borderTopColor: "white" }} /> Verifying...</> : "Verify & Sign In"}
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setError(""); setOtpCode(""); }}
              className="btn btn-ghost"
              style={{ width: "100%", fontSize: 12 }}
            >
              ← Back to registration
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="auth-footer">
          {mode === "login" && (
            <>
              New user?{" "}
              <button
                onClick={() => { setMode("register"); setError(""); }}
                style={{ color: "var(--text-primary)", fontWeight: 600, cursor: "pointer", background: "none", border: "none", fontSize: "inherit" }}
              >
                Create account
              </button>
            </>
          )}
          {mode === "register" && (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setMode("login"); setError(""); }}
                style={{ color: "var(--text-primary)", fontWeight: 600, cursor: "pointer", background: "none", border: "none", fontSize: "inherit" }}
              >
                Sign in
              </button>
            </>
          )}
          {mode === "otp" && "Build AI · Operations Platform"}
        </div>
      </div>
    </div>
  );
}
