import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Resume photos live in the `profile-photos` bucket under the owner's folder
// (`<user id>/…`) — the layout that bucket's storage policies expect. Drafts
// store the storage PATH, never a URL: signed URLs expire, so one is minted
// whenever a photo is shown or printed.
const PHOTO_BUCKET = "profile-photos";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
// Re-mint this long before expiry so a long-open editor never prints a dead link.
const SIGNED_URL_REFRESH_MARGIN_MS = 5 * 60 * 1000;
// Templates show the photo at ~92×115px; 800px keeps it sharp in print while
// keeping the generated PDF small.
const MAX_PHOTO_SIDE = 800;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const RESUME_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export const resolveResumePhotoUrl = async (pathOrUrl?: string): Promise<string> => {
  const value = (pathOrUrl || "").trim();
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const cached = signedUrlCache.get(value);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(value, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return "";
  signedUrlCache.set(value, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 - SIGNED_URL_REFRESH_MARGIN_MS,
  });
  return data.signedUrl;
};

// A displayable URL for a stored photo path ("" while it resolves or if none).
export const useResumePhotoUrl = (path?: string) => {
  const [resolved, setResolved] = useState({ path: "", url: "" });
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    resolveResumePhotoUrl(path).then((url) => {
      if (!cancelled) setResolved({ path, url });
    });
    return () => {
      cancelled = true;
    };
  }, [path]);
  return path && resolved.path === path ? resolved.url : "";
};

// Re-encodes the image as a JPEG no larger than MAX_PHOTO_SIDE on either side.
// This also drops the original's metadata (camera, GPS) before it's stored.
const downscaleToJpeg = (file: File): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(
        1,
        MAX_PHOTO_SIDE / Math.max(image.naturalWidth, image.naturalHeight)
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Couldn't read that image."));
        return;
      }
      // JPEG has no transparency — flatten PNGs onto white, not black.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read that image."))),
        "image/jpeg",
        0.88
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Couldn't read that image. Use a JPG, PNG or WebP file."));
    };
    image.src = objectUrl;
  });

export const uploadResumePhoto = async (userId: string, file: File) => {
  if (!RESUME_PHOTO_ACCEPT.split(",").includes(file.type)) {
    throw new Error("Use a JPG, PNG or WebP image.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("That image is over 10 MB. Please choose a smaller one.");
  }
  const blob = await downscaleToJpeg(file);
  const path = `${userId}/resume-photo-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) {
    console.error("Resume photo upload failed:", error);
    throw new Error("Couldn't upload that photo. Please try again.");
  }
  return path;
};

// The photo from the retired profile page (profiles.photo_url), used for
// resumes saved before photos moved onto the resume itself.
export const loadLegacyProfilePhotoPath = async (userId: string): Promise<string> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("photo_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) return "";
  return (data?.photo_url as string | null) || "";
};
