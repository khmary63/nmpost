import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { markdownToTelegramHtml, stripMarkdown } from "../_shared/markdown.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function escapeHtml(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(t: string) {
  return t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type ChannelSetting = {
  channel_chat_id: string;
  manager_url: string;
  personal_url: string;
  vk_channel_id?: string | null;
  vk_duplicate_to_channel?: boolean | null;
};

async function inspectVkPeer(accessToken: string, groupId: number, peerId: number): Promise<any | null> {
  try {
    const url = new URL("https://api.vk.com/method/messages.getConversationsById");
    url.search = new URLSearchParams({
      peer_ids: String(peerId),
      group_id: String(groupId),
      access_token: accessToken,
      v: "5.199",
    }).toString();
    const data = await (await fetch(url.toString())).json();
    console.log("VK peer inspect:", JSON.stringify(data).slice(0, 1500));
    return data;
  } catch (e) {
    console.warn("VK peer inspect failed:", e);
    return null;
  }
}

async function getChannel(supabase: any, userId: string, channel: string): Promise<ChannelSetting | null> {
  const { data } = await supabase
    .from("channel_settings")
    .select("channel_chat_id, manager_url, personal_url, vk_channel_id, vk_duplicate_to_channel")
    .eq("user_id", userId)
    .eq("channel", channel)
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
}

async function publishTelegram(post: any, ch: ChannelSetting): Promise<{ ok: boolean; error?: string }> {
  const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!TELEGRAM_BOT_TOKEN) return { ok: false, error: "TELEGRAM_BOT_TOKEN missing" };
  if (!ch.channel_chat_id) return { ok: false, error: "telegram chat_id missing" };

  let text = "";
  if (post.title) text += `<b>${escapeHtml(post.title)}</b>\n\n`;
  text += markdownToTelegramHtml(post.content);

  let footer = "";
  if (post.include_footer !== false) {
    const lines: string[] = [];
    if (ch.manager_url?.trim())
      lines.push(`👉 <a href="${escapeAttr(ch.manager_url.trim())}">Связаться с менеджером</a>`);
    if (ch.personal_url?.trim())
      lines.push(`👉 <a href="${escapeAttr(ch.personal_url.trim())}">Связаться со мной</a>`);
    if (lines.length) footer = `\n\n${lines.join("\n")}`;
  }
  const fullText = text + footer;

  const send = async (path: string, body: Record<string, unknown>) =>
    fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const sendTextOnly = async (warning?: string) => {
    const textResp = await send("sendMessage", {
      chat_id: ch.channel_chat_id,
      text: fullText,
      parse_mode: "HTML",
    });
    if (!textResp.ok) {
      const d = await textResp.json().catch(() => ({}));
      return { ok: false, error: `tg: ${d.description || textResp.status}` };
    }
    return warning ? { ok: true, error: warning } : { ok: true };
  };

  const images: string[] = Array.isArray(post.image_urls) && post.image_urls.length > 0
    ? post.image_urls
    : (post.image_url ? [post.image_url] : []);

  let resp: Response;
  if (images.length === 0) {
    resp = await send("sendMessage", {
      chat_id: ch.channel_chat_id,
      text: fullText,
      parse_mode: "HTML",
    });
  } else if (images.length === 1) {
    if (fullText.length <= 1024) {
      resp = await send("sendPhoto", {
        chat_id: ch.channel_chat_id,
        photo: images[0],
        caption: fullText,
        parse_mode: "HTML",
      });
    } else {
      const photoResp = await send("sendPhoto", { chat_id: ch.channel_chat_id, photo: images[0] });
      if (!photoResp.ok) {
        const d = await photoResp.json().catch(() => ({}));
        return await sendTextOnly(`tg image: ${d.description || photoResp.status}`);
      }
      resp = await send("sendMessage", {
        chat_id: ch.channel_chat_id,
        text: fullText,
        parse_mode: "HTML",
      });
    }
  } else {
    const groupImages = images.slice(0, 10);
    const useCaptionInGroup = fullText.length <= 1024;
    const media = groupImages.map((url, idx) => ({
      type: "photo",
      media: url,
      ...(idx === 0 && useCaptionInGroup ? { caption: fullText, parse_mode: "HTML" } : {}),
    }));
    const mgResp = await send("sendMediaGroup", { chat_id: ch.channel_chat_id, media });
    if (!mgResp.ok) {
      const d = await mgResp.json().catch(() => ({}));
      return await sendTextOnly(`tg image: ${d.description || mgResp.status}`);
    }
    if (useCaptionInGroup) {
      resp = mgResp;
    } else {
      resp = await send("sendMessage", {
        chat_id: ch.channel_chat_id,
        text: fullText,
        parse_mode: "HTML",
      });
    }
  }

  if (!resp.ok) {
    const d = await resp.json().catch(() => ({}));
    if (images.length > 0) {
      return await sendTextOnly(`tg image: ${d.description || resp.status}`);
    }
    return { ok: false, error: `tg: ${d.description || resp.status}` };
  }
  return { ok: true };
}

