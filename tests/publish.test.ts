import { execa } from "execa";
import { NextRelease, PublishContext } from "semantic-release";
import { Signale } from "signale";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { Pubspec } from "../lib/schemas.js";
import {
  getConfig,
  getGithubIdentityToken,
  getGoogleIdentityToken,
  getPubspec, getPubspecString,
} from "../lib/utils.js";

import {codeBlock} from "common-tags";
import {PluginConfig, publish} from "../index.ts";
import {execSync} from "child_process";

vi.mock("execa");
vi.mock("../lib/utils");
vi.mock("child_process");

const basePubspec = codeBlock`
    name: pub_package
    version: 1.2.3
    publish_to: https://micropub-api.ommani.vn
    homepage: https://micropub.ommani.vn

    environment:
      sdk: ">=3.0.0 <4.0.0"

    dependencies:
      packageA: 1.0.0
      packageB:
        hosted: https://some-package-server.com
        version: 1.2.0
  `;

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

    vi.mocked(getGoogleIdentityToken).mockResolvedValue(googleIdToken);
    vi.mocked(getPubspecString).mockReturnValue(basePubspec);
    vi.mocked(getPubspec).mockReturnValue(pubspec);
    vi.mocked(getGithubIdentityToken).mockResolvedValue(githubIdToken);
    vi.mocked(execSync).mockImplementation(() => Buffer.from(''));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test("Publish self-hosted package", async () => {
    stubEnv();
    vi.mocked(getConfig).mockReturnValue(testConfig);

    const actual = await publish(testConfig, context);

    expect(actual).toEqual({
      name: "pub_package",
      url: `https://micropub-api.ommani.vn/packages/pub_package/versions/${version}`,
    });

    expect(process.env[semanticReleasePubToken]).toEqual(pubAuth);

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

  test("Publish with useGithubOidc=true", async () => {
    const config = { ...testConfig, useGithubOidc: true, selfHosted: false };
    vi.mocked(getConfig).mockReturnValue(config);
    vi.fn(getPubspec).mockReturnValue(pubspec);
    vi.fn(getConfig).mockReturnValue(config);
    vi.stubEnv(semanticReleasePubToken, githubIdToken);

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
    expect(execa).toHaveBeenNthCalledWith(2, cli, [
      "pub",
      "publish",
      "--force",
    ]);
  });

  test("Publish with useGithubOidc=false, self-hosted=false", async () => {
    const config = { ...testConfig, useGithubOidc: false, selfHosted: false };
    vi.mocked(getConfig).mockReturnValue(config);
    vi.fn(getPubspec).mockReturnValue(pubspec);
    vi.fn(getConfig).mockReturnValue(config);
    vi.stubEnv(semanticReleasePubToken, googleIdToken);

    const actual = await publish(config, context);

    expect(actual).toEqual({
      name: "pub_package",
      url: `https://pub.dev/packages/pub_package/versions/${version}`,
    });

    expect(process.env[semanticReleasePubToken]).toEqual(googleIdToken);

    expect(getGoogleIdentityToken).toHaveBeenCalledOnce();

    expect(execa).toHaveBeenNthCalledWith(1, cli, [
      "pub",
      "token",
      "add",
      "https://pub.dev",
      `--env-var=${semanticReleasePubToken}`,
    ]);
    expect(execa).toHaveBeenNthCalledWith(2, cli, [
      "pub",
      "publish",
      "--force",
    ]);
  });

  const stubEnv = () => {
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_KEY", serviceAccount);
    vi.stubEnv(semanticReleasePubToken, pubAuth);
  };
});