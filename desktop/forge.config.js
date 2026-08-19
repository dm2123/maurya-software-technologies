const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

module.exports = {
  packagerConfig: {
    name: "Maurya-Desktop",
    executableName: "Maurya-Desktop",
    asar: true,
    appBundleId: "tech.mauryasoftware.desktop",
    appCategoryType: "public.app-category.developer-tools"
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "MauryaDesktop",
        authors: "Dinesh Maurya",
        description: "Maurya Desktop for Windows",
        setupExe: "Maurya-Desktop-Setup.exe"
      }
    },
    {
      name: "@reforged/maker-appimage",
      platforms: ["linux"],
      config: {
        options: {
          categories: ["Development"],
          icon: "./assets/icon.svg"
        }
      }
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin", "linux", "win32"]
    },
    {
      name: "@electron-forge/maker-dmg",
      config: {
        name: "Maurya-Desktop",
        format: "ULFO"
      }
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          maintainer: "Dinesh Maurya",
          name: "maurya-desktop",
          productName: "Maurya Desktop"
        }
      }
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {
        options: {
          name: "maurya-desktop",
          productName: "Maurya Desktop"
        }
      }
    }
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {}
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true
    })
  ]
};