async function publishVk(supabase: any, post: any, ch: ChannelSetting): Promise<{ ok: boolean; error?: string }> {
  // Parse a fetch Response as JSON, but detect transient HTML/error pages that VK
  // sometimes returns instead of JSON (e.g. pu.vk.com under load returns a "<!DOCTYPE" page).
  const parseJsonOrThrow = async (resp: Response, label: string) => {
    const text = await resp.text();
    const trimmed = text.trimStart();
    if (trimmed.startsWith("<") || trimmed.startsWith("<!DOCTYPE")) {
      throw new Error(`${label}: VK вернул HTML вместо JSON (HTTP ${resp.status}), временный сбой VK`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${label}: некорректный ответ VK (HTTP ${resp.status})`);
    }
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const VK_TOKEN = Deno.env.get("VK_COMMUNITY_TOKEN")?.replace(/^access_token=/, "").split("&")[0].trim();
  const { data: vkUserTokenRow } = await supabase
    .from("channel_settings")
    .select("channel_chat_id")
    .eq("user_id", post.user_id)
    .eq("channel", "vk_user_token")
    .eq("is_active", true)
    .maybeSingle();
  const VK_USER_TOKEN = (vkUserTokenRow?.channel_chat_id || Deno.env.get("VK_USER_TOKEN") || "")
    .replace(/^access_token=/, "")
    .split("&")[0]
    .trim();
  if (!VK_TOKEN) return { ok: false, error: "VK_COMMUNITY_TOKEN missing" };

  let message = "";
  if (post.title) message += `${stripMarkdown(post.title)}\n\n`;
  message += stripMarkdown(post.content);

  if (post.include_footer !== false) {
    const lines: string[] = [];
    const buildLine = (label: string, url: string) => {
      const u = url.trim();
      const m = u.match(/^https?:\/\/(?:m\.)?vk\.com\/([A-Za-z0-9_.\-]+)\/?$/);
      if (m) return `👉 [${m[1]}|${label}]`;
      return `👉 ${label}\n${u}`;
    };
    if (ch.manager_url?.trim()) lines.push(buildLine("Связаться с менеджером", ch.manager_url));
    if (ch.personal_url?.trim()) lines.push(buildLine("Связаться со мной", ch.personal_url));
    if (lines.length) message += `\n\n${lines.join("\n\n")}`;
  }

  const normalized = ch.channel_chat_id.replace(/[^\d-]/g, "").trim();
  const numeric = Number.parseInt(normalized, 10);
  if (!Number.isFinite(numeric) || numeric === 0) return { ok: false, error: "vk: bad group id" };
  const ownerId = -Math.abs(numeric);
  const groupId = Math.abs(numeric);

  const vkImages: string[] = Array.isArray(post.image_urls) && post.image_urls.length > 0
    ? post.image_urls
    : (post.image_url ? [post.image_url] : []);

  let attachments = "";
  let imageWarning: string | undefined;
  if (vkImages.length > 0 && VK_USER_TOKEN) {
    // Pre-download all images once (so retries don't re-fetch storage repeatedly)
    const downloaded: { blob: Blob; ext: string }[] = [];
    try {
      for (const imgUrl of vkImages.slice(0, 10)) {
        const imgResp = await fetch(imgUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!imgResp.ok) throw new Error(`download HTTP ${imgResp.status}`);
        const ct = imgResp.headers.get("content-type") || "image/jpeg";
        const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
        downloaded.push({ blob: new Blob([await imgResp.arrayBuffer()], { type: ct }), ext });
      }

      // Upload a single photo to VK with retries; re-fetch the upload server on transient failures.
      const uploadOne = async (img: { blob: Blob; ext: string }): Promise<string> => {
        const MAX_ATTEMPTS = 3;
        let lastErr: unknown = null;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            const usUrl = new URL("https://api.vk.com/method/photos.getWallUploadServer");
            usUrl.search = new URLSearchParams({ group_id: String(groupId), access_token: VK_USER_TOKEN, v: "5.199" }).toString();
            const us = await parseJsonOrThrow(await fetch(usUrl.toString()), "getWallUploadServer");
            if (us.error) throw new Error(us.error.error_msg);
            const uploadUrl = us.response?.upload_url;
            if (!uploadUrl) throw new Error("no upload_url");

            const fd = new FormData();
            fd.append("photo", img.blob, `photo.${img.ext}`);
            const upData = await parseJsonOrThrow(await fetch(uploadUrl, { method: "POST", body: fd }), "upload");
            if (!upData.photo || upData.photo === "[]") throw new Error("vk upload empty");

            const saveBody = new URLSearchParams({
              group_id: String(groupId),
              photo: upData.photo,
              server: String(upData.server),
              hash: upData.hash,
              access_token: VK_USER_TOKEN,
              v: "5.199",
            });
            const saveData = await parseJsonOrThrow(
              await fetch("https://api.vk.com/method/photos.saveWallPhoto", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: saveBody.toString(),
              }),
              "saveWallPhoto",
            );
            if (saveData.error) throw new Error(saveData.error.error_msg);
            const photo = saveData.response?.[0];
            if (!photo) throw new Error("saveWallPhoto empty response");
            return `photo${photo.owner_id}_${photo.id}`;
          } catch (e) {
            lastErr = e;
            const msg = e instanceof Error ? e.message : String(e);
            // Do not retry on permanent errors (expired token / permissions)
            if (/access_token has expired/i.test(msg) || /access denied|permission/i.test(msg)) throw e;
            console.warn(`vk image upload attempt ${attempt}/${MAX_ATTEMPTS} failed:`, msg);
            if (attempt < MAX_ATTEMPTS) await sleep(800 * attempt);
          }
        }
        throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
      };

      const built: string[] = [];
      for (const img of downloaded) {
        built.push(await uploadOne(img));
      }
      attachments = built.join(",");
    } catch (e) {
      const rawMessage = e instanceof Error ? e.message : String(e);
      const errorMessage = /access_token has expired/i.test(rawMessage)
        ? "vk image: срок действия VK-токена для загрузки фото истёк, нужно переподключить VK"
        : `vk image: ${rawMessage}`;
      console.error("vk image upload failed:", errorMessage);
      imageWarning = errorMessage;
      attachments = "";
    }
  }


  const params = new URLSearchParams({
    owner_id: String(ownerId), from_group: "1", message, access_token: VK_TOKEN, v: "5.199",
  });
  if (attachments) params.set("attachments", attachments);

  // IMPORTANT: send parameters in the POST body, not as a giant query string.
  // Long posts produced huge URLs that VK could reject / drop ("broken pipe").
  // Retry on transient network/HTML errors as well.
  let vkResp: any = null;
  {
    const MAX_ATTEMPTS = 3;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const resp = await fetch("https://api.vk.com/method/wall.post", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });
        vkResp = await parseJsonOrThrow(resp, "wall.post");
        break;
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`vk wall.post attempt ${attempt}/${MAX_ATTEMPTS} failed:`, msg);
        if (attempt < MAX_ATTEMPTS) await sleep(800 * attempt);
      }
    }
    if (!vkResp) {
      const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
      return { ok: false, error: `vk: ${msg}` };
    }
  }
  if (vkResp.error) return { ok: false, error: `vk: ${vkResp.error.error_msg}` };
  if (!vkResp.response?.post_id) return { ok: false, error: "vk: no post_id" };


  if (ch.vk_duplicate_to_channel && ch.vk_channel_id) {
    try {
      const rawPeerId = String(ch.vk_channel_id).trim();
      const peerId = Number.parseInt(rawPeerId.replace(/[^\d-]/g, ""), 10);
      if (!Number.isFinite(peerId) || peerId === 0) throw new Error("Некорректный ID канала ВК");
      if (!/^\d+$/.test(rawPeerId) || peerId < 2_000_000_000) {
        throw new Error("Указан не канал сообщества VK, а обычный чат. Загрузите список каналов заново и выберите настоящий канал сообщества.");
      }
      const peerInfo = await inspectVkPeer(VK_TOKEN, groupId, peerId);
      const membersCount = peerInfo?.response?.items?.[0]?.chat_settings?.members_count;
      if (typeof membersCount === "number" && membersCount <= 1) {
        throw new Error("Выбрана служебная беседа VK без участников. Выберите беседу, где есть минимум 2 участника.");
      }

      let channelAttachment = "";
      if (vkImages.length > 0) {
        const upUrl = new URL("https://api.vk.com/method/photos.getMessagesUploadServer");
        upUrl.search = new URLSearchParams({
          peer_id: String(peerId),
          access_token: VK_TOKEN,
          v: "5.199",
        }).toString();
        const upData = await (await fetch(upUrl.toString())).json();
        if (upData.error) throw new Error(`getMessagesUploadServer: ${upData.error.error_msg}`);
        const uploadUrl = upData.response?.upload_url;
        if (!uploadUrl) throw new Error("VK не вернул upload_url для канала");

        const builtCh: string[] = [];
        for (const imgUrl of vkImages.slice(0, 10)) {
          const imgResp = await fetch(imgUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
          if (!imgResp.ok) throw new Error(`HTTP ${imgResp.status} при скачивании картинки`);
          const ct = imgResp.headers.get("content-type") || "image/jpeg";
          const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
          const fd = new FormData();
          fd.append("photo", new Blob([await imgResp.arrayBuffer()], { type: ct }), `photo.${ext}`);
          const upPhotoData = await (await fetch(uploadUrl, { method: "POST", body: fd })).json();
          if (!upPhotoData.photo) throw new Error("VK не принял фото для канала");

          const saveBody = new URLSearchParams({
            photo: upPhotoData.photo,
            server: String(upPhotoData.server),
            hash: upPhotoData.hash,
            access_token: VK_TOKEN,
            v: "5.199",
          });
          const saveData = await (await fetch("https://api.vk.com/method/photos.saveMessagesPhoto", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: saveBody.toString(),
          })).json();
          if (saveData.error) throw new Error(`saveMessagesPhoto: ${saveData.error.error_msg}`);
          const photo = saveData.response?.[0];
          if (photo) builtCh.push(`photo${photo.owner_id}_${photo.id}`);
        }
        channelAttachment = builtCh.join(",");
      }

      const sendBody = new URLSearchParams({
        peer_id: String(peerId),
        message,
        random_id: String(Date.now()),
        access_token: VK_TOKEN,
        v: "5.199",
      });
      if (channelAttachment) sendBody.set("attachment", channelAttachment);

      const sendData = await (await fetch("https://api.vk.com/method/messages.send", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: sendBody.toString(),
      })).json();
      if (sendData.error) throw new Error(`messages.send: ${sendData.error.error_msg} (code ${sendData.error.error_code})`);
      console.log("vk scheduled channel duplicate ok:", { postId: post.id, peerId, messageId: sendData.response ?? null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("vk scheduled channel duplicate failed:", msg);
      return { ok: true, error: [imageWarning, `vk channel: ${msg}`].filter(Boolean).join("; ") };
    }
  }

  return { ok: true, error: imageWarning };
}

async function publishMax(post: any, ch: ChannelSetting): Promise<{ ok: boolean; error?: string }> {
  const MAX_BOT_TOKEN = Deno.env.get("MAX_BOT_TOKEN");
  if (!MAX_BOT_TOKEN) return { ok: false, error: "MAX_BOT_TOKEN missing" };
  const chatId = ch.channel_chat_id.trim();
  if (!/^-?\d+$/.test(chatId)) return { ok: false, error: "max: bad chat_id" };

  let text = "";
  if (post.title) text += `${post.title}\n\n`;
  text += post.content;
  let useMd = /\*\*[^*\n]+?\*\*|__[^_\n]+?__|\[[^\]]+\]\s*\([^)]*\)|`[^`\n]+`|~~[^~\n]+?~~/.test(text);
  if (post.include_footer !== false) {
    const lines: string[] = [];
    if (ch.manager_url?.trim()) { lines.push(`👉 [Связаться с менеджером](${ch.manager_url.trim()})`); useMd = true; }
    if (ch.personal_url?.trim()) { lines.push(`👉 [Связаться со мной](${ch.personal_url.trim()})`); useMd = true; }
    if (lines.length) text += `\n\n${lines.join("\n")}`;
  }

  const body: Record<string, unknown> = { text };
  if (useMd) body.format = "markdown";

  const maxImages: string[] = Array.isArray(post.image_urls) && post.image_urls.length > 0
    ? post.image_urls
    : (post.image_url ? [post.image_url] : []);

  if (maxImages.length > 0) {
    try {
      const builtAttachments: any[] = [];
      for (const imgUrl of maxImages) {
        const ui = await fetch("https://platform-api.max.ru/uploads?type=image", {
          method: "POST", headers: { Authorization: MAX_BOT_TOKEN },
        });
        if (!ui.ok) throw new Error(`/uploads ${ui.status}`);
        const uiJson = await ui.json();
        const uploadUrl = uiJson.url;
        if (!uploadUrl) throw new Error("no upload url");
        const imgResp = await fetch(imgUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!imgResp.ok) throw new Error(`download HTTP ${imgResp.status}`);
        const ct = imgResp.headers.get("content-type") || "image/png";
        const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
        const fd = new FormData();
        fd.append("data", new Blob([await imgResp.arrayBuffer()], { type: ct }), `photo.${ext}`);
        const upJson = await (await fetch(uploadUrl, { method: "POST", body: fd })).json() as Record<string, any>;
        const photoEntries = upJson.photos && typeof upJson.photos === "object"
          ? Object.values(upJson.photos as Record<string, any>)
          : [];
        const token = upJson.token || upJson.photos?.photo?.token || photoEntries[0]?.token;
        if (!token) throw new Error("no token");
        builtAttachments.push({ type: "image", payload: { token } });
      }
      body.attachments = builtAttachments;
    } catch (e) {
      console.error("max image upload failed:", e);
    }
  }

  const url = new URL("https://platform-api.max.ru/messages");
  url.searchParams.set("chat_id", chatId);
  const resp = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: MAX_BOT_TOKEN },
    body: JSON.stringify(body),
  });
  const raw = await resp.text();
  let data: any = {};
  try { data = JSON.parse(raw); } catch { /* */ }
  if (!resp.ok || data?.code) {
    return { ok: false, error: `max: ${data?.message || data?.code || resp.status}` };
  }
  return { ok: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

  // Auth: cron secret from app_settings (preferred), env CRON_SECRET, or service_role bearer
  const headerSecret = req.headers.get("x-cron-secret") || "";
  const authHeader = req.headers.get("Authorization") || "";
  const isService = authHeader === `Bearer ${serviceRoleKey}`;

  let isCron = false;
  if (headerSecret) {
    const { data: secretRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "cron_secret")
      .maybeSingle();
    const dbSecret = secretRow?.value || "";
    const envSecret = Deno.env.get("CRON_SECRET") || "";
    if ((dbSecret && headerSecret === dbSecret) || (envSecret && headerSecret === envSecret)) {
      isCron = true;
    }
  }

  if (!isCron && !isService) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Optional: process a specific post (for manual catch-up)
  let onlyPostId: string | null = null;
  try {
    if (req.method === "POST") {
      const j = await req.json().catch(() => ({}));
      if (j?.postId) onlyPostId = j.postId;
    }
  } catch { /* */ }

  let q = supabase
    .from("posts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(20);
  if (onlyPostId) q = supabase.from("posts").select("*").eq("id", onlyPostId);

  const { data: posts, error } = await q;
  if (error) {
    console.error("fetch posts error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const post of posts ?? []) {
    if (post.status === "published") {
      results.push({ id: post.id, skipped: "already published" });
      continue;
    }
    const channelResults: Record<string, { ok: boolean; error?: string }> = {};
    let anySuccess = false;
    for (const channel of post.channels ?? []) {
      const ch = await getChannel(supabase, post.user_id, channel);
      if (!ch) {
        channelResults[channel] = { ok: false, error: "channel not configured" };
        continue;
      }
      try {
        let r: { ok: boolean; error?: string };
        if (channel === "telegram") r = await publishTelegram(post, ch);
        else if (channel === "vk") r = await publishVk(supabase, post, ch);
        else if (channel === "max") r = await publishMax(post, ch);
        else r = { ok: false, error: `unknown channel ${channel}` };
        channelResults[channel] = r;
        if (r.ok) anySuccess = true;
      } catch (e) {
        channelResults[channel] = { ok: false, error: String(e) };
      }
    }

    const requestedChannels = post.channels ?? [];
    const allSuccess = requestedChannels.length > 0 && requestedChannels.every((channel: string) => channelResults[channel]?.ok);

    if (allSuccess) {
      await supabase.from("posts").update({
        status: "published",
        published_at: new Date().toISOString(),
      }).eq("id", post.id);
    } else if (anySuccess) {
      await supabase.from("posts").update({
        status: "draft",
        scheduled_at: null,
        published_at: null,
      }).eq("id", post.id);
    }
    console.log("publish-scheduled post result:", JSON.stringify({ id: post.id, allSuccess, anySuccess, channels: channelResults }));
    results.push({ id: post.id, channels: channelResults });
  }

  console.log("publish-scheduled processed:", results.length);
  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
