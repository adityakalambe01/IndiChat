const { withMainApplication, withDangerousMod, withPodfile } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withAudioRoute(config) {
  // 1. Ensure Kotlin source files are present in the Android source directory
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const srcDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        'com',
        'indichat',
        'app'
      );
      if (!fs.existsSync(srcDir)) {
        fs.mkdirSync(srcDir, { recursive: true });
      }

      const files = ['AudioRouteModule.kt', 'AudioRoutePackage.kt'];
      for (const file of files) {
        const srcFile = path.join(__dirname, file);
        const destFile = path.join(srcDir, file);
        if (fs.existsSync(srcFile) && !fs.existsSync(destFile)) {
          fs.copyFileSync(srcFile, destFile);
        }
      }
      return cfg;
    },
  ]);

  // 2. Ensure AudioRoutePackage is registered in MainApplication.kt
  config = withMainApplication(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (!contents.includes('AudioRoutePackage()')) {
      if (contents.includes('PackageList(this).packages.apply {')) {
        contents = contents.replace(
          'PackageList(this).packages.apply {',
          'PackageList(this).packages.apply {\n          add(AudioRoutePackage())'
        );
      } else if (contents.includes('PackageList(this).packages')) {
        contents = contents.replace(
          'PackageList(this).packages',
          'PackageList(this).packages.apply {\n          add(AudioRoutePackage())\n        }'
        );
      }
      cfg.modResults.contents = contents;
    }
    return cfg;
  });

  config = withPodfile(config, (cfg) => {
    if (!cfg.modResults.contents.includes("pod 'IndiChatAudioRoute'")) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /target '([^']+)' do/,
        "$&\n  pod 'IndiChatAudioRoute', :path => '../native/audio-route'"
      );
    }
    return cfg;
  });
  return config;
}

module.exports = withAudioRoute;

