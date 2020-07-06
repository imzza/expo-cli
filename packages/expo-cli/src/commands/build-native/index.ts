import { Platform } from '@expo/build-tools';
import { ApiV2 } from '@expo/xdl';
import { Command } from 'commander';

import log from '../../log';
import { createBuilderContextAsync, startBuildAsync, waitForBuildEndAsync } from './build';
import { AndroidBuilder } from './android';
import { iOSBuilder } from './ios';
import { CredentialsSource, EasConfig, EasJsonReader } from '../../easJson';
import { printBuildTable } from './utils';

interface Options {
  platform: Platform | 'all';
  skipCredentialsCheck?: boolean;
  wait?: boolean;
  profile: string;
}

async function buildAction(projectDir: string, options: Options): Promise<void> {
  const { platform, profile } = options;
  if (!platform || !['android', 'ios', 'all'].includes(platform)) {
    throw new Error(
      `-p/--platform is required, valid platforms: ${log.chalk.bold('android')}, ${log.chalk.bold(
        'ios'
      )}, ${log.chalk.bold('all')}`
    );
  }
  const easConfig: EasConfig = await new EasJsonReader(projectDir, platform).readAsync(profile);

  const ctx = await createBuilderContextAsync(projectDir, easConfig);
  const client = ApiV2.clientForUser(ctx.user);
  const scheduledBuilds: Array<{ platform: Platform; buildId: string }> = [];

  if ([Platform.Android, 'all'].includes(options.platform)) {
    const builder = new AndroidBuilder(ctx);
    const buildId = await startBuildAsync(client, builder);
    scheduledBuilds.push({ platform: Platform.Android, buildId });
  }
  if ([Platform.iOS, 'all'].includes(options.platform)) {
    const builder = new iOSBuilder(ctx);
    const buildId = await startBuildAsync(client, builder);
    scheduledBuilds.push({ platform: Platform.iOS, buildId });
  }

  if (scheduledBuilds.length === 1) {
    log(`Logs url: ${scheduledBuilds[0].buildId}`); // replace with logs url
  } else {
    scheduledBuilds.forEach(build => {
      log(`Platform: ${build.platform}, Logs url: ${build.buildId}`); // replace with logs url
    });
  }
  if (options.wait) {
    const buildInfo = await waitForBuildEndAsync(
      client,
      ctx.projectId,
      scheduledBuilds.map(i => i.buildId)
    );
    if (buildInfo.length === 1) {
      log(`Artifact url: ${buildInfo[0]?.artifacts?.buildUrl ?? ''}`);
    } else {
      buildInfo.forEach(build => {
        log(`Platform: ${build?.platform}, Artifact url: ${build?.artifacts?.buildUrl ?? ''}`);
      });
    }
  }
}

async function statusAction(projectDir: string): Promise<void> {
  throw new Error('not implemented yet');
}

export default function (program: Command) {
  const buildCmd = program
    .command('build [project-dir]')
    .description(
      'Build an app binary for your project, signed and ready for submission to the Google Play Store.'
    )
    .allowUnknownOption()
    .option('-p --platform <platform>')
    .option('--skip-credentials-check', 'Skip checking credentials', false)
    .option('--no-wait', 'Exit immediately after triggering build.', false)
    .option('--profile <profile>', 'Build profile', 'release')
    .asyncActionProjectDir(buildAction, { checkConfig: true });

  program
    .command('build:status')
    .description(`Get the status of the latest builds for your project.`)
    .asyncActionProjectDir(statusAction, { checkConfig: true });
}
