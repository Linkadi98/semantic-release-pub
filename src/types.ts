export type PluginConfig = {
  cli: "dart" | "flutter";
  updateBuildNumber: boolean;
  useGithubOidc: boolean;
  selfHosted?: boolean;
  publishArgs?: string[];
};
