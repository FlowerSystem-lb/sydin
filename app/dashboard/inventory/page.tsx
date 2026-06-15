"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";
import UiIcon from "@/components/UiIcon";
import InventoryItemCard from "@/components/inventory/InventoryItemCard";
import StockMovementDialog from "@/components/inventory/StockMovementDialog";
import { Button, DialogShell } from "@/components/ui";
import CategorySelector from "@/components/CategorySelector";
import {
  getCategoriesForUser,
  resolveCategoryDisplay,
  type Category,
} from "@/app/lib/categories";
import {
  LockedActionLabel,
  UpgradeDialog,
} from "@/components/UpgradePrompt";
import {
  formatDepotLabel,
  getDepotsForUser,
  type Depot,
} from "@/app/lib/depots";
import EditItemForm, {
  createEditItemFormValues,
  createEmptyEditItemFormValues,
  getEditSaveErrorMessage,
  validateEditItemFormValues,
  type EditItemFieldErrors,
  type EditItemFieldName,
  type EditItemFormValues,
} from "@/app/dashboard/inventory/EditItemForm";
import { logInventoryHistory } from "@/app/lib/inventoryHistory";
import {
  calculateInventoryValue,
  getEffectiveItemLowStockThreshold,
  getInventoryQuantityLabel,
  normalizeCurrencyCode,
  normalizeInventoryUnitType,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";
import { supabase } from "@/app/lib/supabase";
import {
  getSuppliersForUser,
  type Supplier,
} from "@/app/lib/suppliers";
import {
  DEFAULT_BUSINESS_SETTINGS,
  getOrCreateBusinessSettings,
  type BusinessSettings,
} from "@/app/lib/businessSettings";
import { exportInventoryExcel } from "@/app/lib/inventoryExcelExport";
import { exportInventoryPdf } from "@/app/lib/inventoryPdfExport";
import {
  SCANNER_REQUEST_EVENT,
  SCANNER_REQUEST_STORAGE_KEY,
} from "@/app/lib/scannerNavigation";
import {
  FALLBACK_SUBSCRIPTION,
  formatPlanName,
  getEffectiveLowStockThreshold,
  getSubscriptionCapabilities,
  getPlanLimitMessage,
  getSubscriptionUsage,
  getUpgradeActionLabel,
  getUpgradeRequestHref,
  type UpgradePlan,
  type SubscriptionUsage,
} from "@/app/lib/subscription";

interface Item {
  id: number;
  name: string;
  category: string;
  category_id?: number | null;
  quantity: number;
  image: string;
  sku?: string;
  notes?: string;
  depot_id?: number | null;
  public_id?: string | null;
  item_code?: string | null;
  unit_type?: InventoryUnitType | string | null;
  custom_unit_label?: string | null;
  cost_price?: number | string | null;
  selling_price?: number | string | null;
  min_stock_level?: number | null;
  barcode?: string | null;
  supplier_id?: number | null;
}

const DEFAULT_SUBSCRIPTION_USAGE: SubscriptionUsage = {
  subscription: FALLBACK_SUBSCRIPTION,
  usedItems: 0,
};

type DepotFilter = "all" | "unassigned" | string;
type CategoryFilter = "all" | "uncategorized" | string;
type StockFilter = "all" | "low";
type SortOption = "newest" | "name-az" | "quantity-asc" | "quantity-desc";
type LockedFeature = {
  feature: string;
  benefit: string;
  requiredPlan: UpgradePlan;
  source: string;
};

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const CSV_HEADERS = [
  "Name",
  "SKU",
  "Category",
  "Depot",
  "Quantity",
  "Low Stock",
  "Notes",
  "Image URL",
  "Public Item URL",
  "Item Code",
  "Unit Type",
  "Custom Unit Label",
  "Cost Price",
  "Selling Price",
  "Stock Cost Value",
  "Stock Retail Value",
  "Min Stock Level",
  "Barcode",
  "Supplier Name",
];

function escapeCsvValue(value: string | number | null | undefined) {
  const stringValue = String(value ?? "");

  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function formatDateForFilename(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function slugifyFilename(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "sydin"
  );
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getImageValidationError(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Choose a JPG, PNG, or WebP image.";
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return "Image must be 5MB or smaller.";
  }

  return "";
}

function getImageExtension(file: File) {
  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return extensionByType[file.type] || "jpg";
}

function createImagePath(userId: string, file: File) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 12);

  return `${userId}/${Date.now()}-${random}.${getImageExtension(file)}`;
}

