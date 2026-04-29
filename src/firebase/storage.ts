import { getStorage } from "firebase/storage";
import { firebaseApp } from "./app";

export const storage = getStorage(firebaseApp);
