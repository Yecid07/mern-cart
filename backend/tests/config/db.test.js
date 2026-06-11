import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { connectWithRetry, readyStateToText } from "../../config/db.js";

describe("config/db", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("readyStateToText", () => {
    it("mapea los estados de mongoose a texto", () => {
      expect(readyStateToText(0)).toBe("disconnected");
      expect(readyStateToText(1)).toBe("connected");
      expect(readyStateToText(2)).toBe("connecting");
      expect(readyStateToText(3)).toBe("disconnecting");
      expect(readyStateToText(99)).toBe("unknown");
    });
  });

  describe("connectWithRetry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("NO llama process.exit ante un fallo temporal de conexión", async () => {
      vi.spyOn(mongoose, "connect").mockRejectedValue(new Error("ECONNREFUSED"));
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});

      await connectWithRetry();

      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("programa un reintento (vuelve a intentar conectar) tras un fallo", async () => {
      const connectSpy = vi
        .spyOn(mongoose, "connect")
        .mockRejectedValue(new Error("ECONNREFUSED"));
      vi.spyOn(process, "exit").mockImplementation(() => {});

      await connectWithRetry(1);
      expect(connectSpy).toHaveBeenCalledTimes(1);

      // Avanza el reloj para disparar el setTimeout del backoff (1s en attempt 1)
      await vi.advanceTimersByTimeAsync(1000);
      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it("retorna la conexión cuando MongoDB está disponible", async () => {
      const fakeConn = { connection: { host: "127.0.0.1" } };
      vi.spyOn(mongoose, "connect").mockResolvedValue(fakeConn);

      const result = await connectWithRetry();

      expect(result).toBe(fakeConn);
    });
  });
});
