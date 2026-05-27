import { useState } from "react";
import { Sparkles, KeyRound, Save, CheckCircle, AlertCircle, Loader2, TestTube, Shield, Trash2 } from "lucide-react";
import { useAiSettings, useUpdateAiSettings, useTestAiSettings } from "./api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const WRITE_ROLES = new Set(["super_admin", "billing_admin"]);

export default function AiSettingsPage() {
  const { user } = useAuth();
  const { data, isLoading } = useAiSettings();
  const update = useUpdateAiSettings();
  const test = useTestAiSettings();
  const [keyInput, setKeyInput] = useState("");

  const canWrite = user ? WRITE_ROLES.has(user.role) : false;
  // Allow save when a new key is typed OR when "clear" is explicitly requested.
  // We treat empty input on an already-configured row as a "clear" intent.
  const isKeyEntered = keyInput.length > 0 && !keyInput.startsWith("\u2022\u2022\u2022\u2022");
  const isClearIntent = data?.hasKey && keyInput.trim() === "";

  function handleSave() {
    const value = keyInput.trim();
    update.mutate({ anthropicApiKey: value || null });
    setKeyInput("");
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#d4a843]" />
          <h1 className="text-2xl font-semibold tracking-tight">AI Settings</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Configure the Anthropic API key used by the AI Map Maker to classify detected
          cemetery map colours. The key is stored securely and masked on every read.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" />
            Anthropic API Key
          </CardTitle>
          <CardDescription>
            This key powers the Claude vision model behind the AI Map Maker.
            Without it, map detection falls back to geometry-only (no colour classification).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="anthropic-key">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="anthropic-key"
                type="password"
                placeholder={
                  isLoading
                    ? "Loading..."
                    : data?.anthropicApiKey ?? "Enter sk-ant-... key"
                }
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="font-mono"
                disabled={update.isPending || !canWrite}
                readOnly={!canWrite}
              />
              {canWrite && (
                <>
                  <Button
                    onClick={handleSave}
                    disabled={(!isKeyEntered && !isClearIntent) || update.isPending}
                    className="shrink-0"
                  >
                    {update.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                  {data?.hasKey && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (window.confirm("Remove the stored Anthropic API key? The AI Map Maker will no longer be able to classify colours.")) {
                          update.mutate({ anthropicApiKey: null });
                        }
                      }}
                      disabled={update.isPending}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently stored key: {data?.hasKey ? "\u2713 configured" : "\u2717 not set"}
              {data?.anthropicApiKey ? ` (${data.anthropicApiKey})` : ""}
              {canWrite ? null : (
                <span className="text-amber-400 ml-2">(Read-only for support admins)</span>
              )}
            </p>
          </div>

          {canWrite && (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => test.mutate()}
                disabled={test.isPending || !data?.hasKey}
              >
                {test.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>
              {test.data && (
                <span
                  className={`text-sm flex items-center gap-1 ${
                    test.data.status === "ok"
                      ? "text-emerald-400"
                      : test.data.status === "limited"
                        ? "text-amber-400"
                        : "text-rose-400"
                  }`}
                >
                  {test.data.status === "ok" ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  {test.data.message}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200 flex items-start gap-2">
        <Shield className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <div className="font-medium">Access control</div>
          <p className="text-xs mt-1 opacity-90">
            Only super admins and billing admins can view or modify AI settings.
            Support admins have read-only access.
          </p>
        </div>
      </div>
    </div>
  );
}
