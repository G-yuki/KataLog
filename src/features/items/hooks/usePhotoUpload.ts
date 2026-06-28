import { useState } from "react";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../../../firebase/storage";
import type { Item } from "../../../types";

export const MAX_PHOTOS = 20;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const ALLOWED_EXT  = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

type SaveDetailFn = (
  itemId: string,
  data: { userPhotos?: string[]; pinnedPhotoUrl?: string | null }
) => unknown;

const validateImageFile = (file: File): Promise<void> =>
  new Promise((resolve, reject) => {
    if (!ALLOWED_MIME.has(file.type)) { reject(new Error("unsupported_type")); return; }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXT.has(ext)) { reject(new Error("unsupported_type")); return; }
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(objUrl); resolve(); };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      reject(new Error(isIOS && !isSafari ? "use_safari" : "not_image"));
    };
    img.src = objUrl;
  });

const resizeImage = (source: File | Blob, maxPx: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(source);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("resize failed"))),
        "image/jpeg",
        0.8
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error("load failed")); };
    img.src = objUrl;
  });

export const usePhotoUpload = (
  pairId: string | null,
  item: Item | undefined,
  saveDetail: SaveDetailFn
) => {
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photosExpanded, setPhotosExpanded] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [showPhotoDeleteConfirm, setShowPhotoDeleteConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !pairId || !item) return;
    if ((item.userPhotos ?? []).length >= MAX_PHOTOS) {
      setPhotoError(`写真は最大${MAX_PHOTOS}枚までです`);
      return;
    }
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      await validateImageFile(file);
      const blob = await resizeImage(file, 1200);
      const uuid = crypto.randomUUID();
      const storageRef = ref(storage, `pairs/${pairId}/items/${item.itemId}/${uuid}.jpg`);
      await uploadBytes(storageRef, blob, {
        contentType: "image/jpeg",
        cacheControl: "public, max-age=31536000",
      });
      const url = await getDownloadURL(storageRef);
      await saveDetail(item.itemId, { userPhotos: [...(item.userPhotos ?? []), url] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "use_safari") {
        setPhotoError("この写真形式はSafariでのみ対応しています。Safariで開いて再度お試しください。");
      } else if (msg === "unsupported_type" || msg === "not_image") {
        setPhotoError("対応していないファイルです。JPEG・PNG・WebP形式の写真を選択してください。");
      }
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePhotoDelete = async (url: string) => {
    if (!pairId || !item) return;
    const match = url.match(/\/o\/([^?]+)/);
    if (match) {
      try { await deleteObject(ref(storage, decodeURIComponent(match[1]))); }
      catch { /* 既に削除済みの場合も無視 */ }
    }
    const updates: { userPhotos: string[]; pinnedPhotoUrl?: string | null } = {
      userPhotos: (item.userPhotos ?? []).filter((u) => u !== url),
    };
    if (item.pinnedPhotoUrl === url) updates.pinnedPhotoUrl = null;
    await saveDetail(item.itemId, updates);
    setViewerIndex(null);
  };

  const handleBulkPhotoDelete = async () => {
    if (!pairId || !item) return;
    await Promise.all(
      (item.userPhotos ?? []).map(async (url) => {
        const match = url.match(/\/o\/([^?]+)/);
        if (!match) return;
        try { await deleteObject(ref(storage, decodeURIComponent(match[1]))); }
        catch { /* ignore */ }
      })
    );
    await saveDetail(item.itemId, { userPhotos: [], pinnedPhotoUrl: null });
    setShowBulkDeleteConfirm(false);
    setPhotosExpanded(false);
  };

  return {
    photoUploading, photoError,
    photosExpanded, setPhotosExpanded,
    viewerIndex, setViewerIndex,
    showPhotoDeleteConfirm, setShowPhotoDeleteConfirm,
    showBulkDeleteConfirm, setShowBulkDeleteConfirm,
    handlePhotoUpload, handlePhotoDelete, handleBulkPhotoDelete,
  };
};
