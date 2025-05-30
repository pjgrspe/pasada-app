"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.firestore = exports.auth = void 0;
// Import the functions you need from the SDKs you need
const app_1 = require("firebase/app");
const auth_1 = require("firebase/auth");
const firestore_1 = require("firebase/firestore");
const async_storage_1 = require("@react-native-async-storage/async-storage");
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// API Keys import
const APIkeys_1 = require("./APIkeys");
// Initialize Firebase
const app = (0, app_1.initializeApp)(APIkeys_1.firebaseConfig);
// Initialize Firebase Auth
exports.auth = (0, auth_1.initializeAuth)(app, {
    persistence: (0, auth_1.getReactNativePersistence)(async_storage_1.default)
});
// Initialize Firestore
exports.firestore = (0, firestore_1.getFirestore)(app);
