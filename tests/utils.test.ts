import { describe, expect, test } from "vitest";
import { PluginConfig } from "../src";
import { getConfig } from "../src/utils";

describe("getConfig", () => {
  const config: PluginConfig = { cli: "flutter" };

  test("success", () => {
    expect(getConfig(config)).toEqual(config);
  });
});
