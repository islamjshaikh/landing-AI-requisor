import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth.tsx";
import { ArrowRight, User, Mail, Lock, UserPlus, Sparkles, MessageSquare, Target, Sun, Moon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import logo from "@assets/Group_185_1764797140461.png";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = z
  .object({
    firstName: z.string().min(2, "First name must be at least 2 characters"),
    lastName: z.string().min(2, "Last name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const forgotSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;
type ForgotFormData = z.infer<typeof forgotSchema>;

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, demoLoginMutation } = useAuth();
  const [activeTab, setActiveTab] = useState("login");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("auth-theme");
      if (saved) return saved === "dark";
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem("auth-theme", isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/projects");
    }
  }, [isAuthenticated, setLocation]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", confirmPassword: "" },
  });

  const forgotForm = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiRequest("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/user"], user);
      toast({ title: "Welcome back!", description: "You have been successfully logged in." });
      setLocation("/projects");
    },
    onError: (error: any) => {
      if (error?.code === "EMAIL_NOT_VERIFIED") {
        const email = loginForm.getValues("email") || error?.email || "";
        if (email) localStorage.setItem("verify_email", email);
        toast({ title: "Email not verified", description: "Check your inbox for the verification link or resend it.", variant: "destructive" });
        setLocation(`/verify-pending?email=${encodeURIComponent(email)}`);
        return;
      }
      toast({ title: "Login failed", description: error?.message || "Please check your credentials and try again.", variant: "destructive" });
    },
  });

  const onLoginSubmit = (data: LoginFormData) => loginMutation.mutate(data);

  useEffect(() => {
    if (demoLoginMutation.isSuccess) {
      toast({ title: "Demo access granted", description: "Bypassed identity provider - logged in successfully." });
      setLocation("/projects");
    }
  }, [demoLoginMutation.isSuccess, toast, setLocation]);

  useEffect(() => {
    if (demoLoginMutation.isError) {
      toast({ title: "Demo login failed", description: "Could not access demo account.", variant: "destructive" });
    }
  }, [demoLoginMutation.isError, toast]);

  const signupMutation = useMutation({
    mutationFn: async (data: Omit<SignupFormData, "confirmPassword">) => {
      const response = await apiRequest("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (resp: any) => {
      if (resp?.status === "verification_required") {
        const email = resp?.user?.email;
        if (email) localStorage.setItem("verify_email", email);
        toast({ title: "Verify your email", description: "We sent you a verification link. Check your inbox." });
        setLocation(`/verify-pending?email=${encodeURIComponent(email || "")}`);
        return;
      }
      queryClient.setQueryData(["/api/auth/user"], resp);
      toast({ title: "Account created!", description: "Welcome to Requisor! Your account has been successfully created." });
      setLocation("/projects");
    },
    onError: (error: any) => {
      toast({ title: "Registration failed", description: error.message || "An error occurred while creating your account.", variant: "destructive" });
    },
  });

  const onSignupSubmit = (data: SignupFormData) => {
    const { confirmPassword, ...signupData } = data;
    signupMutation.mutate(signupData);
  };

  const forgotMutation = useMutation({
    mutationFn: async (data: ForgotFormData) => {
      const response = await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Reset link sent", description: "Check your email for a password reset link (valid for a limited time)." });
      setForgotOpen(false);
      forgotForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Couldn't send reset link", description: error.message || "Please verify the email and try again.", variant: "destructive" });
    },
  });

  const onForgotSubmit = (data: ForgotFormData) => forgotMutation.mutate(data);

  if (isAuthenticated) return null;

  const t = {
    bg: isDark ? "bg-[#0a0e17]" : "bg-gradient-to-br from-gray-50 via-white to-emerald-50/30",
    text: isDark ? "text-white" : "text-gray-900",
    textMuted: isDark ? "text-white/60" : "text-gray-600",
    textFaint: isDark ? "text-white/50" : "text-gray-500",
    textSubtle: isDark ? "text-white/40" : "text-gray-400",
    textLabel: isDark ? "text-white/70" : "text-gray-700",
    navLink: isDark ? "text-white/60 hover:text-white" : "text-gray-500 hover:text-gray-900",
    brand: isDark ? "text-white" : "text-gray-900",
    accent: "text-emerald-400",
    accentBg: isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200",
    accentText: isDark ? "text-emerald-400" : "text-emerald-600",
    cardBg: isDark ? "bg-white/[0.04] backdrop-blur-xl border-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.5)]" : "bg-white border-gray-200 shadow-xl shadow-gray-200/50",
    cardTitle: isDark ? "text-white" : "text-gray-900",
    tabsBg: isDark ? "bg-white/5 border-white/10" : "bg-gray-100 border-gray-200",
    tabActive: isDark ? "data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-white/50" : "data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=inactive]:text-gray-500",
    inputBg: isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500/50 focus:ring-emerald-500/20" : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-emerald-500/20",
    inputIcon: isDark ? "text-white/30" : "text-gray-400",
    errorText: isDark ? "text-red-400" : "text-red-500",
    forgotLink: isDark ? "text-emerald-400 hover:text-emerald-300" : "text-emerald-600 hover:text-emerald-500",
    divider: isDark ? "border-white/10" : "border-gray-200",
    policyText: isDark ? "text-white/40" : "text-gray-400",
    policyLink: isDark ? "text-emerald-400 hover:text-emerald-300" : "text-emerald-600 hover:text-emerald-500",
    featureIconBg: isDark ? "bg-emerald-500/10 border-emerald-500/20 group-hover:bg-emerald-500/20" : "bg-emerald-50 border-emerald-200 group-hover:bg-emerald-100",
    featureTitle: isDark ? "text-white" : "text-gray-900",
    featureDesc: isDark ? "text-white/50" : "text-gray-500",
    avatarBg: isDark ? "bg-white/10 border-[#0a0e17]" : "bg-emerald-100 border-white",
    gridOverlay: isDark ? "bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)]" : "bg-[linear-gradient(to_right,#80808006_1px,transparent_1px),linear_gradient(to_bottom,#80808006_1px,transparent_1px)]",
    glowTop: isDark ? "bg-emerald-500/5" : "bg-emerald-400/10",
    glowBottom: isDark ? "bg-emerald-500/3" : "bg-emerald-300/5",
    toggleBg: isDark ? "bg-white/10 hover:bg-white/20 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700",
    dialogBg: isDark ? "bg-[#0f1420] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900",
    dialogTitle: isDark ? "text-white" : "text-gray-900",
    dialogDesc: isDark ? "text-white/50" : "text-gray-500",
    dialogCancelBtn: isDark ? "border-white/10 text-white hover:bg-white/5" : "border-gray-200 text-gray-700 hover:bg-gray-50",
    headingFaded: isDark ? "text-white/40" : "text-gray-400",
  };

  return (
    <div className={`min-h-screen ${t.bg} ${t.text} relative overflow-hidden transition-colors duration-300`}>
      <div className={`absolute inset-0 ${t.gridOverlay} bg-[size:32px_32px] pointer-events-none`} />
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] ${t.glowTop} rounded-full blur-[120px] pointer-events-none`} />
      <div className={`absolute bottom-0 right-0 w-[400px] h-[400px] ${t.glowBottom} rounded-full blur-[100px] pointer-events-none`} />

      <nav className="relative z-10 flex items-center justify-between max-w-7xl mx-auto px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <img src={logo} alt="Requisor" className="h-9 w-auto" />
          <span className={`font-bold text-xl tracking-wide ${t.brand}`}>Requisor AI</span>
        </Link>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsDark(!isDark)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${t.toggleBg}`}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link href="/" className={`text-sm transition-colors ${t.navLink}`}>
            Back to home
          </Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-8 pb-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center min-h-[calc(100vh-160px)]">

          <div className="hidden lg:flex flex-col justify-center space-y-10">
            <div>
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full ${t.accentBg} ${t.accentText} text-sm font-medium mb-8`}>
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Cursor for Product Managers
              </div>
              <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.15] mb-6">
                Decide <span className={t.accentText}>what</span> to build,
                <br />not just <span className={t.headingFaded}>how</span>.
              </h1>
              <p className={`text-lg leading-relaxed max-w-lg ${t.textMuted}`}>
                Requisor is an AI-native system that helps teams decide what to build, not just how to build it.
              </p>
            </div>

            <div className="space-y-5">
              <div className="flex items-start gap-4 group">
                <div className={`w-10 h-10 rounded-xl ${t.featureIconBg} border flex items-center justify-center flex-shrink-0 transition-colors`}>
                  <Sparkles className={`w-5 h-5 ${t.accentText}`} />
                </div>
                <div>
                  <h3 className={`font-semibold mb-1 ${t.featureTitle}`}>Code is easy. Knowing what to build is hard.</h3>
                  <p className={`text-sm leading-relaxed ${t.featureDesc}`}>
                    As AI coding tools like Cursor, Claude, and Replit increasingly write software, the bottleneck has shifted.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 group">
                <div className={`w-10 h-10 rounded-xl ${t.featureIconBg} border flex items-center justify-center flex-shrink-0 transition-colors`}>
                  <MessageSquare className={`w-5 h-5 ${t.accentText}`} />
                </div>
                <div>
                  <h3 className={`font-semibold mb-1 ${t.featureTitle}`}>Product discovery is broken.</h3>
                  <p className={`text-sm leading-relaxed ${t.featureDesc}`}>
                    Today, product discovery lives in scattered artifacts -- interviews, PRDs, Figma, and Jira -- built for humans, not AI.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 group">
                <div className={`w-10 h-10 rounded-xl ${t.featureIconBg} border flex items-center justify-center flex-shrink-0 transition-colors`}>
                  <Target className={`w-5 h-5 ${t.accentText}`} />
                </div>
                <div>
                  <h3 className={`font-semibold mb-1 ${t.featureTitle}`}>One system for the full discovery loop.</h3>
                  <p className={`text-sm leading-relaxed ${t.featureDesc}`}>
                    Teams use AI in isolated steps, but there's no system that supports the full discovery loop. Until now.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`w-8 h-8 rounded-full ${t.avatarBg} border-2`} />
                ))}
              </div>
              <p className={`text-sm ${t.textSubtle}`}>
                Trusted by product teams worldwide
              </p>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-md">
              <div className={`rounded-2xl border p-8 transition-colors duration-300 ${t.cardBg}`}>
                <div className="text-center mb-8">
                  <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
                    <img src={logo} alt="Requisor" className="h-8 w-auto" />
                    <span className={`font-bold text-lg ${t.brand}`}>Requisor AI</span>
                  </div>
                  <h2 className={`text-2xl font-bold ${t.cardTitle}`}>
                    {activeTab === "login" ? "Welcome back" : "Create your account"}
                  </h2>
                  <p className={`text-sm mt-2 ${t.textFaint}`}>
                    {activeTab === "login"
                      ? "Sign in to continue building what matters"
                      : "Get started with AI-powered product discovery"}
                  </p>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className={`grid w-full grid-cols-2 border rounded-xl p-1 mb-6 ${t.tabsBg}`}>
                    <TabsTrigger
                      value="login"
                      className={`rounded-lg text-sm font-medium transition-all ${t.tabActive}`}
                    >
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger
                      value="signup"
                      className={`rounded-lg text-sm font-medium transition-all ${t.tabActive}`}
                    >
                      Sign Up
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="space-y-4 mt-0">
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email" className={`text-sm ${t.textLabel}`}>Email</Label>
                        <div className="relative">
                          <Mail className={`absolute left-3 top-3 h-4 w-4 ${t.inputIcon}`} />
                          <Input
                            id="login-email"
                            type="email"
                            placeholder="you@company.com"
                            className={`pl-10 rounded-xl h-11 ${t.inputBg}`}
                            {...loginForm.register("email")}
                          />
                        </div>
                        {loginForm.formState.errors.email && (
                          <p className={`text-sm ${t.errorText}`}>{loginForm.formState.errors.email.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="login-password" className={`text-sm ${t.textLabel}`}>Password</Label>
                        <div className="relative">
                          <Lock className={`absolute left-3 top-3 h-4 w-4 ${t.inputIcon}`} />
                          <Input
                            id="login-password"
                            type="password"
                            placeholder="Enter your password"
                            className={`pl-10 rounded-xl h-11 ${t.inputBg}`}
                            {...loginForm.register("password")}
                          />
                        </div>
                        {loginForm.formState.errors.password && (
                          <p className={`text-sm ${t.errorText}`}>{loginForm.formState.errors.password.message}</p>
                        )}
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setForgotOpen(true)}
                          className={`text-xs transition-colors ${t.forgotLink}`}
                        >
                          Forgot password?
                        </button>
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl h-11 transition-all"
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? "Signing in..." : (
                          <>Sign In <ArrowRight className="ml-2 h-4 w-4" /></>
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup" className="space-y-4 mt-0">
                    <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="signup-firstName" className={`text-sm ${t.textLabel}`}>First Name</Label>
                          <div className="relative">
                            <User className={`absolute left-3 top-3 h-4 w-4 ${t.inputIcon}`} />
                            <Input
                              id="signup-firstName"
                              type="text"
                              placeholder="John"
                              className={`pl-10 rounded-xl h-11 ${t.inputBg}`}
                              {...signupForm.register("firstName")}
                            />
                          </div>
                          {signupForm.formState.errors.firstName && (
                            <p className={`text-xs ${t.errorText}`}>{signupForm.formState.errors.firstName.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-lastName" className={`text-sm ${t.textLabel}`}>Last Name</Label>
                          <div className="relative">
                            <User className={`absolute left-3 top-3 h-4 w-4 ${t.inputIcon}`} />
                            <Input
                              id="signup-lastName"
                              type="text"
                              placeholder="Doe"
                              className={`pl-10 rounded-xl h-11 ${t.inputBg}`}
                              {...signupForm.register("lastName")}
                            />
                          </div>
                          {signupForm.formState.errors.lastName && (
                            <p className={`text-xs ${t.errorText}`}>{signupForm.formState.errors.lastName.message}</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-email" className={`text-sm ${t.textLabel}`}>Email</Label>
                        <div className="relative">
                          <Mail className={`absolute left-3 top-3 h-4 w-4 ${t.inputIcon}`} />
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="you@company.com"
                            className={`pl-10 rounded-xl h-11 ${t.inputBg}`}
                            {...signupForm.register("email")}
                          />
                        </div>
                        {signupForm.formState.errors.email && (
                          <p className={`text-sm ${t.errorText}`}>{signupForm.formState.errors.email.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-password" className={`text-sm ${t.textLabel}`}>Password</Label>
                        <div className="relative">
                          <Lock className={`absolute left-3 top-3 h-4 w-4 ${t.inputIcon}`} />
                          <Input
                            id="signup-password"
                            type="password"
                            placeholder="Create a password"
                            className={`pl-10 rounded-xl h-11 ${t.inputBg}`}
                            {...signupForm.register("password")}
                          />
                        </div>
                        {signupForm.formState.errors.password && (
                          <p className={`text-sm ${t.errorText}`}>{signupForm.formState.errors.password.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="signup-confirmPassword" className={`text-sm ${t.textLabel}`}>Confirm Password</Label>
                        <div className="relative">
                          <Lock className={`absolute left-3 top-3 h-4 w-4 ${t.inputIcon}`} />
                          <Input
                            id="signup-confirmPassword"
                            type="password"
                            placeholder="Confirm your password"
                            className={`pl-10 rounded-xl h-11 ${t.inputBg}`}
                            {...signupForm.register("confirmPassword")}
                          />
                        </div>
                        {signupForm.formState.errors.confirmPassword && (
                          <p className={`text-sm ${t.errorText}`}>{signupForm.formState.errors.confirmPassword.message}</p>
                        )}
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl h-11 transition-all"
                        disabled={signupMutation.isPending}
                      >
                        {signupMutation.isPending ? "Creating account..." : (
                          <>Create Account <UserPlus className="ml-2 h-4 w-4" /></>
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>

                <div className={`mt-6 pt-5 border-t text-center ${t.divider}`}>
                  <p className={`text-xs ${t.policyText}`}>
                    By continuing, you agree to our{" "}
                    <Link href="/privacy-policy" className={`transition-colors ${t.policyLink}`}>
                      Privacy Policy
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className={`border ${t.dialogBg}`}>
          <DialogHeader>
            <DialogTitle className={t.dialogTitle}>Reset your password</DialogTitle>
            <DialogDescription className={t.dialogDesc}>
              Enter the email associated with your account. We'll send you a reset link.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={forgotForm.handleSubmit(onForgotSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email" className={`text-sm ${t.textLabel}`}>Email</Label>
              <div className="relative">
                <Mail className={`absolute left-3 top-3 h-4 w-4 ${t.inputIcon}`} />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  className={`pl-10 rounded-xl h-11 ${t.inputBg}`}
                  {...forgotForm.register("email")}
                />
              </div>
              {forgotForm.formState.errors.email && (
                <p className={`text-sm ${t.errorText}`}>{forgotForm.formState.errors.email.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setForgotOpen(false)} className={t.dialogCancelBtn}>
                Cancel
              </Button>
              <Button type="submit" disabled={forgotMutation.isPending} className="bg-emerald-500 hover:bg-emerald-400 text-white">
                {forgotMutation.isPending ? "Sending..." : "Send reset link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
