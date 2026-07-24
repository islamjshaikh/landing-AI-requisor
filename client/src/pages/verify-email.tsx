import React from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const [state, setState] = React.useState<"checking" | "ok" | "error">(
    "checking",
  );
  const [msg, setMsg] = React.useState<string>("");
 

  React.useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState("error");
      setMsg("Missing token");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          setState("error");
          setMsg(e?.message || "Verification failed");
          return;
        }
        // success: user session may be created on server; go home
        setState("ok");
        setTimeout(() => setLocation("/agent"), 800);
      } catch (err) {
        setState("error");
        setMsg("Network error");
      }
    })();
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <Card className="w-full max-w-md p-6 text-center">
        {state === "checking" && (
          <p className="text-slate-700">Verifying your email…</p>
        )}
        {state === "ok" && (
          <p className="text-emerald-600 font-medium">
            Email verified! Redirecting…
          </p>
        )}
        {state === "error" && (
          <>
            <p className="text-red-600 font-medium">Verification failed</p>
            <p className="text-slate-600 mt-2">{msg}</p>
          </>
        )}
      </Card>
    </div>
  );
}
