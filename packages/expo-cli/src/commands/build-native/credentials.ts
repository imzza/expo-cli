import { CredentialsSource, Keystore } from '../../credentials/credentials';
import { CredentialsProvider } from '../../credentials/provider';
import { BuilderContext } from './build';
import { Workflow } from './easJson';
import prompts from '../../prompts';
import log from '../../log';

export async function ensureCredentials(
  provider: CredentialsProvider,
  ctx: BuilderContext,
  workflow: Workflow
): Promise<void> {
  const src = ctx.eas.builds.credentialsSource;
  if (src === CredentialsSource.LOCAL) {
    await provider.useLocal();
  } else if (src === CredentialsSource.REMOTE) {
    await provider.useRemote();
  } else if (workflow === Workflow.Managed) {
    if (await provider.hasLocal()) {
      await provider.useLocal();
    } else {
      await provider.useRemote();
    }
  } else if (workflow === Workflow.Generic) {
    const hasLocal = await provider.hasLocal();
    const hasRemote = await provider.hasRemote();
    if (hasRemote && hasLocal) {
      if (!(await provider.isLocalSynced())) {
        log(
          'Content of your local credentials.json is not the same as credentials on Expo servers'
        );
        const { select } = await prompts({
          type: 'select',
          name: 'select',
          message: 'Which credentials you want to use for this build?',
          choices: [
            { title: 'Local credentials.json', value: 'local' },
            { title: 'Credentials stored on Expo servers.', value: 'remote' },
          ],
        });
        if (select === 'local') {
          await provider.useLocal();
        } else {
          await provider.useRemote();
        }
      }
    } else if (hasLocal) {
      await provider.useLocal();
    } else if (hasRemote) {
      await provider.useRemote();
    } else {
      log.warn(
        'Credentials for this app are not configured and there is no credentials.json in the project directory'
      );
      const { confirm } = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: 'Do you want to generete new credentials?',
      });
      if (confirm) {
        await provider.useRemote();
      } else {
        throw new Error('Aborting build process, credentials are not configured');
      }
    }
  }
}
