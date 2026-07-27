import { supabase } from "@/app/lib/supabase";

export interface ImportExportRecord {
  id: number;
  user_id: string;
  operation_type: "import" | "export";
  file_name: string;
  item_count: number;
  status: "processing" | "success" | "error";
  error_message: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function logImportExport(params: {
  userId: string;
  operation_type: "import" | "export";
  file_name: string;
  item_count?: number;
  status: "processing" | "success" | "error";
  error_message?: string;
  notes?: string;
}): Promise<ImportExportRecord | null> {
  const { data, error } = await supabase
    .from("import_export_history")
    .insert([
      {
        user_id: params.userId,
        operation_type: params.operation_type,
        file_name: params.file_name,
        item_count: params.item_count || 0,
        status: params.status,
        error_message: params.error_message || null,
        notes: params.notes || null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error logging import/export:", error);
    return null;
  }

  return data;
}

export async function getImportExportHistory(
  userId: string,
  limit: number = 50
): Promise<ImportExportRecord[]> {
  const { data, error } = await supabase
    .from("import_export_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching import/export history:", error);
    return [];
  }

  return data || [];
}

export async function updateImportExportStatus(
  recordId: number,
  status: "success" | "error",
  updates?: { item_count?: number; error_message?: string }
): Promise<ImportExportRecord | null> {
  const { data, error } = await supabase
    .from("import_export_history")
    .update({
      status,
      item_count: updates?.item_count,
      error_message: updates?.error_message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", recordId)
    .select()
    .single();

  if (error) {
    console.error("Error updating import/export record:", error);
    return null;
  }

  return data;
}
