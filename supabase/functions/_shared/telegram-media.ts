type TelegramPhoto = {
  blob: Blob;
  filename: string;
};

function extensionFromContentType(contentType: string): string {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  return "jpg";
}

export async function fetchTelegramPhoto(url: string, index = 0): Promise<TelegramPhoto> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`download HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`download content-type ${contentType}`);
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) {
    throw new Error("download empty image");
  }

  return {
    blob: new Blob([bytes], { type: contentType }),
    filename: `photo-${index + 1}.${extensionFromContentType(contentType)}`,
  };
}

export async function sendTelegramPhotoUpload(
  botToken: string,
  body: {
    chat_id: string;
    photoUrl: string;
    caption?: string;
    parse_mode?: string;
  },
): Promise<Response> {
  const photo = await fetchTelegramPhoto(body.photoUrl, 0);
  const form = new FormData();
  form.append("chat_id", body.chat_id);
  form.append("photo", photo.blob, photo.filename);
  if (body.caption) form.append("caption", body.caption);
  if (body.parse_mode) form.append("parse_mode", body.parse_mode);

  return await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: "POST",
    body: form,
  });
}

export async function sendTelegramMediaGroupUpload(
  botToken: string,
  body: {
    chat_id: string;
    imageUrls: string[];
    caption?: string;
    parse_mode?: string;
  },
): Promise<Response> {
  const photos = await Promise.all(body.imageUrls.map((url, index) => fetchTelegramPhoto(url, index)));
  const form = new FormData();
  form.append("chat_id", body.chat_id);

  const media = photos.map((_, index) => ({
    type: "photo",
    media: `attach://photo${index}`,
    ...(index === 0 && body.caption ? { caption: body.caption, parse_mode: body.parse_mode || "HTML" } : {}),
  }));

  form.append("media", JSON.stringify(media));
  photos.forEach((photo, index) => form.append(`photo${index}`, photo.blob, photo.filename));

  return await fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
    method: "POST",
    body: form,
  });
}