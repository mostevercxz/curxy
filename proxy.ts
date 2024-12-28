import { Hono } from "@hono/hono";
import { bearerAuth } from "@hono/hono/bearer-auth";
import { assert, is } from "@core/unknownutil";
import { parseURL } from "ufo";
import { chooseEndpoint, convertToCustomEndpoint } from "./util.ts";

export function createApp(
  {
    openAIEndpoint,
    ollamaEndpoint,
    OPENAI_API_KEY,
  }: {
    openAIEndpoint: string;
    ollamaEndpoint: string;
    OPENAI_API_KEY: string | undefined;
  },
) {
  const app = new Hono();

  // Add logging middleware for all requests
  app.use(async (c, next) => {
    console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.url}`);
    return next();
  });

  // Apply bearer authentication, but skip it for OPTIONS requests
  app.use((c, next) => {
    if (c.req.method !== "OPTIONS") {
      if (is.String(OPENAI_API_KEY)) {
        return bearerAuth({ token: OPENAI_API_KEY })(c, next);
      }
    }
    // If the method is OPTIONS, skip the bearerAuth
    return next();
  });

  // Handle POST requests
  app.post("*", async (c) => {
    const json = await c.req.raw.clone().json();
    const { model } = json;

    // Log the entire JSON body
    console.log(`[${new Date().toISOString()}] Request body:`, JSON.stringify(json, null, 2));

    // Log the model being requested
    console.log(`[${new Date().toISOString()}] Requesting model: ${model}`);

    // Validate the request payload
    assert(json, is.ObjectOf({ model: is.String }));

    const endpoint = chooseEndpoint({
      model,
      ollamaEndpoint,
      openAIEndpoint,
    });
    
    // Log the chosen endpoint
    console.log(`[${new Date().toISOString()}] Forwarding to endpoint: ${endpoint}`);

    const url = convertToCustomEndpoint(c.req.url, parseURL(endpoint));
    const req = new Request(url, c.req.raw);
    req.headers.set("Host", ollamaEndpoint);
    return fetch(req);
  });

  // Handle GET requests
  app.get("*", (c) => {
    const url = convertToCustomEndpoint(c.req.url, parseURL(ollamaEndpoint));
    const req = new Request(url, c.req.raw);
    req.headers.set("Host", ollamaEndpoint);
    return fetch(req);
  });

  // Handle OPTIONS requests
  app.options("*", (c) => {
    c.header("Allow", "OPTIONS, GET, POST");
    c.header("Access-Control-Allow-Origin", "*");
    c.header("Access-Control-Allow-Methods", "OPTIONS, GET, POST");
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return c.body(null, 204);
  });

  return app;
}
