import SemanticReleaseError from "@semantic-release/error";
import {execa} from "execa";
import {PluginConfig} from "./types.js";
import {getConfig, getGithubIdentityToken, getGoogleIdentityToken, getPubspec,} from "./utils.js";

export const verifyConditions = async (pluginConfig: PluginConfig) => {
    const {cli} = getConfig(pluginConfig);
    await verifyPublishToken(
        pluginConfig,
    );
    await verifyCommand(cli);
};

const verifyPublishToken = async (config: PluginConfig) => {
    const useGithubOidc = config.useGithubOidc;
    const selfHosted = config.selfHosted;
    const pubspec = getPubspec();
    const pubHost = config.selfHosted ? pubspec.publish_to : "https://pub.dev";

    if (selfHosted) {
        const PUB_AUTH_TOKEN = process.env.PUB_AUTH_TOKEN;
        if (!PUB_AUTH_TOKEN) {
            throw new SemanticReleaseError(
                "Environment variable not found: PUB_AUTH_TOKEN",
            );
        }
    } else if (useGithubOidc) {
        try {
            await getGithubIdentityToken(pubHost);
        } catch (error) {
            throw new SemanticReleaseError(
                `Failed to get GitHub OIDC token: ${error}`,
            );
        }
    } else {
        const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        if (!GOOGLE_SERVICE_ACCOUNT_KEY) {
            throw new SemanticReleaseError(
                "Environment variable not found: GOOGLE_SERVICE_ACCOUNT_KEY",
            );
        } else {
            await getGoogleIdentityToken(pubHost, GOOGLE_SERVICE_ACCOUNT_KEY);
        }
    }
};

const verifyCommand = async (command: string) => {
    try {
        await execa(command);
    } catch (error) {
        throw new SemanticReleaseError(`${command} returned an error: ${error}`);
    }
};