function extractScannedPublicId(scannedText: string) {
  const trimmedText = scannedText.trim();
  const itemPathMatch = trimmedText.match(/(?:^|\/)item\/([^/?#\s]+)/i);

  if (itemPathMatch?.[1]) {
    return decodeURIComponent(itemPathMatch[1]);
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidPattern.test(trimmedText) ? trimmedText : "";
}

function getScannerErrorMessage(error: unknown) {
  const errorName =
    error instanceof DOMException
      ? error.name
      : error &&
          typeof error === "object" &&
          "name" in error &&
          typeof error.name === "string"
        ? error.name
        : "";

  if (errorName === "NotAllowedError" || errorName === "SecurityError") {
    return "Camera permission was denied. Allow camera access and try again.";
  }

  if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
    return "No camera was found on this device.";
  }

  if (errorName === "NotReadableError" || errorName === "TrackStartError") {
    return "The camera is already in use by another app or browser tab.";
  }

  if (errorName === "OverconstrainedError") {
    return "We could not start the preferred camera. Try another browser or device.";
  }

  return "Scanner failed. Close it and try again.";
}

async function getBusinessCurrency(userId: string) {
  const { data, error } = await supabase
    .from("business_settings")
    .select("currency_code")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return "USD";

  return normalizeCurrencyCode(data?.currency_code, "USD");
}

export default function InventoryPage() {
  const router = useRouter();
  const scannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scannerMatchedRef = useRef(false);

  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [depotFilter, setDepotFilter] = useState<DepotFilter>("all");
  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilter>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [loadingItems, setLoadingItems] = useState(true);
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isScannerStarting, setIsScannerStarting] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [scannerStatus, setScannerStatus] = useState("");
  const [lockedFeature, setLockedFeature] = useState<LockedFeature | null>(
    null
  );

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState("");
  const [selectedDepotId, setSelectedDepotId] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [depots, setDepots] = useState<Depot[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [isLimitError, setIsLimitError] = useState(false);
  const [subscriptionUsage, setSubscriptionUsage] =
    useState<SubscriptionUsage>(DEFAULT_SUBSCRIPTION_USAGE);
  const [businessSettings, setBusinessSettings] =
    useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [usageLoading, setUsageLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [editValues, setEditValues] = useState<EditItemFormValues>(
    createEmptyEditItemFormValues
  );
  const [editFieldErrors, setEditFieldErrors] =
    useState<EditItemFieldErrors>({});
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editCurrencyCode, setEditCurrencyCode] = useState("USD");
  const [editError, setEditError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<Item | null>(null);
  const [movementItem, setMovementItem] = useState<Item | null>(null);
  const planCapabilities = getSubscriptionCapabilities(
    subscriptionUsage.subscription
  );
  const canUseScanner = planCapabilities.scanner;
  const canExportPdf = planCapabilities.pdfExport !== "none";
  const canExportExcel = planCapabilities.excelExport;
  const effectiveLowStockThreshold = getEffectiveLowStockThreshold(
    subscriptionUsage.subscription,
    businessSettings.low_stock_threshold
  );

  const fetchItems = async () => {
    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      setPageError("Please sign in again to view your inventory.");
      setUsageLoading(false);
      return;
    }

    const [
      { data, error },
      usage,
      settings,
      loadedDepots,
      loadedSuppliers,
      loadedCategories,
      loadedCurrency,
    ] =
      await Promise.all([
        supabase
          .from("inventory")
          .select("*")
          .eq("user_id", user.id)
          .order("id", {
            ascending: false,
          }),
        getSubscriptionUsage(user.id),
        getOrCreateBusinessSettings(user.id),
        getDepotsForUser(user.id).catch(() => []),
        getSuppliersForUser(user.id).catch(() => []),
        getCategoriesForUser(user.id).catch(() => []),
        getBusinessCurrency(user.id),
      ]);

    if (error) {
      setPageError("We could not load your inventory. Refresh the page and try again.");
      setUsageLoading(false);
      return;
    }

    setItems(data || []);
    setSubscriptionUsage(usage);
    setBusinessSettings(settings);
    setDepots(loadedDepots);
    setSuppliers(loadedSuppliers);
    setCategories(loadedCategories);
    setEditCurrencyCode(loadedCurrency);
    setUsageLoading(false);
  };

  useEffect(() => {
    let isActive = true;

    supabase.auth.getUser().then(({ data: { user }, error: userError }) => {
      if (!isActive) return;

      if (userError) {
        setPageError("We could not confirm your session. Please sign in again.");
        setLoadingItems(false);
        setUsageLoading(false);
        return;
      }

      if (!user) {
        setPageError("Please sign in again to view your inventory.");
        setLoadingItems(false);
        setUsageLoading(false);
        return;
      }

      Promise.all([
        supabase
          .from("inventory")
          .select("*")
          .eq("user_id", user.id)
          .order("id", {
            ascending: false,
          }),
        getSubscriptionUsage(user.id),
        getOrCreateBusinessSettings(user.id),
        getDepotsForUser(user.id).catch(() => []),
        getSuppliersForUser(user.id).catch(() => []),
        getCategoriesForUser(user.id).catch(() => []),
        getBusinessCurrency(user.id),
      ])
        .then(
          ([
            { data, error },
            usage,
            settings,
            loadedDepots,
            loadedSuppliers,
            loadedCategories,
            loadedCurrency,
          ]) => {
          if (!isActive) return;

          if (error) {
            setPageError("We could not load your inventory. Refresh the page and try again.");
            setLoadingItems(false);
            setUsageLoading(false);
            return;
          }

          setItems(data || []);
          setSubscriptionUsage(usage);
          setBusinessSettings(settings);
          setDepots(loadedDepots);
          setSuppliers(loadedSuppliers);
          setCategories(loadedCategories);
          setEditCurrencyCode(loadedCurrency);
          setLoadingItems(false);
          setUsageLoading(false);
          }
        )
        .catch(() => {
          if (!isActive) return;

          setPageError("Something went wrong while loading inventory.");
          setLoadingItems(false);
          setUsageLoading(false);
        });
    }).catch(() => {
      if (!isActive) return;

      setPageError("Something went wrong while checking your session.");
      setLoadingItems(false);
      setUsageLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, []);

  const imagePreviewUrl = useMemo(
    () => (image ? URL.createObjectURL(image) : ""),
    [image]
  );

  useEffect(() => {
    if (!imagePreviewUrl) return;

    return () => {
      URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const handleAddImageChange = (file: File | null) => {
    setImageError("");

    if (!file) {
      setImage(null);
      return;
    }

    const validationError = getImageValidationError(file);

    if (validationError) {
      setImage(null);
      setImageError(validationError);
      return;
    }

    setImage(file);
  };

  const clearAddImage = () => {
    setImage(null);
    setImageError("");
  };

  const stopScanner = useCallback(() => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;

    const stream = scannerVideoRef.current?.srcObject;

    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    if (scannerVideoRef.current) {
      scannerVideoRef.current.srcObject = null;
    }
  }, []);

  const closeScanner = useCallback(() => {
    stopScanner();
    scannerMatchedRef.current = false;
    setIsScannerOpen(false);
    setIsScannerStarting(false);
    setScannerError("");
    setScannerStatus("");
  }, [stopScanner]);

  const openScanner = useCallback(() => {
    if (!canUseScanner) {
      setLockedFeature({
        feature: "Inventory scanner",
        benefit:
          "Scan SydIN QR codes and product barcodes directly from your inventory workspace.",
        requiredPlan: "Standard",
        source: "scanner",
      });
      return;
    }

    setPageError("");
    setPageNotice("");
    setScannerError("");
    setScannerStatus("Starting camera...");
    scannerMatchedRef.current = false;
    setIsScannerOpen(true);
  }, [canUseScanner]);

  useEffect(() => {
    const handleScannerRequest = () => {
      if (usageLoading) {
        try {
          window.sessionStorage.setItem(
            SCANNER_REQUEST_STORAGE_KEY,
            "true"
          );
        } catch {
          // The inventory page remains usable without storage access.
        }
        return;
      }

      openScanner();
    };

    let pendingRequest = false;
    try {
      pendingRequest =
        window.sessionStorage.getItem(SCANNER_REQUEST_STORAGE_KEY) === "true";
    } catch {
      pendingRequest = false;
    }

    if (pendingRequest && !usageLoading) {
      try {
        window.sessionStorage.removeItem(SCANNER_REQUEST_STORAGE_KEY);
      } catch {
        // Opening the scanner does not depend on clearing the hint.
      }
      window.requestAnimationFrame(openScanner);
    }

    window.addEventListener(SCANNER_REQUEST_EVENT, handleScannerRequest);
    return () => {
      window.removeEventListener(SCANNER_REQUEST_EVENT, handleScannerRequest);
    };
  }, [openScanner, usageLoading]);

  const handleScannedText = useCallback((scannedValue: string) => {
    const scannedText = scannedValue.trim();

    if (!scannedText) {
      setPageNotice("We could not read that code. Try scanning again.");
      closeScanner();
      return;
    }

    const scannedPublicId = extractScannedPublicId(scannedText);
    const publicItemMatch = scannedPublicId
      ? items.find((item) => item.public_id === scannedPublicId)
      : null;

    if (publicItemMatch) {
      closeScanner();
      router.push(`/dashboard/inventory/${publicItemMatch.id}`);
      return;
    }

    const exactSkuMatches = items.filter(
      (item) => (item.sku || "").trim() === scannedText
    );

    if (exactSkuMatches.length === 1) {
      closeScanner();
      router.push(`/dashboard/inventory/${exactSkuMatches[0].id}`);
      return;
    }

    if (exactSkuMatches.length > 1) {
      setSearch(scannedText);
      setPageNotice(
        `Found ${exactSkuMatches.length} items with that SKU. Showing matches.`
      );
      closeScanner();
      return;
    }

    const normalizedScannedText = scannedText.toLowerCase();
    const caseInsensitiveSkuMatches = items.filter(
      (item) => (item.sku || "").trim().toLowerCase() === normalizedScannedText
    );

    if (caseInsensitiveSkuMatches.length === 1) {
      closeScanner();
      router.push(`/dashboard/inventory/${caseInsensitiveSkuMatches[0].id}`);
      return;
    }

    if (caseInsensitiveSkuMatches.length > 1) {
      setSearch(scannedText);
      setPageNotice(
        `Found ${caseInsensitiveSkuMatches.length} items with that SKU. Showing matches.`
      );
      closeScanner();
      return;
    }

    setSearch(scannedPublicId || scannedText);
    setPageNotice("No exact match found. Showing search results for the scanned code.");
    closeScanner();
  }, [closeScanner, items, router]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  useEffect(() => {
    if (!isScannerOpen) return;

    let isActive = true;

    const startScanner = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerError("This browser does not support camera scanning.");
        setScannerStatus("");
        setIsScannerStarting(false);
        return;
      }

      if (!scannerVideoRef.current) {
        setScannerError("Scanner preview is not ready. Close it and try again.");
        setScannerStatus("");
        setIsScannerStarting(false);
        return;
      }

      try {
        setIsScannerStarting(true);
        setScannerError("");
        setScannerStatus("Starting camera...");

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: {
                ideal: "environment",
              },
            },
          },
          scannerVideoRef.current,
          (result, _error, controls) => {
            if (!isActive || scannerMatchedRef.current || !result) return;

            scannerMatchedRef.current = true;
            controls.stop();
            scannerControlsRef.current = null;
            handleScannedText(result.getText());
          }
        );

        if (!isActive) {
          controls.stop();
          return;
        }

        scannerControlsRef.current = controls;
        setScannerStatus("Scan a SydIn QR code or product barcode.");
      } catch (error) {
        if (!isActive) return;

        setScannerError(getScannerErrorMessage(error));
        setScannerStatus("");
      } finally {
        if (isActive) {
          setIsScannerStarting(false);
        }
      }
    };

    void startScanner();

    return () => {
      isActive = false;
      stopScanner();
    };
  }, [handleScannedText, isScannerOpen, stopScanner]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isAdding) return;

    setIsLimitError(false);

    const trimmedName = name.trim();
    const quantityValue = Number(quantity);

    if (!trimmedName) {
      setAddError("Add a product name before saving.");
      return;
    }

    if (
      quantity === "" ||
      Number.isNaN(quantityValue) ||
      quantityValue < 0
    ) {
      setAddError("Enter a quantity of 0 or more before saving.");
      return;
    }

    try {
      setIsAdding(true);
      setAddError("");
      setImageError("");
      setPageError("");
      setPageNotice("");

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setAddError("Please sign in again before adding inventory.");
        return;
      }

      const usage = await getSubscriptionUsage(user.id, {
        strictCount: true,
      });
      setSubscriptionUsage(usage);

      if (usage.usedItems >= usage.subscription.item_limit) {
        setAddError(getPlanLimitMessage(usage.subscription.plan));
        setIsLimitError(true);
        return;
      }

      let imageUrl = "";
      if (image) {
        const validationError = getImageValidationError(image);

        if (validationError) {
          setImageError(validationError);
          return;
        }

        const fileName = createImagePath(user.id, image);
        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(fileName, image);

        if (uploadError) {
          setAddError(
            "Image upload failed. Try a smaller file or a different image."
          );
          return;
        }

        const { data } = supabase.storage.from("products").getPublicUrl(fileName);
        imageUrl = data.publicUrl;
      }

      const newItem = {
        name: trimmedName,
        sku: sku.trim(),
        category:
          categories.find(
            (category) => String(category.id) === selectedCategoryId
          )?.name || null,
        category_id: selectedCategoryId
          ? Number(selectedCategoryId)
          : null,
        quantity: quantityValue,
        notes,
        image: imageUrl,
        depot_id: selectedDepotId ? Number(selectedDepotId) : null,
        supplier_id: selectedSupplierId ? Number(selectedSupplierId) : null,
        user_id: user.id,
      };

      const { data: createdItem, error } = await supabase
        .from("inventory")
        .insert([newItem])
        .select("*")
        .single();

      if (error) {
        setAddError("We could not save this item. Please try again.");
        return;
      }

      if (createdItem) {
        await logInventoryHistory({
          itemId: createdItem.id,
          userId: user.id,
          action: "created",
          newQuantity: createdItem.quantity,
          newValues: createdItem,
        });
      }

      setPageNotice("Item added successfully.");
      setIsModalOpen(false);
      setName("");
      setSku("");
      setSelectedCategoryId("");
      setQuantity("");
      setNotes("");
      setImage(null);
      setImageError("");
      setSelectedDepotId("");
      setSelectedSupplierId("");
      await fetchItems();
    } catch (error) {
      setAddError(
        error instanceof Error
          ? error.message
          : "Something went wrong while adding this item."
      );
    } finally {
      setIsAdding(false);
    }
  };

  const openEditModal = (item: Item) => {
    setSelectedItem(item);
    setEditValues(createEditItemFormValues(item));
    setEditFieldErrors({});
    setEditImage(null);
    setEditError("");
    setIsEditModalOpen(true);
  };

  const closeEditModal = (force = false) => {
    if (isEditing && !force) return;

    setIsEditModalOpen(false);
    setSelectedItem(null);
    setEditValues(createEmptyEditItemFormValues());
    setEditFieldErrors({});
    setEditImage(null);
    setEditError("");
  };

  const updateEditValue = <Field extends keyof EditItemFormValues>(
    field: Field,
    value: EditItemFormValues[Field]
  ) => {
    setEditValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  };

  const clearEditFieldError = (field: EditItemFieldName) => {
    setEditFieldErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors;

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedItem || isEditing) return;

    const validation = validateEditItemFormValues(editValues, categories);

    if (!validation.parsedValues) {
      setEditFieldErrors(validation.errors);
      setEditError("Review the highlighted fields before saving.");
      return;
    }

    try {
      setIsEditing(true);
      setEditError("");
      setEditFieldErrors({});
      setPageError("");
      setPageNotice("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setEditError("Please sign in again before updating inventory.");
        setIsEditing(false);
        return;
      }

      let imageUrl = selectedItem.image || "";

      if (editImage) {
        const fileName = `${Date.now()}-${editImage.name}`;
        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(fileName, editImage);

        if (uploadError) {
          setEditError(
            "Image upload failed. Try a smaller file or a different image."
          );
          setIsEditing(false);
          return;
        }

        const { data } = supabase.storage
          .from("products")
          .getPublicUrl(fileName);

        imageUrl = data.publicUrl;
      }

      const oldItem = { ...selectedItem };
      const updatedItem = {
        ...validation.parsedValues,
        image: imageUrl,
      };

      const { data, error } = await supabase
        .from("inventory")
        .update(updatedItem)
        .eq("id", selectedItem.id)
        .eq("user_id", user.id)
        .select("*");

      if (error) {
        setEditError(getEditSaveErrorMessage(error));
        return;
      }

      if (!data || data.length === 0) {
        setEditError("Item not found or you do not have access to update it.");
        setIsEditing(false);
        return;
      }

      await logInventoryHistory({
        itemId: selectedItem.id,
        userId: user.id,
        action: "edited",
        oldQuantity: oldItem.quantity,
        newQuantity: (data[0] as Item).quantity,
        oldValues: oldItem,
        newValues: data[0],
      });

      await fetchItems();
      setPageNotice("Item updated successfully.");
      closeEditModal(true);
    } catch {
      setEditError("Something went wrong while updating this item.");
    } finally {
      setIsEditing(false);
    }
  };

  const deleteItem = async (
    id: number
  ) => {
    if (deletingId) return;

    try {
      setDeletingId(id);
      setPageError("");
      setPageNotice("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPageError("Please sign in again before deleting inventory.");
        return;
      }

      const itemToDelete = items.find((item) => item.id === id);

      if (itemToDelete) {
        await logInventoryHistory({
          itemId: itemToDelete.id,
          userId: user.id,
          action: "deleted",
          oldQuantity: itemToDelete.quantity,
          oldValues: itemToDelete,
        });
      }

      const { error } =
        await supabase
          .from("inventory")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id);

      if (error) {
        setPageError("We could not delete this item. Please try again.");
        return;
      }

      setPageNotice("Item deleted successfully.");
      setPendingDeleteItem(null);
      await fetchItems();
    } catch {
      setPageError("Something went wrong while deleting this item.");
    } finally {
      setDeletingId(null);
    }
  };

  const exportInventoryCsv = () => {
    if (loadingItems || items.length === 0) return;

    try {
      setPageError("");
      setPageNotice("");

      const publicBaseUrl = window.location.origin;
      const rows = items.map((item) => [
        item.name,
        item.sku || "",
        getCategoryLabel(item),
        formatDepotLabel(depots.find((depot) => depot.id === item.depot_id)),
        item.quantity,
        item.quantity <=
        getEffectiveItemLowStockThreshold(
          item.min_stock_level,
          effectiveLowStockThreshold
        )
          ? "Yes"
          : "No",
        item.notes || "",
        item.image || "",
        item.public_id ? `${publicBaseUrl}/item/${item.public_id}` : "",
        item.item_code || "",
        normalizeInventoryUnitType(item.unit_type),
        item.unit_type === "custom" ? item.custom_unit_label || "" : "",
        item.cost_price ?? "",
        item.selling_price ?? "",
        calculateInventoryValue(item.quantity, item.cost_price) ?? "",
        calculateInventoryValue(item.quantity, item.selling_price) ?? "",
        item.min_stock_level ?? "",
        item.barcode || "",
        suppliers.find((supplier) => supplier.id === item.supplier_id)?.name || "",
      ]);
      const csv = [CSV_HEADERS, ...rows]
        .map((row) => row.map(escapeCsvValue).join(","))
        .join("\r\n");
      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8",
      });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const businessSlug = slugifyFilename(
        businessSettings.business_name || DEFAULT_BUSINESS_SETTINGS.business_name
      );
      const dateStamp = formatDateForFilename(new Date());

      link.href = downloadUrl;
      link.download = `${businessSlug}-inventory-${dateStamp}.csv`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);

      setPageNotice(`Exported ${items.length} inventory item${items.length === 1 ? "" : "s"}.`);
    } catch {
      setPageError("We could not export your inventory. Please try again.");
    }
  };

  const exportInventoryReportPdf = async () => {
    if (!canExportPdf) {
      setLockedFeature({
        feature: "PDF inventory export",
        benefit:
          "Create a polished, branded PDF inventory report for sharing and review.",
        requiredPlan: "Standard",
        source: "pdf-export",
      });
      return;
    }

    if (loadingItems || items.length === 0 || isExportingPdf) return;

    try {
      setIsExportingPdf(true);
      setPageError("");
      setPageNotice("");

      await exportInventoryPdf({
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          category: getCategoryLabel(item),
          quantity: item.quantity,
          itemCode: item.item_code,
          unitType: normalizeInventoryUnitType(item.unit_type),
          customUnitLabel: item.custom_unit_label,
          costPrice: item.cost_price,
          sellingPrice: item.selling_price,
          minStockLevel: item.min_stock_level,
          barcode: item.barcode,
          notes: item.notes,
          image: item.image,
          depotLabel: formatDepotLabel(
            depots.find((depot) => depot.id === item.depot_id)
          ),
        })),
        branding: {
          businessName:
            businessSettings.business_name ||
            DEFAULT_BUSINESS_SETTINGS.business_name,
          businessLogoUrl: businessSettings.business_logo_url,
          contactEmail: businessSettings.contact_email,
          contactPhone: businessSettings.contact_phone,
          contactWebsite: businessSettings.contact_website,
        },
        lowStockThreshold: effectiveLowStockThreshold,
        currencyCode: editCurrencyCode,
      });

      setPageNotice(
        `PDF report exported for ${items.length} inventory item${
          items.length === 1 ? "" : "s"
        }.`
      );
    } catch {
      setPageError("We could not export your PDF report. Please try again.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const exportInventoryReportExcel = async () => {
    if (!canExportExcel) {
      setLockedFeature({
        feature: "Excel inventory export",
        benefit:
          "Export a structured Excel workbook with item details, depot assignments, and public links.",
        requiredPlan: "Standard",
        source: "excel-export",
      });
      return;
    }

    if (loadingItems || items.length === 0 || isExportingExcel) return;

    try {
      setIsExportingExcel(true);
      setPageError("");
      setPageNotice("");

      const publicBaseUrl = window.location.origin;

      await exportInventoryExcel({
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          category: getCategoryLabel(item),
          quantity: item.quantity,
          itemCode: item.item_code,
          unitType: normalizeInventoryUnitType(item.unit_type),
          customUnitLabel: item.custom_unit_label,
          costPrice: item.cost_price,
          sellingPrice: item.selling_price,
          minStockLevel: item.min_stock_level,
          barcode: item.barcode,
          notes: item.notes,
          image: item.image,
          publicItemUrl: item.public_id
            ? `${publicBaseUrl}/item/${item.public_id}`
            : "",
          depotLabel: formatDepotLabel(
            depots.find((depot) => depot.id === item.depot_id)
          ),
        })),
        branding: {
          businessName:
            businessSettings.business_name ||
            DEFAULT_BUSINESS_SETTINGS.business_name,
          businessLogoUrl: businessSettings.business_logo_url,
          contactEmail: businessSettings.contact_email,
          contactPhone: businessSettings.contact_phone,
          contactWebsite: businessSettings.contact_website,
        },
        lowStockThreshold: effectiveLowStockThreshold,
        currencyCode: editCurrencyCode,
      });

      setPageNotice(
        `Excel report exported for ${items.length} inventory item${
          items.length === 1 ? "" : "s"
        }.`
      );
    } catch {
      setPageError("We could not export your Excel report. Please try again.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const activeDepots = depots.filter((depot) => depot.is_active);
  const editDepotOptions = depots.filter(
    (depot) =>
      depot.is_active ||
      (selectedItem?.depot_id && depot.id === selectedItem.depot_id)
  );
  const getDepotForItem = (item: Item) =>
    depots.find((depot) => depot.id === item.depot_id) || null;
  const getSupplierForItem = (item: Item) =>
    suppliers.find((supplier) => supplier.id === item.supplier_id) || null;
  const getCategoryForItem = (item: Item) =>
    categories.find((category) => category.id === item.category_id) || null;
  const getCategoryLabel = (item: Item) =>
    resolveCategoryDisplay(item, getCategoryForItem(item));
  const getLowStockThresholdForItem = (item: Item) =>
    planCapabilities.customLowStockThreshold
      ? getEffectiveItemLowStockThreshold(
          item.min_stock_level,
          effectiveLowStockThreshold
        )
      : effectiveLowStockThreshold;
  const isItemLowStock = (item: Item) =>
    item.quantity <= getLowStockThresholdForItem(item);
  const normalizedSearch = search.trim().toLowerCase();
  const depotFilterOptions = depots.filter(
    (depot) =>
      depot.is_active || items.some((item) => item.depot_id === depot.id)
  );
  const hasActiveFilters =
    normalizedSearch !== "" ||
    depotFilter !== "all" ||
    categoryFilter !== "all" ||
    stockFilter !== "all" ||
    sortBy !== "newest";

  const resetInventoryControls = () => {
    setSearch("");
    setDepotFilter("all");
    setCategoryFilter("all");
    setStockFilter("all");
    setSortBy("newest");
  };

  const searchMatchedItems = items.filter((item) => {
    if (!normalizedSearch) return true;

    const depot = getDepotForItem(item);
    const supplier = getSupplierForItem(item);
    const searchableText = [
      item.name,
      item.item_code,
      item.sku,
      item.barcode,
      getCategoryLabel(item),
      item.category,
      item.notes,
      formatDepotLabel(depot),
      depot?.name,
      depot?.code,
      depot?.notes,
      supplier?.name,
      supplier?.contact_name,
      supplier?.phone,
      supplier?.whatsapp,
      supplier?.email,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedSearch);
  });

  const filteredItems = searchMatchedItems.filter((item) => {
    const matchesDepot =
      depotFilter === "all" ||
      (depotFilter === "unassigned" && !item.depot_id) ||
      String(item.depot_id) === depotFilter;
    const matchesStock =
      stockFilter === "all" || isItemLowStock(item);
    const matchesCategory =
      categoryFilter === "all" ||
      (categoryFilter === "uncategorized" &&
        !item.category_id &&
        !item.category?.trim()) ||
      String(item.category_id) === categoryFilter;

    return matchesDepot && matchesCategory && matchesStock;
  });

  const visibleItems = [...filteredItems].sort((firstItem, secondItem) => {
    if (sortBy === "name-az") {
      return firstItem.name.localeCompare(secondItem.name);
    }

    if (sortBy === "quantity-asc") {
      return firstItem.quantity - secondItem.quantity;
    }

    if (sortBy === "quantity-desc") {
      return secondItem.quantity - firstItem.quantity;
    }

    return secondItem.id - firstItem.id;
  });

  const currentPlanName = formatPlanName(subscriptionUsage.subscription.plan);
  const exportDisabled = loadingItems || items.length === 0;
  const pdfExportDisabled =
    usageLoading || (canExportPdf && (exportDisabled || isExportingPdf));
  const excelExportDisabled =
    usageLoading || (canExportExcel && (exportDisabled || isExportingExcel));
  const totalQuantity = items.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0
  );
  const lowStockCount = items.filter(isItemLowStock).length;
  const assignedDepotCount = new Set(
    items
      .map((item) => item.depot_id)
      .filter((depotId): depotId is number => typeof depotId === "number")
  ).size;

  return (
    <div className="contents">
      <main>
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
          <section className="rounded-[24px] border border-theme bg-theme-surface p-4 shadow-[0_14px_42px_rgba(15,23,42,0.08)] sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-theme-accent">
                  Products
                </p>

                <h1 className="mt-1 text-3xl font-black tracking-tight text-theme-primary sm:text-4xl">
                  Inventory
                </h1>

                <p className="mt-1 text-sm leading-6 text-theme-muted">
                  Find, filter, and manage products without losing your place.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/dashboard/add-item"
                  className="action-button action-button-primary px-4 py-2.5 text-sm"
                >
                  <UiIcon name="plus" />
                  Add Item
                </Link>

                <button
                  type="button"
                  onClick={openScanner}
                  disabled={usageLoading}
                  className={`action-button px-4 py-2.5 text-sm ${
                    canUseScanner
                      ? ""
                      : "border-sky-300/15 bg-theme-surface text-theme-muted"
                  }`}
                >
                  {!usageLoading && !canUseScanner ? (
                    <LockedActionLabel>Scan</LockedActionLabel>
                  ) : (
                    <>
                      <UiIcon name="scan" />
                      Scan
                    </>
                  )}
                </button>

                <details className="group relative">
                  <summary className="action-button cursor-pointer list-none px-4 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
                    <UiIcon name="more" />
                    More
                  </summary>
                  <div className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
                    <Link
                      href="/dashboard/inventory/import"
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-slate-50"
                    >
                      <UiIcon name="upload" className="h-4 w-4" />
                      {!usageLoading && !planCapabilities.csvExcelImport ? (
                        <LockedActionLabel>Import</LockedActionLabel>
                      ) : (
                        "Import inventory"
                      )}
                    </Link>
                    <button
                      type="button"
                      onClick={exportInventoryCsv}
                      disabled={exportDisabled}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                    >
                      <UiIcon name="file" className="h-4 w-4" />
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={exportInventoryReportPdf}
                      disabled={pdfExportDisabled}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                    >
                      <UiIcon name="download" className="h-4 w-4" />
                      {!usageLoading && !canExportPdf
                        ? "Export PDF (locked)"
                        : isExportingPdf
                          ? "Exporting PDF..."
                          : "Export PDF"}
                    </button>
                    <button
                      type="button"
                      onClick={exportInventoryReportExcel}
                      disabled={excelExportDisabled}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                    >
                      <UiIcon name="sheet" className="h-4 w-4" />
                      {!usageLoading && !canExportExcel
                        ? "Export Excel (locked)"
                        : isExportingExcel
                          ? "Exporting Excel..."
                          : "Export Excel"}
                    </button>
                  </div>
                </details>
              </div>
            </div>
          </section>

          <section
            aria-label="Inventory summary"
            className="grid grid-cols-2 overflow-hidden rounded-[20px] border border-theme bg-theme-surface shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:grid-cols-4"
          >
            {[
              ["Items", items.length.toLocaleString()],
              ["Quantity", totalQuantity.toLocaleString()],
              ["Low stock", lowStockCount.toLocaleString()],
              ["Locations", assignedDepotCount.toLocaleString()],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border-b border-r border-theme px-4 py-3 last:border-r-0 md:border-b-0"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-theme-subtle">
                  {label}
                </p>
                <p className="mt-1 text-xl font-black text-theme-primary">
                  {loadingItems ? "—" : value}
                </p>
              </div>
            ))}
          </section>

          {(pageNotice || pageError) && (
            <div
              className={`rounded-2xl border px-5 py-4 text-sm font-semibold ${
                pageError
                  ? "border-red-500/30 bg-red-500/10 text-theme-danger"
                  : "border-emerald-400/25 bg-emerald-500/10 text-theme-success"
              }`}
            >
              {pageError || pageNotice}
            </div>
          )}

          <section className="rounded-[22px] border border-theme bg-theme-surface p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1">
                  <label htmlFor="inventory-search" className="sr-only">
                    Search inventory
                  </label>
                  <div className="relative">
                    <svg
                      className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-theme-subtle"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                      />
                    </svg>

                    <input
                      id="inventory-search"
                      type="text"
                      placeholder="Search items, SKU, barcode, depot..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="w-full rounded-xl border border-theme bg-[var(--sydin-input-bg)] py-3 pl-12 pr-4 text-sm text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-indigo-300/60 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <p className="whitespace-nowrap rounded-xl border border-theme bg-theme-inset px-3 py-2.5 text-xs font-bold text-theme-secondary">
                    Showing {visibleItems.length} of {items.length} items
                  </p>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetInventoryControls}
                      className="whitespace-nowrap rounded-xl border border-theme bg-theme-surface px-3 py-2.5 text-xs font-bold text-theme-primary transition hover:bg-theme-hover"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <div>
                  <label className="sr-only">
                    Depot
                  </label>

                  <select
                    value={depotFilter}
                    onChange={(e) => setDepotFilter(e.target.value)}
                    className="w-full rounded-xl border border-theme bg-[var(--sydin-input-bg)] px-3 py-2.5 text-xs font-semibold text-theme-primary outline-none transition focus:border-indigo-300/60 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-sm"
                  >
                    <option value="all">All depots</option>
                    <option value="unassigned">Unassigned</option>
                    {depotFilterOptions.map((depot) => (
                      <option
                        key={depot.id}
                        value={depot.id}
                      >
                        {formatDepotLabel(depot)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="sr-only">
                    Category
                  </label>

                  <select
                    value={categoryFilter}
                    onChange={(event) =>
                      setCategoryFilter(event.target.value)
                    }
                    className="w-full rounded-xl border border-theme bg-[var(--sydin-input-bg)] px-3 py-2.5 text-xs font-semibold text-theme-primary outline-none transition focus:border-indigo-300/60 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-sm"
                  >
                    <option value="all">All categories</option>
                    <option value="uncategorized">Uncategorized</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="sr-only">
                    Stock
                  </label>

                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value as StockFilter)}
                    className="w-full rounded-xl border border-theme bg-[var(--sydin-input-bg)] px-3 py-2.5 text-xs font-semibold text-theme-primary outline-none transition focus:border-indigo-300/60 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-sm"
                  >
                    <option value="all">All stock</option>
                    <option value="low">Low stock only</option>
                  </select>
                </div>

                <div>
                  <label className="sr-only">
                    Sort
                  </label>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="w-full rounded-xl border border-theme bg-[var(--sydin-input-bg)] px-3 py-2.5 text-xs font-semibold text-theme-primary outline-none transition focus:border-indigo-300/60 focus:bg-[var(--sydin-input-focus)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-sm"
                  >
                    <option value="newest">Newest</option>
                    <option value="name-az">Name A-Z</option>
                    <option value="quantity-asc">Quantity low-high</option>
                    <option value="quantity-desc">Quantity high-low</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Items */}
          {loadingItems ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="aspect-[4/5] overflow-hidden rounded-[22px] border border-theme bg-theme-surface shadow-[0_14px_36px_rgba(15,23,42,0.08)]"
                >
                  <div className="h-full animate-pulse bg-theme-inset" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visibleItems.map((item) => (
                <InventoryItemCard
                  key={item.id}
                  item={item}
                  itemCode={item.item_code}
                  quantityLabel={getInventoryQuantityLabel(
                    item.quantity,
                    item.unit_type,
                    item.custom_unit_label
                  )}
                  categoryLabel={getCategoryLabel(item)}
                  depotLabel={
                    getDepotForItem(item)
                      ? formatDepotLabel(getDepotForItem(item))
                      : null
                  }
                  lowStock={isItemLowStock(item)}
                  deleting={deletingId === item.id}
                  onAdjust={() => setMovementItem(item)}
                  onEdit={() => openEditModal(item)}
                  onDelete={() => setPendingDeleteItem(item)}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loadingItems && visibleItems.length ===
            0 && (
            <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-indigo-300/25 bg-theme-surface px-4 py-14 text-center shadow-[0_14px_40px_rgba(15,23,42,0.07)]">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-300/20 bg-indigo-500/15 text-theme-accent">
                <UiIcon
                  name={items.length === 0 ? "box" : "search"}
                  className="h-6 w-6"
                />
              </div>

              <h2 className="mb-2 text-xl font-bold text-theme-primary">
                {items.length === 0 ? "No inventory items yet" : "No items found"}
              </h2>

              <p className="max-w-md text-sm leading-6 text-theme-muted">
                {items.length === 0
                  ? "Add your first product to start tracking stock, categories, and item details."
                  : "No products match the current search or filters."}
              </p>

              {items.length === 0 ? (
                <Link
                  href="/dashboard/add-item"
                  className="mt-6 rounded-2xl bg-white px-5 py-3 text-base font-bold text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition hover:bg-slate-200"
                >
                  Add your first item
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={resetInventoryControls}
                  className="mt-6 rounded-2xl bg-white px-5 py-3 text-base font-bold text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition hover:bg-slate-200"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto theme-overlay p-4 backdrop-blur-xl">
          <div className="my-8 w-full max-w-2xl overflow-hidden rounded-[32px] border border-theme bg-[var(--sydin-surface-strong)] shadow-[0_30px_120px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-theme p-5 sm:p-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-theme-accent">
                  Inventory scanner
                </p>

                <h2 className="mt-2 text-3xl font-bold tracking-tight text-theme-primary">
                  Scan Item
                </h2>

                <p className="mt-2 max-w-md text-sm leading-6 text-theme-muted">
                  Scan a SydIn QR code or product barcode.
                </p>
              </div>

              <button
                type="button"
                onClick={closeScanner}
                className="shrink-0 rounded-2xl border border-theme bg-theme-surface p-2 text-theme-muted transition hover:bg-theme-hover hover:text-theme-primary"
                aria-label="Close scanner"
              >
                <svg
                  className="h-7 w-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.6}
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-5 sm:p-6">
              <div className="overflow-hidden rounded-[28px] border border-indigo-300/20 bg-black">
                <video
                  ref={scannerVideoRef}
                  muted
                  playsInline
                  className="aspect-[3/4] w-full bg-black object-cover sm:aspect-video"
                />
              </div>

              <div className="mt-4 rounded-2xl border border-theme bg-theme-surface px-4 py-3">
                {scannerError ? (
                  <p className="text-sm font-semibold text-theme-danger">
                    {scannerError}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-theme-secondary">
                    {isScannerStarting
                      ? "Starting camera..."
                      : scannerStatus || "Point the camera at a code."}
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeScanner}
                  className="rounded-2xl border border-theme bg-theme-surface px-5 py-3 text-base font-bold text-theme-primary transition hover:bg-theme-hover"
                >
                  Close
                </button>

                {scannerError && (
                  <button
                    type="button"
                    onClick={() => {
                      stopScanner();
                      scannerMatchedRef.current = false;
                      setScannerError("");
                      setScannerStatus("Starting camera...");
                      setIsScannerStarting(false);
                      setIsScannerOpen(false);

                      window.setTimeout(() => {
                        setIsScannerOpen(true);
                      }, 0);
                    }}
                    className="rounded-2xl bg-white px-5 py-3 text-base font-bold text-black transition hover:bg-slate-200"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <UpgradeDialog
        open={Boolean(lockedFeature)}
        onClose={() => setLockedFeature(null)}
        feature={lockedFeature?.feature || ""}
        benefit={lockedFeature?.benefit || ""}
        currentPlan={currentPlanName}
        requiredPlan={lockedFeature?.requiredPlan || "Standard"}
        source={lockedFeature?.source || "inventory"}
      />

      {/* Add Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto theme-overlay p-4 backdrop-blur-xl">
          <div className="my-8 max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-theme bg-[var(--sydin-surface-strong)] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-7 md:p-9">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-theme-accent">
                  New product
                </p>

                <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Add Item</h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isAdding) return;
                  setIsModalOpen(false);
                  setAddError("");
                  setImageError("");
                }}
                disabled={isAdding}
                className="rounded-2xl border border-theme bg-theme-surface p-2 text-theme-muted transition hover:bg-theme-hover hover:text-theme-primary disabled:opacity-50"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddItem} className="flex flex-col gap-5 sm:gap-6">
              <div>
                <label className="mb-2 block text-sm font-semibold text-theme-muted">Product Image</label>
                <div className="rounded-3xl border border-dashed border-indigo-300/25 bg-theme-inset p-4 transition hover:border-indigo-300/45 hover:bg-theme-inset">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[190px_1fr] md:items-center">
                    <label className="group flex min-h-[170px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-theme bg-theme-surface px-5 py-6 text-center transition hover:border-indigo-300/45 hover:bg-theme-hover">
                      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-300/25 bg-indigo-500/20 text-2xl font-black text-theme-accent transition group-hover:bg-indigo-500/30">
                        +
                      </span>

                      <span className="mt-4 text-base font-black text-theme-primary">
                        Take or upload photo
                      </span>

                      <span className="mt-2 max-w-[210px] text-sm leading-5 text-theme-muted">
                        JPG, PNG, or WebP up to 5MB.
                      </span>

                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) =>
                          handleAddImageChange(e.target.files?.[0] || null)
                        }
                        className="sr-only"
                      />
                    </label>

                    <div className="min-h-[170px] rounded-3xl border border-theme bg-theme-inset p-4">
                      {image && imagePreviewUrl ? (
                        <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-[140px_1fr] sm:items-center">
                          <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#f4f0e8]">
                            <Image
                              src={imagePreviewUrl}
                              alt="Selected product preview"
                              fill
                              unoptimized
                              sizes="140px"
                              className="object-contain p-3"
                            />
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-theme-accent">
                              Selected image
                            </p>

                            <p className="mt-2 break-words text-base font-semibold text-theme-primary">
                              {image.name}
                            </p>

                            <p className="mt-1 text-sm text-theme-muted">
                              {formatFileSize(image.size)}
                            </p>

                            <button
                              type="button"
                              onClick={clearAddImage}
                              disabled={isAdding}
                              className="mt-4 rounded-2xl border border-theme bg-theme-surface px-4 py-3 text-sm font-bold text-theme-primary transition hover:bg-theme-hover disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Remove image
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full min-h-[138px] flex-col justify-center rounded-2xl border border-white/5 bg-theme-surface px-4 py-5">
                          <p className="text-base font-semibold text-theme-primary">
                            No image selected
                          </p>

                          <p className="mt-2 text-sm leading-6 text-theme-subtle">
                            Add a product photo before saving if you want visual inventory records.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {imageError && (
                    <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-theme-danger">
                      {imageError}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-theme-muted">Product Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-2xl border border-theme bg-theme-surface px-5 py-4 text-base text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-indigo-300/60 focus:bg-theme-surface focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-theme-muted">SKU</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full rounded-2xl border border-theme bg-theme-surface px-5 py-4 text-base text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-indigo-300/60 focus:bg-theme-surface focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-theme-muted">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={quantity}
                    onKeyDown={(e) => {
                      if (["-", "+", "e", "E"].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    onChange={(e) =>
                      setQuantity(
                        e.target.value.startsWith("-") ? "" : e.target.value
                      )
                    }
                    className="w-full rounded-2xl border border-theme bg-theme-surface px-5 py-4 text-base text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-indigo-300/60 focus:bg-theme-surface focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-theme-muted">Category</label>
                  <CategorySelector
                    categories={categories}
                    value={selectedCategoryId}
                    onChange={setSelectedCategoryId}
                    disabled={isAdding}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-theme-muted">Depot</label>
                  <select
                    value={selectedDepotId}
                    onChange={(e) => setSelectedDepotId(e.target.value)}
                    className="w-full rounded-2xl border border-theme bg-theme-surface px-5 py-4 text-base text-theme-primary outline-none transition focus:border-indigo-300/60 focus:bg-theme-surface focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                  >
                    <option value="">Unassigned</option>
                    {activeDepots.map((depot) => (
                      <option
                        key={depot.id}
                        value={depot.id}
                      >
                        {formatDepotLabel(depot)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-theme-muted">
                    Supplier
                  </label>
                  <select
                    value={selectedSupplierId}
                    onChange={(event) =>
                      setSelectedSupplierId(event.target.value)
                    }
                    className="w-full rounded-2xl border border-theme bg-theme-surface px-5 py-4 text-base text-theme-primary outline-none transition focus:border-indigo-300/60 focus:bg-theme-surface focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                  >
                    <option value="">No supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-theme-muted">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[110px] w-full resize-y rounded-2xl border border-theme bg-theme-surface px-5 py-4 text-base text-theme-primary outline-none transition placeholder:text-theme-subtle focus:border-indigo-300/60 focus:bg-theme-surface focus:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] sm:text-lg"
                />
              </div>

              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                {addError && (
                  <div className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-theme-danger">
                    <p>{addError}</p>

                    {isLimitError && (
                      <Link
                        href={getUpgradeRequestHref(
                          subscriptionUsage.subscription.plan,
                          "item-limit"
                        )}
                        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-slate-200"
                      >
                        {getUpgradeActionLabel(
                          subscriptionUsage.subscription.plan
                        )}
                      </Link>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    if (isAdding) return;
                    setIsModalOpen(false);
                    setAddError("");
                    setImageError("");
                  }}
                  disabled={isAdding}
                  className="flex-1 rounded-2xl border border-theme bg-theme-surface py-4 text-base font-bold text-theme-primary transition hover:bg-theme-hover disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="flex-1 rounded-2xl bg-white py-4 text-base font-bold text-black transition hover:bg-slate-200 disabled:opacity-50"
                >
                  {isAdding ? "Saving..." : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pendingDeleteItem && (
        <DialogShell
          title={`Delete ${pendingDeleteItem.name}?`}
          description="This removes the item from inventory. This action cannot be undone."
          eyebrow="Delete inventory item"
          tone="danger"
          onClose={() => setPendingDeleteItem(null)}
          closeDisabled={deletingId !== null}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setPendingDeleteItem(null)}
                disabled={deletingId !== null}
                className="sm:min-w-28"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => void deleteItem(pendingDeleteItem.id)}
                disabled={deletingId !== null}
                loading={deletingId === pendingDeleteItem.id}
                loadingLabel="Deleting..."
                className="sm:min-w-32"
              >
                Delete Item
              </Button>
            </>
          }
        />
      )}

      <StockMovementDialog
        open={Boolean(movementItem)}
        items={items}
        initialItemId={movementItem?.id}
        onClose={() => setMovementItem(null)}
        onRecorded={async () => {
          setPageNotice("Stock movement recorded successfully.");
          await fetchItems();
        }}
      />

      {/* Edit Item Modal */}
      {isEditModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto theme-overlay p-4 backdrop-blur-xl">
          <div className="my-8 max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[32px] border border-theme bg-[var(--sydin-surface-strong)] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-7 md:p-8">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-theme-accent">
                  Product details
                </p>

                <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Edit Item</h2>

                <p className="mt-2 text-theme-muted">
                  Update stock, pricing, tracking codes, and product details.
                </p>
              </div>

              <button
                type="button"
                onClick={() => closeEditModal()}
                disabled={isEditing}
                className="rounded-2xl border border-theme bg-theme-surface p-2 text-theme-muted transition hover:bg-theme-hover hover:text-theme-primary disabled:opacity-50"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <EditItemForm
              item={selectedItem}
              values={editValues}
              fieldErrors={editFieldErrors}
              depots={editDepotOptions}
              categories={categories}
              suppliers={suppliers}
              currencyCode={editCurrencyCode}
              selectedImage={editImage}
              saving={isEditing}
              error={editError}
              onValueChange={updateEditValue}
              onFieldErrorClear={clearEditFieldError}
              onImageChange={setEditImage}
              onCancel={() => closeEditModal()}
              onSubmit={handleUpdateItem}
            />
          </div>
        </div>
      )}
    </div>
  );
}
