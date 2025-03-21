import core from "@actions/core";
import SemanticReleaseError from "@semantic-release/error";
import { codeBlock } from "common-tags";
import { readFileSync } from "fs";
import { Credentials, JWT } from "google-auth-library";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import { parse } from "yaml";
import {
  getConfig,
  getGithubIdentityToken,
  getGoogleIdentityToken,
  getPubspec,
  getPubspecFromString,
  getPubspecString,
} from "../src/utils";
import { PluginConfig } from "../src";

vi.mock("@actions/core");
vi.mock("google-auth-library");
vi.mock("fs");
vi.mock("yaml");

const pubHost = "https://pub.dev";

describe("getConfig", () => {
  const config: PluginConfig = {
    cli: "flutter",
    updateBuildNumber: false,
    useGithubOidc: false,
    selfHosted: false,
  };

  test("success", () => {
    expect(getConfig(config)).toEqual(config);
  });
});

describe("getGoogleIdentityToken", () => {
  const idToken = "idToken";
  const clientEmail = "clientEmail";
  const privateKey = "privateKey";

  const creds = mock<Credentials>();

  const serviceAccount = codeBlock`
    {
      "client_email": "${clientEmail}",
      "private_key": "${privateKey}"
    }
  `;

  beforeEach(() => {
    stubEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("success", async () => {
    creds.id_token = idToken;
    const authorize = vi.fn().mockResolvedValue(creds);
    const jwtClient = mock<JWT>({ authorize });
    vi.mocked(JWT).mockReturnValue(jwtClient);

    const actual = await getGoogleIdentityToken(pubHost, serviceAccount);

    expect(actual).toEqual(idToken);
    expectJwtCalled();
    expect(authorize).toBeCalledTimes(1);
  });

  test("error due to invalid service account", async () => {
    await expect(() =>
      getGoogleIdentityToken("clearlyInvalid"),
    ).rejects.toThrowError(SemanticReleaseError);
    expect(JWT).toBeCalledTimes(0);
  });

  test("error due to missing id token", async () => {
    creds.id_token = null;
    const authorize = vi.fn().mockResolvedValue(creds);
    const jwtClient = mock<JWT>({ authorize });
    vi.mocked(JWT).mockReturnValue(jwtClient);

    await expect(() =>
      getGoogleIdentityToken(pubHost, serviceAccount),
    ).rejects.toThrowError(SemanticReleaseError);

    expectJwtCalled();
    expect(authorize).toBeCalledTimes(1);
  });

  const expectJwtCalled = () => {
    expect(JWT).toHaveBeenNthCalledWith(
      1,
      clientEmail,
      undefined,
      privateKey,
      pubHost,
    );
  };

  const stubEnv = () => {
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_KEY", serviceAccount);
  };
});

describe("getGithubIdentityToken", () => {
  const idToken = "idToken";

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("success", async () => {
    vi.mocked(core.getIDToken).mockResolvedValue(idToken);

    const actual = await getGithubIdentityToken(pubHost);

    expect(actual).toEqual(idToken);
    expect(core.getIDToken).toHaveBeenNthCalledWith(1, pubHost);
  });
});

describe("pubspecUtils", () => {
  const pubspecPath = "pubspec.yaml";
  const fileContent = "fileContent";
  const pubspec = {
    name: "pub_package",
    version: "1.0.0",
    publish_to: "https://pub.dev",
    homepage: "https://pub.dev",
  };

  beforeEach(() => {
    vi.mocked(readFileSync).mockReturnValue(fileContent);
    vi.mocked(parse).mockReturnValue(pubspec);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getPubspecString", () => {
    test("success", () => {
      const actual = getPubspecString();

      expect(actual).toEqual(fileContent);
      expectReadFileCalled();
    });
  });

  describe("getPubspecFromString", () => {
    test("success", () => {
      const actual = getPubspecFromString(fileContent);

      expect(actual).toEqual(pubspec);
      expectYamlParseCalled();
    });
  });

  describe("getPubspec", () => {
    test("success", () => {
      const actual = getPubspec();

      expect(actual).toEqual(pubspec);
      expectReadFileCalled();
      expectYamlParseCalled();
    });
  });

  const expectReadFileCalled = () => {
    expect(readFileSync).toHaveBeenNthCalledWith(1, pubspecPath, "utf-8");
  };

  const expectYamlParseCalled = () => {
    expect(parse).toHaveBeenNthCalledWith(1, fileContent);
  };
});
