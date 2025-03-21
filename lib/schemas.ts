import { z } from "zod";

export const ServiceAccount = z.object({
  client_email: z.string(),
  private_key: z.string(),
});

export type ServiceAccount = z.infer<typeof ServiceAccount>;

export const Pubspec = z.object({ name: z.string(), version: z.string(), publish_to: z.string().optional(), homepage: z.string().optional() });

export type Pubspec = z.infer<typeof Pubspec>;
