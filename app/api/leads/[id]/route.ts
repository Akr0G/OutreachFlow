import { NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { createSupabaseWorkspaceClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Lead id is required." }, { status: 400 });

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, id });
  }

  const owner = await getOwnerContext();
  const supabase = await createSupabaseWorkspaceClient();
  const { data, error } = await supabase
    .from("leads")
    .delete()
    .eq("owner_id", owner.id)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Lead could not be deleted." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  return NextResponse.json({ ok: true, id });
}
