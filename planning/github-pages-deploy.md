# GitHub Pages Deployment Guide

This project can be published with GitHub Pages using only the GitHub website.

## What gets uploaded

Use the contents of:

`D:\Codex\symptom-tracker\publish`

Upload the contents of that folder, not the folder itself. The repository root must contain `index.html` directly.

Do not upload exported symptom CSV files to GitHub.

## Create the repository

1. Sign in at https://github.com.
2. Click the `+` button, then `New repository`.
3. Repository name suggestion: `simple-symptom-tracker`.
4. Visibility: `Public` is simplest for GitHub Pages. The source code will be public, but your symptom records are not in the repository.
5. Leave `Add a README file` unchecked, because the publish folder already includes one.
6. Click `Create repository`.

## Upload the app files

1. On the new empty repository page, choose `uploading an existing file`.
2. Open `D:\Codex\symptom-tracker\publish` in File Explorer.
3. Select everything inside it, including `.nojekyll`, `assets`, and `icons`.
4. Drag the selected files and folders onto the GitHub upload area.
5. Commit message: `Publish Simple Symptom Tracker 0.3.0`.
6. Click `Commit changes`.

If GitHub does not accept folders through drag-and-drop, tell me and we will switch to GitHub Desktop or install Git.

## Enable GitHub Pages

1. In the repository, open `Settings`.
2. In the left sidebar, open `Pages`.
3. Under `Build and deployment`, set `Source` to `Deploy from a branch`.
4. Set branch to `main` and folder to `/root`.
5. Click `Save`.
6. Wait a minute or two. GitHub will show the site URL near the top of the Pages settings screen.

The URL will look like:

`https://YOUR-USERNAME.github.io/simple-symptom-tracker/`

## Install on iPhone

1. On the iPhone, open the GitHub Pages URL in Safari.
2. Let the app fully load once.
3. Tap Share.
4. Tap `Add to Home Screen`.
5. Confirm the name and tap `Add`.
6. Launch it from the Home Screen icon.
7. Turn on Airplane Mode and launch again to confirm offline loading.

## Updating later

When we make new versions, rebuild the `publish` folder, upload the changed files to the same repository, and GitHub Pages will update the app. The installed iPhone app should fetch the new version once online, then keep it cached offline.
