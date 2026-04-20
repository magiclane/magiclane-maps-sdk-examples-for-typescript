# React Native Project

## How to create a project

```bash
npx @react-native-community/cli@latest init hello_world
```
Add magiclane maps sdk react native dependencies:
Edit `package.json` and add the following dependencies:
```json
"dependencies": {
  "@magiclane/maps-sdk-react-native": "0.1.0"
}
```
## Build on Android
```bash
cd hello_world
npx react-native run-android
```
If there is an error related to the Android SDK, make sure you have it installed and that the `ANDROID_HOME` environment variable is set correctly.
 Create a file local.properties in the android folder with the following content:
```properties
sdk.dir=/path/to/your/android/sdk
```
Replace `/path/to/your/android/sdk` with the actual path to your Android SDK.
## Build on iOS
```bashcd hello_world
npx react-native run-ios
```
Make sure you have Xcode installed and that you have the necessary permissions to run on the iOS