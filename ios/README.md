# Ta-do for iOS

Native SwiftUI app — same Supabase project as the web app. Plan and milestones: `docs/checklist.md` → Phase 2.

## Setup
1. Xcode (Mac App Store) with the iOS platform, then `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
2. `brew install xcodegen`
3. `./scripts/write-secrets.sh` — writes the git-ignored `TaDo/Config/Secrets.swift` from `../.env.local`
4. `xcodegen` — generates the git-ignored `TaDo.xcodeproj` from `project.yml` (re-run after adding/removing files or changing `project.yml`)
5. Open `TaDo.xcodeproj`, pick a simulator, Run

Supabase must allow `tado://auth-callback` under Authentication → URL Configuration → Redirect URLs, or sign-in can't return to the app.
