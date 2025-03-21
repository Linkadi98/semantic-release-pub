import { execa } from "execa";
import { NextRelease, PublishContext } from "semantic-release";
import { Signale } from "signale";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import { PluginConfig, publish } from "../src/index.js";
import { Pubspec } from "../src/schemas.js";
import {
  getConfig,
  getGithubIdentityToken,
  getGoogleIdentityToken,
  getPubspec,
} from "../src/utils.js";

vi.mock("execa");
vi.mock("../src/utils");

describe("publish", () => {
  const cli = "dart";
  const serviceAccount = "serviceAccount";
  const googleIdToken = "googleIdToken";
  const githubIdToken = "githubIdToken";
  const pubAuth = "some_token_value";
  const version = "1.2.3";
  const semanticReleasePubToken = "PUB_AUTH_TOKEN";

  const testConfig: PluginConfig = {
    cli,
    updateBuildNumber: false,
    useGithubOidc: false,
    selfHosted: true,
    publishArgs: ["--force"],
  };

  const pubspec: Pubspec = {
    name: "pub_package",
    version,
    publish_to: "https://micropub-api.ommani.vn",
    homepage: "https://micropub.ommani.vn",
  };

  const nextRelease = mock<NextRelease>();
  const logger = mock<Signale>();
  const context = mock<PublishContext>();

  beforeEach(() => {
    nextRelease.version = version;
    context.logger = logger;
    context.nextRelease = nextRelease;

    vi.mocked(getConfig).mockReturnValue(testConfig);
    vi.mocked(getGoogleIdentityToken).mockResolvedValue(googleIdToken);
    vi.mocked(getPubspec).mockReturnValue(pubspec);
    vi.mocked(getGithubIdentityToken).mockResolvedValue(githubIdToken);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test("success", async () => {
    stubEnv();

    const actual = await publish(testConfig, context);

    expect(actual).toEqual({
      name: "pub_package",
      url: `https://micropub-api.ommani.vn/packages/pub_package/versions/${version}`,
    });

    expect(process.env[semanticReleasePubToken]).toEqual(pubAuth);

    // await getGoogleIdentityToken("https://micropub-api.ommani.vn", serviceAccount);
    // expect(getGoogleIdentityToken).toHaveBeenNthCalledWith(1, "https://micropub-api.ommani.vn", serviceAccount);
    expect(execa).toHaveBeenNthCalledWith(1, cli, [
      "pub",
      "token",
      "add",
      "https://micropub-api.ommani.vn",
      `--env-var=${semanticReleasePubToken}`,
    ]);

    expect(execa).toHaveBeenNthCalledWith(2, cli, [
      "pub",
      "publish",
      "--force",
    ]);
  });

  test("success with useGithubOidc=true", async () => {
    const config = { ...testConfig, useGithubOidc: true, selfHosted: false };
    vi.mocked(getConfig).mockReturnValue(config);

    const actual = await publish(config, context);

    expect(actual).toEqual({
      name: "pub_package",
      url: `https://pub.dev/packages/pub_package/versions/${version}`,
    });
    expect(process.env[semanticReleasePubToken]).toEqual(githubIdToken);

    expect(getGithubIdentityToken).toHaveBeenCalledOnce();
    expect(execa).toHaveBeenNthCalledWith(1, cli, [
      "pub",
      "token",
      "add",
      "https://pub.dev",
      `--env-var=${semanticReleasePubToken}`,
    ]);
    expect(execa).toHaveBeenNthCalledWith(2, cli, ["pub", "publish", "--force"]);
  });

  const stubEnv = () => {
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_KEY", serviceAccount);
    vi.stubEnv(semanticReleasePubToken, pubAuth);
  };
});
