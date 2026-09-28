# Face-api.js model weights (required for face recognition on tablet)

Place these files in this folder before building the Android APK:

| File prefix | Model |
|-------------|--------|
| `ssd_mobilenetv1_*` | Face detection |
| `face_landmark_68_*` | Landmarks |
| `face_recognition_*` | 128D embeddings |

## Download

From the [face-api.js weights repo](https://github.com/justadudewhohacks/face-api.js/tree/master/weights):

1. Download all files for `ssd_mobilenetv1_model`
2. Download all files for `face_landmark_68_model`
3. Download all files for `face_recognition_model`

Copy the `.bin` shards and `-weights_manifest.json` files into this `init/public/models/` folder.

Vite copies them into the APK at `web_assets/models/`.  
Android `noCompress 'bin'` keeps weights readable.
