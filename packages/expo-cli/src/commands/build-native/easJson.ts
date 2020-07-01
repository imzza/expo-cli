import path from 'path';

import Joi from '@hapi/joi';
import { Platform } from '@expo/build-tools';
import fs from 'fs-extra';

import { CredentialsSource } from '../../credentials/credentials';

// Workflow is representing different value than BuildType from @epxo/build-toold
// Each workflow has set of BuildTypes available
// - Generic workflow allows to build 'generic' and 'generic-client'
// - Managed workflow allows to build 'generic' and 'managed-client'
export enum Workflow {
  Generic = 'generic',
  Managed = 'managed',
}

export interface AndroidManagedPreset {
  workflow: Workflow.Managed;
  buildType?: 'app-bundle' | 'apk';
}

export interface AndroidGenericPreset {
  workflow: Workflow.Generic;
  buildCommand?: string;
  artifactPath?: string;
  withoutCredentials?: boolean;
}

export interface iOSManagedPreset {
  workflow: Workflow.Managed;
  buildType?: 'archive' | 'simulator';
}

export interface iOSGenericPreset {
  workflow: Workflow.Generic;
}

export type AndroidPreset = AndroidManagedPreset | AndroidGenericPreset;
export type iOSPreset = iOSManagedPreset | iOSGenericPreset;

interface EasJson {
  builds: {
    credentialsSource: CredentialsSource;
    android?: { [key: string]: AndroidManagedPreset | AndroidGenericPreset };
    ios?: { [key: string]: iOSManagedPreset | iOSGenericPreset };
  };
}

// EasConfig represents eas.json with one specific preset
export interface EasConfig {
  builds: {
    credentialsSource: CredentialsSource;
    android?: AndroidManagedPreset | AndroidGenericPreset;
    ios?: iOSManagedPreset | iOSGenericPreset;
  };
}

const EasJsonSchema = Joi.object({
  builds: Joi.object({
    credentialsSource: Joi.string().valid('local', 'remote', 'auto').default('auto'),
    android: Joi.object().pattern(
      Joi.string(),
      Joi.object({
        workflow: Joi.string().valid('generic', 'managed').required(),
      }).unknown(true)
    ),
    ios: Joi.object().pattern(
      Joi.string(),
      Joi.object({
        workflow: Joi.string().valid('generic', 'managed').required(),
      }).unknown(true)
    ),
  }),
});

const AndroidGenericSchema = Joi.object({
  workflow: Joi.string().valid('generic').required(),
  buildCommand: Joi.string(),
  artifactPath: Joi.string(),
  withoutCredentials: Joi.boolean(),
});

const AndroidManagedSchema = Joi.object({
  workflow: Joi.string().valid('managed').required(),
  buildType: Joi.string().valid('apk', 'app-bundle'),
});

const iOSGenericSchema = Joi.object({
  workflow: Joi.string().valid('generic').required(),
});
const iOSManagedSchema = Joi.object({
  workflow: Joi.string().valid('managed').required(),
  buildType: Joi.string().valid('archive', 'simulator'),
});

const schemaPresetMap: Record<string, Record<string, Joi.Schema>> = {
  android: {
    generic: AndroidGenericSchema,
    managed: AndroidManagedSchema,
  },
  ios: {
    managed: iOSManagedSchema,
    generic: iOSGenericSchema,
  },
};

interface Options {
  platform: 'android' | 'ios' | 'all';
  credentialsSource?: CredentialsSource;
}

export class EasJsonReader {
  constructor(private projectDir: string, private options: Options) {}

  public async read(presetName: string): Promise<EasConfig> {
    const easJson = await this.readFile();

    let androidConfig;
    if ([Platform.Android, 'all'].includes(this.options.platform)) {
      androidConfig = this.validatePreset<AndroidPreset>(
        Platform.Android,
        presetName,
        easJson.builds.android?.[presetName]
      );
    }
    let iosConfig;
    if ([Platform.iOS, 'all'].includes(this.options.platform)) {
      iosConfig = this.validatePreset<iOSPreset>(
        Platform.iOS,
        presetName,
        easJson.builds.ios?.[presetName]
      );
    }
    return {
      builds: {
        credentialsSource:
          this.options.credentialsSource ??
          easJson.builds.credentialsSource ??
          CredentialsSource.AUTO,
        ...(androidConfig ? { android: androidConfig } : {}),
        ...(iosConfig ? { ios: iosConfig } : {}),
      },
    };
  }

  private validatePreset<T>(platform: Options['platform'], presetName: string, preset?: any): T {
    if (!preset) {
      throw new Error(`There is no preset named ${presetName} for platform ${platform}`);
    }
    const schema = schemaPresetMap[platform][preset?.workflow];
    if (!schema) {
      throw new Error('invalid workflow'); // this should be validated earlier
    }
    const { value, error } = schema.validate(preset, {
      stripUnknown: true,
      convert: true,
      abortEarly: false,
    });

    if (error) {
      throw new Error(
        `Object "${platform}.${presetName}" in eas.json is not valid [${error.toString()}]`
      );
    }
    return value;
  }

  private async readFile(): Promise<EasJson> {
    const rawFile = await fs.readFile(path.join(this.projectDir, 'eas.json'), 'utf-8');
    const json = JSON.parse(rawFile);

    const { value, error } = EasJsonSchema.validate(json, {
      abortEarly: false,
    });

    if (error) {
      throw new Error(`eas.json is not valid [${error.toString()}]`);
    }
    return value;
  }
}
