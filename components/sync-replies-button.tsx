"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type SyncResponse = {
  ok?: boolean;
  synced?: number;
  checked_threads?: number;
  message?: string;
  error?: string;
};

export function SyncRepliesButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const busy = isSyncing || isPending;

  async function syncReplies() {
    setIsSyncing(true);
    setMessage("");

    try {
      const response = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { accept: "application/json" }
      });
      const body = (await response.json().catch(() => ({}))) as SyncResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Reply sync failed.");
      }

      setMessage(body.message ?? `Synced ${body.synced ?? 0} replies.`);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reply sync failed.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={syncReplies} disabled={busy}>
        <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
        {busy ? "Syncing" : "Sync Replies"}
      </Button>
      {message && (
        <p className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-950" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
