import { NextRequest, NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner";
import { draftUpdateSchema } from "@/lib/schemas";
import { createSupabaseWorkspaceClient, isSupabaseConfigured } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = draftUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid draft update." }, { status: 400 });

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      draft: {
        id,
        ...parsed.data,
        updated_at: new Date().toISOString()
      }
    });
  }

  const owner = await getOwnerContext();
  const supabase = await createSupabaseWorkspaceClient();
  const { data: draft, error } = await supabase
    .from("email_drafts")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("owner_id", owner.id)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !draft) return NextResponse.json({ error: "Draft could not be updated." }, { status: 500 });
  return NextResponse.json({ draft });
}
