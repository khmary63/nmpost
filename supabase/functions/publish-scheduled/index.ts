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

async function inspectVkPeer(accessToken: string, groupId: number, peerId: number): Promise<void> {
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
  } catch (e) {
    console.warn("VK peer inspect failed:", e);
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

  let resp: Response;
  if (post.image_url) {
    if (fullText.length <= 1024) {
      resp = await send("sendPhoto", {
        chat_id: ch.channel_chat_id,
        photo: post.image_url,
        caption: fullText,
        parse_mode: "HTML",
      });
    } else {
      const photoResp = await send("sendPhoto", { chat_id: ch.channel_chat_id, photo: post.image_url });
      if (!photoResp.ok) {
        const d = await photoResp.json().catch(() => ({}));
        return { ok: false, error: `tg photo: ${d.description || photoResp.status}` };
      }
      resp = await send("sendMessage", {
        chat_id: ch.channel_chat_id,
        text: fullText,
        parse_mode: "HTML",
      });
    }
  } else {
    resp = await send("sendMessage", {
      chat_id: ch.channel_chat_id,
      text: fullText,
      parse_mode: "HTML",
    });
  }

  if (!resp.ok) {
    const d = await resp.json().catch(() => ({}));
    return { ok: false, error: `tg: ${d.description || resp.status}` };
  }
  return { ok: true };
}

async function publishVk(supabase: any, post: any, ch: ChannelSetting): Promise<{ ok: boolean; error?: string }> {
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

  let attachments = "";
  if (post.image_url && VK_USER_TOKEN) {
    try {
      const usUrl = new URL("https://api.vk.com/method/photos.getWallUploadServer");
      usUrl.search = new URLSearchParams({ group_id: String(groupId), access_token: VK_USER_TOKEN, v: "5.199" }).toString();
      const us = await (await fetch(usUrl.toString())).json();
      if (us.error) throw new Error(us.error.error_msg);
      const uploadUrl = us.response?.upload_url;
      if (!uploadUrl) throw new Error("no upload_url");
      const imgResp = await fetch(post.image_url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!imgResp.ok) throw new Error(`download HTTP ${imgResp.status}`);
      const ct = imgResp.headers.get("content-type") || "image/jpeg";
      const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
      const fd = new FormData();
      fd.append("photo", new Blob([await imgResp.arrayBuffer()], { type: ct }), `photo.${ext}`);
      const upData = await (await fetch(uploadUrl, { method: "POST", body: fd })).json();
      if (!upData.photo) throw new Error("vk upload empty");
      const saveBody = new URLSearchParams({
        group_id: String(groupId),
        photo: upData.photo,
        server: String(upData.server),
        hash: upData.hash,
        access_token: VK_USER_TOKEN,
        v: "5.199",
      });
      const saveData = await (await fetch("https://api.vk.com/method/photos.saveWallPhoto", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: saveBody.toString(),
      })).json();
      if (saveData.error) throw new Error(saveData.error.error_msg);
      const photo = saveData.response?.[0];
      if (photo) attachments = `photo${photo.owner_id}_${photo.id}`;
    } catch (e) {
      const rawMessage = e instanceof Error ? e.message : String(e);
      const errorMessage = /access_token has expired/i.test(rawMessage)
        ? "vk image: срок действия VK-токена для загрузки фото истёк, нужно переподключить VK"
        : `vk image: ${rawMessage}`;
      console.error("vk image upload failed:", errorMessage);
      return { ok: false, error: errorMessage };
    }
  }

  const params = new URLSearchParams({
    owner_id: String(ownerId), from_group: "1", message, access_token: VK_TOKEN, v: "5.199",
  });
  if (attachments) params.set("attachments", attachments);
  const vkResp = await (await fetch(`https://api.vk.com/method/wall.post?${params.toString()}`, { method: "POST" })).json();
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
      const channelCheck = await verifyVkChannelPeer(VK_TOKEN, groupId, peerId);
      if (!channelCheck.ok) {
        throw new Error(channelCheck.title
          ? `${channelCheck.reason}: «${channelCheck.title}». Выберите именно канал сообщества VK, не беседу.`
          : `${channelCheck.reason}. Выберите именно канал сообщества VK, не беседу.`);
      }

      let channelAttachment = "";
      if (post.image_url) {
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

        const imgResp = await fetch(post.image_url, { headers: { "User-Agent": "Mozilla/5.0" } });
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
        if (photo) channelAttachment = `photo${photo.owner_id}_${photo.id}`;
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
      return { ok: true, error: `vk channel: ${msg}` };
    }
  }

  return { ok: true };
}

async function publishMax(post: any, ch: ChannelSetting): Promise<{ ok: boolean; error?: string }> {
  const MAX_BOT_TOKEN = Deno.env.get("MAX_BOT_TOKEN");
  if (!MAX_BOT_TOKEN) return { ok: false, error: "MAX_BOT_TOKEN missing" };
  const chatId = ch.channel_chat_id.trim();
  if (!/^-?\d+$/.test(chatId)) return { ok: false, error: "max: bad chat_id" };

  let text = "";
  if (post.title) text += `${post.title}\n\n`;
  text += post.content;
  let useMd = false;
  if (post.include_footer !== false) {
    const lines: string[] = [];
    if (ch.manager_url?.trim()) { lines.push(`👉 [Связаться с менеджером](${ch.manager_url.trim()})`); useMd = true; }
    if (ch.personal_url?.trim()) { lines.push(`👉 [Связаться со мной](${ch.personal_url.trim()})`); useMd = true; }
    if (lines.length) text += `\n\n${lines.join("\n")}`;
  }

  const body: Record<string, unknown> = { text };
  if (useMd) body.format = "markdown";

  if (post.image_url) {
    try {
      const ui = await fetch("https://platform-api.max.ru/uploads?type=image", {
        method: "POST", headers: { Authorization: MAX_BOT_TOKEN },
      });
      if (!ui.ok) throw new Error(`/uploads ${ui.status}`);
      const uiJson = await ui.json();
      const uploadUrl = uiJson.url;
      if (!uploadUrl) throw new Error("no upload url");
      const imgResp = await fetch(post.image_url, { headers: { "User-Agent": "Mozilla/5.0" } });
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
      body.attachments = [{ type: "image", payload: { token } }];
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

  // Auth: either CRON_SECRET header (cron) or service_role bearer
  const cronSecretEnv = Deno.env.get("CRON_SECRET");
  const headerSecret = req.headers.get("x-cron-secret");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  const isCron = cronSecretEnv && headerSecret === cronSecretEnv;
  const isService = authHeader === `Bearer ${serviceRoleKey}`;
  if (!isCron && !isService) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

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

    if (anySuccess) {
      await supabase.from("posts").update({
        status: "published",
        published_at: new Date().toISOString(),
      }).eq("id", post.id);
    }
    results.push({ id: post.id, channels: channelResults });
  }

  console.log("publish-scheduled processed:", results.length);
  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
