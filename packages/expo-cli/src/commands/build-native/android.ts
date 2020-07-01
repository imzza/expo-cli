import { Android, BuildType, Job, Platform, validateJob } from '@expo/build-tools';

import { CredentialsSource, Keystore } from '../../credentials/credentials';
import { ensureCredentials } from './credentials';
import { credentialsJson } from '../../credentials/local';
import { AndroidCredentials, AndroidCredentialsProvider } from '../../credentials/provider';
import prompt from '../../prompts';
import { Builder, BuilderContext } from './build';
import { AndroidGenericPreset, AndroidManagedPreset, AndroidPreset, Workflow } from './easJson';

interface CommonJobProperties {
  platform: Platform.Android;
  projectUrl: string;
  secrets?: {
    keystore: Android.Keystore;
  };
}

class AndroidBuilder implements Builder {
  private credentials?: AndroidCredentials;
  private preset: AndroidPreset;

  constructor(public readonly ctx: BuilderContext) {
    if (!ctx.eas.builds.android) {
      throw new Error("missing android configuration, shouldn't happen");
    }
    this.preset = ctx.eas.builds.android;
  }

  public async ensureCredentials(): Promise<void> {
    if (!this.shouldLoadCredentials()) {
      return;
    }
    const provider = new AndroidCredentialsProvider(this.ctx.projectDir, {
      projectName: this.ctx.projectName,
      accountName: this.ctx.accountName,
    });
    await provider.init();
    await ensureCredentials(provider, this.ctx, this.preset.workflow);
    this.credentials = await provider.getCredentials();
  }

  public async prepareJob(archiveUrl: string): Promise<Job> {
    if (this.preset.workflow === Workflow.Generic) {
      return validateJob(await this.prepareGenericJob(archiveUrl, this.preset));
    } else if (this.preset.workflow === Workflow.Managed) {
      return validateJob(await this.prepareManagedJob(archiveUrl, this.preset));
    } else {
      throw new Error("Unknown workflow. Shouldn't happen");
    }
  }

  private async prepareJobCommon(archiveUrl: string): Promise<Partial<CommonJobProperties>> {
    const secrets = this.credentials
      ? {
          secrets: {
            keystore: {
              dataBase64: this.credentials.keystore.keystore,
              keystorePassword: this.credentials.keystore.keystorePassword,
              keyAlias: this.credentials.keystore.keyAlias,
              keyPassword: this.credentials.keystore.keyPassword,
            },
          },
        }
      : {};

    return {
      platform: Platform.Android,
      projectUrl: archiveUrl,
      ...secrets,
    };
  }

  private async prepareGenericJob(
    archiveUrl: string,
    preset: AndroidGenericPreset
  ): Promise<Partial<Android.GenericJob>> {
    return {
      ...(await this.prepareJobCommon(archiveUrl)),
      type: BuildType.Generic,
      gradleCommand: preset.buildCommand,
      artifactPath: preset.artifactPath,
    };
  }

  private async prepareManagedJob(
    archiveUrl: string,
    preset: AndroidManagedPreset
  ): Promise<Partial<Android.ManagedJob>> {
    return {
      ...(await this.prepareJobCommon(archiveUrl)),
      type: BuildType.Managed,
      packageJson: 'packageJson',
      manifest: 'manifest',
    };
  }

  private shouldLoadCredentials(): boolean {
    return !!(
      this.preset.workflow === Workflow.Managed ||
      (this.preset.workflow === Workflow.Generic && !this.preset.withoutCredentials)
    );
  }

  //
  //    const keystore = await ctx.android.fetchKeystore(experienceName);
  //    await this.readCredentialsJson();
  //
  //    if (this.options.clearCredentials) {
  //      if (this.options.parent?.nonInteractive) {
  //        throw new BuildError(
  //          'Clearing your Android build credentials from our build servers is a PERMANENT and IRREVERSIBLE action, it\'s not supported when combined with the "--non-interactive" option'
  //        );
  //      }
  //      await runCredentialsManager(ctx, new RemoveKeystore(experienceName));
  //    }
  //
  //    const paramKeystore = await getKeystoreFromParams(this.options);
  //    if (paramKeystore) {
  //      await useKeystore(ctx, experienceName, paramKeystore);
  //    } else {
  //         }
  //
  //  }
  //
  //  async prepareRemote() {
  //    const ctx = new Context();
  //    await ctx.init(this.projectDir);
  //    const experienceName = `@${ctx.manifest.owner || ctx.user.username}/${ctx.manifest.slug}`;
  //
  //    await runCredentialsManager(
  //      ctx,
  //      new SetupAndroidKeystore(experienceName, {
  //        nonInteractive: this.options.parent?.nonInteractive,
  //      })
  //    );
  //
  //  }
  //
  //  async readLocal() {
  //    const credJson = credentialsJson.read(this.projectDir)
  //
  //  }
}

export { AndroidBuilder };
