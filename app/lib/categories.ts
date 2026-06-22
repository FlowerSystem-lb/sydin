import { supabase } from "@/app/lib/supabase";

export interface Category {
  id: number;
  user_id: string;
  name: string;
  description: string | null;
  created_at?: string;
  updated_at?: string;
  item_count?: number;
}

export interface CategoryInput {
  name: string;
  description?: string;
}

export interface CategoryItemFields {
  category_id?: number | null;
  category?: string | null;
}

export function normalizeCategoryName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function resolveCategoryDisplay(
  item: CategoryItemFields,
  category?: Pick<Category, "name"> | null
) {
  return (
    normalizeCategoryName(category?.name) ||
    normalizeCategoryName(item.category) ||
    "Uncategorized"
  );
}

export function filterCategories(categories: Category[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) return categories;

  return categories.filter((category) =>
    [category.name, category.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch)
  );
}

function normalizeCategoryInput(input: CategoryInput) {
  return {
    name: normalizeCategoryName(input.name),
    description: input.description?.trim() || null,
  };
}

export async function getCategoriesForUser(
  userId: string
): Promise<Category[]> {
  const [{ data: categories, error }, { data: inventory, error: itemError }] =
    await Promise.all([
      supabase
        .from("categories")
        .select(
          "id, user_id, name, description, created_at, updated_at"
        )
        .eq("user_id", userId)
        .order("name", { ascending: true }),
      supabase
        .from("inventory")
        .select("category_id")
        .eq("user_id", userId)
        .not("category_id", "is", null),
    ]);

  if (error) throw error;

  const itemCounts = new Map<number, number>();

  if (!itemError) {
    for (const item of inventory || []) {
      const categoryId = Number(item.category_id);
      itemCounts.set(categoryId, (itemCounts.get(categoryId) || 0) + 1);
    }
  }

  return ((categories || []) as Category[]).map((category) => ({
    ...category,
    item_count: itemCounts.get(category.id) || 0,
  }));
}

export async function createCategory(
  userId: string,
  input: CategoryInput
) {
  const category = normalizeCategoryInput(input);

  if (!category.name) {
    throw new Error("Category name is required.");
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      user_id: userId,
      ...category,
    })
    .select("id, user_id, name, description, created_at, updated_at")
    .single();

  if (error) throw error;
  return data as Category;
}

export async function updateCategory(
  userId: string,
  categoryId: number,
  input: CategoryInput
) {
  const category = normalizeCategoryInput(input);

  if (!category.name) {
    throw new Error("Category name is required.");
  }

  const { data, error } = await supabase
    .from("categories")
    .update(category)
    .eq("id", categoryId)
    .eq("user_id", userId)
    .select("id, user_id, name, description, created_at, updated_at")
    .single();

  if (error) throw error;
  return data as Category;
}

export async function deleteCategory(userId: string, categoryId: number) {
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId)
    .eq("user_id", userId);

  if (error) throw error;
}

export function getCategoryErrorMessage(error: unknown) {
  const categoryError = error as {
    code?: string;
    message?: string;
    details?: string;
  };
  const text =
    `${categoryError?.message || ""} ${categoryError?.details || ""}`.toLowerCase();

  if (categoryError?.code === "23505" || text.includes("unique")) {
    return "A category with this name already exists.";
  }

  if (
    categoryError?.code === "PGRST204" ||
    categoryError?.code === "42P01" ||
    text.includes("category_id") ||
    text.includes("categories")
  ) {
    return "Categories are not available in this workspace yet. Contact support if this keeps happening.";
  }

  return "We could not save this category. Please try again.";
}
