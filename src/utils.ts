import core from "@actions/core";
import SemanticReleaseError from "@semantic-release/error";
import { readFileSync } from "fs";
import { JWT } from "google-auth-library";
import { parse } from "yaml";
import { Pubspec, ServiceAccount } from "./schemas.js";
import { PluginConfig } from "./types.js";
import { log } from "console";

export const PUBSPEC_PATH = "pubspec.yaml";
const DEFAULT_CONFIG: PluginConfig = {
  cli: "dart",
  updateBuildNumber: false,
  useGithubOidc: false,
};

export const getPubHost = (pubspec: Pubspec): string => {
  return pubspec.publish_to || "https://pub.dev";
};

export const isSelfHosted = (): boolean => {
  const publishTo = getPubspec().publish_to;
  return publishTo !== undefined && publishTo !== "https://pub.dev" && publishTo !== "none";
}

export const getConfig = (config: PluginConfig): PluginConfig => {
  return { ...DEFAULT_CONFIG, ...config };
};

export const getGoogleIdentityToken = async (pubHost: string, serviceAccountStr: string) => {
  const serviceAccountJson = getServiceAccount(serviceAccountStr);
  const jwtClient = new JWT(
    serviceAccountJson.client_email,
    undefined,
    serviceAccountJson.private_key,
    pubHost,
  );

  const creds = await jwtClient.authorize();
  if (!creds.id_token) {
    throw new SemanticReleaseError(
      "Failed to retrieve identity token from Google",
    );
  }

  return creds.id_token;
};

export const getGithubIdentityToken = async (pubHost: string, ) => {
  return core.getIDToken(pubHost);
};

export const getPubspecString = () => {
  return readFileSync(PUBSPEC_PATH, "utf-8");
};

export const getPubspecFromString = (data: string) => {
  return Pubspec.parse(parse(data));
};

export const getPubspec = () => {
  const data = getPubspecString();
  return getPubspecFromString(data);
};

const getServiceAccount = (serviceAccountStr: string) => {
  try {
    return ServiceAccount.parse(JSON.parse(serviceAccountStr));
  } catch (error) {
    throw new SemanticReleaseError(`Invalid service account: ${error}`);
  }
};
