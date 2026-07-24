import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function VerifyPendingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = React.useState<string>(() => {
    const urlEmail = new URLSearchParams(window.location.search).get("email") || "";
    return urlEmail || localStorage.getItem("verify_email") || "";
  });
  const [checking, setChecking] = React.useState(false);

  // poll every 3s
  React.useEffect(() => {
    if (!email) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/verification-status?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (data?.verified) {
          clearInterval(id);
          localStorage.removeItem("verify_email");
          // user might be logged in if they clicked the email link and we set session on server
          setLocation("/");
        }
      } catch {}
    }, 3000);

    return () => clearInterval(id);
  }, [email, setLocation]);

  const resend = async () => {
    if (!email) {
      toast({ title: "Enter an email to resend", variant: "destructive" });
      return;
    }
    setChecking(true);
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      toast({ title: "Verification email sent" });
    } catch {
      toast({ title: "Could not resend", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <Card className="w-full max-w-md p-6 space-y-4 text-center">
        <h1 className="text-xl font-semibold">Verification pending</h1>
        <p className="text-slate-600">
          We sent a verification link to your email. Once you click it, this page will automatically continue.
        </p>

        <div className="space-y-2 text-left">
          <label className="text-sm text-slate-600">Email</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>

        <Button onClick={resend} disabled={checking} className="w-full">
          {checking ? "Sending..." : "Resend verification email"}
        </Button>

        <p className="text-xs text-slate-500">
          Didn’t get it? Check spam, or verify your email address is correct and try resending.
        </p>
      </Card>
    </div>
  );
}
