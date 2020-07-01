import { BuildType, Job, Platform, iOS, validateJob } from '@expo/build-tools';

import { CredentialsSource, Keystore } from '../../credentials/credentials';
import { Context } from '../../credentials/context';
import { iOSCredentials, iOSCredentialsProvider } from '../../credentials/provider';
import { ensureCredentials } from './credentials';
import { Builder, BuilderContext } from './build';
import { Workflow, iOSGenericPreset, iOSManagedPreset, iOSPreset } from './easJson';

interface CommonJobProperties {
  platform: Platform.iOS;
  projectUrl: string;
  secrets?: {
    provisioningProfileBase64: string;
    distributionCertificate: {
      dataBase64: string;
      password: string;
    };
  };
}

class iOSBuilder implements Builder {
  private credentials?: iOSCredentials;
  private preset: iOSPreset;

  constructor(public readonly ctx: BuilderContext) {
    if (!ctx.eas.builds.ios) {
      throw new Error("missing ios configuration, shouldn't happen");
    }
    this.preset = ctx.eas.builds.ios;
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

  public async ensureCredentials(): Promise<void> {
    if (!this.shouldLoadCredentials()) {
      return;
    }
    const bundleIdentifier = this.ctx.exp?.ios?.bundleIdentifier;
    if (!bundleIdentifier) {
      throw new Error('"expo.ios.bundleIdentifier" field is required in your app.json');
    }
    const provider = new iOSCredentialsProvider(this.ctx.projectDir, {
      projectName: this.ctx.projectName,
      accountName: this.ctx.accountName,
      bundleIdentifier,
    });
    await provider.init();
    await ensureCredentials(provider, this.ctx, this.preset.workflow);
    this.credentials = await provider.getCredentials();
  }

  private async prepareJobCommon(archiveUrl: string): Promise<Partial<CommonJobProperties>> {
    const secrets = this.credentials
      ? {
          secrets: {
            provisioningProfileBase64: this.credentials.provisioningProfile,
            distributionCertificate: {
              dataBase64: this.credentials.distributionCertificate.certP12,
              password: this.credentials.distributionCertificate.certPassword,
            },
          },
        }
      : {};

    return {
      platform: Platform.iOS,
      projectUrl: archiveUrl,
      ...secrets,
    };
  }

  private async prepareGenericJob(
    archiveUrl: string,
    preset: iOSGenericPreset
  ): Promise<Partial<iOS.GenericJob>> {
    return {
      ...(await this.prepareJobCommon(archiveUrl)),
      type: BuildType.Generic,
    };
  }

  private async prepareManagedJob(
    archiveUrl: string,
    preset: iOSManagedPreset
  ): Promise<Partial<iOS.ManagedJob>> {
    return {
      ...(await this.prepareJobCommon(archiveUrl)),
      type: BuildType.Managed,
      packageJson: 'packageJson',
      manifest: 'manifest',
    };
  }

  private shouldLoadCredentials(): boolean {
    return !!(
      (this.preset.workflow === Workflow.Managed && this.preset.buildType === 'archive') ||
      this.preset.workflow === Workflow.Generic
    );
  }
}

export { iOSBuilder };
