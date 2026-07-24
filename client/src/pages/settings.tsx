import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Bot, KeyRound, ShieldCheck, Sparkles, Trash2, CheckCircle2, AlertTriangle, Loader2, Mic } from "lucide-react";
import { Link } from "wouter";
import { Plug } from "lucide-react";

interface AiSettings {
  provider: "platform" | "anthropic";
  hasAnthropicKey: boolean;
  anthropicKeyLast4: string | null;
  hasTranscriptionKey: boolean;
  transcriptionKeyLast4: string | null;
  zeroRetention: boolean;
  ownKeyActive: boolean;
}

export default function Settings() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<AiSettings>({
    queryKey: ["/api/ai-settings"],
  });

  const [provider, setProvider] = useState<"platform" | "anthropic">("platform");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [transcriptionApiKey, setTranscriptionApiKey] = useState("");
  const [zeroRetention, setZeroRetention] = useState(true);
  const [testingClaude, setTestingClaude] = useState(false);
  const [testingTranscription, setTestingTranscription] = useState(false);

  useEffect(() => {
    if (settings) {
      setProvider(settings.provider);
      setZeroRetention(settings.zeroRetention);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("/api/ai-settings", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tokens/budget"] });
      setAnthropicApiKey("");
      setTranscriptionApiKey("");
      toast({ title: "Settings saved", description: "Your AI provider settings have been updated." });
    },
    onError: (err: any) => {
      toast({ title: "Couldn't save settings", description: err?.message || "Something went wrong.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("/api/ai-settings", { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tokens/budget"] });
      setProvider("platform");
      setAnthropicApiKey("");
      setTranscriptionApiKey("");
      toast({ title: "Keys removed", description: "You're back on the platform's AI provider." });
    },
    onError: (err: any) => {
      toast({ title: "Couldn't remove keys", description: err?.message || "Something went wrong.", variant: "destructive" });
    },
  });

  async function testKey(keyType: "anthropic" | "transcription") {
    const apiKey = keyType === "anthropic" ? anthropicApiKey : transcriptionApiKey;
    if (!apiKey.trim()) {
      toast({ title: "Enter a key first", description: "Paste an API key to test it.", variant: "destructive" });
      return;
    }
    const setTesting = keyType === "anthropic" ? setTestingClaude : setTestingTranscription;
    setTesting(true);
    try {
      const result = await apiRequest("/api/ai-settings/test", {
        method: "POST",
        body: JSON.stringify({ keyType, apiKey }),
      });
      if (result?.valid) {
        toast({ title: "Key is valid", description: "The API key works." });
      } else {
        toast({ title: "Key is invalid", description: result?.error || "The key could not be validated.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Key is invalid", description: err?.message || "The key could not be validated.", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  }

  function handleSave() {
    const body: Record<string, unknown> = { provider, zeroRetention };
    if (anthropicApiKey.trim()) body.anthropicApiKey = anthropicApiKey.trim();
    if (transcriptionApiKey.trim()) body.transcriptionApiKey = transcriptionApiKey.trim();
    saveMutation.mutate(body);
  }

  const ownKeyActive = settings?.ownKeyActive ?? false;
  const transcriptionDisabled = provider === "anthropic" && !(settings?.hasTranscriptionKey || transcriptionApiKey.trim());

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="page-settings">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Settings</h1>
        {ownKeyActive && (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1" data-testid="badge-own-key-active">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Your Claude key is active
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-600" />
            AI Provider
          </CardTitle>
          <CardDescription>
            Choose which AI powers your chat and analysis features. Bring your own Anthropic Claude
            key to run everything on your own account &mdash; your usage is billed directly by
            Anthropic and is never limited by platform token caps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading settings&hellip;
            </div>
          ) : (
            <>
              <RadioGroup
                value={provider}
                onValueChange={(v) => setProvider(v as "platform" | "anthropic")}
                className="space-y-3"
              >
                <label
                  htmlFor="provider-platform"
                  className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer hover-elevate"
                  data-testid="option-provider-platform"
                >
                  <RadioGroupItem value="platform" id="provider-platform" className="mt-1" />
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      Platform AI (default)
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Use Requisor's built-in AI. Subject to your plan's monthly token limits.
                    </p>
                  </div>
                </label>

                <label
                  htmlFor="provider-anthropic"
                  className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer hover-elevate"
                  data-testid="option-provider-anthropic"
                >
                  <RadioGroupItem value="anthropic" id="provider-anthropic" className="mt-1" />
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-violet-600" />
                      My own Claude key
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Run all chat and analysis through Anthropic Claude on your own billing. No
                      platform token caps apply.
                    </p>
                  </div>
                </label>
              </RadioGroup>

              {provider === "anthropic" && (
                <div className="space-y-6 border-l-2 border-violet-200 pl-4">
                  <div className="space-y-2">
                    <Label htmlFor="input-anthropic-key">Anthropic Claude API key</Label>
                    <div className="flex gap-2">
                      <Input
                        id="input-anthropic-key"
                        type="password"
                        autoComplete="off"
                        placeholder={settings?.hasAnthropicKey ? `Saved key ending in ••••${settings.anthropicKeyLast4}` : "sk-ant-..."}
                        value={anthropicApiKey}
                        onChange={(e) => setAnthropicApiKey(e.target.value)}
                        data-testid="input-anthropic-key"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => testKey("anthropic")}
                        disabled={testingClaude}
                        data-testid="button-test-anthropic"
                      >
                        {testingClaude ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your key is encrypted at rest and never shown again after saving.
                      {settings?.hasAnthropicKey && " Leave blank to keep your existing key."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium">Zero data retention</div>
                        <p className="text-xs text-muted-foreground">
                          I confirm my Anthropic organization has zero-data-retention enabled.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={zeroRetention}
                      onCheckedChange={setZeroRetention}
                      data-testid="switch-zero-retention"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="input-transcription-key" className="flex items-center gap-2">
                      <Mic className="h-4 w-4" />
                      Transcription API key (optional)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="input-transcription-key"
                        type="password"
                        autoComplete="off"
                        placeholder={settings?.hasTranscriptionKey ? `Saved key ending in ••••${settings.transcriptionKeyLast4}` : "sk-... (OpenAI Whisper)"}
                        value={transcriptionApiKey}
                        onChange={(e) => setTranscriptionApiKey(e.target.value)}
                        data-testid="input-transcription-key"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => testKey("transcription")}
                        disabled={testingTranscription}
                        data-testid="button-test-transcription"
                      >
                        {testingTranscription ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Claude can't transcribe audio. To keep audio/video transcription working,
                      add an OpenAI-compatible (Whisper) key here.
                    </p>
                  </div>

                  {transcriptionDisabled && (
                    <Alert variant="destructive" data-testid="alert-transcription-disabled">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Transcription is disabled</AlertTitle>
                      <AlertDescription>
                        While using your own Claude key without a transcription key, audio and
                        video transcription will be unavailable. Add a transcription key above to
                        enable it.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div>
                  {(settings?.hasAnthropicKey || settings?.hasTranscriptionKey) && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                      data-testid="button-remove-keys"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Remove my keys
                    </Button>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  data-testid="button-save-ai-settings"
                >
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save changes
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* MCP setup lives on its own page now — this is just a signpost so
          anyone who looked for it here still finds it. */}
      <Card>
        <CardContent className="flex items-center justify-between gap-4 pt-6">
          <div className="flex items-start gap-3">
            <Plug className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">Connect Requisor to your AI</p>
              <p className="text-muted-foreground">
                Let Claude, Cursor or any MCP client read your meetings and customer
                themes. Access tokens are managed there.
              </p>
            </div>
          </div>
          <Link href="/connect">
            <Button variant="outline" data-testid="button-goto-connect">
              Open Connect
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
