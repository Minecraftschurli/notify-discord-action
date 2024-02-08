import * as core from "@actions/core";
import { Embed } from "./embed";
import { getIntegerInput, getJsonInput, getMultilineInput, getStringInput } from "./inputs";
import { sleep } from "./sleep";

type AllowedMentionType = "roles" | "users" | "everyone";

interface Payload {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: Embed[]; // max 10
  allowed_mentions?: {
    parse: AllowedMentionType[];
    roles?: string[];
    users?: string[];
  };
}

const DEFAULT_USERNAME = "GitHubActions";
const DEFAULT_RETRIES = 3;

const OPTIONAL = { required: false } as const;
const OPTIONAL_TRIMMED = { required: false, trimWhitespace: true } as const;

function computeMentionsPayload(allowedMentions: string[]): Payload["allowed_mentions"] {
  if (allowedMentions.length === 0) return { parse: [] };
  const parse: Set<AllowedMentionType> = new Set<AllowedMentionType>();
  const users: string[] = [];
  const roles: string[] = [];
  for (const allowedMention of allowedMentions) {
    if (allowedMention === "everyone") {
      parse.add("everyone");
      continue;
    }
    if (allowedMention === "users") {
      parse.add("users");
      continue;
    }
    if (allowedMention === "roles") {
      parse.add("roles");
      continue;
    }
    if (allowedMention.startsWith("&")) {
      roles.push(allowedMention.substring(1));
    } else {
      users.push(allowedMention);
    }
  }
  const payload: Payload["allowed_mentions"] = {
    parse: Array.from(parse)
  };
  if (!parse.has("users")) {
    payload.users = users;
  }
  if (!parse.has("roles")) {
    payload.roles = roles;
  }
  return payload;
}

async function sendWithRetry(url: string, payload: RequestInit, retry: number): Promise<Response> {
  const resp = await fetch(url, payload);
  if (resp.status !== 429 || retry === -1) {
    return resp;
  }
  if (retry <= 0) {
    throw new Error("Rate limit exceeded multiple times");
  }
  const body = await resp.json();
  const waitUntil = body["retry_after"];
  core.info(`Rate limit exceeded retrying in ${waitUntil}s`);
  await sleep(waitUntil * 1000);
  return await sendWithRetry(url, payload, retry - 1);
}

async function editWebhook(
  url: string,
  payload: Payload,
  messageId: string,
  retry: number
): Promise<unknown> {
  const resp = await sendWithRetry(
    `${url}/messages/${messageId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    },
    retry
  );
  if (resp.ok) {
    return await resp.json();
  } else {
    throw new Error(
      `Error sending webhook! Status code: ${resp.status} Body: ${await resp.text()}`
    );
  }
}

async function sendWebhook(url: string, payload: Payload, retry: number): Promise<unknown> {
  const resp = await sendWithRetry(
    `${url}?wait=true`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    },
    retry
  );
  if (resp.ok) {
    return await resp.json();
  } else {
    throw new Error(
      `Error sending webhook! Status code: ${resp.status} Body: ${await resp.text()}`
    );
  }
}

function parseColor(color: number | string | undefined): number | undefined {
  if (color === undefined) return undefined;
  if (typeof color === "number") return color;
  if (color.startsWith("#")) {
    color = color.substring(1);
  }
  return parseInt(color, 16);
}

function computeFinalEmbeds(embeds: Embed[] | undefined): Embed[] | undefined {
  if (!embeds || embeds.length === 0) return undefined;
  for (const embed of embeds) {
    embed.color = parseColor(embed.color);
  }
  return embeds;
}

async function sendWebhookMessage(): Promise<void> {
  const webhookUrl = getStringInput("webhook_url", {
    required: true,
    trimWhitespace: true
  });
  if (!webhookUrl) {
    throw new Error("The webhook url is required for this action to operate");
  }
  const allowedMentions = getMultilineInput("allowed_mentions", OPTIONAL_TRIMMED) ?? [];
  const allowedMentionsPayload = computeMentionsPayload(allowedMentions);
  const message = getStringInput("message", OPTIONAL);
  if (message && message.length > 2000) {
    throw new Error("The maximum length of the message was exceeded");
  }
  const embeds = getJsonInput("embeds", OPTIONAL) as Embed[];
  if (embeds && embeds.length > 10) {
    throw new Error("The maximum of 10 embeds was exceeded");
  }
  if (!message && (!embeds || embeds.length === 0)) {
    throw new Error("Expected at least one of message or embeds to be provided");
  }
  const messageId = getStringInput("message_id", OPTIONAL);
  const finalEmbeds = computeFinalEmbeds(embeds);
  const payload: Payload = {
    content: message,
    embeds: finalEmbeds,
    allowed_mentions: allowedMentionsPayload
  };
  console.log(`Payload: ${JSON.stringify(payload)}`);
  const retry = getIntegerInput("retry", OPTIONAL) ?? DEFAULT_RETRIES;
  if (!messageId) {
    const username = getStringInput("username", OPTIONAL) ?? DEFAULT_USERNAME;
    const avatar = getStringInput("avatar_url", OPTIONAL);
    payload.username = username;
    payload.avatar_url = avatar;
    const response = await sendWebhook(webhookUrl, payload, retry);
    core.setOutput("message_id", (response as { id: string }).id);
  } else {
    const response = await editWebhook(webhookUrl, payload, messageId, retry);
    core.setOutput("message_id", (response as { id: string }).id);
  }
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    await sendWebhookMessage();
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message);
      return;
    }
    if (typeof error === "string") {
      core.setFailed(error);
      return;
    }
  }
}
