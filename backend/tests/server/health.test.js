import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { app } from "../../server.js";

// Levanta la app en un puerto efímero y permite consultar /health vía fetch.
// NODE_ENV=test evita que server.js arranque su propio listener.
let server;
let baseUrl;

beforeAll(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /health", () => {
  it("responde 200 y database:connected cuando MongoDB está conectado", async () => {
    vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(1);

    const res = await fetch(`${baseUrl}/health`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.database).toBe("connected");
  });

  it("responde 503 y database:disconnected cuando MongoDB NO está conectado", async () => {
    vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(0);

    const res = await fetch(`${baseUrl}/health`);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.database).toBe("disconnected");
  });
});
