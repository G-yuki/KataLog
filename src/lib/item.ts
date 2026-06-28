import type { Item } from "../types";

export const heroUrl = (item: Item): string | null => {
  if (item.pinnedPhotoUrl) return item.pinnedPhotoUrl;
  if (item.userPhotos?.length) return item.userPhotos[0];
  if (item.placePhotoRef?.startsWith("https://")) return item.placePhotoRef;
  return null;
};
