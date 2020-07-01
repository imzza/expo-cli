import { SetupIosProvisioningProfile } from '../views/SetupIosProvisioningProfile';
import { SetupIosDist } from '../views/SetupIosDist';
import { runCredentialsManager } from '../route';
import { Context } from '../context';
import { credentialsJson } from '../local';
import { CredentialsProvider } from './provider';

export interface iOSCredentials {
  provisioningProfile: string;
  distributionCertificate: {
    certP12: string;
    certPassword: string;
  };
}

interface Options {
  projectName: string;
  accountName: string;
  bundleIdentifier: string;
}

export class iOSCredentialsProvider implements CredentialsProvider {
  public readonly platform = 'ios';
  private readonly ctx = new Context();
  private credentials?: iOSCredentials;

  constructor(private projectDir: string, private options: Options) {}

  get projectFullName(): string {
    const { projectName, accountName } = this.options;
    return `@${accountName}/${projectName}`;
  }

  public async init() {
    await this.ctx.init(this.projectDir);
  }

  public async hasRemote(): Promise<boolean> {
    const distCert = await this.ctx.ios.getDistCert(
      this.projectFullName,
      this.options.bundleIdentifier
    );
    const provisioningProfile = await this.ctx.ios.getProvisioningProfile(
      this.projectFullName,
      this.options.bundleIdentifier
    );
    return !!(distCert && provisioningProfile);
  }

  public async hasLocal(): Promise<boolean> {
    if (!(await credentialsJson.exists(this.projectDir))) {
      return false;
    }
    try {
      await credentialsJson.readAndroid(this.projectDir);
      return true;
    } catch (_) {
      return false;
    }
  }

  public async useRemote(): Promise<void> {
    await runCredentialsManager(
      this.ctx,
      new SetupIosDist({
        experienceName: this.projectFullName,
        bundleIdentifier: this.options.bundleIdentifier,
      })
    );
    const distCert = await this.ctx.ios.getDistCert(
      this.projectFullName,
      this.options.bundleIdentifier
    );
    if (!distCert) {
      throw new Error('Missing distribution certificate'); // shouldn't happen
    }
    await runCredentialsManager(
      this.ctx,
      new SetupIosProvisioningProfile({
        experienceName: this.projectFullName,
        bundleIdentifier: this.options.bundleIdentifier,
        distCert,
      })
    );
    this.credentials = await this.getRemote();
  }
  public async useLocal(): Promise<void> {
    this.credentials = await this.getLocal();
  }
  public async isLocalSynced(): Promise<boolean> {
    const [remote, local] = await Promise.allSettled([this.getRemote(), this.getLocal()]);
    if (remote.status === 'fulfilled' && local.status === 'fulfilled') {
      const r = remote.value;
      const l = local.value;
      return !!(
        r.provisioningProfile === l.provisioningProfile &&
        r.distributionCertificate.certP12 === l.distributionCertificate.certP12 &&
        r.distributionCertificate.certPassword === l.distributionCertificate.certPassword
      );
    }
    return true;
  }
  public async getCredentials(): Promise<iOSCredentials> {
    if (!this.credentials) {
      throw new Error('credentials not specified'); // shouldn't happen
    }
    return this.credentials;
  }
  private async getLocal(): Promise<iOSCredentials> {
    return await credentialsJson.readIos(this.projectDir);
  }
  private async getRemote(): Promise<iOSCredentials> {
    const distCert = await this.ctx.ios.getDistCert(
      this.projectFullName,
      this.options.bundleIdentifier
    );
    if (!distCert) {
      throw new Error('Missing distribution certificate'); // shouldn't happen
    }
    const provisioningProfile = await this.ctx.ios.getProvisioningProfile(
      this.projectFullName,
      this.options.bundleIdentifier
    );
    if (!provisioningProfile) {
      throw new Error('Missing provisioning profile'); // shouldn't happen
    }
    return {
      provisioningProfile: provisioningProfile.provisioningProfile,
      distributionCertificate: {
        certP12: distCert.certP12,
        certPassword: distCert.certPassword,
      },
    };
  }
}
