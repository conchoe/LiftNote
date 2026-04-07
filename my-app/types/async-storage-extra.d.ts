import type { AsyncStorageStatic } from "@react-native-async-storage/async-storage";

declare module "@react-native-async-storage/async-storage" {
  export function createAsyncStorage(databaseName: string): AsyncStorageStatic;
}
