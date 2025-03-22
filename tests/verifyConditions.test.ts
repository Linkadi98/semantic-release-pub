import SemanticReleaseError from "@semantic-release/error";
import { execa } from "execa";
import { VerifyConditionsContext } from "semantic-release";
import { Signale } from "signale";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import {
  getConfig,
  getGithubIdentityToken,
  getGoogleIdentityToken, getPubspecString,
} from "../lib/utils.js";
import { PluginConfig, verifyConditions } from "../index.ts";
import {codeBlock} from "common-tags";

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


vi.mock("execa");
vi.mock("google-auth-library");
vi.mock("../lib/utils");

describe("verifyConditions", () => {
  const cli = "dart";
  const serviceAccount = "serviceAccount";
  const idToken = "idToken";
  const pubHost = "https://pub.dev";

  const testConfig: PluginConfig = {
    cli,
    updateBuildNumber: false,
    useGithubOidc: false,
    selfHosted: false,
    publishArgs: ["--force"],
  };

  const logger = mock<Signale>();
  const context = mock<VerifyConditionsContext>();

  beforeEach(() => {
    context.logger = logger;

    vi.mocked(getConfig).mockReturnValue(testConfig);
    vi.mocked(getPubspecString).mockReturnValue(basePubspec);
    vi.mocked(getGoogleIdentityToken).mockResolvedValue(idToken);
    vi.mocked(getGithubIdentityToken).mockResolvedValue(idToken);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test("success", async () => {
    stubEnv();
    await verifyConditions(testConfig);

    expect(execa).toBeCalledWith(cli);
    expectGetGoogleIdentityTokenCalled();
  });

  test("success with useGithubOidc=true", async () => {
    const config = { ...testConfig, useGithubOidc: true };
    vi.mocked(getConfig).mockReturnValue(config);

    await verifyConditions(config);

    expect(getGithubIdentityToken).toBeCalledTimes(1);
    expect(getGoogleIdentityToken).toBeCalledTimes(0);
    expect(execa).toBeCalledWith(cli);
  });

  test("error due to missing environment variable", async () => {
    await expectSemanticReleaseError();

    expect(execa).toBeCalledTimes(0);
    expect(getGoogleIdentityToken).toBeCalledTimes(0);
  });

  test("error due to actions/core getIDToken", async () => {
    const config = { ...testConfig, useGithubOidc: true };
    vi.mocked(getConfig).mockReturnValue(config);
    vi.mocked(getGithubIdentityToken).mockImplementation(() => {
      throw new Error();
    });

    await expectSemanticReleaseError(config);

    expect(execa).toBeCalledTimes(0);
    expect(getGoogleIdentityToken).toBeCalledTimes(0);
  });

  test("error due to execa", async () => {
    stubEnv();
    vi.mocked(execa).mockImplementation(() => {
      throw new Error();
    });

    await expectSemanticReleaseError();

    expect(execa).toBeCalledWith(cli);
    expectGetGoogleIdentityTokenCalled();
  });

  const stubEnv = () =>
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_KEY", serviceAccount);

  const expectGetGoogleIdentityTokenCalled = () =>
    expect(getGoogleIdentityToken).toHaveBeenNthCalledWith(
      1,
      pubHost,
      serviceAccount,
    );

  const expectSemanticReleaseError = async (
    config: PluginConfig = testConfig,
  ) => {
    await expect(() => verifyConditions(config)).rejects.toThrowError(
      SemanticReleaseError,
    );
  };
});
