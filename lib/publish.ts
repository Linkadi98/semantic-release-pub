import { execa } from "execa";
import { PublishContext } from "semantic-release";
import { Signale } from "signale";
import { PluginConfig } from "./types.js";
import {
  getConfig,
  getGithubIdentityToken,
  getGoogleIdentityToken,
  getPubspec,
} from "./utils.js";

import { execSync } from "child_process";

const PUB_AUTH_TOKEN = "PUB_AUTH_TOKEN";

export const publish = async (
  pluginConfig: PluginConfig,
  { nextRelease: { version }, logger, branch }: PublishContext,
) => {
  const config = getConfig(pluginConfig);
  const { cli, publishArgs } = config;

  const pubspec = getPubspec();
  const pubHost = pluginConfig.selfHosted ? pubspec.publish_to : "https://pub.dev";
  const pubToken = await getPubToken(config, logger, pubHost);

  await setPubToken(cli, pubToken, pubHost);

  logger.log(`Publishing version ${version} to ${pubHost}`);
  await execa(cli, ["pub", "publish", ...(publishArgs || [])]);
  logger.log(`Published ${pubspec.name}@${version} on ${pubHost}`);

  const packageUrl = `${pubHost}/packages/${pubspec.name}/versions/${version}`;

  try {
    execSync('git add pubspec.yaml');
    execSync(`git commit -m "chore(release): update pubspec.yaml to ${version} [skip ci]"`);
    execSync(`git push origin ${branch.name}`);
    logger.log('Successfully committed pubspec.yaml changes.');
  } catch (error) {
    logger.error('Error committing pubspec.yaml changes:', error);
    throw error;
  }

  return {
    name: pubspec.name,
    url: packageUrl,
  };
};

const getPubToken = async (config: PluginConfig, logger: Signale, pubHost: string) => {
  if (config.selfHosted) {
    logger.log(`Using self-hosted pub token to publish to ${pubHost}`);
    return process.env[PUB_AUTH_TOKEN];
  }

  if (config.useGithubOidc) {
    logger.log(`Using GitHub OIDC token to publish to ${pubHost}`);
    return await getGithubIdentityToken(pubHost);
  }

  logger.log(`Using Google identity token to publish to ${pubHost}`);
  return await getGoogleIdentityToken(pubHost, process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
};

const setPubToken = async (cli: string, idToken: string, pubHost: string) => {
  process.env[PUB_AUTH_TOKEN] = idToken;

  await execa(cli, [
    "pub",
    "token",
    "add",
    pubHost,
    `--env-var=${PUB_AUTH_TOKEN}`,
  ]);
};