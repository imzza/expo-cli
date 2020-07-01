import fs from 'fs-extra';

import { EasJsonReader } from '../easJson';

jest.mock('fs-extra');

describe('eas.json', () => {
  it('valid minimal android eas.json', async () => {
    fs.readFile.mockImplementationOnce(() =>
      JSON.stringify({
        android: {
          release: { workflow: 'generic' },
        },
      })
    );

    const reader = new EasJsonReader('./fakedir', { platform: 'android' });
    const easJson = await reader.read('release');
    expect({
      credentialsSource: 'auto',
      android: { workflow: 'generic' },
    }).toEqual(easJson);
  });
  it('valid minimal ios eas.json', async () => {
    fs.readFile.mockImplementationOnce(() =>
      JSON.stringify({
        ios: {
          release: { workflow: 'generic' },
        },
      })
    );

    const reader = new EasJsonReader('./fakedir', { platform: 'ios' });
    const easJson = await reader.read('release');
    expect({
      credentialsSource: 'auto',
      ios: { workflow: 'generic' },
    }).toEqual(easJson);
  });
  it('valid minimal eas.json for both platforms', async () => {
    fs.readFile.mockImplementationOnce(() =>
      JSON.stringify({
        android: {
          release: { workflow: 'generic' },
        },
        ios: {
          release: { workflow: 'generic' },
        },
      })
    );

    const reader = new EasJsonReader('./fakedir', { platform: 'all' });
    const easJson = await reader.read('release');
    expect({
      credentialsSource: 'auto',
      android: { workflow: 'generic' },
      ios: { workflow: 'generic' },
    }).toEqual(easJson);
  });
  it('valid eas.json with both platform, but reading only android', async () => {
    fs.readFile.mockImplementationOnce(() =>
      JSON.stringify({
        ios: {
          release: { workflow: 'generic' },
        },
        android: {
          release: { workflow: 'generic' },
        },
      })
    );

    const reader = new EasJsonReader('./fakedir', { platform: 'android' });
    const easJson = await reader.read('release');
    expect({
      credentialsSource: 'auto',
      android: { workflow: 'generic' },
    }).toEqual(easJson);
  });
  it('valid eas.json for debug builds', async () => {
    fs.readFile.mockImplementationOnce(() =>
      JSON.stringify({
        ios: {
          release: { workflow: 'managed' },
          debug: { workflow: 'managed', buildType: 'simulator' },
        },
        android: {
          release: { workflow: 'generic' },
          debug: {
            workflow: 'generic',
            buildCommand: ':app:assembleDebug',
            withoutCredentials: true,
          },
        },
      })
    );

    const reader = new EasJsonReader('./fakedir', { platform: 'all' });
    const easJson = await reader.read('debug');
    expect({
      credentialsSource: 'auto',
      android: {
        workflow: 'generic',
        buildCommand: ':app:assembleDebug',
        withoutCredentials: true,
      },
      ios: { workflow: 'managed', buildType: 'simulator' },
    }).toEqual(easJson);
  });

  it('invalid eas.json with missing preset', async () => {
    fs.readFile.mockImplementationOnce(() =>
      JSON.stringify({
        android: {
          release: { workflow: 'generic' },
        },
      })
    );

    const reader = new EasJsonReader('./fakedir', { platform: 'android' });
    const promise = reader.read('debug');
    expect(promise).rejects.toThrowError('There is no preset named debug for platform android');
  });

  it('invalid eas.json when using buildType for wrong platform', async () => {
    fs.readFile.mockImplementationOnce(() =>
      JSON.stringify({
        android: {
          release: { workflow: 'managed', buildType: 'archive' },
        },
      })
    );

    const reader = new EasJsonReader('./fakedir', { platform: 'android' });
    const promise = reader.read('release');
    expect(promise).rejects.toThrowError(
      'Object "android.release" in eas.json is not valid [ValidationError: "buildType" must be one of [apk, app-bundle]]'
    );
  });

  it('invalid eas.json when missing workflow', async () => {
    fs.readFile.mockImplementationOnce(() =>
      JSON.stringify({
        android: {
          release: { buildType: 'apk' },
        },
      })
    );

    const reader = new EasJsonReader('./fakedir', { platform: 'android' });
    const promise = reader.read('release');
    expect(promise).rejects.toThrowError(
      'eas.json is not valid [ValidationError: "android.release.workflow" is required]'
    );
  });
});
